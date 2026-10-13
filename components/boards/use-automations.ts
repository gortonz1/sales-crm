"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { runAutomations } from "@/app/(app)/boards/automation-actions";
import {
  AUTOMATION_NAME_MAX,
  JOBS_SHOWN,
  MAX_RUN_ROUNDS,
  defaultAutomationName,
  isOpen,
  pendingCells,
  sortJobs,
  type Automation,
  type AutomationJob,
} from "@/lib/automations";
import type { BoardColumn } from "@/lib/columns";
import { createClient } from "@/lib/supabase/client";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";

export type AutomationsApi = ReturnType<typeof useAutomations>;

export type NewAutomation = {
  triggerColumnId: string;
  fields: string[];
  overwrite: boolean;
  name?: string;
};

function keepRecent(jobs: AutomationJob[]) {
  const sorted = sortJobs(jobs);
  const open = sorted.filter(isOpen);
  const closed = sorted.filter((job) => !isOpen(job)).slice(0, JOBS_SHOWN);
  return sortJobs([...open, ...closed]);
}

export function useAutomations({
  boardId,
  columns,
  initialAutomations,
  initialJobs,
  onItemCustom,
}: {
  boardId: string;
  columns: BoardColumn[];
  initialAutomations: Automation[];
  initialJobs: AutomationJob[];
  onItemCustom: (itemId: string, custom: Json) => void;
}) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [jobs, setJobs] = useState(() => keepRecent(initialJobs));
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const onItemCustomRef = useRef(onItemCustom);
  useEffect(() => {
    onItemCustomRef.current = onItemCustom;
  }, [onItemCustom]);
  const kicking = useRef(false);
  const kickAgain = useRef(false);
  const handled = useRef(new Set<string>());

  const upsertJob = useCallback((job: AutomationJob) => {
    setJobs((current) =>
      keepRecent([...current.filter((entry) => entry.id !== job.id), job]),
    );
  }, []);

  const kick = useCallback(async () => {
    if (kicking.current) {
      kickAgain.current = true;
      return;
    }
    kicking.current = true;
    setRunning(true);
    try {
      for (let round = 0; round < MAX_RUN_ROUNDS; round += 1) {
        const outcome = await runAutomations(boardId);
        if (outcome.error) {
          setError(outcome.error);
          break;
        }
        const finishedAt = new Date().toISOString();
        for (const job of outcome.processed) {
          handled.current.add(job.jobId);
          if (job.ok && job.custom !== null)
            onItemCustomRef.current(job.itemId, job.custom);
        }
        setJobs((current) =>
          current.map((job) => {
            const done = outcome.processed.find(
              (entry) => entry.jobId === job.id,
            );
            return done
              ? {
                  ...job,
                  status: done.ok ? "done" : "failed",
                  error: done.error,
                  result: done.result,
                  finished_at: finishedAt,
                }
              : job;
          }),
        );
        if (!outcome.processed.length || outcome.remaining === 0) break;
      }
    } finally {
      kicking.current = false;
      setRunning(false);
      if (kickAgain.current) {
        kickAgain.current = false;
        void kick();
      }
    }
  }, [boardId]);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (initialJobs.some(isOpen)) void kick();
  }, [initialJobs, kick]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`automation-jobs:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automation_jobs",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<AutomationJob>) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old.id;
            if (id)
              setJobs((current) => current.filter((job) => job.id !== id));
            return;
          }
          const job = payload.new;
          if (handled.current.has(job.id) && isOpen(job)) return;
          upsertJob(job);
          if (job.status !== "done" || handled.current.has(job.id)) return;
          handled.current.add(job.id);
          supabase
            .from("board_items")
            .select("custom")
            .eq("id", job.item_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) onItemCustomRef.current(job.item_id, data.custom);
            });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, upsertJob]);

  async function add(draft: NewAutomation) {
    setError(null);
    const name = (
      draft.name?.trim() ||
      defaultAutomationName(columns, draft.triggerColumnId, draft.fields)
    ).slice(0, AUTOMATION_NAME_MAX);
    const { data, error } = await createClient()
      .from("automations")
      .insert({
        board_id: boardId,
        name,
        trigger: "file_added",
        trigger_column_id: draft.triggerColumnId,
        action: "ai_extract",
        config: { fields: draft.fields, overwrite: draft.overwrite },
      })
      .select()
      .single();
    if (error || !data) {
      setError(
        `Couldn't add the automation: ${error?.message ?? "no response"}`,
      );
      return null;
    }
    setAutomations((current) => [...current, data]);
    return data;
  }

  async function update(id: string, patch: TablesUpdate<"automations">) {
    const previous = automations;
    setError(null);
    setAutomations((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
    const { error } = await createClient()
      .from("automations")
      .update(patch)
      .eq("id", id);
    if (error) {
      setAutomations(previous);
      setError(`Couldn't change the automation: ${error.message}`);
      return false;
    }
    return true;
  }

  async function remove(id: string) {
    const previous = automations;
    setError(null);
    setAutomations((current) => current.filter((entry) => entry.id !== id));
    const { error } = await createClient()
      .from("automations")
      .delete()
      .eq("id", id);
    if (error) {
      setAutomations(previous);
      setError(`Couldn't delete the automation: ${error.message}`);
      return false;
    }
    setJobs((current) => current.filter((job) => job.automation_id !== id));
    return true;
  }

  async function runOnExisting(id: string) {
    setError(null);
    const { data, error } = await createClient().rpc("queue_automation", {
      automation_id: id,
    });
    if (error) {
      setError(`Couldn't queue the items: ${error.message}`);
      return null;
    }
    if (data && data > 0) void kick();
    return data ?? 0;
  }

  async function retry(jobId: string) {
    setError(null);
    const { error } = await createClient().rpc("requeue_automation_job", {
      job_id: jobId,
    });
    if (error) {
      setError(`Couldn't retry: ${error.message}`);
      return;
    }
    handled.current.delete(jobId);
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? { ...job, status: "queued", error: null, result: null }
          : job,
      ),
    );
    void kick();
  }

  const pending = useMemo(
    () => pendingCells(jobs, automations),
    [jobs, automations],
  );
  const openCount = useMemo(() => jobs.filter(isOpen).length, [jobs]);

  return {
    automations,
    jobs,
    error,
    running,
    openCount,
    clearError: () => setError(null),
    add,
    update,
    remove,
    runOnExisting,
    retry,
    kick,
    pendingLabel: (itemId: string, columnId: string) =>
      pending.get(itemId)?.has(columnId) ? "Extracting…" : null,
  };
}

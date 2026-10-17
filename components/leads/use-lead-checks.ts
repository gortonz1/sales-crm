"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runLeadChecks } from "@/app/(app)/leads/actions";
import { isCheckOpen, type Lead } from "@/lib/leads";

const POLL_MS = 4000;
const MAX_POLLS = 20;

export function useLeadChecks(
  leads: Lead[],
  onChecked: (updated: Lead[]) => void,
) {
  const [error, setError] = useState<string | null>(null);
  const onCheckedRef = useRef(onChecked);
  useEffect(() => {
    onCheckedRef.current = onChecked;
  }, [onChecked]);
  const key = useMemo(
    () =>
      leads
        .filter(isCheckOpen)
        .map((lead) => lead.id)
        .join(","),
    [leads],
  );

  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function run(poll: number) {
      let outcome: Awaited<ReturnType<typeof runLeadChecks>>;
      try {
        outcome = await runLeadChecks(ids);
      } catch {
        outcome = {
          leads: [],
          checked: 0,
          remaining: 0,
          error: "Couldn't reach the server to run the AI checks.",
        };
      }
      if (cancelled) return;
      setError(outcome.error ?? null);
      if (outcome.error) return;
      if (outcome.leads.length) onCheckedRef.current(outcome.leads);
      if (poll < MAX_POLLS)
        timer = setTimeout(() => run(poll + 1), outcome.checked ? 0 : POLL_MS);
    }
    run(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  return error;
}

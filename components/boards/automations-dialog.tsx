"use client";

import { useEffect, useState, type FormEvent } from "react";
import { automationsReady } from "@/app/(app)/boards/automation-actions";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import { Input } from "@/components/_ui/input";
import { Label } from "@/components/_ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import Tag from "@/components/_ui/tag";
import {
  AUTOMATION_NAME_MAX,
  canExtractInto,
  defaultAutomationName,
  describeAction,
  describeTrigger,
  jobAgo,
  jobFile,
  jobStatus,
  summariseOutcome,
  type Automation,
  type AutomationJob,
  type JobStatus,
} from "@/lib/automations";
import type { BoardColumn } from "@/lib/columns";
import { cn } from "@/lib/utils";
import type { AutomationsApi } from "./use-automations";

const STATUS: Record<
  JobStatus,
  { label: string; tone: "neutral" | "blue" | "green" | "red" }
> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "blue" },
  done: { label: "Done", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

export default function AutomationsDialog({
  open,
  onOpenChange,
  api,
  columns,
  canEdit,
  boardName,
  itemName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: AutomationsApi;
  columns: BoardColumn[];
  canEdit: boolean;
  boardName: string;
  itemName: (id: string) => string | null;
}) {
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    automationsReady().then((ready) => {
      if (!cancelled) setAiReady(ready.ai);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[44em]">
        <DialogHeader>
          <DialogTitle>Automations</DialogTitle>
          <DialogDescription>
            Rules that run on {boardName} when something changes. For now: when
            a file is added to a column, AI reads it and fills in other columns
            on that row.
          </DialogDescription>
        </DialogHeader>
        {aiReady === false && (
          <p
            role="alert"
            className="caption-style text-warning border-line-strong border-b px-6 py-3 leading-[1.4]"
          >
            AI extraction isn&apos;t set up on the server yet. Add
            ANTHROPIC_API_KEY to the app&apos;s environment and redeploy. Rules
            can still be created; their runs will fail until then.
          </p>
        )}
        {canEdit && <NewAutomation api={api} columns={columns} />}
        <AutomationList
          api={api}
          columns={columns}
          canEdit={canEdit}
          itemName={itemName}
        />
        {api.error && (
          <p
            role="alert"
            className="caption-style text-danger border-line-strong border-t px-6 py-3"
          >
            {api.error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary" size="sm">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewAutomation({
  api,
  columns,
}: {
  api: AutomationsApi;
  columns: BoardColumn[];
}) {
  const fileColumns = columns.filter((column) => column.type === "file");
  const [triggerColumnId, setTriggerColumnId] = useState(
    fileColumns[0]?.id ?? "",
  );
  const [fields, setFields] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const trigger =
    fileColumns.find((column) => column.id === triggerColumnId) ??
    fileColumns[0] ??
    null;
  const targets = columns.filter(
    (column) => canExtractInto(column) && column.id !== trigger?.id,
  );
  const placeholder = trigger
    ? defaultAutomationName(columns, trigger.id, fields)
    : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (adding || !trigger) return;
    if (!fields.length) {
      setProblem("Tick at least one column to fill.");
      return;
    }
    setProblem(null);
    setAdding(true);
    const added = await api.add({
      triggerColumnId: trigger.id,
      fields,
      overwrite,
      name: name.trim() || undefined,
    });
    setAdding(false);
    if (added) {
      setFields([]);
      setName("");
      setOverwrite(false);
    }
  }

  if (!fileColumns.length) {
    return (
      <p className="text-soft border-line-strong border-b px-6 py-4 leading-[1.4]">
        Add a Files column first (Columns → Files), then come back here to read
        what&apos;s uploaded into it.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="border-line-strong flex flex-col gap-4 border-b px-6 py-5"
    >
      <h3 className="h2-style">New automation</h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="lead-style text-soft shrink-0">
          When a file is added to
        </span>
        <Select
          value={trigger?.id ?? ""}
          onValueChange={(value) => {
            setTriggerColumnId(value);
            setFields((current) => current.filter((id) => id !== value));
          }}
        >
          <SelectTrigger
            aria-label="File column that starts the automation"
            className="sm:w-[14em]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fileColumns.map((column) => (
              <SelectItem key={column.id} value={column.id}>
                {column.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <span className="lead-style text-soft">
          extract with AI into these columns
        </span>
        {targets.length === 0 ? (
          <p className="caption-style text-subtle leading-[1.4]">
            There are no text, number, date, status, checkbox, email, phone or
            link columns to fill yet. Add some from Columns.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {targets.map((column) => {
              const id = `automation-field-${column.id}`;
              const checked = fields.includes(column.id);
              return (
                <li key={column.id} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(state) =>
                      setFields((current) =>
                        state === true
                          ? [...current, column.id]
                          : current.filter((entry) => entry !== column.id),
                      )
                    }
                  />
                  <Label
                    htmlFor={id}
                    className="text-foreground min-w-0 flex-1 cursor-pointer truncate text-[13px]"
                  >
                    {column.label}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="automation-overwrite"
          checked={overwrite}
          onCheckedChange={(state) => setOverwrite(state === true)}
        />
        <Label
          htmlFor="automation-overwrite"
          className="text-foreground cursor-pointer text-[13px]"
        >
          Overwrite cells that already have a value
        </Label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Automation name"
          placeholder={placeholder || "Name"}
          autoComplete="off"
          maxLength={AUTOMATION_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={adding || targets.length === 0}
        >
          {adding ? "Adding…" : "Add automation"}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="caption-style text-danger">
          {problem}
        </p>
      )}
    </form>
  );
}

function AutomationList({
  api,
  columns,
  canEdit,
  itemName,
}: {
  api: AutomationsApi;
  columns: BoardColumn[];
  canEdit: boolean;
  itemName: (id: string) => string | null;
}) {
  if (!api.automations.length) {
    return (
      <p className="text-soft px-6 py-5 leading-[1.4]">
        No automations on this board yet.
        {canEdit ? " Add one above." : " An admin can add them."}
      </p>
    );
  }
  return (
    <ul className="divide-line-strong flex flex-col divide-y">
      {api.automations.map((automation) => (
        <AutomationRow
          key={automation.id}
          automation={automation}
          jobs={api.jobs.filter((job) => job.automation_id === automation.id)}
          api={api}
          columns={columns}
          canEdit={canEdit}
          itemName={itemName}
        />
      ))}
    </ul>
  );
}

function AutomationRow({
  automation,
  jobs,
  api,
  columns,
  canEdit,
  itemName,
}: {
  automation: Automation;
  jobs: AutomationJob[];
  api: AutomationsApi;
  columns: BoardColumn[];
  canEdit: boolean;
  itemName: (id: string) => string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [queued, setQueued] = useState<number | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const open = jobs.filter(
    (job) => jobStatus(job) === "queued" || jobStatus(job) === "running",
  ).length;

  async function runOnExisting() {
    setQueueing(true);
    const count = await api.runOnExisting(automation.id);
    setQueueing(false);
    setQueued(count);
    if (count) setShowRuns(true);
  }

  return (
    <li className="flex flex-col gap-3 px-6 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p
            className={cn(
              "truncate font-medium",
              !automation.enabled && "text-subtle",
            )}
          >
            {automation.name}
          </p>
          <p className="caption-style text-soft leading-[1.4]">
            {describeTrigger(automation, columns)},{" "}
            {describeAction(automation, columns)}.
          </p>
          {queued !== null && (
            <p role="status" className="caption-style text-subtle">
              {queued === 0
                ? "Nothing to do: every item with a file already has those columns filled."
                : `Queued ${queued} ${queued === 1 ? "item" : "items"}.`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {canEdit && (
            <label className="caption-style text-soft mr-1 flex cursor-pointer items-center gap-1.5">
              <Checkbox
                aria-label={`${automation.name} is on`}
                checked={automation.enabled}
                onCheckedChange={(state) =>
                  api.update(automation.id, { enabled: state === true })
                }
              />
              On
            </label>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={queueing}
            onClick={runOnExisting}
          >
            {queueing ? "Queueing…" : "Run on existing items"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showRuns}
            onClick={() => setShowRuns((current) => !current)}
          >
            {showRuns ? "Hide runs" : "Runs"}
            {open
              ? ` · ${open} running`
              : jobs.length
                ? ` · ${jobs.length}`
                : ""}
          </Button>
          {canEdit &&
            (confirming ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setConfirming(false);
                    api.remove(automation.id);
                  }}
                >
                  Delete automation
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger"
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
            ))}
        </div>
      </div>
      {showRuns && (
        <RunList jobs={jobs} api={api} columns={columns} itemName={itemName} />
      )}
    </li>
  );
}

function RunList({
  jobs,
  api,
  columns,
  itemName,
}: {
  jobs: AutomationJob[];
  api: AutomationsApi;
  columns: BoardColumn[];
  itemName: (id: string) => string | null;
}) {
  if (!jobs.length) {
    return (
      <p className="caption-style text-subtle bg-overlay/[0.03] rounded-lg px-3 py-2.5">
        No runs yet. Drop a file into the column, or run it on existing items.
      </p>
    );
  }
  return (
    <ul className="bg-overlay/[0.03] divide-line-strong flex flex-col divide-y rounded-lg">
      {jobs.map((job) => {
        const status = jobStatus(job);
        const file = jobFile(job);
        return (
          <li
            key={job.id}
            className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="caption-style flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">
                  {itemName(job.item_id) ?? "Deleted item"}
                </span>
                {file && (
                  <span className="text-subtle truncate">{file.name}</span>
                )}
              </p>
              <p
                className={cn(
                  "caption-style leading-[1.4]",
                  status === "failed" ? "text-danger" : "text-soft",
                )}
              >
                {summariseOutcome(job, columns)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="caption-style text-subtle">
                {jobAgo(job.finished_at ?? job.created_at)}
              </span>
              <Tag tone={STATUS[status].tone} size="sm" className="text-[12px]">
                {STATUS[status].label}
              </Tag>
              {status === "failed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => api.retry(job.id)}
                >
                  Retry
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

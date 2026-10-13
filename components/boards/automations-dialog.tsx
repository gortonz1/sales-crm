"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  automationsReady,
  type Readiness,
} from "@/app/(app)/boards/automation-actions";
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
  ACTIONS,
  AUTOMATION_NAME_MAX,
  BODY_MAX,
  SMS_SEGMENT_CHARS,
  SUBJECT_MAX,
  TRIGGERS,
  actionsFor,
  canExtractInto,
  defaultAutomationName,
  describeAction,
  describeTrigger,
  extractConfig,
  isAction,
  isTrigger,
  jobAgo,
  jobFile,
  jobStatus,
  messageConfig,
  statusTriggerValue,
  summariseOutcome,
  templatePlaceholders,
  type Automation,
  type AutomationAction,
  type AutomationJob,
  type AutomationSpec,
  type AutomationTrigger,
  type JobStatus,
} from "@/lib/automations";
import { columnOptions, type BoardColumn } from "@/lib/columns";
import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import type { AutomationDraft, AutomationsApi } from "./use-automations";

const STATUS: Record<
  JobStatus,
  { label: string; tone: "neutral" | "blue" | "green" | "red" }
> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "blue" },
  done: { label: "Done", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANY_STATUS = "__any__";
const FIXED_RECIPIENT = "__fixed__";

const textareaClass =
  "border-line-strong bg-secondary text-foreground placeholder:text-subtle focus-visible:border-ring ease-power3-out flex min-h-[7em] w-full min-w-0 rounded-lg border px-3 py-2 text-[14px] leading-[1.4] outline-none transition-[border-color] duration-150";

const isReady = (ready: Readiness | null, action: AutomationAction) =>
  ready === null ||
  (action === "ai_extract"
    ? ready.ai
    : action === "send_email"
      ? ready.email
      : ready.sms);

const notReadyHint = (action: AutomationAction) =>
  action === "ai_extract"
    ? "AI extraction isn't set up on the server yet: add ANTHROPIC_API_KEY and redeploy."
    : action === "send_email"
      ? "Email isn't set up on the server yet: add RESEND_API_KEY and RESEND_FROM and redeploy."
      : "Texts aren't set up on the server yet: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM and redeploy.";

const actionLabel = (action: string) =>
  ACTIONS.find((entry) => entry.value === action)?.label ?? action;

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
  const [ready, setReady] = useState<Readiness | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    automationsReady().then((result) => {
      if (!cancelled) setReady(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const unready = ACTIONS.filter(
    (entry) =>
      !isReady(ready, entry.value) &&
      api.automations.some((automation) => automation.action === entry.value),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[46em]">
        <DialogHeader>
          <DialogTitle>Automations</DialogTitle>
          <DialogDescription>
            Rules that run on {boardName} when something changes: read an
            uploaded file with AI, or send an email or text when a status
            changes or an item is added.
          </DialogDescription>
        </DialogHeader>
        {unready.length > 0 && (
          <ul
            role="alert"
            className="caption-style text-warning border-line-strong flex flex-col gap-1.5 border-b px-6 py-3 leading-[1.4]"
          >
            {unready.map((entry) => (
              <li key={entry.value}>{notReadyHint(entry.value)}</li>
            ))}
          </ul>
        )}
        {canEdit && (
          <AutomationForm api={api} columns={columns} ready={ready} />
        )}
        <AutomationList
          api={api}
          columns={columns}
          canEdit={canEdit}
          ready={ready}
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

type RecipientKind = "column" | "fixed";

function AutomationForm({
  api,
  columns,
  ready,
  initial,
  onDone,
}: {
  api: AutomationsApi;
  columns: BoardColumn[];
  ready: Readiness | null;
  initial?: Automation;
  onDone?: () => void;
}) {
  const fileColumns = columns.filter((column) => column.type === "file");
  const statusColumns = columns.filter((column) => column.type === "status");
  const emailColumns = columns.filter((column) => column.type === "email");
  const phoneColumns = columns.filter((column) => column.type === "phone");
  const triggers = TRIGGERS.filter((entry) =>
    entry.value === "file_added"
      ? fileColumns.length > 0
      : entry.value === "status_is"
        ? statusColumns.length > 0
        : true,
  );

  const firstTrigger: AutomationTrigger =
    initial && isTrigger(initial.trigger)
      ? initial.trigger
      : (triggers[0]?.value ?? "item_created");
  const extractInit = initial ? extractConfig(initial) : null;
  const messageInit = initial ? messageConfig(initial) : null;

  const [trigger, setTrigger] = useState<AutomationTrigger>(firstTrigger);
  const [triggerColumnId, setTriggerColumnId] = useState(
    initial?.trigger_column_id ?? "",
  );
  const [status, setStatus] = useState(
    initial ? (statusTriggerValue(initial) ?? "") : "",
  );
  const [action, setAction] = useState<AutomationAction>(
    initial && isAction(initial.action)
      ? initial.action
      : actionsFor(firstTrigger)[0],
  );
  const [fields, setFields] = useState<string[]>(extractInit?.fields ?? []);
  const [overwrite, setOverwrite] = useState(extractInit?.overwrite ?? false);
  const [recipientKind, setRecipientKind] = useState<RecipientKind>(
    messageInit?.to?.kind ?? "column",
  );
  const [recipientColumnId, setRecipientColumnId] = useState(
    messageInit?.to?.kind === "column" ? messageInit.to.columnId : "",
  );
  const [recipientValue, setRecipientValue] = useState(
    messageInit?.to?.kind === "fixed" ? messageInit.to.value : "",
  );
  const [subject, setSubject] = useState(messageInit?.subject ?? "");
  const [body, setBody] = useState(messageInit?.body ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const triggerColumns =
    trigger === "file_added"
      ? fileColumns
      : trigger === "status_is"
        ? statusColumns
        : [];
  const triggerColumn =
    triggerColumns.find((column) => column.id === triggerColumnId) ??
    triggerColumns[0] ??
    null;
  const actions = actionsFor(trigger);
  const effectiveAction = actions.includes(action) ? action : actions[0];
  const recipientColumns =
    effectiveAction === "send_email" ? emailColumns : phoneColumns;
  const recipientColumn =
    recipientColumns.find((column) => column.id === recipientColumnId) ??
    recipientColumns[0] ??
    null;
  const effectiveKind: RecipientKind =
    recipientKind === "column" && !recipientColumn ? "fixed" : recipientKind;
  const targets = columns.filter(
    (column) => canExtractInto(column) && column.id !== triggerColumn?.id,
  );
  const statusOptions = triggerColumn ? columnOptions(triggerColumn) : [];

  function buildConfig(): Json {
    if (effectiveAction === "ai_extract") return { fields, overwrite };
    const config: Record<string, Json> = {
      to:
        effectiveKind === "column"
          ? { kind: "column", column_id: recipientColumn?.id ?? "" }
          : { kind: "fixed", value: recipientValue.trim() },
      body: body.trim(),
    };
    if (effectiveAction === "send_email") config.subject = subject.trim();
    if (trigger === "status_is" && status) config.status = status;
    return config;
  }

  const spec: AutomationSpec = {
    trigger,
    trigger_column_id:
      trigger === "item_created" ? null : (triggerColumn?.id ?? null),
    action: effectiveAction,
    config: buildConfig(),
  };
  const placeholder = defaultAutomationName(spec, columns);

  function validate() {
    if (trigger !== "item_created" && !triggerColumn)
      return "Pick the column that starts the automation.";
    if (effectiveAction === "ai_extract")
      return fields.length ? null : "Tick at least one column to fill.";
    const email = effectiveAction === "send_email";
    if (effectiveKind === "column" && !recipientColumn)
      return email
        ? "Add an Email column to the board, or enter an address."
        : "Add a Phone column to the board, or enter a number.";
    if (effectiveKind === "fixed") {
      const value = recipientValue.trim();
      const valid = email
        ? EMAIL_PATTERN.test(value)
        : value.replace(/\D/g, "").length >= 7;
      if (!valid)
        return email
          ? "Enter a valid email address."
          : "Enter a valid phone number.";
    }
    if (email && !subject.trim()) return "Give the email a subject.";
    if (!body.trim()) return "Write the message.";
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const issue = validate();
    if (issue) {
      setProblem(issue);
      return;
    }
    setProblem(null);
    setSaving(true);
    const values: AutomationDraft = {
      ...spec,
      name: (name.trim() || placeholder).slice(0, AUTOMATION_NAME_MAX),
    };
    const saved = initial
      ? await api.update(initial.id, values)
      : (await api.add(values)) !== null;
    setSaving(false);
    if (!saved) return;
    if (initial) {
      onDone?.();
      return;
    }
    setFields([]);
    setOverwrite(false);
    setRecipientValue("");
    setSubject("");
    setBody("");
    setName("");
  }

  const placeholders = templatePlaceholders(columns)
    .map((label) => `{{${label}}}`)
    .join(", ");

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn(
        "flex flex-col gap-4 px-6 py-5",
        initial
          ? "bg-overlay/[0.03] rounded-lg"
          : "border-line-strong border-b",
      )}
    >
      <h3 className="h2-style">
        {initial ? "Edit automation" : "New automation"}
      </h3>

      <div className="flex flex-col gap-2">
        <span className="caption-style text-subtle">When</span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={trigger}
            onValueChange={(value) => {
              if (!isTrigger(value)) return;
              setTrigger(value);
              setTriggerColumnId("");
              setStatus("");
              if (!actionsFor(value).includes(action))
                setAction(actionsFor(value)[0]);
            }}
          >
            <SelectTrigger
              aria-label="What starts the automation"
              className="sm:w-[16em]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {triggers.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {trigger !== "item_created" && (
            <Select
              value={triggerColumn?.id ?? ""}
              onValueChange={(value) => {
                setTriggerColumnId(value);
                setStatus("");
                setFields((current) => current.filter((id) => id !== value));
              }}
            >
              <SelectTrigger
                aria-label={
                  trigger === "file_added" ? "Files column" : "Status column"
                }
                className="sm:w-[14em]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggerColumns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {trigger === "status_is" && (
            <Select
              value={status || ANY_STATUS}
              onValueChange={(value) =>
                setStatus(value === ANY_STATUS ? "" : value)
              }
            >
              <SelectTrigger aria-label="Changes to" className="sm:w-[14em]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_STATUS}>changes to any label</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-[3px]"
                        style={{ backgroundColor: option.color ?? "#6b6b6b" }}
                      />
                      changes to {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="caption-style text-subtle">Then</span>
        <Select
          value={effectiveAction}
          onValueChange={(value) => isAction(value) && setAction(value)}
        >
          <SelectTrigger aria-label="What happens" className="sm:w-[16em]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actions.map((value) => (
              <SelectItem key={value} value={value}>
                {actionLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isReady(ready, effectiveAction) && (
          <p className="caption-style text-warning leading-[1.4]">
            {notReadyHint(effectiveAction)} You can still save the rule; its
            runs will fail until then.
          </p>
        )}
      </div>

      {effectiveAction === "ai_extract" ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="caption-style text-subtle">
              Columns to fill from the file
            </span>
            {targets.length === 0 ? (
              <p className="caption-style text-subtle leading-[1.4]">
                There are no text, number, date, status, checkbox, email, phone
                or link columns to fill yet. Add some from Columns.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                {targets.map((column) => {
                  const id = `automation-field-${initial?.id ?? "new"}-${column.id}`;
                  return (
                    <li key={column.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={fields.includes(column.id)}
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
              id={`automation-overwrite-${initial?.id ?? "new"}`}
              checked={overwrite}
              onCheckedChange={(state) => setOverwrite(state === true)}
            />
            <Label
              htmlFor={`automation-overwrite-${initial?.id ?? "new"}`}
              className="text-foreground cursor-pointer text-[13px]"
            >
              Overwrite cells that already have a value
            </Label>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="caption-style text-subtle">To</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={
                  effectiveKind === "fixed"
                    ? FIXED_RECIPIENT
                    : (recipientColumn?.id ?? FIXED_RECIPIENT)
                }
                onValueChange={(value) => {
                  if (value === FIXED_RECIPIENT) setRecipientKind("fixed");
                  else {
                    setRecipientKind("column");
                    setRecipientColumnId(value);
                  }
                }}
              >
                <SelectTrigger aria-label="Recipient" className="sm:w-[16em]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipientColumns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      The item&apos;s {column.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={FIXED_RECIPIENT}>
                    {effectiveAction === "send_email"
                      ? "An address I enter"
                      : "A number I enter"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {effectiveKind === "fixed" && (
                <Input
                  aria-label={
                    effectiveAction === "send_email"
                      ? "Email address"
                      : "Phone number"
                  }
                  type={effectiveAction === "send_email" ? "email" : "tel"}
                  placeholder={
                    effectiveAction === "send_email"
                      ? "name@example.com"
                      : "07700 900123"
                  }
                  autoComplete="off"
                  value={recipientValue}
                  onChange={(event) => setRecipientValue(event.target.value)}
                  className="min-w-0 flex-1"
                />
              )}
            </div>
          </div>
          {effectiveAction === "send_email" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`automation-subject-${initial?.id ?? "new"}`}>
                Subject
              </Label>
              <Input
                id={`automation-subject-${initial?.id ?? "new"}`}
                autoComplete="off"
                maxLength={SUBJECT_MAX}
                placeholder="Your application, {{Item}}"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`automation-body-${initial?.id ?? "new"}`}>
                Message
              </Label>
              {effectiveAction === "send_sms" && (
                <span className="caption-style text-subtle">
                  {body.length} characters ·{" "}
                  {Math.max(1, Math.ceil(body.length / SMS_SEGMENT_CHARS))}{" "}
                  {body.length > SMS_SEGMENT_CHARS ? "texts" : "text"}
                </span>
              )}
            </div>
            <textarea
              id={`automation-body-${initial?.id ?? "new"}`}
              maxLength={BODY_MAX}
              placeholder={
                effectiveAction === "send_email"
                  ? "Hi {{First name}},\n\nThanks for applying…"
                  : "Hi {{First name}}, thanks for applying to {{Board}}…"
              }
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className={textareaClass}
            />
            <p className="caption-style text-subtle leading-[1.5]">
              Insert a cell with double curly braces: {placeholders}.
            </p>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Automation name"
          placeholder={placeholder}
          autoComplete="off"
          maxLength={AUTOMATION_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1"
        />
        {initial && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add automation"}
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
  ready,
  itemName,
}: {
  api: AutomationsApi;
  columns: BoardColumn[];
  canEdit: boolean;
  ready: Readiness | null;
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
          ready={ready}
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
  ready,
  itemName,
}: {
  automation: Automation;
  jobs: AutomationJob[];
  api: AutomationsApi;
  columns: BoardColumn[];
  canEdit: boolean;
  ready: Readiness | null;
  itemName: (id: string) => string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [queued, setQueued] = useState<number | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const open = jobs.filter(
    (job) => jobStatus(job) === "queued" || jobStatus(job) === "running",
  ).length;
  const canBackfill =
    automation.action === "ai_extract" && automation.trigger === "file_added";

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
          {canBackfill && (
            <Button
              variant="ghost"
              size="sm"
              disabled={queueing}
              onClick={runOnExisting}
            >
              {queueing ? "Queueing…" : "Run on existing items"}
            </Button>
          )}
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
          {canEdit && !editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
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
      {editing && (
        <AutomationForm
          api={api}
          columns={columns}
          ready={ready}
          initial={automation}
          onDone={() => setEditing(false)}
        />
      )}
      {showRuns && (
        <RunList
          jobs={jobs}
          automation={automation}
          api={api}
          columns={columns}
          itemName={itemName}
        />
      )}
    </li>
  );
}

function RunList({
  jobs,
  automation,
  api,
  columns,
  itemName,
}: {
  jobs: AutomationJob[];
  automation: Automation;
  api: AutomationsApi;
  columns: BoardColumn[];
  itemName: (id: string) => string | null;
}) {
  if (!jobs.length) {
    return (
      <p className="caption-style text-subtle bg-overlay/[0.03] rounded-lg px-3 py-2.5">
        No runs yet.
        {automation.action === "ai_extract"
          ? " Drop a file into the column, or run it on existing items."
          : " It runs the next time the trigger happens."}
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
                {summariseOutcome(job, automation, columns)}
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

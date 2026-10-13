import {
  asDate,
  asNumber,
  asText,
  columnOptions,
  customValue,
  type BoardColumn,
  type ColumnType,
} from "@/lib/columns";
import { asFiles } from "@/lib/files";
import type { Json, Tables } from "@/lib/supabase/database.types";

export type Automation = Tables<"automations">;
export type AutomationJob = Tables<"automation_jobs">;

export type AutomationTrigger = "file_added" | "status_is" | "item_created";
export type AutomationAction =
  | "ai_extract"
  | "send_email"
  | "send_sms"
  | "set_cell";
export type JobStatus = "queued" | "running" | "done" | "failed";

export type AutomationSpec = Pick<
  Automation,
  "trigger" | "trigger_column_id" | "action" | "config"
>;

export const AUTOMATION_NAME_MAX = 120;
export const JOBS_SHOWN = 50;
export const JOBS_PER_RUN = 3;
export const MAX_RUN_ROUNDS = 40;
export const SUBJECT_MAX = 200;
export const BODY_MAX = 5000;
export const SMS_MAX_CHARS = 1600;
export const SMS_SEGMENT_CHARS = 160;
export const MAX_CHAIN_DEPTH = 5;

export const TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: "file_added", label: "A file is added to a column" },
  { value: "status_is", label: "A status changes" },
  { value: "item_created", label: "An item is created" },
];

export const ACTIONS: { value: AutomationAction; label: string }[] = [
  { value: "ai_extract", label: "Extract with AI into columns" },
  { value: "set_cell", label: "Set a cell" },
  { value: "send_email", label: "Send an email" },
  { value: "send_sms", label: "Send a text message" },
];

export const PENDING_LABEL: Partial<Record<AutomationAction, string>> = {
  ai_extract: "Extracting…",
  set_cell: "Updating…",
};

export const EXTRACT_TYPES: ColumnType[] = [
  "text",
  "number",
  "date",
  "status",
  "checkbox",
  "email",
  "phone",
  "link",
];

export const canExtractInto = (column: Pick<BoardColumn, "type">) =>
  EXTRACT_TYPES.includes(column.type as ColumnType);

export const canSet = (column: Pick<BoardColumn, "type">) =>
  column.type !== "file";

export const isTrigger = (value: string): value is AutomationTrigger =>
  TRIGGERS.some((entry) => entry.value === value);

export const isAction = (value: string): value is AutomationAction =>
  ACTIONS.some((entry) => entry.value === value);

export const actionsFor = (trigger: AutomationTrigger): AutomationAction[] =>
  trigger === "file_added"
    ? ["ai_extract", "set_cell", "send_email", "send_sms"]
    : ["set_cell", "send_email", "send_sms"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type ExtractConfig = { fields: string[]; overwrite: boolean };

export function extractConfig(
  automation: Pick<Automation, "config">,
): ExtractConfig {
  const config = isRecord(automation.config) ? automation.config : {};
  const fields = Array.isArray(config.fields)
    ? config.fields.filter((id): id is string => typeof id === "string")
    : [];
  return { fields, overwrite: config.overwrite === true };
}

export type Recipient =
  | { kind: "column"; columnId: string }
  | { kind: "fixed"; value: string };

export type MessageConfig = {
  to: Recipient | null;
  subject: string;
  body: string;
};

export function messageConfig(
  automation: Pick<Automation, "config">,
): MessageConfig {
  const config = isRecord(automation.config) ? automation.config : {};
  const raw = isRecord(config.to) ? config.to : null;
  let to: Recipient | null = null;
  if (raw?.kind === "column" && typeof raw.column_id === "string")
    to = { kind: "column", columnId: raw.column_id };
  else if (raw?.kind === "fixed" && typeof raw.value === "string")
    to = { kind: "fixed", value: raw.value };
  return {
    to,
    subject: typeof config.subject === "string" ? config.subject : "",
    body: typeof config.body === "string" ? config.body : "",
  };
}

export type SetMode = "value" | "today" | "clear";

export type SetCellConfig = {
  columnId: string | null;
  mode: SetMode;
  value: Json;
  offsetDays: number;
};

export function setCellConfig(
  automation: Pick<Automation, "config">,
): SetCellConfig {
  const config = isRecord(automation.config) ? automation.config : {};
  const mode =
    config.mode === "today" || config.mode === "clear" ? config.mode : "value";
  return {
    columnId: typeof config.column_id === "string" ? config.column_id : null,
    mode,
    value: (config.value ?? null) as Json,
    offsetDays:
      typeof config.offset_days === "number" &&
      Number.isFinite(config.offset_days)
        ? Math.trunc(config.offset_days)
        : 0,
  };
}

export function statusTriggerValue(automation: Pick<Automation, "config">) {
  const config = isRecord(automation.config) ? automation.config : {};
  return typeof config.status === "string" && config.status
    ? config.status
    : null;
}

export const columnLabel = (columns: BoardColumn[], id: string | null) =>
  (id && columns.find((column) => column.id === id)?.label) || null;

const quoted = (label: string | null, fallback: string) =>
  label ? `“${label}”` : fallback;

export function describeTrigger(spec: AutomationSpec, columns: BoardColumn[]) {
  if (spec.trigger === "item_created") return "When an item is created";
  const label = columnLabel(columns, spec.trigger_column_id);
  if (spec.trigger === "status_is") {
    const column = columns.find((entry) => entry.id === spec.trigger_column_id);
    const value = statusTriggerValue(spec);
    const option = column
      ? columnOptions(column).find((entry) => entry.value === value)
      : null;
    const target = value ? ` to ${option?.label ?? "a deleted label"}` : "";
    return `When ${quoted(label, "a deleted column")} changes${target}`;
  }
  return `When a file is added to ${quoted(label, "a deleted column")}`;
}

function describeRecipient(to: Recipient | null, columns: BoardColumn[]) {
  if (!to) return "nobody";
  if (to.kind === "fixed") return to.value;
  return quoted(columnLabel(columns, to.columnId), "a deleted column");
}

export function describeOffset(offsetDays: number) {
  if (!offsetDays) return "today";
  const days = Math.abs(offsetDays) === 1 ? "day" : "days";
  return `today ${offsetDays > 0 ? "plus" : "minus"} ${Math.abs(offsetDays)} ${days}`;
}

export function describeSetCell(spec: AutomationSpec, columns: BoardColumn[]) {
  const { columnId, mode, value, offsetDays } = setCellConfig(spec);
  const column = columns.find((entry) => entry.id === columnId) ?? null;
  const label = quoted(column?.label ?? null, "a deleted column");
  if (mode === "clear")
    return column?.type === "checkbox" ? `untick ${label}` : `clear ${label}`;
  if (mode === "today") return `set ${label} to ${describeOffset(offsetDays)}`;
  if (column?.type === "checkbox") return `tick ${label}`;
  const shown = column ? formatCell(column, value) : asText(value);
  return `set ${label} to ${shown || "…"}`;
}

export function describeAction(spec: AutomationSpec, columns: BoardColumn[]) {
  if (spec.action === "send_email")
    return `send an email to ${describeRecipient(messageConfig(spec).to, columns)}`;
  if (spec.action === "send_sms")
    return `send a text to ${describeRecipient(messageConfig(spec).to, columns)}`;
  if (spec.action === "set_cell") return describeSetCell(spec, columns);
  const { fields, overwrite } = extractConfig(spec);
  const labels = fields
    .map((id) => columnLabel(columns, id))
    .filter((label): label is string => label !== null);
  const into = labels.length ? labels.join(", ") : "no columns";
  return `extract with AI into ${into}${overwrite ? ", overwriting what's there" : ", filling empty cells only"}`;
}

export function defaultAutomationName(
  spec: AutomationSpec,
  columns: BoardColumn[],
) {
  const action = describeAction(spec, columns);
  const trigger = describeTrigger(spec, columns);
  const name = `${action.charAt(0).toUpperCase()}${action.slice(1)} ${trigger.charAt(0).toLowerCase()}${trigger.slice(1)}`;
  return name.length > AUTOMATION_NAME_MAX
    ? `${name.slice(0, AUTOMATION_NAME_MAX - 1)}…`
    : name;
}

export const jobStatus = (job: Pick<AutomationJob, "status">): JobStatus =>
  job.status === "running" || job.status === "done" || job.status === "failed"
    ? job.status
    : "queued";

export const isOpen = (job: Pick<AutomationJob, "status">) => {
  const status = jobStatus(job);
  return status === "queued" || status === "running";
};

export type JobFile = { id: string; name: string; path: string };

export function jobFile(job: Pick<AutomationJob, "payload">): JobFile | null {
  const payload = isRecord(job.payload) ? job.payload : {};
  if (!Array.isArray(payload.files)) return null;
  const last = payload.files[payload.files.length - 1];
  if (!isRecord(last)) return null;
  const { id, name, path } = last;
  if (typeof id !== "string" || typeof path !== "string") return null;
  return { id, name: typeof name === "string" ? name : "file", path };
}

export type JobOutcome = {
  filled: { column_id: string; value: Json }[];
  empty: string[];
  skipped: string[];
  to: string | null;
  subject: string | null;
  columnId: string | null;
  value: Json;
};

export function jobOutcome(job: Pick<AutomationJob, "result">): JobOutcome {
  const result = isRecord(job.result) ? job.result : {};
  const filled = Array.isArray(result.filled)
    ? result.filled.flatMap((entry) =>
        isRecord(entry) && typeof entry.column_id === "string"
          ? [
              {
                column_id: entry.column_id,
                value: (entry.value ?? null) as Json,
              },
            ]
          : [],
      )
    : [];
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  return {
    filled,
    empty: strings(result.empty),
    skipped: strings(result.skipped),
    to: typeof result.to === "string" ? result.to : null,
    subject: typeof result.subject === "string" ? result.subject : null,
    columnId: typeof result.column_id === "string" ? result.column_id : null,
    value: (result.value ?? null) as Json,
  };
}

export function summariseOutcome(
  job: AutomationJob,
  automation: Pick<Automation, "action"> | null,
  columns: BoardColumn[],
) {
  const status = jobStatus(job);
  if (status === "queued") return "Waiting to run";
  if (status === "running")
    return automation
      ? (PENDING_LABEL[automation.action as AutomationAction] ?? "Sending…")
      : "Running…";
  if (status === "failed") return job.error ?? "Failed";
  const outcome = jobOutcome(job);
  if (automation?.action === "send_email")
    return outcome.to
      ? `Emailed ${outcome.to}${outcome.subject ? `: “${outcome.subject}”` : ""}`
      : "Email sent";
  if (automation?.action === "send_sms")
    return outcome.to ? `Texted ${outcome.to}` : "Text sent";
  if (automation?.action === "set_cell") {
    const column = columns.find((entry) => entry.id === outcome.columnId);
    const label = column?.label ?? "the cell";
    if (outcome.value === null)
      return column?.type === "checkbox"
        ? `Unticked ${label}`
        : `Cleared ${label}`;
    if (column?.type === "checkbox") return `Ticked ${label}`;
    return `Set ${label} to ${column ? formatCell(column, outcome.value) : asText(outcome.value)}`;
  }
  if (!outcome.filled.length && !outcome.empty.length) return "Nothing to fill";
  const names = (ids: string[]) =>
    ids
      .map((id) => columnLabel(columns, id))
      .filter((label): label is string => label !== null)
      .join(", ");
  const parts = [];
  if (outcome.filled.length)
    parts.push(
      `Filled ${names(outcome.filled.map((entry) => entry.column_id))}`,
    );
  if (outcome.empty.length)
    parts.push(`not in the file: ${names(outcome.empty)}`);
  return parts.join(" · ");
}

export function pendingCells(
  jobs: Pick<AutomationJob, "automation_id" | "item_id" | "status">[],
  automations: Pick<Automation, "id" | "action" | "config">[],
) {
  const pending = new Map<string, Map<string, string>>();
  for (const job of jobs) {
    if (!isOpen(job)) continue;
    const automation = automations.find(
      (entry) => entry.id === job.automation_id,
    );
    if (!automation) continue;
    const label = PENDING_LABEL[automation.action as AutomationAction];
    if (!label) continue;
    const targets =
      automation.action === "ai_extract"
        ? extractConfig(automation).fields
        : [setCellConfig(automation).columnId].filter(
            (id): id is string => id !== null,
          );
    if (!targets.length) continue;
    const cells = pending.get(job.item_id) ?? new Map<string, string>();
    for (const id of targets) cells.set(id, label);
    pending.set(job.item_id, cells);
  }
  return pending;
}

export const sortJobs = (jobs: AutomationJob[]) =>
  [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at));

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function jobAgo(at: string) {
  const minutes = Math.round((new Date(at).getTime() - Date.now()) / 60000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relative.format(minutes, "minute");
  if (minutes > -60 * 24)
    return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / (60 * 24)), "day");
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat("en-GB");
const londonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayPlus(offsetDays: number, now = new Date()) {
  const today = londonDate.format(now);
  const base = new Date(`${today}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

export function formatCell(column: BoardColumn, value: Json): string {
  switch (column.type) {
    case "status": {
      const text = asText(value);
      const option = columnOptions(column).find(
        (entry) => entry.value === text,
      );
      return option?.label ?? text ?? "";
    }
    case "checkbox":
      return value === true ? "Yes" : "No";
    case "date": {
      const date = asDate(value);
      return date ? dateFormat.format(new Date(`${date}T00:00:00Z`)) : "";
    }
    case "number": {
      const n = asNumber(value);
      return n === null ? "" : numberFormat.format(n);
    }
    case "file":
      return asFiles(value)
        .map((file) => file.name)
        .join(", ");
    default:
      return asText(value) ?? "";
  }
}

export type TemplateContext = {
  item: { name: string; custom: Json };
  columns: BoardColumn[];
  boardName: string;
};

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function renderTemplate(template: string, context: TemplateContext) {
  return template.replace(PLACEHOLDER, (_match, rawKey: string) => {
    const key = rawKey.trim().toLowerCase();
    if (key === "item" || key === "item name" || key === "name")
      return context.item.name;
    if (key === "board") return context.boardName;
    const column = context.columns.find(
      (entry) => entry.label.trim().toLowerCase() === key,
    );
    return column
      ? formatCell(column, customValue(context.item, column.id))
      : "";
  });
}

export const templatePlaceholders = (columns: BoardColumn[]) => [
  "Item",
  "Board",
  ...columns.map((column) => column.label),
];

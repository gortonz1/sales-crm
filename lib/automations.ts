import type { BoardColumn, ColumnType } from "@/lib/columns";
import type { Json, Tables } from "@/lib/supabase/database.types";

export type Automation = Tables<"automations">;
export type AutomationJob = Tables<"automation_jobs">;

export type AutomationTrigger = "file_added";
export type AutomationAction = "ai_extract";
export type JobStatus = "queued" | "running" | "done" | "failed";

export const AUTOMATION_NAME_MAX = 120;
export const JOBS_SHOWN = 50;
export const JOBS_PER_RUN = 3;
export const MAX_RUN_ROUNDS = 40;

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

export type ExtractConfig = { fields: string[]; overwrite: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function extractConfig(
  automation: Pick<Automation, "config">,
): ExtractConfig {
  const config = isRecord(automation.config) ? automation.config : {};
  const fields = Array.isArray(config.fields)
    ? config.fields.filter((id): id is string => typeof id === "string")
    : [];
  return { fields, overwrite: config.overwrite === true };
}

export const columnLabel = (columns: BoardColumn[], id: string) =>
  columns.find((column) => column.id === id)?.label ?? null;

export function defaultAutomationName(
  columns: BoardColumn[],
  triggerColumnId: string,
  fields: string[],
) {
  const source = columnLabel(columns, triggerColumnId) ?? "a file";
  const targets = fields
    .map((id) => columnLabel(columns, id))
    .filter((label): label is string => label !== null);
  const shown = targets.slice(0, 3).join(", ");
  const more = targets.length > 3 ? ` and ${targets.length - 3} more` : "";
  return `Fill ${shown || "columns"}${more} from ${source}`.slice(
    0,
    AUTOMATION_NAME_MAX,
  );
}

export function describeTrigger(
  automation: Pick<Automation, "trigger" | "trigger_column_id">,
  columns: BoardColumn[],
) {
  const label = columnLabel(columns, automation.trigger_column_id);
  return `When a file is added to ${label ? `“${label}”` : "a deleted column"}`;
}

export function describeAction(
  automation: Pick<Automation, "action" | "config">,
  columns: BoardColumn[],
) {
  const { fields, overwrite } = extractConfig(automation);
  const labels = fields
    .map((id) => columnLabel(columns, id))
    .filter((label): label is string => label !== null);
  const into = labels.length ? labels.join(", ") : "no columns";
  return `extract with AI into ${into}${overwrite ? ", overwriting what's there" : ", filling empty cells only"}`;
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
  };
}

export function summariseOutcome(job: AutomationJob, columns: BoardColumn[]) {
  const status = jobStatus(job);
  if (status === "queued") return "Waiting to run";
  if (status === "running") return "Extracting…";
  if (status === "failed") return job.error ?? "Failed";
  const { filled, empty } = jobOutcome(job);
  if (!filled.length && !empty.length) return "Nothing to fill";
  const names = (ids: string[]) =>
    ids
      .map((id) => columnLabel(columns, id))
      .filter((label): label is string => label !== null)
      .join(", ");
  const parts = [];
  if (filled.length)
    parts.push(`Filled ${names(filled.map((entry) => entry.column_id))}`);
  if (empty.length) parts.push(`not in the file: ${names(empty)}`);
  return parts.join(" · ");
}

export function pendingCells(
  jobs: Pick<AutomationJob, "automation_id" | "item_id" | "status">[],
  automations: Pick<Automation, "id" | "config">[],
) {
  const pending = new Map<string, Set<string>>();
  for (const job of jobs) {
    if (!isOpen(job)) continue;
    const automation = automations.find(
      (entry) => entry.id === job.automation_id,
    );
    if (!automation) continue;
    const cells = pending.get(job.item_id) ?? new Set<string>();
    for (const field of extractConfig(automation).fields) cells.add(field);
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

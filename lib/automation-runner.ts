import type { SupabaseClient } from "@supabase/supabase-js";
import { extractFields, slugKey, type ExtractField } from "@/lib/ai-extract";
import { AutomationError } from "@/lib/automation-error";
import {
  canExtractInto,
  extractConfig,
  jobFile,
  JOBS_PER_RUN,
  messageConfig,
  renderTemplate,
  SMS_MAX_CHARS,
  type Automation,
  type AutomationJob,
  type Recipient,
} from "@/lib/automations";
import { asText, customValue, type BoardColumn } from "@/lib/columns";
import { asFiles, FILES_BUCKET } from "@/lib/files";
import { normaliseEmail, sendEmail, sendSms, toE164 } from "@/lib/messaging";
import type { Database, Json } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

type Context = {
  automation: Automation;
  item: Database["public"]["Tables"]["board_items"]["Row"];
  columns: BoardColumn[];
  boardName: string;
};

type JobResult = { outcome: Record<string, Json>; custom: Json | null };

export type ProcessedJob = {
  jobId: string;
  itemId: string;
  ok: boolean;
  error: string | null;
  result: Json | null;
  custom: Json | null;
};

export type RunOutcome = { processed: ProcessedJob[]; remaining: number };

async function loadContext(
  supabase: Supabase,
  job: AutomationJob,
): Promise<Context> {
  const [automation, item, columns, board] = await Promise.all([
    supabase
      .from("automations")
      .select("*")
      .eq("id", job.automation_id)
      .maybeSingle(),
    supabase
      .from("board_items")
      .select("*")
      .eq("id", job.item_id)
      .maybeSingle(),
    supabase
      .from("board_columns")
      .select("*")
      .eq("board_id", job.board_id)
      .is("deleted_at", null),
    supabase.from("boards").select("name").eq("id", job.board_id).maybeSingle(),
  ]);
  if (!automation.data)
    throw new AutomationError("The automation was deleted.");
  if (!item.data || item.data.deleted_at)
    throw new AutomationError("The item was deleted.");
  if (columns.error)
    throw new AutomationError(
      `Couldn't read the columns: ${columns.error.message}`,
      true,
    );
  return {
    automation: automation.data,
    item: item.data,
    columns: columns.data ?? [],
    boardName: board.data?.name ?? "the board",
  };
}

async function download(supabase: Supabase, path: string) {
  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .download(path);
  if (error || !data)
    throw new AutomationError(
      `Couldn't download the file: ${error?.message ?? "no response"}`,
      true,
    );
  return Buffer.from(await data.arrayBuffer());
}

async function runExtract(
  supabase: Supabase,
  job: AutomationJob,
  { automation, item, columns }: Context,
): Promise<JobResult> {
  const wanted = jobFile(job);
  if (!wanted) throw new AutomationError("The job has no file to read.");
  const trigger = columns.find(
    (column) => column.id === automation.trigger_column_id,
  );
  if (!trigger) throw new AutomationError("The trigger column was deleted.");
  const file = asFiles(customValue(item, trigger.id)).find(
    (entry) => entry.id === wanted.id,
  );
  if (!file)
    throw new AutomationError(`${wanted.name} was removed from the item.`);

  const { fields, overwrite } = extractConfig(automation);
  const skipped: string[] = [];
  const targets: BoardColumn[] = [];
  for (const id of fields) {
    const column = columns.find((entry) => entry.id === id);
    if (!column || !canExtractInto(column) || column.id === trigger.id)
      continue;
    if (!overwrite && customValue(item, column.id) !== null) skipped.push(id);
    else targets.push(column);
  }
  if (!targets.length) {
    return {
      outcome: { filled: [], empty: [], skipped, file: file.name },
      custom: item.custom,
    };
  }

  const taken = new Set<string>();
  const specs: ExtractField[] = targets.map((column) => ({
    key: slugKey(column.label, taken),
    column,
  }));
  const bytes = await download(supabase, file.path);
  const extracted = await extractFields(
    { name: file.name, type: file.type, bytes },
    specs,
  );

  const filled: { column_id: string; value: Json }[] = [];
  let custom: Json = item.custom;
  for (const column of targets) {
    const value = extracted.values.get(column.id);
    if (value === undefined || value === null) continue;
    const { data, error } = await supabase.rpc("set_custom_value", {
      target: "board_items",
      row_id: item.id,
      column_id: column.id,
      value,
    });
    if (error)
      throw new AutomationError(
        `Couldn't save ${column.label}: ${error.message}`,
        true,
      );
    custom = data;
    filled.push({ column_id: column.id, value });
  }
  return {
    outcome: {
      filled,
      empty: extracted.empty,
      skipped,
      file: file.name,
      model: extracted.model,
    },
    custom,
  };
}

function recipientFor(
  kind: "email" | "sms",
  recipient: Recipient | null,
  { item, columns }: Context,
) {
  if (!recipient)
    throw new AutomationError("The automation has nobody to send to.");
  let raw = "";
  let label = "The recipient";
  if (recipient.kind === "fixed") raw = recipient.value;
  else {
    const column = columns.find((entry) => entry.id === recipient.columnId);
    if (!column) throw new AutomationError("The recipient column was deleted.");
    label = column.label;
    raw = asText(customValue(item, column.id)) ?? "";
  }
  if (!raw.trim()) throw new AutomationError(`${label} is empty on this item.`);
  const value = kind === "email" ? normaliseEmail(raw) : toE164(raw);
  if (!value)
    throw new AutomationError(
      `“${raw.trim()}” isn't a valid ${kind === "email" ? "email address" : "phone number"}.`,
    );
  return value;
}

async function runEmail(context: Context): Promise<JobResult> {
  const config = messageConfig(context.automation);
  const to = recipientFor("email", config.to, context);
  const subject =
    renderTemplate(config.subject, context).trim() || context.boardName;
  const text = renderTemplate(config.body, context).trim();
  if (!text) throw new AutomationError("The email came out empty.");
  const { id } = await sendEmail({ to, subject, text });
  return { outcome: { to, subject, provider_id: id }, custom: null };
}

async function runSms(context: Context): Promise<JobResult> {
  const config = messageConfig(context.automation);
  const to = recipientFor("sms", config.to, context);
  const body = renderTemplate(config.body, context)
    .trim()
    .slice(0, SMS_MAX_CHARS);
  if (!body) throw new AutomationError("The text message came out empty.");
  const { id } = await sendSms({ to, body });
  return { outcome: { to, provider_id: id }, custom: null };
}

async function runJob(supabase: Supabase, job: AutomationJob) {
  const context = await loadContext(supabase, job);
  switch (context.automation.action) {
    case "ai_extract":
      return runExtract(supabase, job, context);
    case "send_email":
      return runEmail(context);
    case "send_sms":
      return runSms(context);
    default:
      throw new AutomationError(
        `Unknown action “${context.automation.action}”.`,
      );
  }
}

export async function processAutomationJobs(
  supabase: Supabase,
  boardId: string | null,
  maxJobs = JOBS_PER_RUN,
): Promise<RunOutcome> {
  const { data: jobs, error } = await supabase.rpc("claim_automation_jobs", {
    board: boardId,
    max_jobs: maxJobs,
  });
  if (error) throw new Error(`Couldn't pick up the jobs: ${error.message}`);

  const processed: ProcessedJob[] = await Promise.all(
    (jobs ?? []).map(async (job): Promise<ProcessedJob> => {
      try {
        const { outcome, custom } = await runJob(supabase, job);
        await supabase.rpc("finish_automation_job", {
          job_id: job.id,
          ok: true,
          outcome,
        });
        return {
          jobId: job.id,
          itemId: job.item_id,
          ok: true,
          error: null,
          result: outcome,
          custom,
        };
      } catch (caught) {
        const retry = caught instanceof AutomationError && caught.retry;
        const message =
          caught instanceof Error ? caught.message : "Automation failed.";
        await supabase.rpc("finish_automation_job", {
          job_id: job.id,
          ok: false,
          message,
          retry,
        });
        return {
          jobId: job.id,
          itemId: job.item_id,
          ok: false,
          error: message,
          result: null,
          custom: null,
        };
      }
    }),
  );

  let remainingQuery = supabase
    .from("automation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");
  if (boardId) remainingQuery = remainingQuery.eq("board_id", boardId);
  const { count } = await remainingQuery;
  return { processed, remaining: count ?? 0 };
}

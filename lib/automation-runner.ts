import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ExtractError,
  extractFields,
  slugKey,
  type ExtractField,
} from "@/lib/ai-extract";
import {
  canExtractInto,
  extractConfig,
  jobFile,
  JOBS_PER_RUN,
  type AutomationJob,
} from "@/lib/automations";
import { customValue, type BoardColumn } from "@/lib/columns";
import { asFiles, FILES_BUCKET } from "@/lib/files";
import type { Database, Json } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export type ProcessedJob = {
  jobId: string;
  itemId: string;
  ok: boolean;
  error: string | null;
  result: Json | null;
  custom: Json | null;
};

export type RunOutcome = { processed: ProcessedJob[]; remaining: number };

async function loadContext(supabase: Supabase, job: AutomationJob) {
  const [automation, item, columns] = await Promise.all([
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
  ]);
  if (!automation.data) throw new ExtractError("The automation was deleted.");
  if (!item.data || item.data.deleted_at)
    throw new ExtractError("The item was deleted.");
  if (columns.error)
    throw new ExtractError(
      `Couldn't read the columns: ${columns.error.message}`,
      true,
    );
  return {
    automation: automation.data,
    item: item.data,
    columns: columns.data ?? [],
  };
}

async function download(supabase: Supabase, path: string) {
  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .download(path);
  if (error || !data)
    throw new ExtractError(
      `Couldn't download the file: ${error?.message ?? "no response"}`,
      true,
    );
  return Buffer.from(await data.arrayBuffer());
}

async function runJob(supabase: Supabase, job: AutomationJob) {
  const { automation, item, columns } = await loadContext(supabase, job);
  const wanted = jobFile(job);
  if (!wanted) throw new ExtractError("The job has no file to read.");
  const trigger = columns.find(
    (column) => column.id === automation.trigger_column_id,
  );
  if (!trigger) throw new ExtractError("The trigger column was deleted.");
  const file = asFiles(customValue(item, trigger.id)).find(
    (entry) => entry.id === wanted.id,
  );
  if (!file)
    throw new ExtractError(`${wanted.name} was removed from the item.`);

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
      filled: [],
      empty: [],
      skipped,
      file: file.name,
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
      throw new ExtractError(
        `Couldn't save ${column.label}: ${error.message}`,
        true,
      );
    custom = data;
    filled.push({ column_id: column.id, value });
  }
  return {
    filled,
    empty: extracted.empty,
    skipped,
    file: file.name,
    model: extracted.model,
    custom,
  };
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
        const { custom, ...outcome } = await runJob(supabase, job);
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
        const retry = caught instanceof ExtractError && caught.retry;
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

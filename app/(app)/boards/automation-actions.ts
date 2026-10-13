"use server";

import { aiConfigured } from "@/lib/ai-extract";
import {
  processAutomationJobs,
  type ProcessedJob,
} from "@/lib/automation-runner";
import { createClient } from "@/lib/supabase/server";

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function runAutomations(
  boardId: string,
): Promise<{ processed: ProcessedJob[]; remaining: number; error?: string }> {
  const empty = { processed: [], remaining: 0 };
  if (!isUuid(boardId)) return { ...empty, error: "Unknown board." };
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("lead_stages")
    .select("id")
    .limit(1);
  if (!member?.length) return { ...empty, error: "Not allowed." };
  try {
    return await processAutomationJobs(supabase, boardId);
  } catch (error) {
    return {
      ...empty,
      error:
        error instanceof Error ? error.message : "Couldn't run automations.",
    };
  }
}

export async function automationsReady(): Promise<{ ai: boolean }> {
  return { ai: aiConfigured() };
}

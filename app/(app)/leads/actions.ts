"use server";

import { aiConfigured } from "@/lib/ai-extract";
import { processLeadChecks } from "@/lib/lead-check";
import type { Lead } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";

const MAX_WATCHED = 50;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function runLeadChecks(
  watch: string[],
): Promise<{
  leads: Lead[];
  checked: number;
  remaining: number;
  error?: string;
}> {
  const empty = { leads: [], checked: 0, remaining: 0 };
  if (!aiConfigured())
    return {
      ...empty,
      error: "AI checks aren't set up: add ANTHROPIC_API_KEY to the server.",
    };
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("lead_stages")
    .select("id")
    .limit(1);
  if (!member?.length) return { ...empty, error: "Not allowed." };
  const ids = Array.isArray(watch)
    ? watch.filter(isUuid).slice(0, MAX_WATCHED)
    : [];
  try {
    return await processLeadChecks(supabase, ids);
  } catch (error) {
    return {
      ...empty,
      error:
        error instanceof Error ? error.message : "Couldn't run the AI checks.",
    };
  }
}

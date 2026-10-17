import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { processAutomationJobs } from "@/lib/automation-runner";
import { processLeadChecks } from "@/lib/lead-check";
import type { Database } from "@/lib/supabase/database.types";

const MAX_ROUNDS = 20;

const json = (body: unknown, status = 200) => Response.json(body, { status });

function keyMatches(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.AUTOMATION_WEBHOOK_SECRET?.trim();
  const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !url) {
    return json(
      {
        error:
          "Set AUTOMATION_WEBHOOK_SECRET and SUPABASE_SECRET_KEY on the server to run automations from a webhook.",
      },
      503,
    );
  }
  if (!keyMatches(request.headers.get("x-automation-key"), secret)) {
    return json({ error: "Invalid key" }, 401);
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let processed = 0;
  let failed = 0;
  let remaining = 0;
  let leadsChecked = 0;
  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const outcome = await processAutomationJobs(supabase, null);
      processed += outcome.processed.length;
      failed += outcome.processed.filter((job) => !job.ok).length;
      remaining = outcome.remaining;
      if (!outcome.processed.length || !remaining) break;
    }
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const outcome = await processLeadChecks(supabase);
      leadsChecked += outcome.checked;
      if (!outcome.checked || !outcome.remaining) break;
    }
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't run automations.",
        processed,
        failed,
        leadsChecked,
      },
      500,
    );
  }
  return json({ processed, failed, remaining, leadsChecked });
}

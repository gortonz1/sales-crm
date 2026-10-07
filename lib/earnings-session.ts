import { cookies } from "next/headers";
import { readWorkspace, type SavedWorkspace } from "@/lib/earnings";
import { createClient } from "@/lib/supabase/server";

export const EARNINGS_COOKIE = "earnings_session";
export const EARNINGS_SESSION_SECONDS = 12 * 60 * 60;

export async function earningsSession() {
  const value = (await cookies()).get(EARNINGS_COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function loadEarnings(): Promise<
  { unlocked: false } | { unlocked: true; saved: SavedWorkspace | null }
> {
  const session = await earningsSession();
  if (!session) return { unlocked: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("earnings_load", { session });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { unlocked: false };
  }
  return { unlocked: true, saved: readWorkspace(data.workspace) };
}

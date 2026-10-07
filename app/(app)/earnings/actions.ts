"use server";

import { cookies } from "next/headers";
import type { Plan, Report } from "@/lib/earnings";
import {
  EARNINGS_COOKIE,
  EARNINGS_SESSION_SECONDS,
  earningsSession,
} from "@/lib/earnings-session";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function unlockEarnings(
  attempt: string,
): Promise<{ error?: string }> {
  if (typeof attempt !== "string" || !attempt || attempt.length > 200) {
    return { error: "Enter the earnings password." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("earnings_unlock", { attempt });
  if (error) {
    return {
      error: error.message.startsWith("Too many attempts")
        ? error.message
        : "Couldn't check the password. Try again.",
    };
  }
  if (!data) return { error: "That password isn't right." };

  (await cookies()).set({
    name: EARNINGS_COOKIE,
    value: data,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EARNINGS_SESSION_SECONDS,
  });
  return {};
}

export async function saveEarnings(
  report: Report,
  plan: Plan,
): Promise<{ savedAt?: string; savedBy?: string | null; error?: string }> {
  const session = await earningsSession();
  if (!session) return { error: "The earnings dashboard is locked." };
  if (
    !isRecord(report) ||
    !Array.isArray(report.rows) ||
    !isRecord(plan) ||
    !Array.isArray(plan.programmes)
  ) {
    return { error: "There's nothing to save yet." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("earnings_save", {
    session,
    report: report as unknown as Json,
    plan: plan as unknown as Json,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "The earnings dashboard locked itself. Unlock it again to save."
          : "Couldn't save. Try again.",
    };
  }
  const { data: claims } = await supabase.auth.getClaims();
  return {
    savedAt: data,
    savedBy: (claims?.claims?.email as string | undefined) ?? null,
  };
}

export async function lockEarnings() {
  const session = await earningsSession();
  if (session) {
    const supabase = await createClient();
    await supabase.rpc("earnings_lock", { session });
  }
  (await cookies()).delete(EARNINGS_COOKIE);
}

import type { Metadata } from "next";
import Earnings from "@/components/earnings/earnings";
import EarningsLock from "@/components/earnings/earnings-lock";
import NoAccess from "@/components/leads/no-access";
import { getCostStats, type CostStats } from "@/lib/costs";
import { earningsSession, loadEarnings } from "@/lib/earnings-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Earnings · Sales CRM" };

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : null;

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_stages").select("id").limit(1);
  if (!data?.length) return <NoAccess />;

  const earnings = await loadEarnings();
  const session = await earningsSession();
  if (!earnings.unlocked || !session) return <EarningsLock />;

  const params = await searchParams;

  return (
    <Earnings
      saved={earnings.saved}
      costs={getCostStats(session).catch(
        (err): CostStats => ({
          status: "disconnected",
          reason: err instanceof Error ? err.message : "Couldn't reach Sage.",
        }),
      )}
      costsFlash={{
        outcome: param(params.sage),
        detail: param(params.detail),
      }}
    />
  );
}

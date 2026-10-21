import type { Metadata } from "next";
import NoAccess from "@/components/leads/no-access";
import QrCodes from "@/components/qr-codes/qr-codes";
import { totalsById } from "@/lib/qr-codes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "QR codes · Sales CRM" };

export default async function QrCodesPage() {
  const supabase = await createClient();
  const [stagesResult, codesResult, totalsResult] = await Promise.all([
    supabase.from("lead_stages").select("id, label").order("position"),
    supabase
      .from("qr_codes")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.rpc("qr_code_totals"),
  ]);

  const stages = stagesResult.data ?? [];
  if (stages.length === 0) return <NoAccess />;

  return (
    <QrCodes
      initialCodes={codesResult.data ?? []}
      initialTotals={totalsById(totalsResult.data ?? [])}
      stageLabels={Object.fromEntries(stages.map((s) => [s.id, s.label]))}
    />
  );
}

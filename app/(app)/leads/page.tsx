import type { Metadata } from "next";
import Leads from "@/components/leads/leads";
import NoAccess from "@/components/leads/no-access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Website leads · Sales CRM" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const [
    stagesResult,
    leadsResult,
    eventsResult,
    columnsResult,
    adminResult,
    qrResult,
  ] = await Promise.all([
    supabase.from("lead_stages").select("*").order("position"),
    supabase
      .from("leads")
      .select("*")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("lead_activities")
      .select("lead_id, kind, from_stage, to_stage, body, created_at")
      .in("kind", ["received", "imported", "stage", "active"])
      .order("created_at"),
    supabase
      .from("board_columns")
      .select("*")
      .eq("board", "leads")
      .order("position"),
    supabase.rpc("crm_is_admin"),
    supabase.from("qr_codes").select("id, name, slug").order("name"),
  ]);

  const stages = stagesResult.data ?? [];
  if (stages.length === 0) return <NoAccess />;

  return (
    <Leads
      stages={stages}
      initialLeads={leadsResult.data ?? []}
      initialEvents={eventsResult.data ?? []}
      initialColumns={columnsResult.data ?? []}
      canAdd
      isAdmin={adminResult.data === true}
      qrCodes={qrResult.data ?? []}
    />
  );
}

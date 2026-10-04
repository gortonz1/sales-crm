import type { Metadata } from "next";
import Leads from "@/components/leads/leads";
import NoAccess from "@/components/leads/no-access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Website leads · Sales CRM" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const [stagesResult, leadsResult] = await Promise.all([
    supabase.from("lead_stages").select("*").order("position"),
    supabase
      .from("leads")
      .select("*")
      .order("submitted_at", { ascending: false }),
  ]);

  const stages = stagesResult.data ?? [];
  if (stages.length === 0) return <NoAccess />;

  return <Leads stages={stages} initialLeads={leadsResult.data ?? []} />;
}

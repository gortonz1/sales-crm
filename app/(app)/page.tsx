import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/dashboard";
import NoAccess from "@/components/leads/no-access";
import { PIPELINE_STAGE_IDS } from "@/lib/leads";
import {
  PIPELINE_STATUSES,
  forecastMonths,
  isForecastable,
  monthKey,
  monthStart,
} from "@/lib/recruitment";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard · Sales CRM" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [stagesResult, recruitmentsResult, leadsResult, optInsResult] =
    await Promise.all([
      supabase
        .from("lead_stages")
        .select("id, label, position")
        .order("position"),
      supabase.from("recruitments").select("status, board_group, est_start"),
      supabase.from("leads").select("stage, active, enquiry_type"),
      supabase
        .from("course_interests")
        .select("id", { count: "exact", head: true })
        .eq("source", "mock-exam"),
    ]);

  const stages = stagesResult.data ?? [];
  if (!stages.length) return <NoAccess />;

  const now = new Date();
  const recruitments = (recruitmentsResult.data ?? []).filter(
    (item) => isForecastable(item) && PIPELINE_STATUSES.includes(item.status),
  );
  const months = forecastMonths(now).map((month) => {
    const inMonth = recruitments.filter((item) => item.est_start === month);
    return {
      month,
      counts: PIPELINE_STATUSES.map((status) => ({
        status,
        count: inMonth.filter((item) => item.status === status).length,
      })),
    };
  });

  const leads = leadsResult.data ?? [];
  const activeLeads = leads.filter(
    (lead) => lead.active && PIPELINE_STAGE_IDS.includes(lead.stage),
  );
  const leadStages = stages
    .filter((stage) => PIPELINE_STAGE_IDS.includes(stage.id))
    .map((stage) => ({
      id: stage.id,
      label: stage.label,
      count: activeLeads.filter((lead) => lead.stage === stage.id).length,
    }));

  return (
    <Dashboard
      currentMonth={monthKey(monthStart(now))}
      months={months}
      activeLeads={activeLeads.length}
      leadStages={leadStages}
      aiEnquiries={
        leads.filter((lead) => lead.enquiry_type === "ai-level-4").length
      }
      aiOptIns={optInsResult.count ?? 0}
    />
  );
}

import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/dashboard";
import NoAccess from "@/components/leads/no-access";
import {
  AI_COURSE_ENQUIRY,
  INTEREST_OPTIONS,
  PIPELINE_STAGE_IDS,
} from "@/lib/leads";
import {
  PIPELINE_STATUSES,
  addMonths,
  forecastMonths,
  isForecastable,
  monthKey,
  monthStart,
} from "@/lib/recruitment";
import { createClient } from "@/lib/supabase/server";

const OPEN_LEAD_STAGES = PIPELINE_STAGE_IDS.filter(
  (stage) => stage !== "recruiting" && stage !== "started",
);
const SIGNED_STATUSES = ["signed-up", "completed"];

export const metadata: Metadata = { title: "Dashboard · Sales CRM" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [stagesResult, recruitmentsResult, leadsResult, optInsResult] =
    await Promise.all([
      supabase
        .from("lead_stages")
        .select("id, label, position")
        .order("position"),
      supabase
        .from("recruitments")
        .select("status, board_group, est_start, source"),
      supabase.from("leads").select("stage, active, enquiry_type, interest"),
      supabase
        .from("course_interests")
        .select("interest")
        .eq("source", "mock-exam"),
    ]);

  const stages = stagesResult.data ?? [];
  if (!stages.length) return <NoAccess />;

  const now = new Date();
  const allRecruitments = recruitmentsResult.data ?? [];
  const recruitments = allRecruitments.filter(
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

  const base = monthStart(now);
  const signupMonths = Array.from({ length: 12 }, (_, i) =>
    monthKey(addMonths(base, i - 11)),
  );
  const signups = signupMonths.map((month) => ({
    month,
    counts: {} as Record<string, number>,
  }));
  for (const item of allRecruitments) {
    if (!isForecastable(item) || !SIGNED_STATUSES.includes(item.status))
      continue;
    const month = item.est_start;
    const entry = signups.find((row) => row.month === month);
    if (!entry) continue;
    const source = item.source ?? "none";
    entry.counts[source] = (entry.counts[source] ?? 0) + 1;
  }

  const leads = leadsResult.data ?? [];
  const activeLeads = leads.filter(
    (lead) => lead.active && OPEN_LEAD_STAGES.includes(lead.stage),
  );
  const leadStages = stages
    .filter((stage) => OPEN_LEAD_STAGES.includes(stage.id))
    .map((stage) => ({
      id: stage.id,
      label: stage.label,
      count: activeLeads.filter((lead) => lead.stage === stage.id).length,
    }));

  const rated = [
    ...leads
      .filter((lead) => lead.enquiry_type === AI_COURSE_ENQUIRY)
      .map((lead) => lead.interest),
    ...(optInsResult.data ?? []).map((item) => item.interest),
  ];
  const aiInterest = INTEREST_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    color: option.color,
    count: rated.filter((value) => value === option.value).length,
  }));

  return (
    <Dashboard
      currentMonth={monthKey(monthStart(now))}
      months={months}
      activeLeads={activeLeads.length}
      leadStages={leadStages}
      aiInterest={aiInterest}
      signups={signups}
    />
  );
}

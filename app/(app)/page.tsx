import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/dashboard";
import NoAccess from "@/components/leads/no-access";
import { PIPELINE_STAGE_IDS } from "@/lib/leads";
import {
  columnOptions,
  customValue,
  type BoardColumn,
  type CustomRow,
} from "@/lib/columns";
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
const INTEREST_LABELS = ["potential", "solid"];

function aiInterest(
  columns: BoardColumn[],
  optIns: Pick<CustomRow, "custom">[],
  enquiries: Pick<CustomRow, "custom">[],
) {
  const counts = new Map<
    string,
    { key: string; label: string; color?: string; count: number }
  >();
  for (const label of INTEREST_LABELS) {
    counts.set(label, { key: label, label: "", count: 0 });
  }
  let configured = false;
  for (const column of columns) {
    const rows = column.board === "mock-exam" ? optIns : enquiries;
    for (const option of columnOptions(column)) {
      const key = option.label.trim().toLowerCase();
      const entry = counts.get(key);
      if (!entry) continue;
      configured = true;
      entry.label ||= option.label.trim();
      entry.color ??= option.color;
      entry.count += rows.filter(
        (row) => customValue(row, column.id) === option.value,
      ).length;
    }
  }
  return {
    configured,
    rows: [...counts.values()].filter((row) => row.label),
  };
}

export const metadata: Metadata = { title: "Dashboard · Sales CRM" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [
    stagesResult,
    recruitmentsResult,
    leadsResult,
    optInsResult,
    columnsResult,
  ] = await Promise.all([
    supabase
      .from("lead_stages")
      .select("id, label, position")
      .order("position"),
    supabase
      .from("recruitments")
      .select("status, board_group, est_start, signed_up_on, source"),
    supabase.from("leads").select("stage, active, enquiry_type, custom"),
    supabase
      .from("course_interests")
      .select("custom")
      .eq("source", "mock-exam"),
    supabase
      .from("board_columns")
      .select("*")
      .in("board", ["mock-exam", "ai-enquiries"])
      .is("field", null)
      .eq("type", "status"),
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
    if (item.status !== "signed-up") continue;
    const month = item.signed_up_on
      ? monthKey(monthStart(new Date(`${item.signed_up_on}T00:00:00Z`)))
      : item.est_start;
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

  return (
    <Dashboard
      currentMonth={monthKey(monthStart(now))}
      months={months}
      activeLeads={activeLeads.length}
      leadStages={leadStages}
      aiInterest={aiInterest(
        columnsResult.data ?? [],
        optInsResult.data ?? [],
        leads.filter((lead) => lead.enquiry_type === "ai-level-4"),
      )}
      signups={signups}
    />
  );
}

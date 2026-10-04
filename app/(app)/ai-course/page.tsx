import type { Metadata } from "next";
import Leads from "@/components/leads/leads";
import AiCourseSubnav from "@/components/ai-course/subnav";
import NoAccess from "@/components/leads/no-access";
import { ALL } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI in Marketing L4 · Sales CRM",
};

export default async function AiCoursePage() {
  const supabase = await createClient();
  const [stagesResult, leadsResult] = await Promise.all([
    supabase.from("lead_stages").select("*").order("position"),
    supabase
      .from("leads")
      .select("*")
      .eq("enquiry_type", "ai-level-4")
      .order("submitted_at", { ascending: false }),
  ]);

  const stages = stagesResult.data ?? [];
  if (stages.length === 0) return <NoAccess />;

  const leads = leadsResult.data ?? [];
  const eventsResult = leads.length
    ? await supabase
        .from("lead_activities")
        .select("lead_id, kind, from_stage, to_stage, body, created_at")
        .in("kind", ["received", "imported", "stage", "active"])
        .in(
          "lead_id",
          leads.map((lead) => lead.id),
        )
        .order("created_at")
    : { data: [] };

  return (
    <Leads
      stages={stages}
      initialLeads={leads}
      initialEvents={eventsResult.data ?? []}
      title="AI in Marketing Level 4"
      defaultFilter={ALL}
      subnav={<AiCourseSubnav current="/ai-course" />}
      emptyMessage="Nobody has picked “AI in Marketing Level 4” on the website contact form yet. When they do, their enquiry appears here as well as in Website leads."
    />
  );
}

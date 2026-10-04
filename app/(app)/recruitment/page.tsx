import type { Metadata } from "next";
import Recruitment from "@/components/recruitment/recruitment";
import NoAccess from "@/components/leads/no-access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recruitment · Sales CRM" };

export default async function RecruitmentPage() {
  const supabase = await createClient();
  const [stagesResult, itemsResult, leadsResult, columnsResult] =
    await Promise.all([
      supabase.from("lead_stages").select("id").limit(1),
      supabase
        .from("recruitments")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("leads").select("id, name, organisation"),
      supabase
        .from("board_columns")
        .select("*")
        .eq("board", "recruitment")
        .order("position"),
    ]);

  if (!stagesResult.data?.length) return <NoAccess />;

  return (
    <Recruitment
      initialItems={itemsResult.data ?? []}
      initialColumns={columnsResult.data ?? []}
      leads={leadsResult.data ?? []}
    />
  );
}

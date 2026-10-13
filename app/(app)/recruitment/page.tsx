import type { Metadata } from "next";
import Recruitment from "@/components/recruitment/recruitment";
import NoAccess from "@/components/leads/no-access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recruitment · Sales CRM" };

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  const supabase = await createClient();
  const [stagesResult, itemsResult, leadsResult, columnsResult, adminResult] =
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
      supabase.rpc("crm_is_admin"),
    ]);

  if (!stagesResult.data?.length) return <NoAccess />;

  return (
    <Recruitment
      initialItems={itemsResult.data ?? []}
      initialColumns={columnsResult.data ?? []}
      leads={leadsResult.data ?? []}
      initialSelectedId={isUuid(item) ? item : null}
      isAdmin={adminResult.data === true}
    />
  );
}

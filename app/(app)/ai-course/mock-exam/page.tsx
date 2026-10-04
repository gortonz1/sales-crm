import type { Metadata } from "next";
import MockExamOptIns from "@/components/ai-course/mock-exam-opt-ins";
import NoAccess from "@/components/leads/no-access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mock exam opt-ins · AI in Marketing L4 · Sales CRM",
};

export default async function MockExamOptInsPage() {
  const supabase = await createClient();
  const [stagesResult, itemsResult, columnsResult] = await Promise.all([
    supabase.from("lead_stages").select("id").limit(1),
    supabase
      .from("course_interests")
      .select("*")
      .eq("source", "mock-exam")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("board_columns")
      .select("*")
      .eq("board", "mock-exam")
      .order("position"),
  ]);

  if (!stagesResult.data?.length) return <NoAccess />;

  return (
    <MockExamOptIns
      initialItems={itemsResult.data ?? []}
      initialColumns={columnsResult.data ?? []}
    />
  );
}

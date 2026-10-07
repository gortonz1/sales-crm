import type { Metadata } from "next";
import Earnings from "@/components/earnings/earnings";
import NoAccess from "@/components/leads/no-access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Earnings · Sales CRM" };

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_stages").select("id").limit(1);
  if (!data?.length) return <NoAccess />;

  return <Earnings />;
}

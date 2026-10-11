import type { Metadata } from "next";
import Team from "@/components/team/team";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team · Sales CRM" };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("crm_is_admin");
  if (!isAdmin) {
    return (
      <section className="flex flex-1 items-center justify-center px-4">
        <div className="flex max-w-[28em] flex-col gap-2 text-center">
          <h1>Admins only</h1>
          <p className="text-soft">
            Only CRM admins can add people or change who&apos;s an admin. Ask an
            admin if you need someone added.
          </p>
        </div>
      </section>
    );
  }
  const { data: members } = await supabase.rpc("crm_team");
  return <Team initialMembers={members ?? []} />;
}

import Sidebar from "@/components/_common/sidebar/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const [{ data }, boardsResult, adminResult] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("boards")
      .select("id, name")
      .is("deleted_at", null)
      .order("position"),
    supabase.rpc("crm_is_admin"),
  ]);
  const email = (data?.claims?.email as string | undefined) ?? null;

  return (
    <main className="flex h-dvh max-w-full overflow-hidden">
      <Sidebar
        email={email}
        boards={boardsResult.data ?? []}
        isAdmin={adminResult.data === true}
      />
      {children}
    </main>
  );
}

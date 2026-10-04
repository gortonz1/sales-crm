import Sidebar from "@/components/_common/sidebar/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;

  return (
    <main className="flex h-dvh max-w-full overflow-hidden">
      <Sidebar email={email} />
      {children}
    </main>
  );
}

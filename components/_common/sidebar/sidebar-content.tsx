"use client";

import { usePathname, useRouter } from "next/navigation";
import { ScrollArea } from "@/components/_ui/scroll-area";
import SidebarNavItem from "./sidebar-nav-item";
import SidebarSection from "./sidebar-section";
import { useCompaniesStore } from "@/stores/companies-store";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/public/assets/images/_common/logo.svg";
import BuildingIcon from "@/public/assets/images/companies/sidebar/building.svg";
import MailIcon from "@/public/assets/images/companies/sidebar/mail.svg";
import UsersIcon from "@/public/assets/images/companies/sidebar/users.svg";

export default function SidebarContent({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center gap-2 border-b p-3">
        <Logo aria-hidden className="size-8 shrink-0 overflow-visible" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="lead-style block truncate font-medium tracking-[-0.01em]">
            Sales CRM
          </span>
          <span className="caption-style text-subtle block truncate">
            The Marketing Trainer
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Primary">
          <SidebarSection className="border-sidebar-border border-b">
            <SidebarNavItem
              icon={MailIcon}
              label="Website leads"
              href="/leads"
              onClick={closeSidebar}
              active={pathname.startsWith("/leads")}
            />
          </SidebarSection>

          <SidebarSection title="Sample data">
            <SidebarNavItem
              icon={BuildingIcon}
              label="Companies"
              href="/companies"
              onClick={closeSidebar}
              active={pathname.startsWith("/companies")}
            />
          </SidebarSection>
        </nav>
      </ScrollArea>

      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 flex-col gap-2 border-t p-3">
        {email && (
          <span className="caption-style text-subtle block truncate px-2">
            {email}
          </span>
        )}
        <ul className="flex flex-col">
          <SidebarNavItem
            icon={UsersIcon}
            label="Sign out"
            tone="quiet"
            onClick={signOut}
          />
        </ul>
      </div>
    </div>
  );
}

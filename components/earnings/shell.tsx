"use client";

import type { ReactNode } from "react";
import Button from "@/components/_ui/button";
import { useCompaniesStore } from "@/stores/companies-store";
import MenuIcon from "@/public/assets/images/_common/menu.svg";

export default function EarningsShell({
  badge,
  actions,
  toolbar,
  children,
}: {
  badge?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-border shrink-0 border-b">
        <div className="flex items-center justify-between gap-2 px-4 py-[14px]">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon aria-hidden className="size-3.5" />
            </Button>
            <h1 className="truncate">Earnings</h1>
            {badge && (
              <span className="caption-style bg-muted border-pill hidden shrink-0 rounded-full border px-2 py-[3px] sm:inline">
                {badge}
              </span>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
        {toolbar && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
            {toolbar}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {children}
      </div>
    </section>
  );
}

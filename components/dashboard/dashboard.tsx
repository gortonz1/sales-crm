"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Button from "@/components/_ui/button";
import { STAGE_COLORS } from "@/lib/leads";
import { formatLongMonth, statusColor, statusLabel } from "@/lib/recruitment";
import { cn } from "@/lib/utils";
import { useCompaniesStore } from "@/stores/companies-store";
import SignupsChart, { type SignupMonth } from "./signups-chart";
import MenuIcon from "@/public/assets/images/_common/menu.svg";

type MonthSummary = {
  month: string;
  counts: { status: string; count: number }[];
};

const tileClass =
  "border-line-strong bg-card hover:bg-secondary focus-visible:ring-ring/60 flex flex-col gap-4 rounded-xl border p-4 transition-colors duration-150 outline-none focus-visible:ring-2";

function Breakdown({
  rows,
}: {
  rows: { key: string; label: string; color?: string; count: number }[];
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li
          key={row.key}
          className="caption-style flex items-center justify-between gap-2"
        >
          <span className="text-subtle flex min-w-0 items-center gap-1.5">
            {row.color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            )}
            <span className="truncate">{row.label}</span>
          </span>
          <span
            className={cn(
              "tabular-nums",
              row.count === 0 ? "text-faint" : "text-foreground",
            )}
          >
            {row.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatTile({
  href,
  label,
  value,
  detail,
  children,
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={tileClass}>
      <div className="flex flex-col gap-2">
        <h2 className="caption-style text-subtle font-medium">{label}</h2>
        <span className="text-[32px] leading-none font-medium tabular-nums">
          {value}
        </span>
        <span className="caption-style text-subtle">{detail}</span>
      </div>
      {children}
    </Link>
  );
}

function StackedBar({ counts }: { counts: MonthSummary["counts"] }) {
  const filled = counts.filter((row) => row.count > 0);
  if (!filled.length) {
    return <div aria-hidden className="bg-muted h-1.5 rounded-full" />;
  }
  return (
    <div aria-hidden className="flex h-1.5 gap-[2px]">
      {filled.map((row) => (
        <span
          key={row.status}
          title={`${statusLabel(row.status)}: ${row.count}`}
          className="h-full rounded-full"
          style={{
            flexGrow: row.count,
            backgroundColor: statusColor(row.status),
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard({
  currentMonth,
  months,
  activeLeads,
  leadStages,
  aiInterest,
  signups,
}: {
  currentMonth: string;
  months: MonthSummary[];
  activeLeads: number;
  leadStages: { id: string; label: string; count: number }[];
  aiInterest: {
    configured: boolean;
    rows: { key: string; label: string; color?: string; count: number }[];
  };
  signups: SignupMonth[];
}) {
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-border flex shrink-0 items-center gap-2 border-b px-4 py-[14px]">
        <Button
          variant="secondary"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon aria-hidden className="size-3.5" />
        </Button>
        <h1 className="truncate">Dashboard</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            href="/leads"
            label="Active website leads"
            value={activeLeads}
            detail="Genuine leads not yet recruiting or started, and not gone cold"
          >
            <Breakdown
              rows={leadStages.map((stage) => ({
                key: stage.id,
                label: stage.label,
                color: STAGE_COLORS[stage.id],
                count: stage.count,
              }))}
            />
          </StatTile>
          <StatTile
            href="/ai-course/mock-exam"
            label="AI in Marketing Level 4 interest"
            value={aiInterest.rows.reduce((sum, row) => sum + row.count, 0)}
            detail={
              aiInterest.configured
                ? "Marked Potential or Solid in the Status column"
                : "Add Potential and Solid labels to a Status column on the AI in Marketing L4 tab to count them here"
            }
          >
            {aiInterest.configured && <Breakdown rows={aiInterest.rows} />}
          </StatTile>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <h2>Apprentices by start month</h2>
            <p className="caption-style text-subtle">
              Recruitments that are working on, shortlisted, interviewing,
              completed or signed up, by estimated start month. The last 3
              months, this month and the next 3.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 min-[30em]:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
            {months.map(({ month, counts }) => {
              const rows = [...counts].reverse();
              const total = rows.reduce((sum, row) => sum + row.count, 0);
              const isCurrent = month === currentMonth;
              return (
                <li key={month}>
                  <Link
                    href="/recruitment"
                    aria-label={`${formatLongMonth(month)}: ${total} apprentices`}
                    className={cn(
                      tileClass,
                      "h-full gap-3",
                      isCurrent && "border-ring/70",
                    )}
                  >
                    <h3
                      className={cn(
                        "caption-style truncate font-medium",
                        month < currentMonth && "text-soft",
                      )}
                    >
                      {formatLongMonth(month)}
                    </h3>
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-[28px] leading-none font-medium tabular-nums">
                        {total}
                      </span>
                      {isCurrent && (
                        <span className="caption-style bg-muted shrink-0 rounded-full border border-[#363636] px-2 py-[2px]">
                          This month
                        </span>
                      )}
                    </div>
                    <StackedBar counts={rows} />
                    <Breakdown
                      rows={rows.map((row) => ({
                        key: row.status,
                        label: statusLabel(row.status),
                        color: statusColor(row.status),
                        count: row.count,
                      }))}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <SignupsChart months={signups} currentMonth={currentMonth} />
      </div>
    </section>
  );
}

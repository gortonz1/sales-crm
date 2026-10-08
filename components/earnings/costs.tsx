"use client";

import { use } from "react";
import { buttonVariants } from "@/components/_ui/button";
import type { CostStats } from "@/lib/costs";
import { gbp } from "@/lib/earnings";
import type { MonthCosts } from "@/lib/sage-costs";
import { cn } from "@/lib/utils";
import CostsControls from "./costs-controls";
import { Footnote, Meter, Panel, Swatch } from "./panel";

const COST_SERIES = [
  { key: "overheads", label: "Overheads", color: "#4c8df6" },
  { key: "direct", label: "Direct costs", color: "#d95926" },
] as const;

const PLOT_HEIGHT = 180;

const shortMonth = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});
const longMonth = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const fetchedTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});
const connectedDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

const monthDate = (key: string) => new Date(`${key}-01T00:00:00Z`);

export type CostsFlash = { outcome: string | null; detail: string | null };

function ConnectLink({ label }: { label: string }) {
  return (
    <a
      href="/api/sage/connect"
      className={buttonVariants({ variant: "primary", size: "sm" })}
    >
      {label}
    </a>
  );
}

function FlashNote({ flash }: { flash: CostsFlash }) {
  if (flash.outcome === "connected") {
    return (
      <p role="status" className="caption-style text-(--tag-green-text)">
        Sage is connected. The figures below come straight from your books.
      </p>
    );
  }
  if (flash.outcome === "error") {
    return (
      <p role="status" className="caption-style text-(--tag-red-text)">
        Couldn&apos;t connect to Sage.{flash.detail ? ` ${flash.detail}` : ""}
      </p>
    );
  }
  return null;
}

function CostsChart({ months }: { months: MonthCosts[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(0, m.total)));

  return (
    <Panel
      title="Costs per month"
      description={`Peak month ${gbp(max)}. The last bar is this month so far.`}
    >
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Key">
        {COST_SERIES.map((series) => (
          <li
            key={series.key}
            className="caption-style text-soft flex items-center gap-1.5"
          >
            <Swatch color={series.color} />
            {series.label}
          </li>
        ))}
      </ul>
      <ol
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
        }}
        aria-label="Costs per month"
      >
        {months.map((month) => {
          const segments = COST_SERIES.map((series) => ({
            ...series,
            value: Math.max(0, month[series.key]),
          })).filter((segment) => segment.value > 0);
          return (
            <li
              key={month.month}
              className="flex min-w-0 flex-col items-center"
              title={`${longMonth.format(monthDate(month.month))}: ${gbp(month.total, 2)}`}
            >
              <span
                className="flex w-full flex-col items-center justify-end px-[3px] sm:px-1.5"
                style={{ height: PLOT_HEIGHT }}
              >
                <span className="flex w-full max-w-10 flex-col-reverse gap-[2px]">
                  {segments.map((segment, i) => (
                    <span
                      key={segment.key}
                      className={cn(
                        "w-full shrink-0",
                        i === segments.length - 1 && "rounded-t-[4px]",
                      )}
                      style={{
                        height: Math.max(
                          2,
                          (segment.value / max) * PLOT_HEIGHT,
                        ),
                        backgroundColor: segment.color,
                      }}
                    />
                  ))}
                </span>
              </span>
              <span className="caption-style text-subtle mt-1.5 truncate leading-none">
                {shortMonth.format(monthDate(month.month))}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function CostsTable({ months }: { months: MonthCosts[] }) {
  const rows = [
    ...COST_SERIES.map((series) => ({
      key: series.key,
      label: series.label,
      color: series.color as string | null,
    })),
    { key: "total" as const, label: "Total", color: null },
  ];
  const yearOf = (key: "direct" | "overheads" | "total") =>
    months.reduce((sum, month) => sum + month[key], 0);

  return (
    <Panel
      title="Monthly costs"
      description="Net of VAT, from the expense accounts in your Sage chart of accounts, so they should match the cost lines of your Profit and Loss report."
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="caption-style w-full min-w-[64em] text-left tabular-nums">
          <thead>
            <tr className="text-subtle">
              <th className="py-1.5 pr-3 font-normal">
                <span className="sr-only">Costs</span>
              </th>
              {months.map((month) => (
                <th
                  key={month.month}
                  className="px-2 py-1.5 text-right font-normal"
                >
                  {shortMonth.format(monthDate(month.month))}
                </th>
              ))}
              <th className="py-1.5 pl-2 text-right font-normal">12 months</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-line-strong border-t">
                <td className="text-soft py-1.5 pr-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    {row.color && (
                      <Swatch
                        color={row.color}
                        className="size-2 rounded-[2px]"
                      />
                    )}
                    {row.label}
                  </span>
                </td>
                {months.map((month) => (
                  <td
                    key={month.month}
                    className={cn(
                      "px-2 py-1.5 text-right",
                      row.key === "total" && "font-medium",
                      month[row.key] ? "text-foreground" : "text-faint",
                    )}
                  >
                    {month[row.key] ? gbp(month[row.key]) : "—"}
                  </td>
                ))}
                <td
                  className={cn(
                    "py-1.5 pl-2 text-right",
                    row.key === "total" && "font-medium",
                  )}
                >
                  {gbp(yearOf(row.key))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Categories({
  stats,
}: {
  stats: Extract<CostStats, { status: "ok" }>;
}) {
  const last = stats.months[stats.months.length - 2];
  const max = Math.max(1, ...stats.byAccount.map((row) => row.amount));
  const lastMax = Math.max(
    1,
    ...(last?.byAccount ?? []).map((row) => row.amount),
  );

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Panel
        title="Where it goes"
        description="Each expense category over the last 12 months."
      >
        {stats.byAccount.length ? (
          <div className="flex flex-col gap-3">
            {stats.byAccount.map((row) => (
              <Meter
                key={row.label}
                label={row.label}
                value={gbp(row.amount)}
                share={row.amount / max}
                color={COST_SERIES[0].color}
              />
            ))}
          </div>
        ) : (
          <p className="caption-style text-subtle">Nothing posted yet.</p>
        )}
      </Panel>
      {last && (
        <Panel
          title={`${longMonth.format(monthDate(last.month))} in detail`}
          description="The last complete month, by category."
        >
          {last.byAccount.length ? (
            <div className="flex flex-col gap-3">
              {last.byAccount.map((row) => (
                <Meter
                  key={row.label}
                  label={row.label}
                  value={gbp(row.amount, 2)}
                  share={row.amount / lastMax}
                  color={COST_SERIES[0].color}
                />
              ))}
            </div>
          ) : (
            <p className="caption-style text-subtle">
              Nothing posted that month.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

function ConnectionNote({
  stats,
}: {
  stats: Extract<CostStats, { status: "ok" | "error" }>;
}) {
  const { connection } = stats;
  return (
    <Footnote>
      Connected to {connection.businessName ?? "your Sage business"}
      {connection.connectedAt &&
        ` since ${connectedDay.format(new Date(connection.connectedAt))}`}
      {connection.connectedBy && ` by ${connection.connectedBy}`}.
      {stats.status === "ok" &&
        ` Figures are kept for an hour; last fetched ${fetchedTime.format(new Date(stats.generatedAt))}.`}
    </Footnote>
  );
}

export default function Costs({
  stats: pending,
  flash,
}: {
  stats: Promise<CostStats>;
  flash: CostsFlash;
}) {
  const stats = use(pending);

  if (stats.status === "unconfigured") {
    return (
      <Panel
        title="Costs"
        description="Monthly costs from Sage Accounting appear here once the app is set up."
      >
        <FlashNote flash={flash} />
        <p className="caption-style text-subtle leading-[1.4]">
          Add <code>SAGE_CLIENT_ID</code> and <code>SAGE_CLIENT_SECRET</code> to
          this app&apos;s environment on Railway, from the app registered at
          developer.sage.com. Its callback URL must be this site&apos;s{" "}
          <code>/api/sage/callback</code>.
        </p>
      </Panel>
    );
  }

  if (stats.status === "disconnected") {
    return (
      <Panel
        title="Costs"
        description={
          stats.reason ??
          "Connect Sage Accounting to see what the business spends each month. Access is read-only, so nothing here can change your books."
        }
        actions={
          <ConnectLink
            label={stats.reason ? "Reconnect Sage" : "Connect Sage"}
          />
        }
      >
        <FlashNote flash={flash} />
      </Panel>
    );
  }

  if (stats.status === "error") {
    return (
      <Panel title="Costs" actions={<CostsControls />}>
        <p className="caption-style leading-[1.4] break-words text-(--tag-red-text)">
          Couldn&apos;t load figures from Sage. {stats.message}
        </p>
        <ConnectionNote stats={stats} />
      </Panel>
    );
  }

  const lastLabel = longMonth.format(monthDate(stats.lastMonth.month));
  const change = stats.lastMonth.changePct;
  const tiles = [
    {
      label: `Last month · ${lastLabel}`,
      value: gbp(stats.lastMonth.total),
      detail:
        change === null
          ? "no earlier month to compare"
          : `${change >= 0 ? "up" : "down"} ${Math.abs(change)}% on the month before`,
    },
    {
      label: "Monthly average",
      value: gbp(stats.monthlyAverage),
      detail: `over the last ${stats.months.length - 1} complete months`,
    },
    {
      label: "This month so far",
      value: gbp(stats.months[stats.months.length - 1]?.total ?? 0),
      detail: "updates as costs are posted in Sage",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-3">
          <span className="eyebrow-style text-subtle text-[11px] leading-[1.4]">
            Costs from Sage · last 12 months
            {stats.connection.businessName &&
              ` · ${stats.connection.businessName}`}
          </span>
          <span className="text-[40px] leading-none font-medium tracking-[-0.02em] tabular-nums">
            {gbp(stats.total)}
          </span>
        </div>
        <CostsControls />
      </div>

      <FlashNote flash={flash} />

      {stats.truncated && (
        <p className="caption-style text-(--tag-red-text)">
          The ledger was too large to fetch in full, so these totals are
          partial.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 min-[30em]:grid-cols-3">
        {tiles.map((tile) => (
          <li
            key={tile.label}
            className="border-line-strong bg-card flex flex-col gap-2 rounded-xl border p-4"
          >
            <h2 className="caption-style text-subtle font-medium">
              {tile.label}
            </h2>
            <span className="text-[28px] leading-none font-medium tabular-nums">
              {tile.value}
            </span>
            <span className="caption-style text-subtle">{tile.detail}</span>
          </li>
        ))}
      </ul>

      <CostsChart months={stats.months} />
      <CostsTable months={stats.months} />
      <Categories stats={stats} />
      <ConnectionNote stats={stats} />
    </div>
  );
}

export function CostsLoading() {
  return (
    <Panel title="Costs" description="Fetching this month's figures from Sage…">
      <div
        aria-hidden
        className="bg-muted h-[180px] animate-pulse rounded-lg"
      />
    </Panel>
  );
}

"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import { SOURCES, formatLongMonth } from "@/lib/recruitment";
import { cn } from "@/lib/utils";

export type SignupMonth = {
  month: string;
  counts: Record<string, number>;
};

const NOT_SET = { value: "none", label: "Source not set", color: "#6b6b6b" };
const SERIES = [...SOURCES, NOT_SET];
const PLOT_HEIGHT = 176;

const shortMonth = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

function niceMax(value: number) {
  if (value <= 4) return 4;
  const step = value <= 10 ? 2 : value <= 25 ? 5 : 10;
  return Math.ceil(value / step) * step;
}

export default function SignupsChart({
  months,
  currentMonth,
}: {
  months: SignupMonth[];
  currentMonth: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const series = SERIES.filter((source) =>
    months.some((month) => (month.counts[source.value] ?? 0) > 0),
  );
  const totals = months.map((month) =>
    series.reduce((sum, source) => sum + (month.counts[source.value] ?? 0), 0),
  );
  const total = totals.reduce((sum, value) => sum + value, 0);
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [0, max / 2, max];

  return (
    <section className="border-line-strong bg-card flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2>Sign-ups by source</h2>
          <p className="caption-style text-subtle">
            {total} signed up over the last 12 months, by month of sign-up (or
            estimated start where no sign-up date is set).
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={showTable}
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? "Show chart" : "Show table"}
        </Button>
      </div>

      {series.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Sources">
          {series.map((source) => (
            <li
              key={source.value}
              className="caption-style text-soft flex items-center gap-1.5"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-[3px]"
                style={{ backgroundColor: source.color }}
              />
              {source.label}
            </li>
          ))}
        </ul>
      )}

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="caption-style w-full min-w-[36em] text-left tabular-nums">
            <thead>
              <tr className="text-subtle">
                <th className="py-1.5 pr-3 font-normal">Month</th>
                {series.map((source) => (
                  <th
                    key={source.value}
                    className="px-2 py-1.5 text-right font-normal"
                  >
                    {source.label}
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, i) => (
                <tr key={month.month} className="border-line-strong border-t">
                  <td className="py-1.5 pr-3">
                    {formatLongMonth(month.month)}
                  </td>
                  {series.map((source) => (
                    <td key={source.value} className="px-2 py-1.5 text-right">
                      {month.counts[source.value] ?? 0}
                    </td>
                  ))}
                  <td className="py-1.5 pl-2 text-right font-medium">
                    {totals[i]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div
            aria-hidden
            className="caption-style text-faint relative w-5 shrink-0 tabular-nums"
            style={{ height: PLOT_HEIGHT, marginTop: 18 }}
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 translate-y-1/2 leading-none"
                style={{ bottom: (tick / max) * PLOT_HEIGHT }}
              >
                {tick}
              </span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0"
              style={{ top: 18, height: PLOT_HEIGHT }}
            >
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className={cn(
                    "absolute inset-x-0 h-px",
                    tick === 0 ? "bg-line-strong" : "bg-white/[0.05]",
                  )}
                  style={{ bottom: (tick / max) * PLOT_HEIGHT }}
                />
              ))}
            </div>
            <ol
              className="relative flex gap-1 sm:gap-2"
              aria-label="Sign-ups per month"
            >
              {months.map((month, i) => (
                <Bar
                  key={month.month}
                  month={month}
                  total={totals[i]}
                  max={max}
                  series={series}
                  isCurrent={month.month === currentMonth}
                  alignRight={i >= months.length - 3}
                />
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

function Bar({
  month,
  total,
  max,
  series,
  isCurrent,
  alignRight,
}: {
  month: SignupMonth;
  total: number;
  max: number;
  series: typeof SERIES;
  isCurrent: boolean;
  alignRight: boolean;
}) {
  const date = new Date(`${month.month}T00:00:00Z`);
  const segments = series
    .map((source) => ({ ...source, count: month.counts[source.value] ?? 0 }))
    .filter((segment) => segment.count > 0);
  const label = `${formatLongMonth(month.month)}: ${total} signed up${
    segments.length
      ? ` (${segments.map((s) => `${s.label} ${s.count}`).join(", ")})`
      : ""
  }`;

  return (
    <li
      tabIndex={0}
      aria-label={label}
      className="group/bar focus-visible:ring-ring/60 relative flex min-w-0 flex-1 flex-col items-center rounded-md outline-none focus-visible:ring-2"
    >
      <div
        className="flex w-full flex-col items-center justify-end"
        style={{ height: PLOT_HEIGHT + 18 }}
      >
        <span
          className={cn(
            "caption-style h-[18px] leading-[18px] tabular-nums",
            total === 0 ? "text-faint" : "text-soft",
          )}
        >
          {total}
        </span>
        <div className="flex w-full max-w-9 flex-col-reverse gap-[2px] group-hover/bar:brightness-110">
          {segments.map((segment, i) => (
            <span
              key={segment.value}
              className={cn(
                "w-full shrink-0",
                i === segments.length - 1 && "rounded-t-[4px]",
              )}
              style={{
                height: Math.max(
                  2,
                  (segment.count / max) * PLOT_HEIGHT -
                    (i < segments.length - 1 ? 2 : 0),
                ),
                backgroundColor: segment.color,
              }}
            />
          ))}
        </div>
      </div>
      <span
        className={cn(
          "caption-style mt-1.5 truncate leading-none",
          isCurrent ? "text-foreground font-medium" : "text-subtle",
        )}
      >
        {shortMonth.format(date)}
      </span>
      {segments.length > 0 && (
        <div
          role="presentation"
          className={cn(
            "border-line-strong bg-popover shadow-overlay pointer-events-none invisible absolute bottom-full z-10 mb-1 w-max min-w-[11em] rounded-lg border p-2.5 opacity-0 transition-opacity duration-150 group-hover/bar:visible group-hover/bar:opacity-100 group-focus-visible/bar:visible group-focus-visible/bar:opacity-100",
            alignRight ? "right-0" : "left-0",
          )}
        >
          <p className="caption-style mb-1.5 font-medium">
            {formatLongMonth(month.month)} · {total}
          </p>
          <ul className="flex flex-col gap-1">
            {[...segments].reverse().map((segment) => (
              <li
                key={segment.value}
                className="caption-style text-soft flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 rounded-[2px]"
                    style={{ backgroundColor: segment.color }}
                  />
                  {segment.label}
                </span>
                <span className="text-foreground tabular-nums">
                  {segment.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

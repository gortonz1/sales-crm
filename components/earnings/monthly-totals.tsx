"use client";

import { EARNINGS_SERIES, MONTHS, SHORT_MONTHS, gbp } from "@/lib/earnings";
import { cn } from "@/lib/utils";
import type { MonthTotals } from "./earnings-chart";
import { Panel, Swatch } from "./panel";

export default function MonthlyTotals({
  monthly,
  selected,
  onSelect,
}: {
  monthly: MonthTotals[];
  selected: number | null;
  onSelect: (month: number) => void;
}) {
  const yearOf = (key: keyof MonthTotals) =>
    monthly.reduce((total, month) => total + month[key], 0);
  const cumulative = monthly.map((_, i) =>
    monthly.slice(0, i + 1).reduce((total, month) => total + month.total, 0),
  );
  const cell = (i: number) =>
    cn(
      "cursor-pointer px-2 py-1.5 text-right transition-colors duration-150",
      selected === i && "bg-overlay/[0.05]",
    );

  return (
    <Panel
      title="Monthly totals"
      description="Everything the chart shows, including any what-ifs and planned starts. Click a month to open its detail."
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="caption-style w-full min-w-[64em] text-left tabular-nums">
          <thead>
            <tr className="text-subtle">
              <th className="py-1.5 pr-3 font-normal">
                <span className="sr-only">Earnings</span>
              </th>
              {SHORT_MONTHS.map((month, i) => (
                <th key={month} className={cn(cell(i), "font-normal")}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-pressed={selected === i}
                    aria-label={`${MONTHS[i]} in detail`}
                    className={cn(
                      "hover:text-foreground focus-visible:ring-ring/60 cursor-pointer rounded-sm outline-none focus-visible:ring-2",
                      selected === i && "text-foreground font-medium",
                    )}
                  >
                    {month}
                  </button>
                </th>
              ))}
              <th className="py-1.5 pl-2 text-right font-normal">Year</th>
            </tr>
          </thead>
          <tbody>
            {EARNINGS_SERIES.map((series) => (
              <tr key={series.key} className="border-line-strong border-t">
                <td className="text-soft py-1.5 pr-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <Swatch
                      color={series.color}
                      className="size-2 rounded-[2px]"
                    />
                    {series.label}
                  </span>
                </td>
                {monthly.map((month, i) => (
                  <td
                    key={i}
                    className={cn(
                      cell(i),
                      month[series.key] ? "text-foreground" : "text-faint",
                    )}
                    onClick={() => onSelect(i)}
                  >
                    {month[series.key] ? gbp(month[series.key]) : "—"}
                  </td>
                ))}
                <td className="py-1.5 pl-2 text-right font-medium">
                  {gbp(yearOf(series.key))}
                </td>
              </tr>
            ))}
            <tr className="border-foreground border-y font-medium">
              <td className="py-2 pr-3">Total</td>
              {monthly.map((month, i) => (
                <td
                  key={i}
                  className={cn(cell(i), "py-2")}
                  onClick={() => onSelect(i)}
                >
                  {gbp(month.total)}
                </td>
              ))}
              <td className="py-2 pl-2 text-right">{gbp(yearOf("total"))}</td>
            </tr>
            <tr className="text-subtle">
              <td className="py-1.5 pr-3 whitespace-nowrap">Running total</td>
              {cumulative.map((value, i) => (
                <td key={i} className={cell(i)} onClick={() => onSelect(i)}>
                  {gbp(value)}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

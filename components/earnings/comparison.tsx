"use client";

import { useMemo, useState } from "react";
import { compare, compareMonth } from "@/lib/earnings-compare";
import {
  MONTHS,
  SHORT_MONTHS,
  apprenticeName,
  gbp,
  reportMonth,
  seriesColor,
  type Report,
  type Snapshot,
} from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { Footnote, Panel, Swatch } from "./panel";

const takenTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

const signed = (value: number) =>
  Math.abs(value) < 0.5
    ? gbp(0)
    : `${value > 0 ? "+" : "−"}\u2060${gbp(Math.abs(value))}`;

const tone = (value: number) =>
  Math.abs(value) < 0.5
    ? "text-subtle"
    : value > 0
      ? "text-(--tag-green-text)"
      : "text-(--tag-red-text)";

export default function Comparison({
  report,
  snapshot,
  masked,
}: {
  report: Report;
  snapshot: Snapshot | undefined;
  masked: boolean;
}) {
  if (!snapshot) {
    return (
      <Panel
        title="Comparison"
        description={`Load a newer report for ${report.year} and the current one is kept as a snapshot, along with the early finishes, EPAs and new starts you've set. This tab then compares that forecast with what the new report actually shows.`}
      >
        <p className="caption-style text-faint italic">
          No snapshot yet. Use “Load another report” when next month’s CSV is
          ready.
        </p>
      </Panel>
    );
  }
  return <Compared report={report} snapshot={snapshot} masked={masked} />;
}

function Compared({
  report,
  snapshot,
  masked,
}: {
  report: Report;
  snapshot: Snapshot;
  masked: boolean;
}) {
  const latest = reportMonth(report);
  const before = reportMonth(snapshot.report);
  const [month, setMonth] = useState(latest);
  const comparison = useMemo(
    () => compare(snapshot, report),
    [snapshot, report],
  );
  const detail = useMemo(
    () => compareMonth(comparison, month),
    [comparison, month],
  );

  const forecastYear = comparison.monthly.reduce(
    (total, row) => total + row.forecast,
    0,
  );
  const actualYear = comparison.monthly.reduce(
    (total, row) => total + row.actual,
    0,
  );
  const forecastMonth = detail.series.reduce(
    (total, row) => total + row.forecast,
    0,
  );
  const actualMonth = detail.series.reduce(
    (total, row) => total + row.actual,
    0,
  );
  const cell = (i: number) =>
    cn(
      "cursor-pointer px-2 py-1.5 text-right transition-colors duration-150",
      month === i && "bg-overlay/[0.05]",
    );
  const rows = [
    {
      label: `Snapshot · ${snapshot.report.generated}`,
      values: comparison.monthly.map((row) => row.forecast),
      year: forecastYear,
    },
    {
      label: `Latest · ${report.generated}`,
      values: comparison.monthly.map((row) => row.actual),
      year: actualYear,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Forecast against actual"
        description={`The ${snapshot.report.generated} report with the forecast you had set, against the ${report.generated} report. The snapshot was kept on ${takenTime.format(new Date(snapshot.takenAt))}. Click a month to see what changed.`}
      >
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="caption-style w-full min-w-[64em] text-left whitespace-nowrap tabular-nums">
            <thead>
              <tr className="text-subtle">
                <th className="py-1.5 pr-3 font-normal">
                  <span className="sr-only">Report</span>
                </th>
                {SHORT_MONTHS.map((label, i) => (
                  <th key={label} className={cn(cell(i), "font-normal")}>
                    <button
                      type="button"
                      onClick={() => setMonth(i)}
                      aria-pressed={month === i}
                      aria-label={`Compare ${MONTHS[i]}`}
                      className={cn(
                        "hover:text-foreground focus-visible:ring-ring/60 cursor-pointer rounded-sm outline-none focus-visible:ring-2",
                        i > before && i <= latest && "text-soft",
                        month === i && "text-foreground font-medium",
                      )}
                    >
                      {label}
                    </button>
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-right font-normal">Year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-line-strong border-t">
                  <td className="text-soft py-1.5 pr-3 whitespace-nowrap">
                    {row.label}
                  </td>
                  {row.values.map((value, i) => (
                    <td key={i} className={cell(i)} onClick={() => setMonth(i)}>
                      {gbp(value)}
                    </td>
                  ))}
                  <td className="py-1.5 pl-2 text-right font-medium">
                    {gbp(row.year)}
                  </td>
                </tr>
              ))}
              <tr className="border-foreground border-y font-medium">
                <td className="py-2 pr-3">Difference</td>
                {comparison.monthly.map((row, i) => (
                  <td
                    key={i}
                    className={cn(
                      cell(i),
                      "py-2",
                      tone(row.actual - row.forecast),
                    )}
                    onClick={() => setMonth(i)}
                  >
                    {signed(row.actual - row.forecast)}
                  </td>
                ))}
                <td
                  className={cn(
                    "py-2 pl-2 text-right",
                    tone(actualYear - forecastYear),
                  )}
                >
                  {signed(actualYear - forecastYear)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Footnote>
          {latest > before
            ? `${MONTHS.slice(before + 1, latest + 1).join(", ")} ${latest - before > 1 ? "were" : "was"} still a forecast in the snapshot and ${latest - before > 1 ? "are" : "is"} now actual. `
            : ""}
          {latest < 11
            ? `From ${MONTHS[latest + 1]} both rows are projections, so a difference there means the forecast has moved, not that money was gained or lost.`
            : "Every month in the latest report is actual."}
        </Footnote>
      </Panel>

      <Panel
        title={`${MONTHS[month]}: forecast against actual`}
        description={`Forecast ${gbp(forecastMonth)}, latest report ${gbp(actualMonth)}, a difference of ${signed(actualMonth - forecastMonth)}.`}
      >
        <ul className="grid grid-cols-1 gap-3 min-[36em]:grid-cols-2 xl:grid-cols-4">
          {detail.series.map((series) => (
            <li
              key={series.key}
              className="border-line-strong flex flex-col gap-2 rounded-lg border p-3"
            >
              <span className="caption-style text-subtle flex items-center gap-1.5 font-medium">
                <Swatch color={seriesColor(series.key)} />
                {series.label}
              </span>
              <span
                className={cn(
                  "text-[22px] leading-none font-medium tabular-nums",
                  tone(series.actual - series.forecast),
                )}
              >
                {signed(series.actual - series.forecast)}
              </span>
              <span className="caption-style text-subtle tabular-nums">
                {gbp(series.forecast)} forecast · {gbp(series.actual)} actual
              </span>
            </li>
          ))}
        </ul>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="caption-style w-full min-w-[44em] text-left tabular-nums">
            <thead>
              <tr className="text-subtle">
                <th className="py-2 pr-3 font-normal">Apprentice</th>
                <th className="py-2 pr-3 font-normal">What changed</th>
                <th className="py-2 pr-3 text-right font-normal">Forecast</th>
                <th className="py-2 pr-3 text-right font-normal">Actual</th>
                <th className="py-2 text-right font-normal">Difference</th>
              </tr>
            </thead>
            <tbody>
              {detail.learners.length ? (
                detail.learners.map((learner) => (
                  <tr key={learner.ref} className="border-line-strong border-t">
                    <td className="max-w-[16em] truncate py-1.5 pr-3">
                      {apprenticeName(learner.row, masked)}
                    </td>
                    <td className="text-soft py-1.5 pr-3">{learner.reason}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {gbp(learner.forecast, 2)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {gbp(learner.actual, 2)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 text-right font-medium",
                        tone(learner.actual - learner.forecast),
                      )}
                    >
                      {signed(learner.actual - learner.forecast)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-line-strong border-t">
                  <td colSpan={5} className="text-faint py-2 italic">
                    Every apprentice on both reports matched the forecast in{" "}
                    {MONTHS[month]}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Footnote>
          New starts compares the starts you had planned with the apprentices
          who are on the latest report but weren’t on the snapshot. Their money
          is counted there rather than in the other columns.
        </Footnote>
      </Panel>
    </div>
  );
}

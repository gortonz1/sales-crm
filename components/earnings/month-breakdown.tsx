"use client";

import type { ReactNode } from "react";
import Button from "@/components/_ui/button";
import {
  MONTHS,
  SHORT_MONTHS,
  apprenticeName,
  gbp,
  seriesColor,
  type Adjusted,
  type Programme,
} from "@/lib/earnings";
import { Footnote, Panel, Swatch } from "./panel";

type Line = { key: string; label: string; sub?: string | null; value: number };

function Column({
  title,
  color,
  count,
  unit,
  lines,
  decimals,
}: {
  title: string;
  color: string;
  count: number;
  unit: string;
  lines: Line[];
  decimals: 0 | 2;
}) {
  const total = lines.reduce((sum, line) => sum + line.value, 0);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="caption-style text-subtle flex items-center gap-1.5 font-medium">
        <Swatch color={color} />
        {title}
      </span>
      <span className="text-[22px] leading-none font-medium tabular-nums">
        {gbp(total)}
      </span>
      <span className="caption-style text-subtle">
        {count} {unit}
      </span>
      <ul className="mt-1 flex max-h-[15em] flex-col overflow-y-auto pr-1">
        {lines.length ? (
          lines.map((line) => (
            <li
              key={line.key}
              className="caption-style border-line-strong flex justify-between gap-2 border-t py-1.5"
            >
              <span className="min-w-0 truncate">
                {line.label}
                {line.sub && <span className="text-subtle"> · {line.sub}</span>}
              </span>
              <span className="font-medium tabular-nums">
                {gbp(line.value, decimals)}
              </span>
            </li>
          ))
        ) : (
          <li className="caption-style text-faint italic">
            Nothing this month
          </li>
        )}
      </ul>
    </div>
  );
}

export default function MonthBreakdown({
  month,
  rows,
  programmes,
  masked,
  onClose,
}: {
  month: number;
  rows: Adjusted[];
  programmes: Programme[];
  masked: boolean;
  onClose: () => void;
}) {
  const pick = (
    value: (row: Adjusted) => number,
    sub?: (row: Adjusted) => string | null,
  ): Line[] =>
    rows
      .filter((row) => value(row) > 0)
      .map((row) => ({
        key: row.ref,
        label: apprenticeName(row, masked),
        sub: sub?.(row),
        value: value(row),
      }))
      .sort((a, b) => b.value - a.value);

  const onProgramme = pick((row) => row.instM[month] + row.otherM[month]);
  const lump = pick(
    (row) => row.lumpM[month],
    (row) =>
      row.fin === month ? "finishes" : row.mode === "epa" ? "EPA" : null,
  );
  const incentive = pick((row) => row.incM[month]);

  const intakes: Line[] = [];
  let heads = 0;
  for (const programme of programmes) {
    programme.starts.forEach((count, start) => {
      if (count && start <= month && month < start + programme.months) {
        heads += count;
        intakes.push({
          key: `${programme.id}-${start}`,
          label: programme.name,
          sub: `${SHORT_MONTHS[start]} intake × ${count}`,
          value: count * programme.monthly,
        });
      }
    });
  }

  const grand = [...onProgramme, ...lump, ...incentive, ...intakes].reduce(
    (sum, line) => sum + line.value,
    0,
  );
  const people = onProgramme.length + lump.length + incentive.length;

  const columns: ReactNode[] = [
    <Column
      key="onp"
      title="On-programme"
      color={seriesColor("onp")}
      count={onProgramme.length}
      unit="apprentices"
      lines={onProgramme}
      decimals={2}
    />,
    <Column
      key="comp"
      title="Completion and balancing"
      color={seriesColor("comp")}
      count={lump.length}
      unit="apprentices"
      lines={lump}
      decimals={2}
    />,
    <Column
      key="inc"
      title="16-18 incentive"
      color={seriesColor("inc")}
      count={incentive.length}
      unit="apprentices"
      lines={incentive}
      decimals={2}
    />,
    <Column
      key="plan"
      title="New starts"
      color={seriesColor("plan")}
      count={heads}
      unit="in learning"
      lines={intakes}
      decimals={0}
    />,
  ];

  return (
    <Panel
      title={`${MONTHS[month]} in detail`}
      description={`${gbp(grand)} earned across ${people} apprentices on the report${heads > 0 ? ` and ${heads} planned starts` : ""}.`}
      actions={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 min-[36em]:grid-cols-2 xl:grid-cols-4">
        {columns}
      </div>
      <Footnote>
        <div className="flex justify-between gap-3">
          <span>{MONTHS[month]} total</span>
          <span className="text-foreground font-medium tabular-nums">
            {gbp(grand)}
          </span>
        </div>
      </Footnote>
    </Panel>
  );
}

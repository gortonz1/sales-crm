"use client";

import { memo, useState } from "react";
import Button from "@/components/_ui/button";
import {
  DEFAULT_COMPLETION,
  MONTHS,
  SHORT_MONTHS,
  apprenticeName,
  gbp,
  seriesColor,
  type Adjusted,
} from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { Footnote, Panel } from "./panel";

export const stripGrid =
  "grid grid-cols-[9em_minmax(0,1fr)_5em] items-center gap-2";

export function StripMonths({ last }: { last: string }) {
  return (
    <div className={cn(stripGrid, "caption-style text-subtle text-[11px]")}>
      <span />
      <div className="grid grid-cols-12 gap-0.5 text-center">
        {SHORT_MONTHS.map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>
      <span className="text-right">{last}</span>
    </div>
  );
}

type Hover = { row: Adjusted; month: number; value: number };

const StripRows = memo(function StripRows({
  strip,
  maxCell,
  masked,
  onToggle,
  onHover,
}: {
  strip: Adjusted[];
  maxCell: number;
  masked: boolean;
  onToggle: (ref: string, month: number) => void;
  onHover: (hover: Hover | null) => void;
}) {
  return (
    <ul
      className="flex max-h-[30em] flex-col gap-0.5 overflow-y-auto py-0.5 pr-1"
      onMouseLeave={() => onHover(null)}
    >
      {strip.map((row) => (
        <li key={row.ref} className={stripGrid}>
          <span className="caption-style truncate">
            {apprenticeName(row, masked)}
            {row.gateway && row.offProgramme && (
              <span className="text-subtle"> · gateway</span>
            )}
          </span>
          <div className="grid grid-cols-12 gap-0.5">
            {row.provM.map((value, i) => {
              const finishing = row.fin === i;
              const color =
                row.lumpM[i] > 0 ? seriesColor("comp") : seriesColor("onp");
              const strength = Math.round(
                Math.min(1, 0.35 + 0.65 * (value / maxCell)) * 100,
              );
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onToggle(row.ref, i)}
                  onMouseEnter={() => onHover({ row, month: i, value })}
                  onFocus={() => onHover({ row, month: i, value })}
                  aria-label={`${apprenticeName(row, masked)}, ${MONTHS[i]}, ${gbp(value)}${finishing ? ", finishing this month" : ""}`}
                  aria-pressed={finishing}
                  className={cn(
                    "hover:ring-foreground/70 focus-visible:ring-ring h-3 cursor-pointer rounded-[2px] outline-none hover:ring-2 focus-visible:ring-2",
                    finishing ? "bg-foreground" : value > 0 ? "" : "bg-muted",
                  )}
                  style={
                    value > 0 && !finishing
                      ? {
                          backgroundColor: `color-mix(in srgb, ${color} ${strength}%, transparent)`,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
          <span
            className={cn(
              "caption-style text-right font-medium tabular-nums",
              row.fin == null && "text-soft",
            )}
          >
            {gbp(row.total)}
          </span>
        </li>
      ))}
    </ul>
  );
});

export default function RunOff({
  strip,
  maxCell,
  masked,
  finishes,
  pulled,
  julyLearners,
  nextYear,
  onToggle,
  onClear,
}: {
  strip: Adjusted[];
  maxCell: number;
  masked: boolean;
  finishes: number;
  pulled: number;
  julyLearners: number;
  nextYear: string;
  onToggle: (ref: string, month: number) => void;
  onClear: () => void;
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  return (
    <Panel
      title="Cohort run-off"
      description={`Click the month an apprentice finishes and everything left on their price is paid then. Click it again to undo. Apprentices with no price on this report pay a flat ${gbp(DEFAULT_COMPLETION)}.`}
      actions={
        finishes > 0 && (
          <Button variant="secondary" size="sm" onClick={onClear}>
            Clear finishes
          </Button>
        )
      }
    >
      <p
        aria-live="polite"
        className="caption-style text-subtle h-3 truncate tabular-nums"
      >
        {hover ? (
          <>
            <span className="text-foreground font-medium">
              {apprenticeName(hover.row, masked)}
            </span>{" "}
            · {MONTHS[hover.month]} · {gbp(hover.value, 2)}
            {hover.row.fin === hover.month
              ? " · finishes here"
              : " · click to finish here"}
          </>
        ) : (
          "Hover a cell for the amount"
        )}
      </p>
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-[36em] flex-col gap-1">
          <StripMonths last="Year" />
          <StripRows
            strip={strip}
            maxCell={maxCell}
            masked={masked}
            onToggle={onToggle}
            onHover={setHover}
          />
        </div>
      </div>

      <Footnote>
        {finishes > 0
          ? `${finishes} early finishes pull ${gbp(pulled)} into this year. That money is not new income — it is drawn forward from ${nextYear} and later.`
          : `${julyLearners} apprentices still draw an instalment in July. Replacing the ones who roll off is what holds next year's income flat.`}
      </Footnote>
    </Panel>
  );
}

"use client";

import { useState } from "react";
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
  const [hover, setHover] = useState<{
    row: Adjusted;
    month: number;
    value: number;
  } | null>(null);

  return (
    <Panel
      title="Cohort run-off"
      description={`Click the month an apprentice finishes and everything left on their price is paid then. Click it again to undo. Apprentices with no price on this report pay a flat ${gbp(DEFAULT_COMPLETION)}.`}
      actions={
        <>
          <span className="caption-style text-subtle hidden min-h-4 text-right md:block">
            {hover
              ? `${apprenticeName(hover.row, masked)} — ${MONTHS[hover.month]}: ${gbp(hover.value, 2)}`
              : "Hover a cell for the amount"}
          </span>
          {finishes > 0 && (
            <Button variant="secondary" size="sm" onClick={onClear}>
              Clear finishes
            </Button>
          )}
        </>
      }
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-[36em] flex-col gap-1">
          <StripMonths last="Year" />
          <ul className="flex max-h-[30em] flex-col gap-0.5 overflow-y-auto pr-1">
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
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onToggle(row.ref, i)}
                        onMouseEnter={() => setHover({ row, month: i, value })}
                        onMouseLeave={() => setHover(null)}
                        title={`${MONTHS[i]}: ${gbp(value, 2)}${finishing ? " — finishes here" : " — click to finish here"}`}
                        aria-label={`${apprenticeName(row, masked)}, ${MONTHS[i]}, ${gbp(value)}${finishing ? ", finishing this month" : ""}`}
                        aria-pressed={finishing}
                        className={cn(
                          "ease-power3-out focus-visible:ring-ring h-3 cursor-pointer rounded-[2px] transition-transform duration-150 outline-none hover:scale-y-[1.8] focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:scale-y-100",
                          value > 0 ? "" : "bg-muted",
                          finishing &&
                            "bg-foreground outline-foreground outline-[1.5px] outline-offset-1 outline-solid",
                        )}
                        style={
                          value > 0 && !finishing
                            ? {
                                backgroundColor:
                                  row.lumpM[i] > 0
                                    ? seriesColor("comp")
                                    : seriesColor("onp"),
                                opacity: Math.min(
                                  1,
                                  0.35 + 0.65 * (value / maxCell),
                                ),
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

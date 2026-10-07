"use client";

import type { Dispatch, SetStateAction } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import {
  DEFAULT_COMPLETION,
  MONTHS,
  SHORT_MONTHS,
  apprenticeName,
  gbp,
  num,
  seriesColor,
  type Adjusted,
} from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { Footnote, Panel, numberInputClass } from "./panel";
import { StripMonths, stripGrid } from "./run-off";

type Schedule = Record<string, number>;

export default function Gateway({
  list,
  epa,
  setEpa,
  masked,
  lag,
  setLag,
}: {
  list: Adjusted[];
  epa: Schedule;
  setEpa: Dispatch<SetStateAction<Schedule>>;
  masked: boolean;
  lag: number;
  setLag: (lag: number) => void;
}) {
  const scheduled = list.filter(
    (row) => row.fin == null && epa[row.ref] != null,
  );
  const value = list.reduce((total, row) => total + row.element, 0);
  const estimated = list.filter((row) => row.elementEst).length;
  const released = scheduled.reduce((total, row) => total + row.pulled, 0);

  const scheduleAll = () =>
    setEpa((current) => {
      const next = { ...current };
      for (const row of list) {
        if (row.fin != null || row.offMonth == null) continue;
        const month = row.offMonth + lag;
        if (month <= 11) next[row.ref] = month;
      }
      return next;
    });

  const toggle = (ref: string, month: number) =>
    setEpa((current) => {
      const next = { ...current };
      if (next[ref] === month) delete next[ref];
      else next[ref] = month;
      return next;
    });

  return (
    <Panel
      title="Gateway and EPA"
      description={`${list.length} apprentices come off programme this year holding ${gbp(value)} of completion element. Pick the month each one passes EPA to release it. Months before they leave programme are closed.`}
      actions={
        <>
          <label className="caption-style text-subtle flex items-center gap-2">
            EPA lag
            <Input
              type="number"
              min={0}
              max={11}
              className={cn(
                numberInputClass,
                "h-[30px] w-12 px-2 text-center text-[13px]",
              )}
              value={lag}
              onChange={(event) =>
                setLag(
                  Math.max(
                    0,
                    Math.min(11, Math.round(num(event.target.value))),
                  ),
                )
              }
              aria-label="Months between leaving programme and passing EPA"
            />
          </label>
          <Button variant="secondary" size="sm" onClick={scheduleAll}>
            Schedule all
          </Button>
          {scheduled.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setEpa({})}>
              Clear EPAs
            </Button>
          )}
        </>
      }
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-[36em] flex-col gap-1">
          <StripMonths last="Element" />
          <ul className="flex max-h-[22em] flex-col gap-0.5 overflow-y-auto pr-1">
            {list.map((row) => {
              const locked = row.fin != null;
              const picked = locked ? null : epa[row.ref];
              const offMonth = row.offMonth ?? 0;
              return (
                <li key={row.ref} className={stripGrid}>
                  <span className="caption-style truncate">
                    {apprenticeName(row, masked)}
                    <span className="text-subtle">
                      {" "}
                      · {row.offProgramme ? "left" : "ends"}{" "}
                      {SHORT_MONTHS[offMonth]}
                    </span>
                  </span>
                  <div className="grid grid-cols-12 gap-0.5">
                    {SHORT_MONTHS.map((_, i) => {
                      const open = i >= offMonth && !locked;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={!open}
                          onClick={() => toggle(row.ref, i)}
                          aria-pressed={picked === i}
                          title={
                            locked
                              ? "Already finishing early — the element is in that lump"
                              : open
                                ? `Pass EPA in ${MONTHS[i]}: ${gbp(row.element)}${row.elementEst ? " (estimated)" : ""}`
                                : "Still on programme"
                          }
                          aria-label={`${masked ? row.ref : `${row.fn} ${row.sn}`}, EPA in ${MONTHS[i]}`}
                          className={cn(
                            "focus-visible:ring-ring h-3 rounded-[2px] transition-colors duration-150 outline-none focus-visible:ring-2",
                            open
                              ? "bg-track hover:bg-line-strong cursor-pointer"
                              : "bg-subtle-fill",
                            locked && "opacity-40",
                          )}
                          style={
                            picked === i
                              ? { backgroundColor: seriesColor("comp") }
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                  <span
                    className={cn(
                      "caption-style text-right font-medium tabular-nums",
                      picked == null && "text-subtle",
                    )}
                    style={
                      picked != null
                        ? { color: seriesColor("comp") }
                        : undefined
                    }
                  >
                    {gbp(row.element)}
                    {row.elementEst && <span className="opacity-60">*</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Footnote>
        {scheduled.length > 0
          ? `${scheduled.length} EPAs scheduled, releasing ${gbp(released)} into this year. `
          : "Nothing scheduled yet. The completion element only appears in the report once an achievement date is recorded, so none of this is in the forecast. "}
        {estimated > 0 &&
          `* ${estimated} of these apprentices left programme in an earlier funding year, so this report carries no price for them. Completing pays a flat ${gbp(DEFAULT_COMPLETION)} — check that against their actual negotiated price before you rely on the total.`}
      </Footnote>
    </Panel>
  );
}

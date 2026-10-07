"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import {
  COMPLETION_SHARE,
  MONTHS,
  SHORT_MONTHS,
  gbp,
  num,
  programmeMonthsInYear,
  sum,
  zeros,
  type Programme,
} from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { Footnote, Panel, numberInputClass } from "./panel";

export default function Planner({
  programmes,
  setProgrammes,
  inYear,
}: {
  programmes: Programme[];
  setProgrammes: (programmes: Programme[]) => void;
  inYear: number;
}) {
  const update = (id: string, patch: Partial<Programme>) =>
    setProgrammes(
      programmes.map((programme) =>
        programme.id === id ? { ...programme, ...patch } : programme,
      ),
    );
  const setStart = (programme: Programme, month: number, value: string) => {
    const starts = programme.starts.slice();
    starts[month] = Math.max(0, Math.min(999, Math.round(num(value))));
    update(programme.id, { starts });
  };
  const addProgramme = () =>
    setProgrammes([
      ...programmes,
      {
        id: `p${Date.now()}`,
        name: "New programme",
        monthly: 950,
        months: 12,
        starts: zeros(),
      },
    ]);

  const heads = programmes.reduce((total, p) => total + sum(p.starts), 0);
  const later = programmes.reduce(
    (total, p) =>
      total +
      sum(p.starts) *
        p.monthly *
        p.months *
        (COMPLETION_SHARE / (1 - COMPLETION_SHARE)),
    0,
  );

  return (
    <Panel
      title="Plan new starts"
      description="Enter how many apprentices you expect to sign in each month. Instalments run from the start month at the programme’s monthly rate."
      actions={
        <Button variant="secondary" size="sm" onClick={addProgramme}>
          Add programme
        </Button>
      }
    >
      <div className="flex flex-col">
        {programmes.map((programme, index) => {
          const count = sum(programme.starts);
          const price =
            (programme.monthly * programme.months) / (1 - COMPLETION_SHARE);
          return (
            <div
              key={programme.id}
              className={cn(
                "flex flex-col gap-3 py-4 first:pt-0",
                index > 0 && "border-line-strong border-t",
              )}
            >
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[12em] flex-1 flex-col gap-1.5">
                  <span className="caption-style text-subtle">Programme</span>
                  <Input
                    value={programme.name}
                    onChange={(event) =>
                      update(programme.id, { name: event.target.value })
                    }
                  />
                </label>
                <label className="flex w-[8.5em] flex-col gap-1.5">
                  <span className="caption-style text-subtle">
                    Funding per month
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    className={numberInputClass}
                    value={programme.monthly}
                    onChange={(event) =>
                      update(programme.id, {
                        monthly: Math.max(0, num(event.target.value)),
                      })
                    }
                  />
                </label>
                <label className="flex w-[5.5em] flex-col gap-1.5">
                  <span className="caption-style text-subtle">Months</span>
                  <Input
                    type="number"
                    min={1}
                    max={48}
                    className={numberInputClass}
                    value={programme.months}
                    onChange={(event) =>
                      update(programme.id, {
                        months: Math.max(
                          1,
                          Math.min(
                            48,
                            Math.round(num(event.target.value)) || 1,
                          ),
                        ),
                      })
                    }
                  />
                </label>
                {programmes.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    aria-label={`Remove ${programme.name}`}
                    onClick={() =>
                      setProgrammes(
                        programmes.filter((p) => p.id !== programme.id),
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                {SHORT_MONTHS.map((month, i) => (
                  <label
                    key={month}
                    className="flex flex-col gap-1 text-center"
                  >
                    <span className="caption-style text-subtle text-[11px]">
                      {month}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      className={cn(
                        numberInputClass,
                        "h-8 px-1 text-center text-[13px]",
                        programme.starts[i] === 0 && "text-faint",
                      )}
                      value={programme.starts[i]}
                      onChange={(event) =>
                        setStart(programme, i, event.target.value)
                      }
                      aria-label={`Starts on ${programme.name} in ${MONTHS[i]}`}
                    />
                  </label>
                ))}
              </div>

              <p className="caption-style text-subtle leading-[1.4]">
                {gbp(programme.monthly)} a month over {programme.months} months
                implies a {gbp(price)} price with{" "}
                {gbp(price * COMPLETION_SHARE)} held to completion.
                {count > 0 && (
                  <span className="text-foreground font-medium">
                    {" "}
                    {count} starts add {gbp(programmeMonthsInYear(programme))}{" "}
                    this year.
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <Footnote>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="caption-style max-w-[48em] leading-[1.4]">
            {heads > 0
              ? `${heads} planned starts across ${programmes.length} programmes. A further ${gbp(later)} of completion element falls due at EPA, mostly beyond this year. Incentive payments are not modelled here.`
              : "Nothing planned yet. Add starts to see how much of the run-off they replace."}
          </p>
          <div className="flex flex-col items-end gap-1.5">
            <span className="eyebrow-style text-subtle text-[11px]">
              Adds this year
            </span>
            <span className="text-foreground text-[22px] leading-none font-medium tabular-nums">
              {gbp(inYear)}
            </span>
          </div>
        </div>
      </Footnote>
    </Panel>
  );
}

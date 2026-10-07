"use client";

import { EARNINGS_SERIES, MONTHS, SHORT_MONTHS, gbp } from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { Panel, Swatch } from "./panel";

export type MonthTotals = {
  onp: number;
  comp: number;
  inc: number;
  plan: number;
  learners: number;
  total: number;
};

const PLOT_HEIGHT = 220;

function niceMoney(value: number) {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => value <= s * magnitude)!;
  return step * magnitude;
}

function niceCount(value: number) {
  if (value <= 4) return 4;
  const step = value <= 10 ? 2 : value <= 25 ? 5 : 10;
  return Math.ceil(value / step) * step;
}

const shortMoney = (value: number) =>
  value >= 1000
    ? `£${Number((value / 1000).toFixed(1))}k`
    : `£${Math.round(value)}`;

export default function EarningsChart({
  monthly,
  selected,
  onSelect,
}: {
  monthly: MonthTotals[];
  selected: number | null;
  onSelect: (month: number) => void;
}) {
  const peak = Math.max(0, ...monthly.map((month) => month.total));
  const first = monthly[0];
  const last = monthly[11];
  const runOff = peak ? Math.round((1 - last.total / peak) * 100) : 0;
  const maxMoney = niceMoney(peak);
  const maxLearners = niceCount(
    Math.max(0, ...monthly.map((month) => month.learners)),
  );
  const ticks = [0, 0.5, 1];
  const learnerY = (count: number) =>
    PLOT_HEIGHT - (count / maxLearners) * PLOT_HEIGHT;

  return (
    <Panel
      title="Monthly earnings profile"
      description={
        runOff > 0
          ? `Income falls ${runOff}% from its ${gbp(peak)} peak to ${gbp(last.total)} in July.`
          : `Income runs from ${gbp(first.total)} in August to ${gbp(last.total)} in July.`
      }
    >
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Key">
        {EARNINGS_SERIES.map((series) => (
          <li
            key={series.key}
            className="caption-style text-soft flex items-center gap-1.5"
          >
            <Swatch color={series.color} />
            {series.label}
          </li>
        ))}
        <li className="caption-style text-soft flex items-center gap-1.5">
          <span aria-hidden className="bg-foreground h-0.5 w-3 rounded-full" />
          Apprentices funded
        </li>
      </ul>

      <div className="flex gap-2">
        <div
          aria-hidden
          className="caption-style text-faint relative w-9 shrink-0 tabular-nums"
          style={{ height: PLOT_HEIGHT }}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: tick * PLOT_HEIGHT }}
            >
              {shortMoney(tick * maxMoney)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{ height: PLOT_HEIGHT }}
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className={cn(
                  "absolute inset-x-0 h-px",
                  tick === 0 ? "bg-line-strong" : "bg-overlay/[0.05]",
                )}
                style={{ bottom: tick * PLOT_HEIGHT }}
              />
            ))}
          </div>

          <ol
            className="relative grid grid-cols-12"
            aria-label="Earnings per month"
          >
            {monthly.map((month, i) => (
              <MonthBar
                key={MONTHS[i]}
                index={i}
                month={month}
                max={maxMoney}
                dimmed={selected != null && selected !== i}
                active={selected === i}
                alignRight={i >= 8}
                onSelect={onSelect}
              />
            ))}
          </ol>

          <div
            aria-hidden
            className="text-foreground pointer-events-none absolute inset-x-0 top-0"
            style={{ height: PLOT_HEIGHT }}
          >
            <svg
              className="absolute inset-0 size-full overflow-visible"
              viewBox={`0 0 12 ${PLOT_HEIGHT}`}
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                points={monthly
                  .map((month, i) => `${i + 0.5},${learnerY(month.learners)}`)
                  .join(" ")}
              />
            </svg>
            {monthly.map((month, i) => (
              <span
                key={MONTHS[i]}
                className="bg-foreground ring-card absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                style={{
                  left: `${((i + 0.5) / 12) * 100}%`,
                  top: learnerY(month.learners),
                }}
              />
            ))}
          </div>
        </div>

        <div
          aria-hidden
          className="caption-style text-faint relative w-6 shrink-0 tabular-nums"
          style={{ height: PLOT_HEIGHT }}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute left-0 translate-y-1/2 leading-none"
              style={{ bottom: tick * PLOT_HEIGHT }}
            >
              {tick * maxLearners}
            </span>
          ))}
        </div>
      </div>

      <p className="caption-style text-subtle">
        {selected == null
          ? "Click a month to see who makes it up."
          : `Showing ${MONTHS[selected]} below.`}
      </p>
    </Panel>
  );
}

function MonthBar({
  index,
  month,
  max,
  dimmed,
  active,
  alignRight,
  onSelect,
}: {
  index: number;
  month: MonthTotals;
  max: number;
  dimmed: boolean;
  active: boolean;
  alignRight: boolean;
  onSelect: (month: number) => void;
}) {
  const segments = EARNINGS_SERIES.map((series) => ({
    ...series,
    value: month[series.key],
  })).filter((segment) => segment.value > 0);

  return (
    <li className="group/bar relative min-w-0">
      <button
        type="button"
        onClick={() => onSelect(index)}
        aria-pressed={active}
        aria-label={`${MONTHS[index]}: ${gbp(month.total)}, ${month.learners} apprentices funded`}
        className="focus-visible:ring-ring/60 flex w-full cursor-pointer flex-col items-center rounded-md outline-none focus-visible:ring-2"
      >
        <span
          className={cn(
            "flex w-full flex-col items-center justify-end px-[3px] transition-opacity duration-150 sm:px-1.5",
            dimmed && "opacity-30",
          )}
          style={{ height: PLOT_HEIGHT }}
        >
          <span className="flex w-full max-w-10 flex-col-reverse gap-[2px] group-hover/bar:brightness-110">
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
                    (segment.value / max) * PLOT_HEIGHT -
                      (i < segments.length - 1 ? 2 : 0),
                  ),
                  backgroundColor: segment.color,
                }}
              />
            ))}
          </span>
        </span>
        <span
          className={cn(
            "caption-style mt-1.5 truncate leading-none",
            active ? "text-foreground font-medium" : "text-subtle",
          )}
        >
          <span className="sm:hidden">{MONTHS[index][0]}</span>
          <span className="hidden sm:inline">{SHORT_MONTHS[index]}</span>
        </span>
      </button>

      <div
        role="presentation"
        className={cn(
          "border-line-strong bg-popover shadow-overlay pointer-events-none invisible absolute bottom-full z-10 mb-1 w-max min-w-[13em] rounded-lg border p-2.5 opacity-0 transition-opacity duration-150 group-focus-within/bar:visible group-focus-within/bar:opacity-100 group-hover/bar:visible group-hover/bar:opacity-100",
          alignRight ? "right-0" : "left-0",
        )}
      >
        <p className="caption-style mb-1.5 font-medium">
          {MONTHS[index]} · {gbp(month.total)}
        </p>
        <ul className="flex flex-col gap-1">
          {EARNINGS_SERIES.map((series) => (
            <li
              key={series.key}
              className="caption-style text-soft flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-1.5">
                <Swatch color={series.color} className="size-2 rounded-[2px]" />
                {series.label}
              </span>
              <span className="text-foreground tabular-nums">
                {gbp(month[series.key])}
              </span>
            </li>
          ))}
          <li className="caption-style text-soft border-line-strong mt-0.5 flex items-center justify-between gap-3 border-t pt-1.5">
            Apprentices funded
            <span className="text-foreground tabular-nums">
              {month.learners}
            </span>
          </li>
        </ul>
      </div>
    </li>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Button from "@/components/_ui/button";
import {
  COLD_COLOR,
  UNRECORDED,
  buildTimeline,
  formatDate,
  stageColor,
  type Lead,
  type LeadStage,
  type TimelineEvent,
  type TimelineSegment,
} from "@/lib/leads";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const RANGES = [
  { key: "3m", label: "3 months", days: 91 },
  { key: "6m", label: "6 months", days: 182 },
  { key: "12m", label: "12 months", days: 365 },
  { key: "all", label: "All", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const HATCH =
  "repeating-linear-gradient(135deg, #4a4a4a 0 2px, transparent 2px 6px)";

const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "Europe/London",
});

type Tooltip = { x: number; y: number; title: string; detail: string };

export default function LeadsTimeline({
  leads,
  stages,
  events,
  onOpen,
}: {
  leads: Lead[];
  stages: LeadStage[];
  events: TimelineEvent[];
  onOpen: (id: string) => void;
}) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("6m");
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [now] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [rangeKey]);

  const stageLabels = useMemo<Record<string, string>>(
    () => ({
      ...Object.fromEntries(stages.map((s) => [s.id, s.label])),
      [UNRECORDED]: "Before the CRM (stage history not recorded)",
    }),
    [stages],
  );

  const rows = useMemo(() => {
    const byLead = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const list = byLead.get(event.lead_id) ?? [];
      list.push(event);
      byLead.set(event.lead_id, list);
    }
    return leads.map((lead) => ({
      lead,
      timeline: buildTimeline(lead, byLead.get(lead.id) ?? [], now),
    }));
  }, [leads, events, now]);

  const range = RANGES.find((r) => r.key === rangeKey)!;
  const earliest = rows.reduce(
    (min, row) => Math.min(min, row.timeline.segments[0]?.start ?? now),
    now,
  );
  const start = range.days ? now - range.days * DAY_MS : earliest - DAY_MS;
  const span = Math.max(now - start, DAY_MS);
  const pos = (t: number) => ((Math.max(t, start) - start) / span) * 100;

  const ticks = useMemo(() => {
    const result: { at: number; label: string }[] = [];
    const d = new Date(start);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() < now) {
      result.push({ at: d.getTime(), label: monthFormat.format(d) });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return result;
  }, [start, now]);

  const legend = [
    ...stages.filter((s) => s.id !== "not-a-lead"),
    { id: UNRECORDED, label: "Before the CRM" },
  ];

  function showTip(
    event: MouseEvent,
    lead: Lead,
    segment: TimelineSegment,
    isLast: boolean,
  ) {
    const days = Math.max(
      1,
      Math.round((segment.end - segment.start) / DAY_MS),
    );
    const ongoing = isLast && lead.active;
    setTooltip({
      x: event.clientX,
      y: event.clientY,
      title: `${lead.name} · ${stageLabels[segment.stage] ?? segment.stage}`,
      detail: `${formatDate(new Date(segment.start).toISOString())} → ${
        ongoing ? "now" : formatDate(new Date(segment.end).toISOString())
      } · ${days} ${days === 1 ? "day" : "days"}`,
    });
  }

  if (leads.length === 0) {
    return (
      <p className="text-subtle px-4 py-12 text-center">
        No leads match this view.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
        <ul
          aria-label="Legend"
          className="caption-style text-soft flex flex-wrap items-center gap-x-4 gap-y-1.5"
        >
          {legend.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-4 rounded-[2px]"
                style={
                  item.id === UNRECORDED
                    ? {
                        backgroundImage: HATCH,
                        boxShadow: "inset 0 0 0 1px #4a4a4a",
                      }
                    : { backgroundColor: stageColor(item.id) }
                }
              />
              {item.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-3 w-0.5 rounded-full"
              style={{ backgroundColor: COLD_COLOR }}
            />
            Gone cold
          </li>
        </ul>
        <div className="flex shrink-0 items-center gap-1">
          {RANGES.map((option) => (
            <Button
              key={option.key}
              variant={rangeKey === option.key ? "muted" : "ghost"}
              size="sm"
              aria-pressed={rangeKey === option.key}
              onClick={() => setRangeKey(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[44em] md:min-w-[52em]">
          <div className="border-border bg-background sticky top-0 z-10 grid grid-cols-[10em_1fr] border-b md:grid-cols-[15em_1fr]">
            <span className="caption-style text-subtle bg-background border-border sticky left-0 z-[2] border-r px-4 py-2.5">
              Lead
            </span>
            <div className="relative mr-6">
              {ticks
                .filter((tick) => pos(tick.at) < 94)
                .map((tick) => (
                  <span
                    key={tick.at}
                    className="caption-style text-subtle absolute top-2.5 -translate-x-1/2"
                    style={{ left: `${pos(tick.at)}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              <span className="caption-style text-subtle absolute top-2.5 right-0 translate-x-1/2">
                Today
              </span>
            </div>
          </div>

          <ul>
            {rows.map(({ lead, timeline }) => {
              const visible = timeline.segments.filter((s) => s.end > start);
              const coldAt = timeline.coldAt;
              return (
                <li
                  key={lead.id}
                  className="border-border grid grid-cols-[10em_1fr] border-b md:grid-cols-[15em_1fr]"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(lead.id)}
                    className="bg-background border-border sticky left-0 z-[2] flex min-w-0 flex-col gap-0.5 border-r px-4 py-2 text-left outline-none hover:bg-overlay/[0.03] focus-visible:bg-overlay/[0.05]"
                  >
                    <span className="truncate text-[14px] font-medium">
                      {lead.name}
                    </span>
                    <span className="caption-style text-subtle truncate">
                      {lead.organisation ?? lead.email}
                    </span>
                  </button>
                  <div className="relative mr-6">
                    {ticks.map((tick) => (
                      <span
                        key={tick.at}
                        aria-hidden
                        className="bg-border absolute inset-y-0 w-px"
                        style={{ left: `${pos(tick.at)}%` }}
                      />
                    ))}
                    {visible.length === 0 && (
                      <span className="caption-style text-faint absolute top-1/2 left-1 -translate-y-1/2">
                        Before this range
                      </span>
                    )}
                    {visible.map((segment, i) => {
                      const left = pos(segment.start);
                      const width = Math.max(pos(segment.end) - left, 0.8);
                      const first = i === 0;
                      const last = i === visible.length - 1;
                      return (
                        <span
                          key={`${segment.stage}-${segment.start}`}
                          className="absolute top-1/2 h-4 -translate-y-1/2 px-px"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          onMouseMove={(event) =>
                            showTip(event, lead, segment, last)
                          }
                          onMouseLeave={() => setTooltip(null)}
                          onClick={() => onOpen(lead.id)}
                        >
                          <span
                            className={cn(
                              "block h-full cursor-pointer rounded-[1px]",
                              first && "rounded-l",
                              last && "rounded-r",
                            )}
                            style={
                              segment.stage === UNRECORDED
                                ? {
                                    backgroundImage: HATCH,
                                    boxShadow: "inset 0 0 0 1px #4a4a4a",
                                  }
                                : { backgroundColor: stageColor(segment.stage) }
                            }
                          />
                        </span>
                      );
                    })}
                    {coldAt !== null && coldAt > start && (
                      <span
                        aria-hidden
                        className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full"
                        style={{
                          left: `calc(${pos(coldAt)}% + 2px)`,
                          backgroundColor: COLD_COLOR,
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {tooltip && (
        <div
          role="tooltip"
          className="border-line-strong bg-popover shadow-overlay pointer-events-none fixed z-50 flex max-w-[20em] flex-col gap-1 rounded-lg border px-3 py-2"
          style={{ left: tooltip.x + 12, top: tooltip.y + 14 }}
        >
          <span className="text-[13px] font-medium">{tooltip.title}</span>
          <span className="caption-style text-soft">{tooltip.detail}</span>
        </div>
      )}
    </div>
  );
}

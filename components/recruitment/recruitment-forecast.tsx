"use client";

import { useState, type DragEvent } from "react";
import CountBadge from "@/components/_ui/count-badge";
import StatusTag from "./status-tag";
import {
  forecastMonths,
  formatLongMonth,
  isForecastable,
  monthKey,
  monthStart,
  statusColor,
  type Recruitment,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

export default function RecruitmentForecast({
  items,
  onOpen,
  onMove,
}: {
  items: Recruitment[];
  onOpen: (id: string) => void;
  onMove: (id: string, month: string) => void;
}) {
  const [now] = useState(() => new Date());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const months = forecastMonths(now);
  const current = monthKey(monthStart(now));
  const live = items.filter(isForecastable);
  const unscheduled = live.filter(
    (item) => !item.est_start && item.board_group === "active",
  ).length;

  function onDrop(event: DragEvent, month: string) {
    event.preventDefault();
    setDropTarget(null);
    const id = event.dataTransfer.getData("text/plain");
    const item = items.find((entry) => entry.id === id);
    if (item && item.est_start !== month) onMove(id, month);
  }

  return (
    <div className="flex h-full flex-col">
      <p className="caption-style text-subtle shrink-0 px-4 pt-3">
        Recruitments by estimated start month — the last 3 months, this month
        and the next 3. Drag a card to another month to change its start. Dead
        and leaver recruitments aren&apos;t counted
        {unscheduled > 0 &&
          `; ${unscheduled} active ${unscheduled === 1 ? "recruitment has" : "recruitments have"} no start month yet`}
        .
      </p>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {months.map((month) => {
          const column = live.filter((item) => item.est_start === month);
          const signedUp = column.filter(
            (item) => item.status === "signed-up",
          ).length;
          const isCurrent = month === current;
          const isPast = month < current;
          return (
            <section
              key={month}
              aria-label={formatLongMonth(month)}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(month);
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(event) => onDrop(event, month)}
              className={cn(
                "border-line-strong bg-card flex h-full min-w-[9em] flex-1 basis-0 flex-col overflow-hidden rounded-xl border transition-colors duration-150",
                isCurrent && "border-ring/70",
                dropTarget === month && "border-ring",
              )}
            >
              <header
                className={cn(
                  "border-line-strong flex flex-col gap-1 border-b px-3 py-2.5",
                  isCurrent && "bg-overlay/[0.04]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2
                    className={cn(
                      "caption-style truncate font-medium",
                      isPast && "text-soft",
                    )}
                  >
                    {formatLongMonth(month)}
                  </h2>
                  <CountBadge>{column.length}</CountBadge>
                </div>
                <span className="caption-style text-subtle">
                  {signedUp} signed up
                </span>
              </header>
              <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {column.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", item.id)
                      }
                      onClick={() => onOpen(item.id)}
                      className="border-line-strong bg-secondary hover:bg-muted focus-visible:ring-ring/60 flex w-full cursor-grab flex-col gap-1.5 rounded-lg border border-l-[3px] p-2.5 text-left transition-colors duration-150 outline-none focus-visible:ring-2 active:cursor-grabbing"
                      style={{ borderLeftColor: statusColor(item.status) }}
                    >
                      <span className="truncate text-[14px] font-medium">
                        {item.client}
                      </span>
                      <StatusTag status={item.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

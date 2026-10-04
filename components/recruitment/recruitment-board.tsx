"use client";

import { useState, type DragEvent } from "react";
import CountBadge from "@/components/_ui/count-badge";
import {
  formatMonth,
  sourceLabel,
  statusColor,
  type Recruitment,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

export default function RecruitmentBoard({
  items,
  statuses,
  onOpen,
  onMove,
}: {
  items: Recruitment[];
  statuses: { value: string; label: string }[];
  onOpen: (id: string) => void;
  onMove: (id: string, status: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function onDrop(event: DragEvent, status: string) {
    event.preventDefault();
    setDropTarget(null);
    const id = event.dataTransfer.getData("text/plain");
    const item = items.find((entry) => entry.id === id);
    if (item && item.status !== status) onMove(id, status);
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {statuses.map((status) => {
        const column = items.filter((item) => item.status === status.value);
        return (
          <section
            key={status.value}
            aria-label={status.label}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(status.value);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(event) => onDrop(event, status.value)}
            className={cn(
              "border-line-strong bg-card flex h-full min-w-[9em] flex-1 basis-0 flex-col overflow-hidden rounded-xl border transition-colors duration-150",
              dropTarget === status.value && "border-ring",
            )}
          >
            <header
              className="border-line-strong flex items-center justify-between gap-2 border-t-[3px] border-b px-3 py-2.5"
              style={{ borderTopColor: statusColor(status.value) }}
            >
              <h2 className="caption-style truncate font-medium">
                {status.label}
              </h2>
              <CountBadge>{column.length}</CountBadge>
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
                    className="border-line-strong bg-secondary hover:bg-muted focus-visible:ring-ring/60 flex w-full cursor-grab flex-col gap-1 rounded-lg border border-l-[3px] p-2.5 text-left transition-colors duration-150 outline-none focus-visible:ring-2 active:cursor-grabbing"
                    style={{ borderLeftColor: statusColor(item.status) }}
                  >
                    <span className="truncate text-[14px] font-medium">
                      {item.client}
                    </span>
                    {item.notes && (
                      <span className="caption-style text-subtle line-clamp-2">
                        {item.notes}
                      </span>
                    )}
                    <span className="caption-style text-faint flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {sourceLabel(item.source)}
                      </span>
                      {item.est_start && (
                        <span className="shrink-0">
                          {formatMonth(item.est_start)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

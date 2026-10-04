"use client";

import { useState, type DragEvent } from "react";
import CountBadge from "@/components/_ui/count-badge";
import {
  daysSince,
  enquiryTypeLabel,
  type Lead,
  type LeadStage,
} from "@/lib/leads";
import { cn } from "@/lib/utils";

export default function LeadsBoard({
  leads,
  stages,
  onOpen,
  onMove,
}: {
  leads: Lead[];
  stages: LeadStage[];
  onOpen: (id: string) => void;
  onMove: (id: string, stage: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function onDrop(event: DragEvent, stage: string) {
    event.preventDefault();
    setDropTarget(null);
    const id = event.dataTransfer.getData("text/plain");
    const lead = leads.find((item) => item.id === id);
    if (lead && lead.stage !== stage) onMove(id, stage);
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {stages.map((stage) => {
        const column = leads.filter((lead) => lead.stage === stage.id);
        return (
          <section
            key={stage.id}
            aria-label={stage.label}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(stage.id);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(event) => onDrop(event, stage.id)}
            className={cn(
              "border-line-strong bg-card flex h-full w-[17em] shrink-0 flex-col rounded-xl border transition-colors duration-150",
              dropTarget === stage.id && "border-ring",
            )}
          >
            <header className="border-line-strong flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <h2 className="caption-style truncate font-medium">
                {stage.label}
              </h2>
              <CountBadge>{column.length}</CountBadge>
            </header>
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {column.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/plain", lead.id)
                    }
                    onClick={() => onOpen(lead.id)}
                    className={cn(
                      "border-line-strong bg-secondary hover:bg-muted focus-visible:ring-ring/60 flex w-full cursor-grab flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors duration-150 outline-none focus-visible:ring-2 active:cursor-grabbing",
                      !lead.active && "opacity-60",
                    )}
                  >
                    <span className="truncate text-[14px] font-medium">
                      {lead.name}
                    </span>
                    <span className="caption-style text-subtle truncate">
                      {lead.organisation ?? lead.email}
                    </span>
                    <span className="caption-style text-faint flex justify-between gap-2">
                      <span className="truncate">
                        {enquiryTypeLabel(lead.enquiry_type)}
                      </span>
                      <span className="shrink-0">
                        {lead.active
                          ? `${daysSince(lead.stage_changed_at)}d`
                          : "Gone cold"}
                      </span>
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

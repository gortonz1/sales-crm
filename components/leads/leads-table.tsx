"use client";

import type { ReactNode } from "react";
import { PillCell, TextCell } from "@/components/recruitment/cells";
import SheetTable from "@/components/sheet/sheet-table";
import type { CustomValue } from "@/components/sheet/custom-cell";
import type { LeadPatch } from "./leads";
import { linkHref } from "@/lib/columns";
import {
  COLD_COLOR,
  INTEREST_OPTIONS,
  daysSince,
  enquiryTypeLabel,
  formatDate,
  stageColor,
  type Lead,
  type LeadStage,
} from "@/lib/leads";
import { cn } from "@/lib/utils";

const readOnly = "block truncate px-2.5 leading-9";

export default function LeadsTable({
  leads,
  stages,
  selectedId,
  onOpen,
  onUpdate,
  onCustomChange,
}: {
  leads: Lead[];
  stages: LeadStage[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onUpdate: (id: string, patch: LeadPatch) => void;
  onCustomChange: (id: string, columnId: string, value: CustomValue) => void;
}) {
  if (leads.length === 0) {
    return (
      <p className="text-subtle px-4 py-12 text-center">
        No leads match this view.
      </p>
    );
  }

  const stageOptions = stages.map((stage) => ({
    value: stage.id,
    label: stage.label,
    color: stageColor(stage.id),
  }));

  function renderBuiltIn(field: string, lead: Lead): ReactNode {
    const save = (patch: LeadPatch) => onUpdate(lead.id, patch);
    switch (field) {
      case "organisation":
        return (
          <TextCell
            label="Organisation"
            value={lead.organisation}
            onCommit={(organisation) => save({ organisation })}
          />
        );
      case "enquiry_type":
        return (
          <span className={readOnly}>
            {enquiryTypeLabel(lead.enquiry_type)}
          </span>
        );
      case "stage":
        return (
          <div className={cn("relative", !lead.active && "[&_button]:pr-10")}>
            <PillCell
              label="Stage"
              value={lead.stage}
              options={stageOptions}
              allowEmpty={false}
              onCommit={(stage) => stage && save({ stage })}
            />
            {!lead.active && (
              <span
                className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 rounded-[4px] px-1 py-0.5 text-[10px] leading-none font-medium text-white"
                style={{ backgroundColor: COLD_COLOR }}
              >
                Cold
              </span>
            )}
          </div>
        );
      case "interest":
        return (
          <PillCell
            label="Interest"
            value={lead.interest}
            options={INTEREST_OPTIONS}
            onCommit={(interest) => save({ interest })}
          />
        );
      case "submitted_at":
        return (
          <span className={readOnly}>{formatDate(lead.submitted_at)}</span>
        );
      case "stage_changed_at":
        return (
          <span className={cn(readOnly, "text-center tabular-nums")}>
            {daysSince(lead.stage_changed_at)}d
          </span>
        );
      case "phone":
        return (
          <TextCell
            label="Phone"
            value={lead.phone}
            onCommit={(phone) => save({ phone })}
          />
        );
      case "message":
        return (
          <span
            className={cn(readOnly, "text-soft")}
            title={lead.message ?? ""}
          >
            {lead.message ?? "—"}
          </span>
        );
      case "source_page":
        return lead.source_page ? (
          <a
            href={linkHref("link", lead.source_page)}
            target="_blank"
            rel="noreferrer"
            className={cn(readOnly, "text-soft hover:underline")}
          >
            {lead.source_page.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        ) : (
          <span className={readOnly}>—</span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="p-4">
      <SheetTable
        rows={leads}
        rowClassName={(lead) =>
          cn(
            !lead.active && "text-subtle",
            lead.id === selectedId && "[&>td]:bg-overlay/5",
          )
        }
        pinned={{
          label: "Name",
          width: 16,
          render: (lead) => (
            <div className="flex items-center gap-1 py-1.5 pr-1.5 pl-2.5">
              <button
                type="button"
                onClick={() => onOpen(lead.id)}
                className="flex min-w-0 flex-1 cursor-pointer flex-col text-left outline-none focus-visible:underline"
              >
                <span className="truncate font-medium">{lead.name}</span>
                <span className="caption-style text-subtle truncate">
                  {lead.email}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpen(lead.id)}
                className="caption-style text-subtle hover:text-foreground hover:bg-muted shrink-0 cursor-pointer rounded-md px-1.5 py-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
              >
                Open
              </button>
            </div>
          ),
        }}
        renderBuiltIn={renderBuiltIn}
        onCustomChange={(lead, column, value) =>
          onCustomChange(lead.id, column.id, value)
        }
      />
    </div>
  );
}

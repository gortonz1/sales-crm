"use client";

import { useState, type ReactNode } from "react";
import {
  CONTRACT_STATUSES,
  LEFT_STATUSES,
  PAPERWORK_STATUSES,
  RECRUITMENT_GROUPS,
  RECRUITMENT_STATUSES,
  SOURCES,
  monthOptions,
  type Recruitment,
  type RecruitmentPatch,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";
import { DateCell, NumberCell, PillCell, TextCell } from "./cells";
import SheetTable from "@/components/sheet/sheet-table";
import type { CustomValue } from "@/components/sheet/custom-cell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import ChevronDownIcon from "@/public/assets/images/_common/chevron-down.svg";
import GripIcon from "@/public/assets/images/_common/grip.svg";

const ROW_DRAG_TYPE = "application/x-crm-recruitment";

function renderBuiltIn(
  field: string,
  item: Recruitment,
  save: (patch: RecruitmentPatch) => void,
): ReactNode {
  switch (field) {
    case "status":
      return (
        <PillCell
          label="Status"
          value={item.status}
          options={RECRUITMENT_STATUSES}
          allowEmpty={false}
          onCommit={(status) => status && save({ status })}
        />
      );
    case "est_start":
      return (
        <PillCell
          label="Est. start"
          value={item.est_start}
          options={monthOptions(item.est_start)}
          neutral
          onCommit={(est_start) => save({ est_start })}
        />
      );
    case "source":
      return (
        <PillCell
          label="Source"
          value={item.source}
          options={SOURCES}
          onCommit={(source) => save({ source })}
        />
      );
    case "shortlist_delivery":
      return (
        <DateCell
          label="Shortlist delivery"
          value={item.shortlist_delivery}
          onCommit={(shortlist_delivery) => save({ shortlist_delivery })}
        />
      );
    case "shortlist_count":
      return (
        <NumberCell
          label="Candidates in shortlist"
          value={item.shortlist_count}
          onCommit={(shortlist_count) => save({ shortlist_count })}
        />
      );
    case "interviewees":
      return (
        <TextCell
          label="Interviewees"
          value={item.interviewees}
          onCommit={(interviewees) => save({ interviewees })}
        />
      );
    case "interview_date":
      return (
        <DateCell
          label="Interview date"
          value={item.interview_date}
          onCommit={(interview_date) => save({ interview_date })}
        />
      );
    case "notes":
      return (
        <TextCell
          label="Notes"
          value={item.notes}
          onCommit={(notes) => save({ notes })}
        />
      );
    case "das":
      return (
        <PillCell
          label="DAS"
          value={item.das}
          options={PAPERWORK_STATUSES}
          onCommit={(das) => save({ das })}
        />
      );
    case "deposit":
      return (
        <PillCell
          label="Deposit"
          value={item.deposit}
          options={PAPERWORK_STATUSES}
          onCommit={(deposit) => save({ deposit })}
        />
      );
    case "contract":
      return (
        <PillCell
          label="Contract"
          value={item.contract}
          options={CONTRACT_STATUSES}
          onCommit={(contract) => save({ contract })}
        />
      );
    case "signed_up_on":
      return (
        <DateCell
          label="Date of sign-up"
          value={item.signed_up_on}
          onCommit={(signed_up_on) => save({ signed_up_on })}
        />
      );
    case "left_status":
      return (
        <PillCell
          label="Left"
          value={item.left_status}
          options={LEFT_STATUSES}
          onCommit={(left_status) => save({ left_status })}
        />
      );
    case "contact":
      return (
        <TextCell
          label="Contact"
          value={item.contact}
          onCommit={(contact) => save({ contact })}
        />
      );
    default:
      return null;
  }
}

export default function RecruitmentSheet({
  items,
  onSave,
  onCustomChange,
  onOpen,
  onAdd,
}: {
  items: Recruitment[];
  onSave: (id: string, patch: RecruitmentPatch) => void;
  onCustomChange: (id: string, columnId: string, value: CustomValue) => void;
  onOpen: (id: string) => void;
  onAdd: (client: string, group: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    dead: true,
  });
  const [dropGroup, setDropGroup] = useState<string | null>(null);

  function moveTo(id: string, group: string) {
    const item = items.find((entry) => entry.id === id);
    if (item && item.board_group !== group) onSave(id, { board_group: group });
  }

  return (
    <div className="h-full overflow-auto pb-10">
      {RECRUITMENT_GROUPS.map((group) => {
        const rows = items.filter((item) => item.board_group === group.value);
        const isCollapsed = collapsed[group.value];
        return (
          <section
            key={group.value}
            aria-label={group.label}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(ROW_DRAG_TYPE)) return;
              event.preventDefault();
              setDropGroup(group.value);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDropGroup(null);
            }}
            onDrop={(event) => {
              const id = event.dataTransfer.getData(ROW_DRAG_TYPE);
              setDropGroup(null);
              if (!id) return;
              event.preventDefault();
              moveTo(id, group.value);
            }}
            className={cn(
              "mt-5 rounded-lg transition-colors duration-150 first:mt-4",
              dropGroup === group.value && "bg-overlay/[0.04]",
            )}
          >
            <div className="bg-background sticky left-0 z-[3] flex w-fit items-center gap-2 px-4 pb-2">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() =>
                  setCollapsed((current) => ({
                    ...current,
                    [group.value]: !current[group.value],
                  }))
                }
                className="focus-visible:ring-ring/60 flex cursor-pointer items-center gap-2 rounded-md outline-none focus-visible:ring-2"
              >
                <ChevronDownIcon
                  aria-hidden
                  className={cn(
                    "size-3 transition-transform duration-150",
                    isCollapsed && "-rotate-90",
                  )}
                  style={{ color: group.color }}
                />
                <h2
                  className="lead-style font-medium"
                  style={{ color: group.color }}
                >
                  {group.label}
                </h2>
              </button>
              <span className="caption-style text-subtle">
                {rows.length} {rows.length === 1 ? "client" : "clients"}
              </span>
            </div>

            {!isCollapsed && (
              <div className="px-4">
                <SheetTable
                  rows={rows}
                  accent={group.color}
                  pinned={{
                    label: "Client",
                    width: 16,
                    render: (item) => (
                      <div className="relative flex items-center">
                        <span
                          draggable
                          aria-hidden
                          title="Drag to another group"
                          onDragStart={(event) => {
                            event.dataTransfer.setData(ROW_DRAG_TYPE, item.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDropGroup(null)}
                          className="text-faint hover:text-subtle flex h-9 w-4 shrink-0 cursor-grab items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 active:cursor-grabbing"
                        >
                          <GripIcon className="size-3.5" />
                        </span>
                        <TextCell
                          label="Client"
                          value={item.client}
                          className="font-medium"
                          onCommit={(client) =>
                            client && onSave(item.id, { client })
                          }
                        />
                        <div className="bg-background group-hover:bg-secondary invisible absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 group-focus-within:visible group-hover:visible has-[[data-state=open]]:visible">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Move ${item.client} to another group`}
                                className="caption-style text-subtle hover:text-foreground hover:bg-muted data-[state=open]:bg-muted shrink-0 cursor-pointer rounded-md px-1.5 py-1"
                              >
                                Move
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuLabel>Move to</DropdownMenuLabel>
                              {RECRUITMENT_GROUPS.filter(
                                (target) => target.value !== item.board_group,
                              ).map((target) => (
                                <DropdownMenuItem
                                  key={target.value}
                                  onSelect={() => moveTo(item.id, target.value)}
                                >
                                  <span
                                    aria-hidden
                                    className="size-2.5 rounded-[3px]"
                                    style={{ backgroundColor: target.color }}
                                  />
                                  {target.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <button
                            type="button"
                            onClick={() => onOpen(item.id)}
                            className="caption-style text-subtle hover:text-foreground hover:bg-muted shrink-0 cursor-pointer rounded-md px-1.5 py-1"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ),
                  }}
                  renderBuiltIn={(field, item) =>
                    renderBuiltIn(field, item, (patch) =>
                      onSave(item.id, patch),
                    )
                  }
                  onCustomChange={(item, column, value) =>
                    onCustomChange(item.id, column.id, value)
                  }
                  footer={
                    <AddRow onAdd={(client) => onAdd(client, group.value)} />
                  }
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AddRow({ onAdd }: { onAdd: (client: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="Add a client"
      placeholder="+ Add client"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && value.trim()) {
          onAdd(value.trim());
          setValue("");
        }
      }}
      className="placeholder:text-subtle focus:bg-secondary sticky left-0 h-9 w-[16em] bg-transparent px-2.5 text-[13px] outline-none"
    />
  );
}

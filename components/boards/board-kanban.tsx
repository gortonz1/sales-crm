"use client";

import { useState, type DragEvent } from "react";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import type { BoardGroup, BoardItem } from "@/lib/boards";
import {
  asText,
  columnOptions,
  customValue,
  type BoardColumn,
} from "@/lib/columns";
import { asFiles } from "@/lib/files";
import { cn } from "@/lib/utils";

const CARD_DRAG_TYPE = "application/x-crm-board-card";
const NO_LABEL = "__none__";
const NO_LABEL_COLOR = "#6b6b6b";

const dueFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const formatDue = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? dueFormat.format(new Date(`${date}T00:00:00Z`))
    : date;

export default function BoardKanban({
  items,
  groups,
  columns,
  field,
  onFieldChange,
  onMove,
  onAddStatusColumn,
}: {
  items: BoardItem[];
  groups: BoardGroup[];
  columns: BoardColumn[];
  field: string | null;
  onFieldChange: (field: string) => void;
  onMove: (item: BoardItem, column: BoardColumn, value: string | null) => void;
  onAddStatusColumn?: () => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const statusColumns = columns.filter((column) => column.type === "status");
  const column =
    statusColumns.find((entry) => entry.id === field) ?? statusColumns[0];

  if (!column) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-soft max-w-[32em]">
          Kanban lays items out by a Status column.{" "}
          {onAddStatusColumn
            ? "Add one to this board to use it."
            : "Ask an admin to add one to this board to use it."}
        </p>
        {onAddStatusColumn && (
          <Button variant="secondary" size="sm" onClick={onAddStatusColumn}>
            Add a Status column
          </Button>
        )}
      </div>
    );
  }

  const options = columnOptions(column);
  const known = new Set(options.map((option) => option.value));
  const lanes = [
    ...options.map((option) => ({
      key: option.value,
      label: option.label,
      color: option.color ?? NO_LABEL_COLOR,
    })),
    { key: NO_LABEL, label: "No label", color: NO_LABEL_COLOR },
  ];
  const laneOf = (item: BoardItem) => {
    const value = asText(customValue(item, column.id));
    return value && known.has(value) ? value : NO_LABEL;
  };
  const groupOf = (item: BoardItem) =>
    groups.find((group) => group.id === item.group_id);
  const dateColumn = columns.find((entry) => entry.type === "date");
  const fileColumns = columns.filter((entry) => entry.type === "file");

  function move(item: BoardItem, lane: string) {
    if (laneOf(item) === lane) return;
    onMove(item, column, lane === NO_LABEL ? null : lane);
  }

  function onDrop(event: DragEvent, lane: string) {
    event.preventDefault();
    setDropTarget(null);
    const id = event.dataTransfer.getData(CARD_DRAG_TYPE);
    const item = items.find((entry) => entry.id === id);
    if (item) move(item, lane);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {statusColumns.length > 1 && (
        <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
          <span className="caption-style text-subtle">Lanes from</span>
          <Select value={column.id} onValueChange={onFieldChange}>
            <SelectTrigger aria-label="Lanes from" className="w-[14em]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusColumns.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {lanes.map((lane) => {
          const cards = items.filter((item) => laneOf(item) === lane.key);
          if (lane.key === NO_LABEL && cards.length === 0) return null;
          return (
            <section
              key={lane.key}
              aria-label={lane.label}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(CARD_DRAG_TYPE)) return;
                event.preventDefault();
                setDropTarget(lane.key);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setDropTarget(null);
              }}
              onDrop={(event) => onDrop(event, lane.key)}
              className={cn(
                "border-line-strong bg-card flex h-full w-[17em] shrink-0 flex-col overflow-hidden rounded-xl border transition-colors duration-150",
                dropTarget === lane.key && "border-ring",
              )}
            >
              <header
                className="border-line-strong flex items-center justify-between gap-2 border-t-[3px] border-b px-3 py-2.5"
                style={{ borderTopColor: lane.color }}
              >
                <h2 className="caption-style truncate font-medium">
                  {lane.label}
                </h2>
                <CountBadge>{cards.length}</CountBadge>
              </header>
              <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {cards.map((item) => {
                  const group = groupOf(item);
                  const due = dateColumn
                    ? asText(customValue(item, dateColumn.id))
                    : null;
                  const fileCount = fileColumns.reduce(
                    (sum, entry) =>
                      sum + asFiles(customValue(item, entry.id)).length,
                    0,
                  );
                  return (
                    <li key={item.id}>
                      <KanbanCard
                        item={item}
                        color={lane.color}
                        group={group}
                        due={
                          due ? `${dateColumn?.label} ${formatDue(due)}` : null
                        }
                        fileCount={fileCount}
                        targets={lanes.filter(
                          (target) => target.key !== lane.key,
                        )}
                        onMove={(target) => move(item, target)}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  item,
  color,
  group,
  due,
  fileCount,
  targets,
  onMove,
}: {
  item: BoardItem;
  color: string;
  group: BoardGroup | undefined;
  due: string | null;
  fileCount: number;
  targets: { key: string; label: string; color: string }[];
  onMove: (lane: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <span aria-hidden className="pointer-events-none absolute inset-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {targets.map((target) => (
            <DropdownMenuItem
              key={target.key}
              onSelect={() => onMove(target.key)}
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
        draggable
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onDragStart={(event) => {
          event.dataTransfer.setData(CARD_DRAG_TYPE, item.id);
          event.dataTransfer.effectAllowed = "move";
        }}
        className="border-line-strong bg-secondary hover:bg-muted focus-visible:ring-ring/60 flex w-full cursor-grab flex-col gap-1.5 rounded-lg border border-l-[3px] p-2.5 text-left transition-colors duration-150 outline-none focus-visible:ring-2 active:cursor-grabbing"
        style={{ borderLeftColor: color }}
      >
        <span className="text-[14px] font-medium">{item.name}</span>
        <span className="caption-style text-subtle flex flex-wrap items-center gap-x-2 gap-y-1">
          {group && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="truncate">{group.name}</span>
            </span>
          )}
          {due && <span>{due}</span>}
          {fileCount > 0 && (
            <span>
              {fileCount} {fileCount === 1 ? "file" : "files"}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

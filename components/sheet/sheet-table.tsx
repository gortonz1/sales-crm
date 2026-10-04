"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import CustomCell, { type CustomValue } from "./custom-cell";
import { useColumns } from "./columns-provider";
import {
  COLUMN_TYPES,
  customValue,
  typeLabel,
  type BoardColumn,
  type ColumnType,
  type CustomRow,
} from "@/lib/columns";
import { cn } from "@/lib/utils";
import ChevronDownIcon from "@/public/assets/images/_common/chevron-down.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const DRAG_TYPE = "application/x-crm-column";
const ADD_WIDTH = 3;

export default function SheetTable<Row extends CustomRow>({
  rows,
  pinned,
  renderBuiltIn,
  onCustomChange,
  accent,
  footer,
  rowClassName,
}: {
  rows: Row[];
  pinned: { label: string; width: number; render: (row: Row) => ReactNode };
  renderBuiltIn: (field: string, row: Row) => ReactNode;
  onCustomChange: (row: Row, column: BoardColumn, value: CustomValue) => void;
  accent?: string;
  footer?: ReactNode;
  rowClassName?: (row: Row) => string | undefined;
}) {
  const { api, editLabels } = useColumns();
  const columns = api.visible;
  const totalWidth =
    pinned.width +
    ADD_WIDTH +
    columns.reduce((sum, column) => sum + column.width, 0);

  return (
    <table
      className={cn(
        "border-line-strong table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border-y border-r text-[13px]",
        !accent && "border-l",
      )}
      style={{
        width: `${totalWidth}em`,
        borderLeft: accent ? `4px solid ${accent}` : undefined,
      }}
    >
      <colgroup>
        <col style={{ width: `${pinned.width}em` }} />
        {columns.map((column) => (
          <col key={column.id} style={{ width: `${column.width}em` }} />
        ))}
        <col style={{ width: `${ADD_WIDTH}em` }} />
      </colgroup>
      <thead>
        <tr>
          <th className="bg-card border-line-strong caption-style text-subtle sticky left-0 z-[2] h-9 border-r border-b px-2.5 text-left font-normal">
            {pinned.label}
          </th>
          {columns.map((column, index) => (
            <ColumnHeader
              key={column.id}
              column={column}
              index={index}
              count={columns.length}
            />
          ))}
          <th className="bg-card border-line-strong h-9 border-b border-l p-0">
            <AddColumnMenu />
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={cn("group", rowClassName?.(row))}>
            <td className="bg-background group-hover:bg-secondary border-line-strong sticky left-0 z-[1] border-r border-b p-0">
              {pinned.render(row)}
            </td>
            {columns.map((column) => (
              <td
                key={column.id}
                className="border-line-strong border-b border-l p-0 group-hover:bg-white/[0.02]"
              >
                {column.field ? (
                  renderBuiltIn(column.field, row)
                ) : (
                  <CustomCell
                    column={column}
                    value={customValue(row, column.id)}
                    onCommit={(value) => onCustomChange(row, column, value)}
                    onEditLabels={() => editLabels(column)}
                  />
                )}
              </td>
            ))}
            <td className="border-line-strong border-b border-l p-0" />
          </tr>
        ))}
        {footer && (
          <tr>
            <td colSpan={columns.length + 2} className="bg-background p-0">
              {footer}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ColumnHeader({
  column,
  index,
  count,
}: {
  column: BoardColumn;
  index: number;
  count: number;
}) {
  const { api, editLabels, confirmDelete } = useColumns();
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropSide, setDropSide] = useState<"left" | "right" | null>(null);
  const builtIn = column.field !== null;

  function onDragOver(event: DragEvent) {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDropSide(event.clientX < rect.left + rect.width / 2 ? "left" : "right");
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    const side = dropSide;
    setDropSide(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    if (!id || id === column.id) return;
    const from = api.visible.findIndex((entry) => entry.id === id);
    let target = side === "right" ? index + 1 : index;
    if (from < target) target -= 1;
    api.move(id, target);
  }

  return (
    <th
      draggable={!renaming}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, column.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={onDragOver}
      onDragLeave={() => setDropSide(null)}
      onDrop={onDrop}
      className={cn(
        "bg-card border-line-strong caption-style text-subtle relative h-9 border-b border-l p-0 font-normal",
        !renaming && "cursor-grab active:cursor-grabbing",
      )}
    >
      {dropSide && (
        <span
          aria-hidden
          className={cn(
            "bg-ring absolute inset-y-0 z-[1] w-0.5",
            dropSide === "left" ? "-left-px" : "-right-px",
          )}
        />
      )}
      {renaming ? (
        <RenameInput
          value={column.label}
          onDone={(label) => {
            setRenaming(false);
            if (label && label !== column.label) api.rename(column.id, label);
          }}
        />
      ) : (
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => !open && setMenuOpen(false)}
        >
          <DropdownMenuTrigger asChild>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
            />
          </DropdownMenuTrigger>
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(event) => {
              if (event.detail <= 1) setMenuOpen(true);
            }}
            onDoubleClick={() => {
              setMenuOpen(false);
              setRenaming(true);
            }}
            className="hover:text-foreground focus-visible:ring-ring/60 group/header flex h-9 w-full min-w-0 cursor-[inherit] items-center justify-center gap-1 px-2 outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            <span className="truncate">{column.label}</span>
            <ChevronDownIcon
              aria-hidden
              className="size-2.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/header:opacity-100 group-focus-visible/header:opacity-100"
            />
          </button>
          <DropdownMenuContent
            align="start"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              buttonRef.current?.focus();
            }}
          >
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              Rename
            </DropdownMenuItem>
            {!builtIn && column.type === "status" && (
              <DropdownMenuItem onSelect={() => editLabels(column)}>
                Edit labels
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => api.move(column.id, index - 1)}
            >
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === count - 1}
              onSelect={() => api.move(column.id, index + 1)}
            >
              Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {builtIn ? (
              <DropdownMenuLabel>
                {typeLabel(column.type)} column
              </DropdownMenuLabel>
            ) : (
              <>
                <DropdownMenuLabel>Column type</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={column.type}
                  onValueChange={(type) =>
                    api.changeType(column, type as ColumnType)
                  }
                >
                  {COLUMN_TYPES.map((type) => (
                    <DropdownMenuRadioItem key={type.value} value={type.value}>
                      {type.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            <DropdownMenuSeparator />
            {builtIn ? (
              <DropdownMenuItem onSelect={() => api.setHidden(column.id, true)}>
                Hide column
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() => confirmDelete(column)}
                className="text-danger"
              >
                Delete column
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </th>
  );
}

function RenameInput({
  value,
  onDone,
}: {
  value: string;
  onDone: (label: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      aria-label="Column name"
      autoFocus
      value={draft}
      maxLength={60}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onDone(draft.trim())}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          onDone(value);
        }
      }}
      className="text-foreground bg-secondary h-9 w-full min-w-0 px-2 text-center text-[13px] outline-none focus:shadow-[inset_0_0_0_1px_var(--color-ring)]"
    />
  );
}

function AddColumnMenu() {
  const { api } = useColumns();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Add column"
          className="text-subtle hover:text-foreground hover:bg-muted focus-visible:ring-ring/60 flex h-9 w-full cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <PlusIcon aria-hidden className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Add column</DropdownMenuLabel>
        {COLUMN_TYPES.map((type) => (
          <DropdownMenuItem
            key={type.value}
            onSelect={() => api.add(type.value)}
          >
            {type.label}
          </DropdownMenuItem>
        ))}
        {api.hidden.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Show hidden column</DropdownMenuLabel>
            {api.hidden.map((column) => (
              <DropdownMenuItem
                key={column.id}
                onSelect={() => api.setHidden(column.id, false)}
              >
                {column.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

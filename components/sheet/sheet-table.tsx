"use client";

import {
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
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
  LABEL_MAX,
  WIDTH_MAX,
  WIDTH_MIN,
  clampWidth,
  customValue,
  defaultWidth,
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
  pendingLabel,
  accent,
  footer,
  rowClassName,
}: {
  rows: Row[];
  pinned: { label: string; width: number; render: (row: Row) => ReactNode };
  renderBuiltIn: (field: string, row: Row) => ReactNode;
  onCustomChange: (row: Row, column: BoardColumn, value: CustomValue) => void;
  pendingLabel?: (row: Row, column: BoardColumn) => string | null;
  accent?: string;
  footer?: ReactNode;
  rowClassName?: (row: Row) => string | undefined;
}) {
  const { api, canEdit, editLabels } = useColumns();
  const columns = api.visible;
  const totalWidth =
    pinned.width +
    (canEdit ? ADD_WIDTH : 0) +
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
        {canEdit && <col style={{ width: `${ADD_WIDTH}em` }} />}
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
          {canEdit && (
            <th className="bg-card border-line-strong h-9 border-b border-l p-0">
              <AddColumnMenu />
            </th>
          )}
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
                className="border-line-strong group-hover:bg-overlay/[0.02] border-b border-l p-0"
              >
                {column.field ? (
                  renderBuiltIn(column.field, row)
                ) : pendingLabel?.(row, column) ? (
                  <PendingCell label={pendingLabel(row, column) ?? ""} />
                ) : (
                  <CustomCell
                    column={column}
                    rowId={row.id}
                    value={customValue(row, column.id)}
                    onCommit={(value) => onCustomChange(row, column, value)}
                    onEditLabels={
                      canEdit ? () => editLabels(column) : undefined
                    }
                  />
                )}
              </td>
            ))}
            {canEdit && (
              <td className="border-line-strong border-b border-l p-0" />
            )}
          </tr>
        ))}
        {footer && (
          <tr>
            <td
              colSpan={columns.length + (canEdit ? 2 : 1)}
              className="bg-background p-0"
            >
              {footer}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function PendingCell({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="caption-style text-subtle bg-overlay/[0.03] flex h-9 w-full min-w-0 items-center px-2.5"
    >
      <span className="animate-pulse truncate">{label}</span>
    </div>
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
  const { api, canEdit, editLabels, confirmDelete } = useColumns();
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

  if (!canEdit) {
    return (
      <th className="bg-card border-line-strong caption-style text-subtle h-9 border-b border-l px-2 text-center font-normal">
        <span className="block truncate">{column.label}</span>
      </th>
    );
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
      <ResizeHandle column={column} />
    </th>
  );
}

const KEYBOARD_STEP = 0.5;

function ResizeHandle({ column }: { column: BoardColumn }) {
  const { api } = useColumns();
  const drag = useRef<{
    startX: number;
    startWidth: number;
    fontSize: number;
    latest: number;
  } | null>(null);

  function onPointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const table = event.currentTarget.closest("table");
    const fontSize =
      (table && parseFloat(getComputedStyle(table).fontSize)) || 13;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startWidth: column.width,
      fontSize,
      latest: column.width,
    };
    document.documentElement.dataset.columnResizing = "";
  }

  function onPointerMove(event: PointerEvent<HTMLSpanElement>) {
    if (!drag.current) return;
    const next = clampWidth(
      drag.current.startWidth +
        (event.clientX - drag.current.startX) / drag.current.fontSize,
    );
    if (next === drag.current.latest) return;
    drag.current.latest = next;
    api.previewWidth(column.id, next);
  }

  function onPointerEnd(event: PointerEvent<HTMLSpanElement>) {
    if (!drag.current) return;
    const { latest, startWidth } = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    delete document.documentElement.dataset.columnResizing;
    if (latest !== startWidth) api.setWidth(column.id, latest);
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    const next: Record<string, number> = {
      ArrowLeft: column.width - KEYBOARD_STEP,
      ArrowRight: column.width + KEYBOARD_STEP,
      Home: WIDTH_MIN,
      End: WIDTH_MAX,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    event.stopPropagation();
    const width = clampWidth(next[event.key]);
    if (width !== column.width) api.setWidth(column.id, width);
  }

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${column.label}`}
      aria-valuemin={WIDTH_MIN}
      aria-valuemax={WIDTH_MAX}
      aria-valuenow={column.width}
      tabIndex={0}
      draggable={false}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        api.setWidth(column.id, defaultWidth(column.type as ColumnType));
      }}
      className="group/resize focus-visible:ring-ring/60 absolute inset-y-0 -right-1 z-[2] w-2 cursor-col-resize touch-none rounded-sm outline-none select-none focus-visible:ring-2"
    >
      <span
        aria-hidden
        className="ease-power3-out group-hover/resize:bg-line-strong group-active/resize:bg-ring group-focus-visible/resize:bg-ring absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-[background-color] duration-150"
      />
    </span>
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
      maxLength={LABEL_MAX}
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

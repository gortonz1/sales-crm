"use client";

import Button from "@/components/_ui/button";
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
import { Input } from "@/components/_ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/_ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  NAME_FIELD,
  isRuleReady,
  needsValue,
  opsFor,
  type FilterOp,
  type FilterRule,
  type SortRule,
  type ViewMode,
} from "@/lib/board-view";
import { columnOptions, newOptionId, type BoardColumn } from "@/lib/columns";

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "kanban", label: "Kanban" },
];

const fieldLabel = (columns: BoardColumn[], field: string) =>
  field === NAME_FIELD
    ? "Item"
    : (columns.find((column) => column.id === field)?.label ?? "Column");

const columnFor = (columns: BoardColumn[], field: string) =>
  columns.find((column) => column.id === field) ?? null;

export function ViewSwitch({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {VIEWS.map((option) => (
        <Button
          key={option.value}
          variant={view === option.value ? "muted" : "ghost"}
          size="sm"
          aria-pressed={view === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function FilterMenu({
  columns,
  filters,
  onChange,
}: {
  columns: BoardColumn[];
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
}) {
  const fields = [NAME_FIELD, ...columns.map((column) => column.id)];
  const active = filters.filter((rule) =>
    isRuleReady(columnFor(columns, rule.field), rule),
  ).length;

  const change = (id: string, patch: Partial<FilterRule>) =>
    onChange(
      filters.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );

  const setField = (rule: FilterRule, field: string) => {
    const op = opsFor(columnFor(columns, field))[0].value;
    change(rule.id, { field, op, value: "" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={active ? "muted" : "ghost"} size="sm">
          Filter{active ? ` · ${active}` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(34em,calc(100vw-2rem))] p-3"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="caption-style text-subtle">
              {filters.length > 1
                ? "Show items that match all of these"
                : "Show items where"}
            </span>
            {filters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onChange([])}>
                Clear all
              </Button>
            )}
          </div>
          {filters.map((rule) => {
            const column = columnFor(columns, rule.field);
            return (
              <div
                key={rule.id}
                className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
              >
                <Select
                  value={rule.field}
                  onValueChange={(field) => setField(rule, field)}
                >
                  <SelectTrigger aria-label="Filter column">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field} value={field}>
                        {fieldLabel(columns, field)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:order-last"
                  aria-label="Remove filter"
                  onClick={() =>
                    onChange(filters.filter((entry) => entry.id !== rule.id))
                  }
                >
                  Remove
                </Button>
                <Select
                  value={rule.op}
                  onValueChange={(op) =>
                    change(rule.id, { op: op as FilterOp })
                  }
                >
                  <SelectTrigger aria-label="Filter condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opsFor(column).map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {needsValue(column, rule.op) ? (
                  <RuleValue
                    column={column}
                    value={rule.value}
                    onChange={(value) => change(rule.id, { value })}
                  />
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
              </div>
            );
          })}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onChange([
                  ...filters,
                  {
                    id: newOptionId(),
                    field: columns[0]?.id ?? NAME_FIELD,
                    op: opsFor(columns[0] ?? null)[0].value,
                    value: "",
                  },
                ])
              }
            >
              + Add filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RuleValue({
  column,
  value,
  onChange,
}: {
  column: BoardColumn | null;
  value: string;
  onChange: (value: string) => void;
}) {
  if (column?.type === "status" || column?.type === "recruitment") {
    const options = columnOptions(column);
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger aria-label="Filter label">
          <SelectValue placeholder="Pick a label" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                {column.type === "status" && (
                  <span
                    aria-hidden
                    className="size-2.5 rounded-[3px]"
                    style={{ backgroundColor: option.color ?? "#6b6b6b" }}
                  />
                )}
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      aria-label="Filter value"
      type={
        column?.type === "number"
          ? "number"
          : column?.type === "date"
            ? "date"
            : "text"
      }
      value={value}
      placeholder="Value"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function SortMenu({
  columns,
  sort,
  onChange,
}: {
  columns: BoardColumn[];
  sort: SortRule | null;
  onChange: (sort: SortRule | null) => void;
}) {
  const sortable = columns.filter((column) => column.type !== "file");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={sort ? "muted" : "ghost"} size="sm">
          {sort
            ? `Sort · ${fieldLabel(columns, sort.field)} ${sort.direction === "asc" ? "↑" : "↓"}`
            : "Sort"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[60dvh] overflow-y-auto"
      >
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort?.field ?? ""}
          onValueChange={(field) =>
            onChange({ field, direction: sort?.direction ?? "asc" })
          }
        >
          {[NAME_FIELD, ...sortable.map((column) => column.id)].map((field) => (
            <DropdownMenuRadioItem key={field} value={field}>
              {fieldLabel(columns, field)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {sort && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Order</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort.direction}
              onValueChange={(direction) =>
                onChange({
                  ...sort,
                  direction: direction as SortRule["direction"],
                })
              }
            >
              <DropdownMenuRadioItem value="asc">
                Ascending (A–Z, low–high, oldest first)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                Descending (Z–A, high–low, newest first)
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onChange(null)}
              className="text-subtle"
            >
              Clear sort
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

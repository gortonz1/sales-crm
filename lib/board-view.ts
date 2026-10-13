import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  asDate,
  asNumber,
  asText,
  columnOptions,
  customValue,
  type BoardColumn,
} from "@/lib/columns";
import { asFiles } from "@/lib/files";
import type { BoardItem } from "@/lib/boards";

export const NAME_FIELD = "name";

export type FilterOp =
  | "contains"
  | "is"
  | "is_not"
  | "eq"
  | "gt"
  | "lt"
  | "before"
  | "after"
  | "on"
  | "overdue"
  | "checked"
  | "unchecked"
  | "empty"
  | "not_empty";

export type FilterRule = {
  id: string;
  field: string;
  op: FilterOp;
  value: string;
};

export type SortRule = { field: string; direction: "asc" | "desc" };

export type ViewMode = "table" | "kanban";

export type BoardViewSettings = {
  view: ViewMode;
  filters: FilterRule[];
  sort: SortRule | null;
  kanbanField: string | null;
};

export const DEFAULT_SETTINGS: BoardViewSettings = {
  view: "table",
  filters: [],
  sort: null,
  kanbanField: null,
};

type OpChoice = { value: FilterOp; label: string; needsValue: boolean };

const EMPTY_OPS: OpChoice[] = [
  { value: "empty", label: "is empty", needsValue: false },
  { value: "not_empty", label: "is not empty", needsValue: false },
];

export function opsFor(column: BoardColumn | null): OpChoice[] {
  if (!column)
    return [{ value: "contains", label: "contains", needsValue: true }];
  switch (column.type) {
    case "status":
    case "recruitment":
      return [
        { value: "is", label: "is", needsValue: true },
        { value: "is_not", label: "is not", needsValue: true },
        ...EMPTY_OPS,
      ];
    case "number":
      return [
        { value: "eq", label: "=", needsValue: true },
        { value: "gt", label: ">", needsValue: true },
        { value: "lt", label: "<", needsValue: true },
        ...EMPTY_OPS,
      ];
    case "date":
      return [
        { value: "on", label: "is on", needsValue: true },
        { value: "before", label: "is before", needsValue: true },
        { value: "after", label: "is after", needsValue: true },
        { value: "overdue", label: "is overdue", needsValue: false },
        ...EMPTY_OPS,
      ];
    case "checkbox":
      return [
        { value: "checked", label: "is ticked", needsValue: false },
        { value: "unchecked", label: "is not ticked", needsValue: false },
      ];
    case "file":
      return [
        { value: "not_empty", label: "has files", needsValue: false },
        { value: "empty", label: "has no files", needsValue: false },
      ];
    default:
      return [
        { value: "contains", label: "contains", needsValue: true },
        ...EMPTY_OPS,
      ];
  }
}

export const needsValue = (column: BoardColumn | null, op: FilterOp) =>
  opsFor(column).find((choice) => choice.value === op)?.needsValue ?? false;

export function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isEmpty(column: BoardColumn, item: BoardItem) {
  const raw = customValue(item, column.id);
  if (column.type === "file") return asFiles(raw).length === 0;
  if (column.type === "checkbox") return raw !== true;
  return raw === null || raw === "";
}

export function matchesRule(
  item: BoardItem,
  column: BoardColumn | null,
  rule: FilterRule,
  today: string,
) {
  if (!column) {
    return item.name.toLowerCase().includes(rule.value.trim().toLowerCase());
  }
  if (rule.op === "empty") return isEmpty(column, item);
  if (rule.op === "not_empty") return !isEmpty(column, item);
  const raw = customValue(item, column.id);
  switch (rule.op) {
    case "contains":
      return (asText(raw) ?? "")
        .toLowerCase()
        .includes(rule.value.trim().toLowerCase());
    case "is":
      return asText(raw) === rule.value;
    case "is_not":
      return asText(raw) !== rule.value;
    case "eq":
    case "gt":
    case "lt": {
      const n = asNumber(raw);
      const target = Number(rule.value);
      if (n === null || rule.value.trim() === "" || !Number.isFinite(target))
        return false;
      return rule.op === "eq"
        ? n === target
        : rule.op === "gt"
          ? n > target
          : n < target;
    }
    case "on":
    case "before":
    case "after": {
      const date = asDate(raw);
      if (!date || !rule.value) return false;
      return rule.op === "on"
        ? date === rule.value
        : rule.op === "before"
          ? date < rule.value
          : date > rule.value;
    }
    case "overdue": {
      const date = asDate(raw);
      return date !== null && date < today;
    }
    case "checked":
      return raw === true;
    case "unchecked":
      return raw !== true;
    default:
      return true;
  }
}

export function isRuleReady(column: BoardColumn | null, rule: FilterRule) {
  return !needsValue(column, rule.op) || rule.value.trim() !== "";
}

function sortKey(
  item: BoardItem,
  column: BoardColumn | null,
): string | number | null {
  if (!column) return item.name.toLowerCase();
  const raw = customValue(item, column.id);
  switch (column.type) {
    case "status": {
      const value = asText(raw);
      const index = columnOptions(column).findIndex(
        (option) => option.value === value,
      );
      return index === -1 ? null : index;
    }
    case "recruitment": {
      const value = asText(raw);
      const label = columnOptions(column).find(
        (option) => option.value === value,
      )?.label;
      return label?.toLowerCase() ?? null;
    }
    case "number":
      return asNumber(raw);
    case "date":
      return asDate(raw);
    case "checkbox":
      return raw === true ? 0 : 1;
    case "file":
      return -asFiles(raw).length || null;
    default:
      return asText(raw)?.toLowerCase() || null;
  }
}

export function compareItems(
  a: BoardItem,
  b: BoardItem,
  column: BoardColumn | null,
  direction: "asc" | "desc",
) {
  const x = sortKey(a, column);
  const y = sortKey(b, column);
  if (x === null && y === null) return a.position - b.position;
  if (x === null) return 1;
  if (y === null) return -1;
  const order =
    typeof x === "number" && typeof y === "number"
      ? x - y
      : String(x).localeCompare(String(y), "en-GB", { numeric: true });
  return (direction === "asc" ? order : -order) || a.position - b.position;
}

const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function parseSettings(raw: string | null): BoardViewSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<BoardViewSettings>;
    return {
      view: parsed.view === "kanban" ? "kanban" : "table",
      filters: Array.isArray(parsed.filters)
        ? parsed.filters.filter(
            (rule): rule is FilterRule =>
              !!rule &&
              typeof rule.id === "string" &&
              typeof rule.field === "string" &&
              typeof rule.op === "string" &&
              typeof rule.value === "string",
          )
        : [],
      sort:
        parsed.sort &&
        typeof parsed.sort.field === "string" &&
        (parsed.sort.direction === "asc" || parsed.sort.direction === "desc")
          ? parsed.sort
          : null,
      kanbanField:
        typeof parsed.kanbanField === "string" ? parsed.kanbanField : null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useBoardViewSettings(boardId: string) {
  const key = `board-view:${boardId}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => readStorage(key),
    () => null,
  );
  const settings = useMemo(() => parseSettings(raw), [raw]);
  const update = useCallback(
    (patch: Partial<BoardViewSettings>) => {
      const next = JSON.stringify({
        ...parseSettings(readStorage(key)),
        ...patch,
      });
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {}
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [settings, update] as const;
}

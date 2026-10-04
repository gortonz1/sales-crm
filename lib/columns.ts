import type { Json, Tables } from "@/lib/supabase/database.types";
import type { Option } from "@/lib/recruitment";

export type BoardColumn = Tables<"board_columns">;
export type Board = "leads" | "ai-enquiries" | "mock-exam" | "recruitment";
export type CustomTarget = "leads" | "recruitments" | "course_interests";
export type CustomRow = { id: string; custom: Json };

export type ColumnType =
  | "text"
  | "number"
  | "date"
  | "status"
  | "checkbox"
  | "email"
  | "phone"
  | "link";

export const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "link", label: "Link" },
];

export const typeLabel = (type: string) =>
  COLUMN_TYPES.find((t) => t.value === type)?.label ?? type;

const DEFAULT_WIDTHS: Record<ColumnType, number> = {
  status: 9,
  text: 12,
  number: 6.5,
  date: 9,
  checkbox: 6,
  email: 14,
  phone: 9,
  link: 12,
};

export const defaultWidth = (type: ColumnType) => DEFAULT_WIDTHS[type];

export const LABEL_COLORS = [
  "#16803c",
  "#65d38a",
  "#eab308",
  "#d9480f",
  "#ef4444",
  "#4c8df6",
  "#0e7490",
  "#9d7cf0",
  "#c026d3",
  "#6b6b6b",
];

export const newOptionId = () => crypto.randomUUID().slice(0, 8);

export function defaultOptions(type: ColumnType): Option[] {
  if (type !== "status") return [];
  return [
    { value: newOptionId(), label: "Working on it", color: "#eab308" },
    { value: newOptionId(), label: "Done", color: "#16803c" },
    { value: newOptionId(), label: "Stuck", color: "#ef4444" },
  ];
}

export function columnOptions(column: BoardColumn): Option[] {
  if (!Array.isArray(column.options)) return [];
  return column.options.flatMap((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option))
      return [];
    const { value, label, color } = option as Record<string, Json>;
    if (typeof value !== "string" || typeof label !== "string") return [];
    return [
      {
        value,
        label,
        color: typeof color === "string" ? color : undefined,
      },
    ];
  });
}

export function customValue(row: CustomRow, columnId: string): Json {
  const custom = row.custom;
  if (!custom || typeof custom !== "object" || Array.isArray(custom))
    return null;
  return custom[columnId] ?? null;
}

export const asText = (value: Json) =>
  typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : null;

export function asNumber(value: Json) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const asDate = (value: Json) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export const sortColumns = (columns: BoardColumn[]) =>
  [...columns].sort((a, b) => a.position - b.position);

export function linkHref(type: string, value: string) {
  if (type === "email") return `mailto:${value}`;
  if (type === "phone") return `tel:${value.replace(/[^\d+]/g, "")}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function withCustom<Row extends CustomRow>(
  row: Row,
  columnId: string,
  value: string | number | boolean | null,
): Row {
  const base =
    row.custom && typeof row.custom === "object" && !Array.isArray(row.custom)
      ? { ...row.custom }
      : {};
  if (value === null) delete base[columnId];
  else base[columnId] = value;
  return { ...row, custom: base };
}

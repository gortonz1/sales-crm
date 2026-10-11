import type { Tables } from "@/lib/supabase/database.types";
import {
  LABEL_COLORS,
  asText,
  columnOptions,
  customValue,
  type BoardColumn,
} from "@/lib/columns";

export type CustomBoard = Tables<"boards">;
export type BoardGroup = Tables<"board_groups">;
export type BoardItem = Tables<"board_items">;
export type BoardLink = Pick<CustomBoard, "id" | "name">;

export const NAME_MAX = 60;
export const GROUP_NAME_MAX = 80;
export const ITEM_NAME_MAX = 500;

export const FILE_BATCH = 5;

export type PendingFile = {
  itemId: string;
  columnId: string;
  assetId: string;
  name: string;
};

export const boardHref = (id: string) => `/boards/${id}`;

export const groupColor = (index: number) =>
  LABEL_COLORS[index % LABEL_COLORS.length];

export const nextPosition = (rows: { position: number }[]) =>
  rows.reduce((max, row) => Math.max(max, row.position), 0) + 1;

export const sortByPosition = <Row extends { position: number }>(rows: Row[]) =>
  [...rows].sort((a, b) => a.position - b.position);

export function matchesItemSearch(
  item: BoardItem,
  columns: BoardColumn[],
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.name.toLowerCase().includes(q)) return true;
  return columns.some((column) => {
    const value = asText(customValue(item, column.id));
    if (value === null) return false;
    const shown =
      column.type === "status"
        ? (columnOptions(column).find((option) => option.value === value)
            ?.label ?? "")
        : value;
    return shown.toLowerCase().includes(q);
  });
}

export const BIN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function binDaysLeft(deletedAt: string) {
  const age = Date.now() - new Date(deletedAt).getTime();
  return Math.max(0, BIN_DAYS - Math.floor(age / DAY_MS));
}

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function deletedAgo(deletedAt: string) {
  const minutes = Math.round(
    (new Date(deletedAt).getTime() - Date.now()) / 60000,
  );
  if (minutes > -60) return relative.format(minutes, "minute");
  if (minutes > -60 * 24)
    return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / (60 * 24)), "day");
}

export type BinKind = "board" | "group" | "item" | "column";

export type BinEntry = {
  kind: BinKind;
  id: string;
  name: string;
  place: string | null;
  boardId: string | null;
  deletedAt: string;
  deletedBy: string | null;
  detail: string | null;
  ago: string;
  daysLeft: number;
};

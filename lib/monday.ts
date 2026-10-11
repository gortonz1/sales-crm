import {
  LABEL_COLORS,
  defaultWidth,
  newOptionId,
  type ColumnType,
} from "@/lib/columns";
import type { Option } from "@/lib/recruitment";
import { GROUP_NAME_MAX, ITEM_NAME_MAX, NAME_MAX } from "@/lib/boards";

const MONDAY_API = "https://api.monday.com/v2";
const PAGE_SIZE = 200;
export const MONDAY_ITEM_LIMIT = 5000;

export class MondayError extends Error {}

export type MondayBoardSummary = {
  id: string;
  name: string;
  items: number | null;
  workspace: string | null;
};

type MondayColumn = {
  id: string;
  title: string;
  type: string;
  settings_str?: string | null;
};
type MondayGroup = {
  id: string;
  title: string;
  color: string;
  position: string;
};
type MondayValue = {
  id: string;
  type: string;
  text: string | null;
  value: string | null;
};
type MondayItem = {
  id: string;
  name: string;
  group: { id: string } | null;
  column_values: MondayValue[];
};
type ItemsPage = { cursor: string | null; items: MondayItem[] };

export type ImportColumn = {
  sourceId: string;
  label: string;
  type: ColumnType;
  options: Option[];
  width: number;
};
export type ImportGroup = { sourceId: string; name: string; color: string };
export type ImportFile = {
  columnSourceId: string;
  assetId: string;
  name: string;
};
export type ImportItem = {
  sourceId: string;
  name: string;
  groupSourceId: string;
  values: Record<string, string | number | boolean>;
  files: ImportFile[];
};
export type MondayAsset = {
  id: string;
  name: string;
  url: string | null;
  size: number | null;
};
export type ImportBoard = {
  sourceId: string;
  name: string;
  groups: ImportGroup[];
  columns: ImportColumn[];
  items: ImportItem[];
  skippedColumns: string[];
  linkedFiles: number;
  truncated: boolean;
};

async function request<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(MONDAY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
  } catch {
    throw new MondayError("Couldn't reach monday.com. Try again.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new MondayError(
      "monday.com didn't accept that token. Copy it again from your monday profile, under Developers → My access tokens.",
    );
  }
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: { message?: string }[];
    error_message?: string;
  } | null;
  const message = body?.errors?.[0]?.message ?? body?.error_message;
  if (message) throw new MondayError(`monday.com said: ${message}`);
  if (!response.ok || !body?.data) {
    throw new MondayError(`monday.com returned an error (${response.status}).`);
  }
  return body.data;
}

async function withFallback<T>(
  primary: () => Promise<T>,
  plain: () => Promise<T>,
) {
  try {
    return await primary();
  } catch (error) {
    if (
      error instanceof MondayError &&
      error.message.startsWith("monday.com said:")
    ) {
      return plain();
    }
    throw error;
  }
}

export async function listBoards(token: string): Promise<MondayBoardSummary[]> {
  type Row = {
    id: string;
    name: string;
    type?: string | null;
    items_count?: number | null;
    workspace?: { name: string } | null;
  };
  const data = await withFallback(
    () =>
      request<{ boards: Row[] }>(
        token,
        `query { boards(limit: 200, state: active, order_by: used_at) { id name type items_count workspace { name } } }`,
      ),
    () =>
      request<{ boards: Row[] }>(
        token,
        `query { boards(limit: 200) { id name } }`,
      ),
  );
  return data.boards
    .filter((board) => !board.type || board.type === "board")
    .map((board) => ({
      id: String(board.id),
      name: board.name,
      items: board.items_count ?? null,
      workspace: board.workspace?.name ?? null,
    }));
}

const ITEM_FIELDS = `cursor items { id name group { id } column_values { id type text value } }`;

export async function fetchBoard(
  token: string,
  boardId: string,
): Promise<ImportBoard> {
  type Board = {
    id: string;
    name: string;
    columns: MondayColumn[];
    groups: MondayGroup[];
    items_page: ItemsPage;
  };
  const query = (columnFields: string) =>
    `query ($ids: [ID!]) { boards(ids: $ids) { id name columns { ${columnFields} } groups { id title color position } items_page(limit: ${PAGE_SIZE}) { ${ITEM_FIELDS} } } }`;
  const data = await withFallback(
    () =>
      request<{ boards: Board[] }>(token, query("id title type settings_str"), {
        ids: [boardId],
      }),
    () =>
      request<{ boards: Board[] }>(token, query("id title type"), {
        ids: [boardId],
      }),
  );
  const board = data.boards[0];
  if (!board) {
    throw new MondayError(
      "That board wasn't found. Check the token's account can open it.",
    );
  }

  const items = [...board.items_page.items];
  let cursor = board.items_page.cursor;
  while (cursor && items.length < MONDAY_ITEM_LIMIT) {
    const next = await request<{ next_items_page: ItemsPage }>(
      token,
      `query ($cursor: String!) { next_items_page(cursor: $cursor, limit: ${PAGE_SIZE}) { ${ITEM_FIELDS} } }`,
      { cursor },
    );
    items.push(...next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }

  return convertBoard(board, items.slice(0, MONDAY_ITEM_LIMIT), !!cursor);
}

const SKIPPED_TYPES = new Set([
  "name",
  "subtasks",
  "subitems",
  "button",
  "doc",
  "direct_doc",
]);

function columnType(mondayType: string): ColumnType | null {
  if (SKIPPED_TYPES.has(mondayType)) return null;
  switch (mondayType) {
    case "status":
    case "color":
      return "status";
    case "numbers":
    case "numeric":
    case "rating":
      return "number";
    case "date":
      return "date";
    case "checkbox":
    case "boolean":
      return "checkbox";
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "link":
      return "link";
    case "file":
      return "file";
    default:
      return "text";
  }
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

function statusLabels(settings: string | null | undefined) {
  const parsed = parseJson(settings);
  if (!isRecord(parsed)) return [];
  const { labels, labels_colors: colors } = parsed;
  const colorOf = (key: string) => {
    const entry = isRecord(colors) ? colors[key] : null;
    return isRecord(entry) && isHex(entry.color) ? entry.color : undefined;
  };
  if (Array.isArray(labels)) {
    return labels.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const label = entry.label ?? entry.name;
      if (typeof label !== "string" || !label.trim()) return [];
      return [
        {
          label: label.trim(),
          color: isHex(entry.color) ? entry.color : colorOf(String(entry.id)),
        },
      ];
    });
  }
  if (isRecord(labels)) {
    return Object.entries(labels)
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[1].trim() !== "",
      )
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([key, label]) => ({ label: label.trim(), color: colorOf(key) }));
  }
  return [];
}

function cellValue(
  type: ColumnType,
  raw: MondayValue,
  statusValue: (label: string) => string,
): string | number | boolean | null {
  const text = raw.text?.trim() || null;
  const value = parseJson(raw.value);
  switch (type) {
    case "status":
      return text ? statusValue(text) : null;
    case "number": {
      if (!text) return null;
      const n = Number(text.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    case "date": {
      const date =
        isRecord(value) && typeof value.date === "string" ? value.date : text;
      return date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null;
    }
    case "checkbox":
      return isRecord(value)
        ? value.checked === true || value.checked === "true" || null
        : text === "v" || null;
    case "email":
      return isRecord(value) && typeof value.email === "string" && value.email
        ? value.email
        : text;
    case "phone":
      return isRecord(value) && typeof value.phone === "string" && value.phone
        ? value.phone
        : text;
    case "link":
      return isRecord(value) && typeof value.url === "string" && value.url
        ? value.url
        : text;
    default:
      return text;
  }
}

function cellFiles(raw: MondayValue) {
  const value = parseJson(raw.value);
  const entries =
    isRecord(value) && Array.isArray(value.files) ? value.files : [];
  const assets: { assetId: string; name: string }[] = [];
  let links = 0;
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const assetId = entry.assetId ?? entry.asset_id;
    const name = typeof entry.name === "string" ? entry.name : "file";
    if (
      (typeof assetId === "number" || typeof assetId === "string") &&
      /^\d+$/.test(String(assetId))
    ) {
      assets.push({ assetId: String(assetId), name });
    } else {
      links += 1;
    }
  }
  if (!entries.length && raw.text) {
    for (const match of raw.text.matchAll(/\/resources\/(\d+)\/([^,\s]+)/g)) {
      let name = match[2];
      try {
        name = decodeURIComponent(name);
      } catch {}
      assets.push({ assetId: match[1], name });
    }
  }
  return { assets, links };
}

const clip = (value: string, max: number) =>
  value.trim().slice(0, max) || "Untitled";

function convertBoard(
  board: {
    id: string;
    name: string;
    columns: MondayColumn[];
    groups: MondayGroup[];
  },
  items: MondayItem[],
  truncated: boolean,
): ImportBoard {
  const skippedColumns: string[] = [];
  const columns: ImportColumn[] = [];
  const statusValues = new Map<string, (label: string) => string>();

  for (const column of board.columns) {
    const type = columnType(column.type);
    if (!type) {
      if (column.type !== "name") skippedColumns.push(column.title);
      continue;
    }
    const options: Option[] =
      type === "status"
        ? statusLabels(column.settings_str).map((entry, i) => ({
            value: newOptionId(),
            label: entry.label.slice(0, 40),
            color: entry.color ?? LABEL_COLORS[i % LABEL_COLORS.length],
          }))
        : [];
    const statusValue = (label: string) => {
      const clipped = label.slice(0, 40);
      const found = options.find((option) => option.label === clipped);
      if (found) return found.value;
      const added = {
        value: newOptionId(),
        label: clipped,
        color: LABEL_COLORS[options.length % LABEL_COLORS.length],
      };
      options.push(added);
      return added.value;
    };
    statusValues.set(column.id, statusValue);
    columns.push({
      sourceId: column.id,
      label: clip(column.title, 60),
      type,
      options,
      width: column.type === "long_text" ? 18 : defaultWidth(type),
    });
  }

  const groups = [...board.groups]
    .sort((a, b) => parseFloat(a.position) - parseFloat(b.position))
    .map((group, i) => ({
      sourceId: group.id,
      name: clip(group.title, GROUP_NAME_MAX),
      color: isHex(group.color)
        ? group.color
        : LABEL_COLORS[i % LABEL_COLORS.length],
    }));
  const fallbackGroup = groups[0]?.sourceId ?? "group";
  if (!groups.length) {
    groups.push({
      sourceId: fallbackGroup,
      name: "Items",
      color: LABEL_COLORS[5],
    });
  }
  const knownGroups = new Set(groups.map((group) => group.sourceId));

  let linkedFiles = 0;
  const converted = items.map((item) => {
    const values: ImportItem["values"] = {};
    const files: ImportFile[] = [];
    for (const column of columns) {
      const raw = item.column_values.find((v) => v.id === column.sourceId);
      if (!raw) continue;
      if (column.type === "file") {
        const found = cellFiles(raw);
        linkedFiles += found.links;
        files.push(
          ...found.assets.map((asset) => ({
            ...asset,
            columnSourceId: column.sourceId,
          })),
        );
        continue;
      }
      const value = cellValue(
        column.type,
        raw,
        statusValues.get(column.sourceId)!,
      );
      if (value !== null && value !== "") values[column.sourceId] = value;
    }
    const groupId = item.group?.id;
    return {
      sourceId: String(item.id),
      name: clip(item.name, ITEM_NAME_MAX),
      groupSourceId:
        groupId && knownGroups.has(groupId) ? groupId : fallbackGroup,
      values,
      files,
    };
  });

  return {
    sourceId: String(board.id),
    name: clip(board.name, NAME_MAX),
    groups,
    columns,
    items: converted,
    skippedColumns,
    linkedFiles,
    truncated,
  };
}

export async function fetchAssets(
  token: string,
  ids: string[],
): Promise<MondayAsset[]> {
  if (!ids.length) return [];
  const data = await request<{
    assets: {
      id: string;
      name: string;
      public_url: string | null;
      file_size: number | null;
    }[];
  }>(
    token,
    `query ($ids: [ID!]!) { assets(ids: $ids) { id name public_url file_size } }`,
    { ids },
  );
  return data.assets.map((asset) => ({
    id: String(asset.id),
    name: asset.name,
    url: asset.public_url,
    size: asset.file_size,
  }));
}

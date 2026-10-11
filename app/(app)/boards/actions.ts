"use server";

import {
  FILE_BATCH,
  groupColor,
  NAME_MAX,
  nextPosition,
  type PendingFile,
} from "@/lib/boards";
import { extensionOf, FILES_BUCKET, MAX_FILE_BYTES } from "@/lib/files";
import {
  fetchAssets,
  fetchBoard,
  listBoards,
  MondayError,
  type MondayBoardSummary,
} from "@/lib/monday";
import { createClient } from "@/lib/supabase/server";

const ITEM_CHUNK = 500;
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function adminClient(): Promise<Supabase | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("crm_is_admin");
  return data === true ? supabase : null;
}

async function boardPosition(supabase: Supabase) {
  const { data } = await supabase.from("boards").select("position");
  return nextPosition(data ?? []);
}

const validToken = (token: unknown): token is string =>
  typeof token === "string" && token.trim().length > 10 && token.length < 4000;

const failure = (error: unknown, fallback: string) =>
  error instanceof MondayError ? error.message : fallback;

export async function createBoard(
  name: string,
): Promise<{ id?: string; error?: string }> {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return { error: "Give the board a name." };
  if (trimmed.length > NAME_MAX) {
    return { error: `Keep the name under ${NAME_MAX} characters.` };
  }
  const supabase = await adminClient();
  if (!supabase) return { error: "Only admins can create boards." };

  const { data: board, error } = await supabase
    .from("boards")
    .insert({ name: trimmed, position: await boardPosition(supabase) })
    .select("id")
    .single();
  if (error || !board) {
    return {
      error: `Couldn't create the board: ${error?.message ?? "no response"}`,
    };
  }
  await supabase.from("board_groups").insert({
    board_id: board.id,
    name: "Group 1",
    color: groupColor(5),
    position: 1,
  });
  return { id: board.id };
}

export async function listMondayBoards(
  token: string,
): Promise<{ boards?: MondayBoardSummary[]; error?: string }> {
  if (!validToken(token)) return { error: "Paste your monday.com API token." };
  if (!(await adminClient()))
    return { error: "Only admins can import boards." };
  try {
    return { boards: await listBoards(token.trim()) };
  } catch (error) {
    return { error: failure(error, "Couldn't load your monday.com boards.") };
  }
}

export async function importMondayBoard(
  token: string,
  mondayBoardId: string,
): Promise<{
  id?: string;
  items?: number;
  skippedColumns?: string[];
  linkedFiles?: number;
  truncated?: boolean;
  files?: PendingFile[];
  error?: string;
}> {
  if (!validToken(token)) return { error: "Paste your monday.com API token." };
  if (typeof mondayBoardId !== "string" || !/^\d{1,20}$/.test(mondayBoardId)) {
    return { error: "Pick a board to import." };
  }
  const supabase = await adminClient();
  if (!supabase) return { error: "Only admins can import boards." };

  const { data: existing } = await supabase
    .from("boards")
    .select("id, name")
    .eq("monday_board_id", mondayBoardId)
    .maybeSingle();
  if (existing) {
    return {
      error: `This board is already imported as “${existing.name}”. Delete that board first to import it again.`,
    };
  }

  let source;
  try {
    source = await fetchBoard(token.trim(), mondayBoardId);
  } catch (error) {
    return {
      error: failure(error, "Couldn't read that board from monday.com."),
    };
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .insert({
      name: source.name,
      position: await boardPosition(supabase),
      monday_board_id: source.sourceId,
    })
    .select("id")
    .single();
  if (boardError || !board) {
    return {
      error: `Couldn't create the board: ${boardError?.message ?? "no response"}`,
    };
  }

  const abort = async (step: string, message?: string) => {
    await supabase.from("boards").delete().eq("id", board.id);
    return {
      error: `Couldn't import the ${step}: ${message ?? "no response"}`,
    };
  };

  const { data: groups, error: groupsError } = await supabase
    .from("board_groups")
    .insert(
      source.groups.map((group, i) => ({
        board_id: board.id,
        name: group.name,
        color: group.color,
        position: i + 1,
        monday_group_id: group.sourceId,
      })),
    )
    .select("id, monday_group_id");
  if (groupsError || !groups) return abort("groups", groupsError?.message);
  const groupIds = new Map(groups.map((g) => [g.monday_group_id, g.id]));

  const columnIds = new Map<string, string>();
  if (source.columns.length) {
    const { data: columns, error: columnsError } = await supabase
      .from("board_columns")
      .insert(
        source.columns.map((column, i) => ({
          board: "custom",
          board_id: board.id,
          label: column.label,
          type: column.type,
          options: column.options,
          position: i + 1,
          width: column.width,
        })),
      )
      .select("id, position");
    if (columnsError || !columns)
      return abort("columns", columnsError?.message);
    for (const column of columns) {
      columnIds.set(source.columns[column.position - 1].sourceId, column.id);
    }
  }

  const rows = source.items.map((item, i) => ({
    board_id: board.id,
    group_id: groupIds.get(item.groupSourceId) ?? groups[0].id,
    name: item.name,
    position: i + 1,
    monday_item_id: item.sourceId,
    custom: Object.fromEntries(
      Object.entries(item.values).flatMap(([sourceId, value]) => {
        const id = columnIds.get(sourceId);
        return id ? [[id, value]] : [];
      }),
    ),
  }));
  const itemIds = new Map<string, string>();
  for (let i = 0; i < rows.length; i += ITEM_CHUNK) {
    const { data, error } = await supabase
      .from("board_items")
      .insert(rows.slice(i, i + ITEM_CHUNK))
      .select("id, monday_item_id");
    if (error || !data) return abort("items", error?.message);
    for (const row of data) {
      if (row.monday_item_id) itemIds.set(row.monday_item_id, row.id);
    }
  }

  const files = source.items.flatMap((item) => {
    const itemId = itemIds.get(item.sourceId);
    return itemId
      ? item.files.flatMap((file) => {
          const columnId = columnIds.get(file.columnSourceId);
          return columnId
            ? [{ itemId, columnId, assetId: file.assetId, name: file.name }]
            : [];
        })
      : [];
  });

  return {
    id: board.id,
    items: rows.length,
    skippedColumns: source.skippedColumns,
    linkedFiles: source.linkedFiles,
    truncated: source.truncated,
    files,
  };
}

async function download(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`download failed (${response.status})`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES) throw new Error("over the 50 MB limit");
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_FILE_BYTES) throw new Error("over the 50 MB limit");
  return {
    body,
    type:
      response.headers.get("content-type")?.split(";")[0] ||
      "application/octet-stream",
  };
}

export async function copyMondayFiles(
  token: string,
  boardId: string,
  batch: PendingFile[],
): Promise<{ copied: number; failed: string[]; error?: string }> {
  const empty = { copied: 0, failed: [] };
  if (!validToken(token))
    return { ...empty, error: "Paste your monday.com API token." };
  if (
    !isUuid(boardId) ||
    !Array.isArray(batch) ||
    batch.length > FILE_BATCH ||
    !batch.every(
      (file) =>
        isUuid(file?.itemId) &&
        isUuid(file?.columnId) &&
        typeof file.assetId === "string" &&
        /^\d{1,20}$/.test(file.assetId) &&
        typeof file.name === "string",
    )
  ) {
    return { ...empty, error: "Those files can't be copied." };
  }
  const supabase = await adminClient();
  if (!supabase) return { ...empty, error: "Only admins can import boards." };

  const [{ data: columns }, { data: items }] = await Promise.all([
    supabase
      .from("board_columns")
      .select("id")
      .eq("board_id", boardId)
      .eq("type", "file")
      .in("id", [...new Set(batch.map((file) => file.columnId))]),
    supabase
      .from("board_items")
      .select("id")
      .eq("board_id", boardId)
      .in("id", [...new Set(batch.map((file) => file.itemId))]),
  ]);
  const okColumns = new Set((columns ?? []).map((column) => column.id));
  const okItems = new Set((items ?? []).map((item) => item.id));
  const wanted = batch.filter(
    (file) => okColumns.has(file.columnId) && okItems.has(file.itemId),
  );

  let assets;
  try {
    assets = await fetchAssets(
      token.trim(),
      wanted.map((file) => file.assetId),
    );
  } catch (error) {
    return {
      ...empty,
      failed: batch.map((file) => file.name),
      error: failure(error, "Couldn't read the files from monday.com."),
    };
  }

  const failed = batch
    .filter((file) => !wanted.includes(file))
    .map((file) => file.name);
  let copied = 0;
  for (const file of wanted) {
    const asset = assets.find((entry) => entry.id === file.assetId);
    try {
      if (!asset?.url) throw new Error("no download link");
      const { body, type } = await download(asset.url);
      const id = crypto.randomUUID();
      const name = (asset.name || file.name).slice(0, 255);
      const ext = extensionOf(name);
      const path = `${file.columnId}/${file.itemId}/${id}${ext ? `.${ext}` : ""}`;
      const { error: uploadError } = await supabase.storage
        .from(FILES_BUCKET)
        .upload(path, body, { contentType: type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { error: saveError } = await supabase.rpc("update_custom_files", {
        target: "board_items",
        row_id: file.itemId,
        column_id: file.columnId,
        add_files: [
          {
            id,
            name,
            path,
            size: body.byteLength,
            type,
            uploadedAt: new Date().toISOString(),
          },
        ],
        remove_ids: [],
      });
      if (saveError) {
        await supabase.storage.from(FILES_BUCKET).remove([path]);
        throw new Error(saveError.message);
      }
      copied += 1;
    } catch {
      failed.push(file.name);
    }
  }
  return { copied, failed };
}

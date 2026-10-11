"use server";

import { groupColor, NAME_MAX, nextPosition } from "@/lib/boards";
import {
  fetchBoard,
  listBoards,
  MondayError,
  type MondayBoardSummary,
} from "@/lib/monday";
import { createClient } from "@/lib/supabase/server";

const ITEM_CHUNK = 500;

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
  await supabase
    .from("board_groups")
    .insert({
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
  truncated?: boolean;
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
  for (let i = 0; i < rows.length; i += ITEM_CHUNK) {
    const { error } = await supabase
      .from("board_items")
      .insert(rows.slice(i, i + ITEM_CHUNK));
    if (error) return abort("items", error.message);
  }

  return {
    id: board.id,
    items: rows.length,
    skippedColumns: source.skippedColumns,
    truncated: source.truncated,
  };
}

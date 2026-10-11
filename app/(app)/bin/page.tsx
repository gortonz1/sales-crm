import type { Metadata } from "next";
import Bin from "@/components/bin/bin";
import NoAccess from "@/components/leads/no-access";
import {
  binDaysLeft,
  deletedAgo,
  type BinEntry,
  type BinKind,
} from "@/lib/boards";
import { typeLabel } from "@/lib/columns";
import { FILES_BUCKET } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bin · Sales CRM" };

const ITEM_LIMIT = 500;

export default async function BinPage() {
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("lead_stages")
    .select("id")
    .limit(1);
  if (!stages?.length) return <NoAccess />;

  const { data: expired } = await supabase.rpc("purge_bin");
  if (expired?.length) {
    await supabase.storage.from(FILES_BUCKET).remove(expired);
  }

  const [boardsResult, groupsResult, itemsResult, columnsResult, adminResult] =
    await Promise.all([
      supabase.from("boards").select("id, name, deleted_at, deleted_by"),
      supabase
        .from("board_groups")
        .select("id, board_id, name, deleted_at, deleted_by")
        .not("deleted_at", "is", null),
      supabase
        .from("board_items")
        .select("id, board_id, group_id, name, deleted_at, deleted_by")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(ITEM_LIMIT),
      supabase
        .from("board_columns")
        .select("id, board_id, label, type, deleted_at, deleted_by")
        .eq("board", "custom")
        .not("deleted_at", "is", null),
      supabase.rpc("crm_is_admin"),
    ]);

  const boards = boardsResult.data ?? [];
  const boardName = new Map(boards.map((board) => [board.id, board.name]));
  const binnedBoards = new Set(
    boards.filter((board) => board.deleted_at).map((board) => board.id),
  );
  const binnedGroups = groupsResult.data ?? [];
  const binnedGroupIds = new Set(binnedGroups.map((group) => group.id));

  const items = itemsResult.data ?? [];
  const itemGroupIds = [...new Set(items.map((item) => item.group_id))];
  const { data: itemGroups } = itemGroupIds.length
    ? await supabase
        .from("board_groups")
        .select("id, name")
        .in("id", itemGroupIds)
    : { data: [] };
  const groupName = new Map(
    (itemGroups ?? []).map((group) => [group.id, group.name]),
  );

  const groupCounts = new Map<string, number>();
  if (binnedGroups.length) {
    const { data: inGroups } = await supabase
      .from("board_items")
      .select("group_id")
      .in(
        "group_id",
        binnedGroups.map((group) => group.id),
      )
      .is("deleted_at", null);
    for (const row of inGroups ?? []) {
      groupCounts.set(row.group_id, (groupCounts.get(row.group_id) ?? 0) + 1);
    }
  }

  const entry = (
    kind: BinKind,
    row: { id: string; deleted_at: string | null; deleted_by: string | null },
    fields: Pick<BinEntry, "name" | "place" | "boardId" | "detail">,
  ): BinEntry => ({
    kind,
    id: row.id,
    deletedAt: row.deleted_at ?? "",
    deletedBy: row.deleted_by,
    ago: deletedAgo(row.deleted_at ?? ""),
    daysLeft: binDaysLeft(row.deleted_at ?? ""),
    ...fields,
  });

  const entries: BinEntry[] = [
    ...boards
      .filter((board) => board.deleted_at)
      .map((board) =>
        entry("board", board, {
          name: board.name,
          place: null,
          boardId: board.id,
          detail: null,
        }),
      ),
    ...binnedGroups
      .filter((group) => !binnedBoards.has(group.board_id))
      .map((group) => {
        const count = groupCounts.get(group.id) ?? 0;
        return entry("group", group, {
          name: group.name,
          place: boardName.get(group.board_id) ?? null,
          boardId: group.board_id,
          detail: `${count} ${count === 1 ? "item" : "items"}`,
        });
      }),
    ...(columnsResult.data
      ?.filter(
        (column) => column.board_id && !binnedBoards.has(column.board_id),
      )
      .map((column) =>
        entry("column", column, {
          name: column.label,
          place: boardName.get(column.board_id ?? "") ?? null,
          boardId: column.board_id,
          detail: `${typeLabel(column.type)} column`,
        }),
      ) ?? []),
    ...items
      .filter(
        (item) =>
          !binnedBoards.has(item.board_id) &&
          !binnedGroupIds.has(item.group_id),
      )
      .map((item) =>
        entry("item", item, {
          name: item.name,
          place: [boardName.get(item.board_id), groupName.get(item.group_id)]
            .filter(Boolean)
            .join(" · "),
          boardId: item.board_id,
          detail: null,
        }),
      ),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  return <Bin entries={entries} isAdmin={adminResult.data === true} />;
}

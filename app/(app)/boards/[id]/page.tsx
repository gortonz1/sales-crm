import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BoardView from "@/components/boards/board-view";
import NoAccess from "@/components/leads/no-access";
import type { BoardItem } from "@/lib/boards";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };
type Supabase = Awaited<ReturnType<typeof createClient>>;

const ITEM_PAGE = 1000;

async function loadItems(supabase: Supabase, boardId: string) {
  const items: BoardItem[] = [];
  for (let from = 0; ; from += ITEM_PAGE) {
    const { data } = await supabase
      .from("board_items")
      .select("*")
      .eq("board_id", boardId)
      .is("deleted_at", null)
      .order("position")
      .order("id")
      .range(from, from + ITEM_PAGE - 1);
    items.push(...(data ?? []));
    if (!data || data.length < ITEM_PAGE) return items;
  }
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Board · Sales CRM" };
  const supabase = await createClient();
  const { data } = await supabase
    .from("boards")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return { title: `${data?.name ?? "Board"} · Sales CRM` };
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [
    stagesResult,
    boardResult,
    groupsResult,
    itemsResult,
    columnsResult,
    adminResult,
  ] = await Promise.all([
    supabase.from("lead_stages").select("id").limit(1),
    supabase
      .from("boards")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("board_groups")
      .select("*")
      .eq("board_id", id)
      .is("deleted_at", null)
      .order("position"),
    loadItems(supabase, id),
    supabase
      .from("board_columns")
      .select("*")
      .eq("board_id", id)
      .is("deleted_at", null)
      .order("position"),
    supabase.rpc("crm_is_admin"),
  ]);

  if (!stagesResult.data?.length) return <NoAccess />;
  if (!boardResult.data) notFound();
  const groups = groupsResult.data ?? [];
  const groupIds = new Set(groups.map((group) => group.id));

  return (
    <BoardView
      key={id}
      board={boardResult.data}
      initialGroups={groups}
      initialItems={itemsResult.filter((item) => groupIds.has(item.group_id))}
      initialColumns={columnsResult.data ?? []}
      isAdmin={adminResult.data === true}
    />
  );
}

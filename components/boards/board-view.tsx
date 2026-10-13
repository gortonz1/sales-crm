"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { Input } from "@/components/_ui/input";
import UndoToast, { type UndoNotice } from "@/components/_common/undo-toast";
import ColumnsDialog from "@/components/sheet/columns-dialog";
import ColumnsProvider from "@/components/sheet/columns-provider";
import type { CustomValue } from "@/components/sheet/custom-cell";
import {
  saveCustomValue,
  useBoardColumns,
} from "@/components/sheet/use-board-columns";
import type { Automation, AutomationJob } from "@/lib/automations";
import {
  GROUP_NAME_MAX,
  NAME_MAX,
  groupColor,
  matchesItemSearch,
  nextPosition,
  sortByPosition,
  type BoardGroup,
  type BoardItem,
  type CustomBoard,
} from "@/lib/boards";
import {
  NAME_FIELD,
  compareItems,
  isRuleReady,
  matchesRule,
  todayKey,
  useBoardViewSettings,
} from "@/lib/board-view";
import { withCustom, type BoardColumn } from "@/lib/columns";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { useCompaniesStore } from "@/stores/companies-store";
import AutomationsDialog from "./automations-dialog";
import BoardGroupSection from "./board-group";
import BoardKanban from "./board-kanban";
import { FilterMenu, SortMenu, ViewSwitch } from "./board-toolbar";
import NameDialog from "./name-dialog";
import { useAutomations } from "./use-automations";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import SearchIcon from "@/public/assets/images/_common/search.svg";

type Confirm = { kind: "board" } | { kind: "group"; group: BoardGroup };

export default function BoardView({
  board,
  initialGroups,
  initialItems,
  initialColumns,
  initialAutomations,
  initialJobs,
  isAdmin,
}: {
  board: CustomBoard;
  initialGroups: BoardGroup[];
  initialItems: BoardItem[];
  initialColumns: BoardColumn[];
  initialAutomations: Automation[];
  initialJobs: AutomationJob[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const columnsApi = useBoardColumns("custom", initialColumns, board.id);
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const [name, setName] = useState(board.name);
  const [groups, setGroups] = useState(() => sortByPosition(initialGroups));
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<
    { kind: "board" } | { kind: "group"; group: BoardGroup } | null
  >(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [editingColumns, setEditingColumns] = useState(false);
  const [editingAutomations, setEditingAutomations] = useState(false);
  const [undo, setUndo] = useState<UndoNotice | null>(null);
  const closeUndo = useCallback(() => setUndo(null), []);

  const [settings, updateSettings] = useBoardViewSettings(board.id);
  const columns = columnsApi.columns;
  const onItemCustom = useCallback((id: string, custom: Json) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, custom } : item)),
    );
  }, []);
  const automations = useAutomations({
    boardId: board.id,
    columns,
    initialAutomations,
    initialJobs,
    onItemCustom,
  });
  const rules = useMemo(
    () =>
      settings.filters.flatMap((rule) => {
        const column = columns.find((entry) => entry.id === rule.field) ?? null;
        if (!column && rule.field !== NAME_FIELD) return [];
        return isRuleReady(column, rule) ? [{ rule, column }] : [];
      }),
    [settings.filters, columns],
  );
  const sortColumn = settings.sort
    ? (columns.find((entry) => entry.id === settings.sort?.field) ?? null)
    : null;
  const sortActive =
    settings.sort !== null &&
    (settings.sort.field === NAME_FIELD || sortColumn !== null);

  const visible = useMemo(() => {
    const today = todayKey();
    const matched = items.filter(
      (item) =>
        matchesItemSearch(item, columns, query) &&
        rules.every(({ rule, column }) =>
          matchesRule(item, column, rule, today),
        ),
    );
    return settings.sort && sortActive
      ? [...matched].sort((a, b) =>
          compareItems(a, b, sortColumn, settings.sort!.direction),
        )
      : sortByPosition(matched);
  }, [items, columns, query, rules, settings.sort, sortActive, sortColumn]);
  const narrowed = query.trim() !== "" || rules.length > 0;

  const fail = (action: string, message?: string) =>
    setError(`Couldn't ${action}: ${message ?? "no response"}`);

  async function addItem(groupId: string, itemName: string) {
    setError(null);
    const { data, error } = await createClient()
      .from("board_items")
      .insert({
        board_id: board.id,
        group_id: groupId,
        name: itemName,
        position: nextPosition(items),
      })
      .select()
      .single();
    if (error || !data) return fail("add the item", error?.message);
    setItems((current) => [...current, data]);
  }

  async function updateItem(id: string, patch: TablesUpdate<"board_items">) {
    const previous = items.find((item) => item.id === id);
    if (!previous) return;
    setError(null);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    const { error } = await createClient()
      .from("board_items")
      .update(patch)
      .eq("id", id);
    if (error) {
      setItems((current) =>
        current.map((item) => (item.id === id ? previous : item)),
      );
      fail(`save ${previous.name}`, error.message);
    }
  }

  async function saveCustom(id: string, columnId: string, value: CustomValue) {
    const previous = items.find((item) => item.id === id);
    if (!previous) return;
    setError(null);
    setItems((current) =>
      current.map((item) =>
        item.id === id ? withCustom(item, columnId, value) : item,
      ),
    );
    const { data, error } = await saveCustomValue(
      "board_items",
      previous,
      columnId,
      value,
    );
    setItems((current) =>
      current.map((item) =>
        item.id !== id ? item : error ? previous : { ...item, custom: data },
      ),
    );
    if (error) return fail(`save ${previous.name}`, error.message);
    if (
      Array.isArray(value) &&
      automations.automations.some(
        (rule) => rule.enabled && rule.trigger_column_id === columnId,
      )
    )
      void automations.kick();
  }

  const binned = () => ({ deleted_at: new Date().toISOString() });

  async function deleteItem(item: BoardItem) {
    setError(null);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    const { error } = await createClient()
      .from("board_items")
      .update(binned())
      .eq("id", item.id);
    if (error) {
      setItems((current) => [...current, item]);
      return fail(`delete ${item.name}`, error.message);
    }
    setUndo({
      message: `Deleted “${item.name}”`,
      undo: () => restoreItem(item),
    });
  }

  async function restoreItem(item: BoardItem) {
    setError(null);
    setItems((current) => [...current, item]);
    const { error } = await createClient()
      .from("board_items")
      .update({ deleted_at: null })
      .eq("id", item.id);
    if (error) {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      fail(`restore ${item.name}`, error.message);
    }
  }

  async function addGroup() {
    setError(null);
    const { data, error } = await createClient()
      .from("board_groups")
      .insert({
        board_id: board.id,
        name: "New group",
        color: groupColor(groups.length),
        position: nextPosition(groups),
      })
      .select()
      .single();
    if (error || !data) return fail("add the group", error?.message);
    setGroups((current) => [...current, data]);
    setRenaming({ kind: "group", group: data });
  }

  async function updateGroup(id: string, patch: TablesUpdate<"board_groups">) {
    const previous = groups;
    setError(null);
    setGroups((current) =>
      sortByPosition(
        current.map((group) =>
          group.id === id ? { ...group, ...patch } : group,
        ),
      ),
    );
    const { error } = await createClient()
      .from("board_groups")
      .update(patch)
      .eq("id", id);
    if (error) {
      setGroups(previous);
      fail("change the group", error.message);
    }
  }

  async function moveGroup(id: string, direction: -1 | 1) {
    const index = groups.findIndex((group) => group.id === id);
    const other = groups[index + direction];
    if (index === -1 || !other) return;
    const previous = groups;
    const reordered = [...groups];
    reordered.splice(index, 1);
    reordered.splice(index + direction, 0, groups[index]);
    const numbered = reordered.map((group, i) => ({
      ...group,
      position: i + 1,
    }));
    setError(null);
    setGroups(numbered);
    const supabase = createClient();
    const results = await Promise.all(
      numbered
        .filter(
          (group) =>
            previous.find((entry) => entry.id === group.id)?.position !==
            group.position,
        )
        .map((group) =>
          supabase
            .from("board_groups")
            .update({ position: group.position })
            .eq("id", group.id),
        ),
    );
    const failed = results.find((result) => result.error);
    if (failed) {
      setGroups(previous);
      fail("move the group", failed.error?.message);
    }
  }

  async function deleteGroup(group: BoardGroup) {
    setError(null);
    setGroups((current) => current.filter((entry) => entry.id !== group.id));
    const { error } = await createClient()
      .from("board_groups")
      .update(binned())
      .eq("id", group.id);
    if (error) {
      setGroups((current) => sortByPosition([...current, group]));
      return fail(`delete ${group.name}`, error.message);
    }
    setUndo({
      message: `Deleted “${group.name}”`,
      undo: () => restoreGroup(group),
    });
  }

  async function restoreGroup(group: BoardGroup) {
    setError(null);
    setGroups((current) => sortByPosition([...current, group]));
    const { error } = await createClient()
      .from("board_groups")
      .update({ deleted_at: null })
      .eq("id", group.id);
    if (error) {
      setGroups((current) => current.filter((entry) => entry.id !== group.id));
      fail(`restore ${group.name}`, error.message);
    }
  }

  async function renameBoard(next: string) {
    const previous = name;
    setError(null);
    setName(next);
    const { error } = await createClient()
      .from("boards")
      .update({ name: next })
      .eq("id", board.id);
    if (error) {
      setName(previous);
      return fail("rename the board", error.message);
    }
    router.refresh();
  }

  async function deleteBoard() {
    setError(null);
    const { error } = await createClient()
      .from("boards")
      .update(binned())
      .eq("id", board.id);
    if (error) return fail("delete the board", error.message);
    router.replace("/bin");
    router.refresh();
  }

  function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === "board") deleteBoard();
    else deleteGroup(confirm.group);
    setConfirm(null);
  }

  const confirmCopy = confirm
    ? confirm.kind === "board"
      ? {
          title: `Delete “${name}”?`,
          body: "The board, its groups, columns and items move to the Bin for everyone. An admin can restore it from there for 30 days.",
          action: "Delete board",
        }
      : {
          title: `Delete “${confirm.group.name}”?`,
          body: `The group and its ${items.filter((item) => item.group_id === confirm.group.id).length} items move to the Bin, where they can be restored for 30 days.`,
          action: "Delete group",
        }
    : null;

  return (
    <ColumnsProvider api={columnsApi} canEdit={isAdmin}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0">
          <div className="flex items-center justify-between gap-2 px-4 py-[14px]">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <MenuIcon aria-hidden className="size-3.5" />
              </Button>
              <h1 className="truncate">{name}</h1>
              {board.monday_board_id && (
                <span
                  title="A copy of the monday.com board. It isn't linked back, so edit it like any other board."
                  className="caption-style bg-muted border-pill hidden shrink-0 rounded-full border px-2 py-[3px] sm:inline"
                >
                  From monday.com
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Board
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => setRenaming({ kind: "board" })}
                    >
                      Rename board
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setEditingColumns(true)}>
                      Edit columns
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setEditingAutomations(true)}
                    >
                      Automations
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setConfirm({ kind: "board" })}
                      className="text-danger"
                    >
                      Delete board
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="primary" size="sm" onClick={addGroup}>
                <PlusIcon aria-hidden className="size-3" />
                New group
              </Button>
            </div>
          </div>

          <div className="border-border flex flex-col gap-2 border-b px-4 pb-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="relative mr-1.5 block w-full sm:w-[18em]">
                <span className="sr-only">Search {name}</span>
                <SearchIcon
                  aria-hidden
                  className="text-subtle pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
                />
                <Input
                  type="search"
                  placeholder="Search items…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-8"
                />
              </label>
              <FilterMenu
                columns={columns}
                filters={settings.filters}
                onChange={(filters) => updateSettings({ filters })}
              />
              <SortMenu
                columns={columns}
                sort={sortActive ? settings.sort : null}
                onChange={(sort) => updateSettings({ sort })}
              />
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingColumns(true)}
                >
                  Columns
                </Button>
              )}
              <Button
                variant={automations.openCount ? "muted" : "ghost"}
                size="sm"
                onClick={() => setEditingAutomations(true)}
              >
                Automations
                {automations.openCount
                  ? ` · ${automations.openCount} running`
                  : ""}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="caption-style text-subtle">
                {narrowed
                  ? `${visible.length} of ${items.length} items`
                  : `${items.length} ${items.length === 1 ? "item" : "items"} · ${groups.length} ${groups.length === 1 ? "group" : "groups"}`}
              </span>
              <ViewSwitch
                view={settings.view}
                onChange={(view) => updateSettings({ view })}
              />
            </div>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="caption-style text-danger border-border shrink-0 border-b px-4 py-2"
          >
            {error}
          </p>
        )}

        {settings.view === "kanban" ? (
          <div className="min-h-0 flex-1">
            <BoardKanban
              items={visible}
              groups={groups}
              columns={columns}
              field={settings.kanbanField}
              onFieldChange={(kanbanField) => updateSettings({ kanbanField })}
              onMove={(item, column, value) =>
                saveCustom(item.id, column.id, value)
              }
              onAddStatusColumn={
                isAdmin
                  ? async () => {
                      const added = await columnsApi.add("status");
                      if (added) updateSettings({ kanbanField: added.id });
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto pb-10">
            {groups.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-4">
                <p className="text-soft">
                  This board is empty. Add a group to start adding items.
                </p>
                <Button variant="secondary" size="sm" onClick={addGroup}>
                  <PlusIcon aria-hidden className="size-3" />
                  Add group
                </Button>
              </div>
            ) : (
              groups.map((group, index) => (
                <BoardGroupSection
                  key={group.id}
                  group={group}
                  groups={groups}
                  index={index}
                  items={visible.filter((item) => item.group_id === group.id)}
                  onAddItem={(itemName) => addItem(group.id, itemName)}
                  onRenameItem={(id, itemName) =>
                    updateItem(id, { name: itemName })
                  }
                  onMoveItem={(id, groupId) =>
                    updateItem(id, { group_id: groupId })
                  }
                  onDeleteItem={deleteItem}
                  onCustomChange={saveCustom}
                  pendingLabel={automations.pendingLabel}
                  onRename={() => setRenaming({ kind: "group", group })}
                  onColor={(color) => updateGroup(group.id, { color })}
                  onMove={(direction) => moveGroup(group.id, direction)}
                  onDelete={() => setConfirm({ kind: "group", group })}
                />
              ))
            )}
          </div>
        )}

        <NameDialog
          open={renaming !== null}
          title={renaming?.kind === "board" ? "Rename board" : "Rename group"}
          label={renaming?.kind === "board" ? "Board name" : "Group name"}
          value={
            renaming?.kind === "group"
              ? (groups.find((group) => group.id === renaming.group.id)?.name ??
                renaming.group.name)
              : name
          }
          maxLength={renaming?.kind === "board" ? NAME_MAX : GROUP_NAME_MAX}
          onClose={() => setRenaming(null)}
          onSave={(next) => {
            if (renaming?.kind === "board") renameBoard(next);
            else if (renaming?.kind === "group")
              updateGroup(renaming.group.id, { name: next });
          }}
        />

        <ColumnsDialog
          open={editingColumns}
          onOpenChange={setEditingColumns}
          boardName={name}
        />

        <AutomationsDialog
          open={editingAutomations}
          onOpenChange={setEditingAutomations}
          api={automations}
          columns={columns}
          canEdit={isAdmin}
          boardName={name}
          itemName={(id) => items.find((item) => item.id === id)?.name ?? null}
        />

        <UndoToast notice={undo} onClose={closeUndo} />

        <Dialog
          open={confirm !== null}
          onOpenChange={(open) => !open && setConfirm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmCopy?.title}</DialogTitle>
              <DialogDescription>{confirmCopy?.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={runConfirm}>
                {confirmCopy?.action}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </ColumnsProvider>
  );
}

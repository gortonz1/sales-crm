"use client";

import { useState } from "react";
import { asFiles, removeColumnFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import {
  LABEL_MAX,
  defaultOptions,
  defaultWidth,
  sortColumns,
  typeLabel,
  type Board,
  type BoardColumn,
  type ColumnType,
  customValue,
  type CellValue,
  type CustomRow,
  type CustomTarget,
} from "@/lib/columns";
import type { Option } from "@/lib/recruitment";
import type { TablesUpdate } from "@/lib/supabase/database.types";

export type ColumnsApi = ReturnType<typeof useBoardColumns>;

export function useBoardColumns(
  board: Board,
  initial: BoardColumn[],
  boardId: string | null = null,
) {
  const [columns, setColumns] = useState(() => sortColumns(initial));
  const [error, setError] = useState<string | null>(null);

  async function update(id: string, patch: TablesUpdate<"board_columns">) {
    const previous = columns;
    setError(null);
    setColumns((current) =>
      current.map((column) =>
        column.id === id ? { ...column, ...patch } : column,
      ),
    );
    const { error } = await createClient()
      .from("board_columns")
      .update(patch)
      .eq("id", id);
    if (error) {
      setColumns(previous);
      setError(`Couldn't change the column: ${error.message}`);
    }
  }

  async function add(type: ColumnType, label = typeLabel(type)) {
    setError(null);
    const position =
      columns.reduce((max, column) => Math.max(max, column.position), 0) + 1;
    const { data, error } = await createClient()
      .from("board_columns")
      .insert({
        board,
        board_id: boardId,
        label: label.trim().slice(0, LABEL_MAX) || typeLabel(type),
        type,
        position,
        width: defaultWidth(type),
        options: defaultOptions(type),
      })
      .select()
      .single();
    if (error || !data) {
      setError(`Couldn't add the column: ${error?.message ?? "no response"}`);
      return null;
    }
    setColumns((current) => [...current, data]);
    return data;
  }

  async function remove(id: string) {
    const previous = columns;
    const removed = columns.find((column) => column.id === id);
    setError(null);
    setColumns((current) => current.filter((column) => column.id !== id));
    const table = createClient().from("board_columns");
    const { error } =
      board === "custom"
        ? await table
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id)
        : await table.delete().eq("id", id);
    if (error) {
      setColumns(previous);
      setError(`Couldn't delete the column: ${error.message}`);
      return false;
    }
    if (board !== "custom" && removed?.type === "file")
      removeColumnFiles(id).catch(() => undefined);
    return true;
  }

  async function restore(column: BoardColumn) {
    setError(null);
    setColumns((current) => sortColumns([...current, column]));
    const { error } = await createClient()
      .from("board_columns")
      .update({ deleted_at: null })
      .eq("id", column.id);
    if (error) {
      setColumns((current) =>
        current.filter((entry) => entry.id !== column.id),
      );
      setError(`Couldn't restore the column: ${error.message}`);
    }
  }

  async function move(id: string, toIndex: number) {
    const visible = columns.filter((column) => !column.hidden);
    const from = visible.findIndex((column) => column.id === id);
    if (from === -1) return;
    const target = Math.max(0, Math.min(visible.length - 1, toIndex));
    if (target === from) return;
    const reordered = [...visible];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(target, 0, moved);
    const ordered = [
      ...reordered,
      ...columns.filter((column) => column.hidden),
    ];
    const previous = columns;
    setError(null);
    setColumns(ordered.map((column, i) => ({ ...column, position: i + 1 })));
    const { error } = await createClient().rpc("reorder_board_columns", {
      board_name: board,
      ids: ordered.map((column) => column.id),
    });
    if (error) {
      setColumns(previous);
      setError(`Couldn't move the column: ${error.message}`);
    }
  }

  function previewWidth(id: string, width: number) {
    setColumns((current) =>
      current.map((column) =>
        column.id === id ? { ...column, width } : column,
      ),
    );
  }

  function changeType(column: BoardColumn, type: ColumnType) {
    const hasOptions =
      Array.isArray(column.options) && column.options.length > 0;
    return update(column.id, {
      type,
      options:
        type === "status" && !hasOptions
          ? defaultOptions(type)
          : column.options,
    });
  }

  return {
    columns,
    visible: columns.filter((column) => !column.hidden),
    hidden: columns.filter((column) => column.hidden),
    error,
    clearError: () => setError(null),
    add,
    remove,
    restore,
    inBin: board === "custom",
    move,
    rename: (id: string, label: string) => update(id, { label }),
    changeType,
    setOptions: (id: string, options: Option[]) => update(id, { options }),
    setHidden: (id: string, hidden: boolean) => update(id, { hidden }),
    previewWidth,
    setWidth: (id: string, width: number) => update(id, { width }),
  };
}

export async function saveCustomValue(
  target: CustomTarget,
  previous: CustomRow,
  columnId: string,
  value: CellValue,
) {
  if (Array.isArray(value)) {
    const now = value;
    const was = asFiles(customValue(previous, columnId));
    return createClient().rpc("update_custom_files", {
      target,
      row_id: previous.id,
      column_id: columnId,
      add_files: now.filter((file) => !was.some((old) => old.id === file.id)),
      remove_ids: was
        .filter((old) => !now.some((file) => file.id === old.id))
        .map((old) => old.id),
    });
  }
  return createClient().rpc("set_custom_value", {
    target,
    row_id: previous.id,
    column_id: columnId,
    value,
  });
}

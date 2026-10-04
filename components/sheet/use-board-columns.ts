"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  defaultOptions,
  defaultWidth,
  sortColumns,
  typeLabel,
  type Board,
  type BoardColumn,
  type ColumnType,
} from "@/lib/columns";
import type { Option } from "@/lib/recruitment";
import type { TablesUpdate } from "@/lib/supabase/database.types";

export type ColumnsApi = ReturnType<typeof useBoardColumns>;

export function useBoardColumns(board: Board, initial: BoardColumn[]) {
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

  async function add(type: ColumnType) {
    setError(null);
    const position =
      columns.reduce((max, column) => Math.max(max, column.position), 0) + 1;
    const { data, error } = await createClient()
      .from("board_columns")
      .insert({
        board,
        label: typeLabel(type),
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
    setError(null);
    setColumns((current) => current.filter((column) => column.id !== id));
    const { error } = await createClient()
      .from("board_columns")
      .delete()
      .eq("id", id);
    if (error) {
      setColumns(previous);
      setError(`Couldn't delete the column: ${error.message}`);
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
    move,
    rename: (id: string, label: string) => update(id, { label }),
    changeType,
    setOptions: (id: string, options: Option[]) => update(id, { options }),
    setHidden: (id: string, hidden: boolean) => update(id, { hidden }),
  };
}

export async function saveCustomValue(
  target: "leads" | "recruitments" | "course_interests",
  rowId: string,
  columnId: string,
  value: string | number | boolean | null,
) {
  return createClient().rpc("set_custom_value", {
    target,
    row_id: rowId,
    column_id: columnId,
    value,
  });
}

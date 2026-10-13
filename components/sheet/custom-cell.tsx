"use client";

import {
  CheckboxCell,
  DateCell,
  LinkCell,
  NumberCell,
  PillCell,
  TextCell,
} from "@/components/recruitment/cells";
import {
  asDate,
  asNumber,
  asText,
  columnOptions,
  type BoardColumn,
  type CellValue,
} from "@/lib/columns";
import { asFiles } from "@/lib/files";
import type { Json } from "@/lib/supabase/database.types";
import { useColumns } from "./columns-provider";
import FileCell from "./file-cell";

export type CustomValue = CellValue;

export default function CustomCell({
  column,
  rowId,
  value,
  onCommit,
  onEditLabels,
}: {
  column: BoardColumn;
  rowId: string;
  value: Json;
  onCommit: (value: CustomValue) => void;
  onEditLabels?: () => void;
}) {
  const { notify } = useColumns();
  const label = column.label;
  switch (column.type) {
    case "file":
      return (
        <FileCell
          label={label}
          width={column.width}
          columnId={column.id}
          rowId={rowId}
          files={asFiles(value)}
          onCommit={onCommit}
          onError={notify}
        />
      );
    case "status":
      return (
        <PillCell
          label={label}
          value={asText(value)}
          options={columnOptions(column)}
          onCommit={onCommit}
          onEditLabels={onEditLabels}
        />
      );
    case "number":
      return (
        <NumberCell
          label={label}
          value={asNumber(value)}
          onCommit={onCommit}
          decimals
        />
      );
    case "date":
      return (
        <DateCell label={label} value={asDate(value)} onCommit={onCommit} />
      );
    case "checkbox":
      return (
        <CheckboxCell
          label={label}
          value={value === true}
          onCommit={(checked) => onCommit(checked || null)}
        />
      );
    case "email":
    case "phone":
    case "link":
      return (
        <LinkCell
          label={label}
          type={column.type}
          value={asText(value)}
          onCommit={onCommit}
        />
      );
    default:
      return (
        <TextCell label={label} value={asText(value)} onCommit={onCommit} />
      );
  }
}

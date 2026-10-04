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
} from "@/lib/columns";
import type { Json } from "@/lib/supabase/database.types";

export type CustomValue = string | number | boolean | null;

export default function CustomCell({
  column,
  value,
  onCommit,
  onEditLabels,
}: {
  column: BoardColumn;
  value: Json;
  onCommit: (value: CustomValue) => void;
  onEditLabels: () => void;
}) {
  const label = column.label;
  switch (column.type) {
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

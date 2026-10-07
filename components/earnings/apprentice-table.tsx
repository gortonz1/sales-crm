"use client";

import { useMemo, useState } from "react";
import FilterMenu from "@/components/_common/filter-menu";
import Tag from "@/components/_ui/tag";
import {
  SHORT_MONTHS,
  apprenticeName,
  gbp,
  type Adjusted,
} from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

type SortKey =
  | "sn"
  | "band"
  | "st"
  | "start"
  | "pend"
  | "price"
  | "rem"
  | "cel"
  | "total";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "19+", label: "19+" },
  { value: "16-18", label: "16-18" },
  { value: "none", label: "No earnings" },
];

const NUMERIC: SortKey[] = ["price", "rem", "cel", "total"];

function compare(a: Adjusted, b: Adjusted, key: SortKey) {
  if (key === "sn") return (a.sn + a.fn).localeCompare(b.sn + b.fn);
  if (key === "band" || key === "st") return a[key].localeCompare(b[key]);
  if (key === "start") return a.startTs - b.startTs;
  if (key === "pend") return a.pendTs - b.pendTs;
  return (a[key] || 0) - (b[key] || 0);
}

export default function ApprenticeTable({
  rows,
  epa,
  masked,
  year,
  fileName,
}: {
  rows: Adjusted[];
  epa: Record<string, number>;
  masked: boolean;
  year: string;
  fileName: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [direction, setDirection] = useState(-1);
  const [filter, setFilter] = useState("all");

  const table = useMemo(
    () =>
      rows
        .filter((row) =>
          filter === "all"
            ? true
            : filter === "none"
              ? !row.active
              : row.band === filter,
        )
        .sort((a, b) => direction * compare(a, b, sortKey)),
    [rows, filter, sortKey, direction],
  );

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDirection(-direction);
    else {
      setSortKey(key);
      setDirection(-1);
    }
  };

  const columns: [SortKey, string][] = [
    ["sn", "Apprentice"],
    ["band", "Band"],
    ["st", "Status"],
    ["start", "Started"],
    ["pend", "Planned end"],
    ["price", "Price"],
    ["rem", "Remaining"],
    ["cel", "Completion"],
    ["total", `${year} earnings`],
  ];

  return (
    <Panel
      title="Apprentice detail"
      actions={
        <FilterMenu
          label="Show"
          value={filter}
          options={FILTERS}
          onChange={setFilter}
          align="end"
        />
      }
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="caption-style w-full min-w-[60em] text-left tabular-nums">
          <thead>
            <tr className="text-subtle">
              {columns.map(([key, label]) => (
                <th
                  key={key}
                  aria-sort={
                    sortKey === key
                      ? direction === -1
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className={cn(
                    "py-2 pr-3 font-normal whitespace-nowrap last:pr-0",
                    NUMERIC.includes(key) && "text-right",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => sortBy(key)}
                    className={cn(
                      "hover:text-foreground focus-visible:ring-ring/60 cursor-pointer rounded-sm outline-none focus-visible:ring-2",
                      sortKey === key && "text-foreground font-medium",
                    )}
                  >
                    {label}
                    {sortKey === key && (direction === -1 ? " ↓" : " ↑")}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr
                key={row.ref}
                className="border-line-strong hover:bg-overlay/[0.03] border-t transition-colors duration-150"
              >
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium">
                      {apprenticeName(row, masked)}
                    </span>
                    {row.rs && (
                      <Tag tone="amber" size="sm" className="text-[11px]">
                        restart
                      </Tag>
                    )}
                    {row.fin != null && (
                      <Tag tone="blue" size="sm" className="text-[11px]">
                        finishes {SHORT_MONTHS[row.fin]}
                      </Tag>
                    )}
                    {row.mode === "epa" && (
                      <Tag tone="purple" size="sm" className="text-[11px]">
                        EPA {SHORT_MONTHS[epa[row.ref]]}
                      </Tag>
                    )}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <Tag
                    tone={
                      row.band === "16-18"
                        ? "yellow"
                        : row.band === "19+"
                          ? "blue"
                          : "neutral"
                    }
                    size="sm"
                    className="text-[11px]"
                  >
                    {row.band}
                  </Tag>
                </td>
                <td
                  className={cn(
                    "py-2 pr-3 whitespace-nowrap",
                    !row.active && "text-subtle",
                  )}
                >
                  {row.st}
                </td>
                <td className="text-subtle py-2 pr-3 whitespace-nowrap">
                  {row.start}
                </td>
                <td className="text-subtle py-2 pr-3 whitespace-nowrap">
                  {row.aend ? `${row.aend} (actual)` : row.pend}
                </td>
                <td className="py-2 pr-3 text-right">
                  {row.price ? gbp(row.price) : "—"}
                </td>
                <td className="py-2 pr-3 text-right">
                  {row.rem ? gbp(row.rem) : "—"}
                </td>
                <td className="py-2 pr-3 text-right">
                  {row.cel ? gbp(row.cel) : "—"}
                </td>
                <td className="py-2 text-right font-medium">
                  {row.total ? gbp(row.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="caption-style text-subtle leading-[1.4]">
        Indicative earnings only — actual payment depends on the ILR submitted
        at each return and on employer account funds. Early finishes, EPAs and
        planned starts are what-ifs; the report itself is never changed. Read
        from {fileName}. Use Hide names before sharing a screen.
      </p>
    </Panel>
  );
}

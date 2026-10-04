"use client";

import { useMemo, useState, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { PillCell, TextCell } from "@/components/recruitment/cells";
import AiCourseSubnav from "./subnav";
import ColumnsProvider from "@/components/sheet/columns-provider";
import type { CustomValue } from "@/components/sheet/custom-cell";
import SheetTable from "@/components/sheet/sheet-table";
import {
  saveCustomValue,
  useBoardColumns,
} from "@/components/sheet/use-board-columns";
import { withCustom, type BoardColumn } from "@/lib/columns";
import { createClient } from "@/lib/supabase/client";
import { INTEREST_OPTIONS, formatDate } from "@/lib/leads";
import type { Option } from "@/lib/recruitment";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { useCompaniesStore } from "@/stores/companies-store";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import SearchIcon from "@/public/assets/images/_common/search.svg";

type OptIn = Tables<"course_interests">;
type OptInPatch = TablesUpdate<"course_interests">;

const STATUSES: Option[] = [
  { value: "new", label: "New", color: "#6b6b6b" },
  { value: "contacted", label: "Contacted", color: "#d9480f" },
  { value: "applying", label: "Applying", color: "#eab308" },
  { value: "enrolled", label: "Enrolled", color: "#16803c" },
  { value: "not-interested", label: "Not interested", color: "#ef4444" },
];

const readOnly = "block truncate px-2.5 leading-9";

function renderBuiltIn(
  field: string,
  item: OptIn,
  save: (patch: OptInPatch) => void,
): ReactNode {
  switch (field) {
    case "email":
      return (
        <a
          href={`mailto:${item.email}`}
          className={`${readOnly} underline-offset-2 hover:underline`}
        >
          {item.email}
        </a>
      );
    case "exam":
      return (
        <span className={`${readOnly} text-soft`}>{item.exam ?? "—"}</span>
      );
    case "score_pct":
      return (
        <span className={`${readOnly} text-center tabular-nums`}>
          {item.score_pct !== null ? `${item.score_pct}%` : "—"}
        </span>
      );
    case "submitted_at":
      return <span className={readOnly}>{formatDate(item.submitted_at)}</span>;
    case "status":
      return (
        <PillCell
          label="Status"
          value={item.status}
          options={STATUSES}
          allowEmpty={false}
          onCommit={(status) => status && save({ status })}
        />
      );
    case "interest":
      return (
        <PillCell
          label="Interest"
          value={item.interest}
          options={INTEREST_OPTIONS}
          onCommit={(interest) => save({ interest })}
        />
      );
    case "notes":
      return (
        <TextCell
          label="Notes"
          value={item.notes}
          onCommit={(notes) => save({ notes })}
        />
      );
    default:
      return null;
  }
}

export default function MockExamOptIns({
  initialItems,
  initialColumns,
}: {
  initialItems: OptIn[];
  initialColumns: BoardColumn[];
}) {
  const columnsApi = useBoardColumns("mock-exam", initialColumns);
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.name, item.email, item.exam, item.notes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q)),
    );
  }, [items, query]);
  const newCount = items.filter((item) => item.status === "new").length;

  async function save(id: string, patch: OptInPatch) {
    const previous = items.find((item) => item.id === id);
    if (!previous) return;
    setError(null);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    const { data, error } = await createClient()
      .from("course_interests")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      setItems((current) =>
        current.map((item) => (item.id === id ? previous : item)),
      );
      setError(
        `Couldn't save ${previous.name ?? previous.email}: ${error?.message ?? "no response"}`,
      );
      return;
    }
    setItems((current) =>
      current.map((item) => (item.id === id ? data : item)),
    );
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
      "course_interests",
      id,
      columnId,
      value,
    );
    setItems((current) =>
      current.map((item) =>
        item.id !== id ? item : error ? previous : { ...item, custom: data },
      ),
    );
    if (error)
      setError(
        `Couldn't save ${previous.name ?? previous.email}: ${error.message}`,
      );
  }

  return (
    <ColumnsProvider api={columnsApi}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AiCourseSubnav current="/ai-course/mock-exam" />
        <header className="shrink-0">
          <div className="flex items-center gap-2 px-4 py-[14px]">
            <Button
              variant="secondary"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon aria-hidden className="size-3.5" />
            </Button>
            <h1 className="truncate">AI in Marketing Level 4</h1>
            {newCount > 0 && (
              <span className="caption-style bg-muted shrink-0 rounded-full border border-pill px-2 py-[3px]">
                {newCount} new
              </span>
            )}
          </div>
          <div className="border-border flex flex-col gap-2 border-b px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-[20em]">
              <span className="sr-only">Search opt-ins</span>
              <SearchIcon
                aria-hidden
                className="text-subtle pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
              />
              <Input
                type="search"
                placeholder="Search name, email, exam, notes…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
              />
            </label>
            <span className="caption-style text-subtle">
              {items.length} mock exam{" "}
              {items.length === 1 ? "candidate" : "candidates"} opted in
            </span>
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

        <div className="min-h-0 flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 py-16">
              <div className="flex max-w-[30em] flex-col gap-2 text-center">
                <p className="lead-style font-medium">No opt-ins yet</p>
                <p className="text-soft">
                  Mock exam candidates who tick &ldquo;wants to hear about the
                  AI in Marketing course&rdquo; appear here. Past opt-ins come
                  across when you press Import to CRM on the website&apos;s
                  Enquiries dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <SheetTable
                rows={visible}
                pinned={{
                  label: "Name",
                  width: 14,
                  render: (item) => (
                    <span className="block truncate px-2.5 font-medium">
                      {item.name ?? "—"}
                    </span>
                  ),
                }}
                renderBuiltIn={(field, item) =>
                  renderBuiltIn(field, item, (patch) => save(item.id, patch))
                }
                onCustomChange={(item, column, value) =>
                  saveCustom(item.id, column.id, value)
                }
              />
            </div>
          )}
        </div>
      </section>
    </ColumnsProvider>
  );
}

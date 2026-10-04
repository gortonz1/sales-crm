"use client";

import { useMemo, useState } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import RecruitmentBoard from "./recruitment-board";
import RecruitmentSheet from "./recruitment-sheet";
import RecruitmentForecast from "./recruitment-forecast";
import RecruitmentDetail from "./recruitment-detail";
import ColumnsProvider from "@/components/sheet/columns-provider";
import type { CustomValue } from "@/components/sheet/custom-cell";
import {
  saveCustomValue,
  useBoardColumns,
} from "@/components/sheet/use-board-columns";
import { withCustom, type BoardColumn } from "@/lib/columns";
import { createClient } from "@/lib/supabase/client";
import { useCompaniesStore } from "@/stores/companies-store";
import {
  ALL_GROUPS,
  RECRUITMENT_GROUPS,
  boardStatuses,
  filterByGroup,
  matchesRecruitmentSearch,
  type Recruitment as RecruitmentRow,
  type RecruitmentPatch,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import SearchIcon from "@/public/assets/images/_common/search.svg";

type View = "table" | "board" | "forecast";

const VIEWS: { value: View; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "board", label: "Board" },
  { value: "forecast", label: "Forecast" },
];
type LeadOption = { id: string; name: string; organisation: string | null };

export default function Recruitment({
  initialItems,
  initialColumns,
  leads,
}: {
  initialItems: RecruitmentRow[];
  initialColumns: BoardColumn[];
  leads: LeadOption[];
}) {
  const columnsApi = useBoardColumns("recruitment", initialColumns);
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const [items, setItems] = useState(initialItems);
  const [group, setGroup] = useState("active");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searched = useMemo(
    () => items.filter((item) => matchesRecruitmentSearch(item, query)),
    [items, query],
  );
  const visible = useMemo(
    () => filterByGroup(searched, group),
    [searched, group],
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const signedUp = items.filter((item) => item.status === "signed-up").length;

  async function save(id: string | null, patch: RecruitmentPatch) {
    setError(null);
    const supabase = createClient();
    if (id === null) {
      const { data, error } = await supabase
        .from("recruitments")
        .insert({ ...patch, client: patch.client ?? "" })
        .select()
        .single();
      if (error || !data) {
        setError(
          `Couldn't add the recruitment: ${error?.message ?? "no response"}`,
        );
        return false;
      }
      setItems((current) => [data, ...current]);
      if (view === "board") setGroup(data.board_group);
      return true;
    }

    const previous = items.find((item) => item.id === id);
    if (!previous) return false;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    const { data, error } = await supabase
      .from("recruitments")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      setItems((current) =>
        current.map((item) => (item.id === id ? previous : item)),
      );
      setError(
        `Couldn't save ${previous.client}: ${error?.message ?? "no response"}`,
      );
      return false;
    }
    setItems((current) =>
      current.map((item) => (item.id === id ? data : item)),
    );
    return true;
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
      "recruitments",
      id,
      columnId,
      value,
    );
    setItems((current) =>
      current.map((item) =>
        item.id !== id ? item : error ? previous : { ...item, custom: data },
      ),
    );
    if (error) setError(`Couldn't save ${previous.client}: ${error.message}`);
  }

  return (
    <ColumnsProvider api={columnsApi}>
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
              <h1 className="truncate">Recruitment</h1>
              <span className="caption-style bg-muted shrink-0 rounded-full border border-[#363636] px-2 py-[3px]">
                {signedUp} signed up
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedId(null);
                setCreating(true);
              }}
            >
              <PlusIcon aria-hidden className="size-3" />
              New recruitment
            </Button>
          </div>

          <div className="border-border flex flex-col gap-2 border-b px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-[20em]">
              <span className="sr-only">Search recruitments</span>
              <SearchIcon
                aria-hidden
                className="text-subtle pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
              />
              <Input
                type="search"
                placeholder="Search client, contact, notes…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="caption-style text-subtle">
                {items.length} recruitments
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {VIEWS.map((option) => (
                  <Button
                    key={option.value}
                    variant={view === option.value ? "muted" : "ghost"}
                    size="sm"
                    aria-pressed={view === option.value}
                    onClick={() => setView(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {view === "board" && (
            <Tabs value={group} onValueChange={setGroup}>
              <TabsList className="border-border overflow-x-auto border-b px-4">
                {[
                  ...RECRUITMENT_GROUPS,
                  { value: ALL_GROUPS, label: "All" },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {tab.label} ({filterByGroup(searched, tab.value).length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </header>

        {error && (
          <p
            role="alert"
            className="caption-style text-danger border-border shrink-0 border-b px-4 py-2"
          >
            {error}
          </p>
        )}

        <div className={cn("min-h-0 flex-1", "overflow-hidden")}>
          {view === "table" ? (
            <RecruitmentSheet
              items={searched}
              onSave={(id, patch) => save(id, patch)}
              onCustomChange={saveCustom}
              onOpen={setSelectedId}
              onAdd={(client, board_group) =>
                save(null, { client, board_group })
              }
            />
          ) : view === "board" ? (
            <RecruitmentBoard
              items={visible}
              statuses={boardStatuses(visible)}
              onOpen={setSelectedId}
              onMove={(id, status) => save(id, { status })}
            />
          ) : (
            <RecruitmentForecast
              items={searched}
              onOpen={setSelectedId}
              onMove={(id, est_start) => save(id, { est_start })}
            />
          )}
        </div>

        <RecruitmentDetail
          open={creating || selected !== null}
          item={creating ? null : selected}
          leads={leads}
          onClose={() => {
            setCreating(false);
            setSelectedId(null);
          }}
          onSave={save}
        />
      </section>
    </ColumnsProvider>
  );
}

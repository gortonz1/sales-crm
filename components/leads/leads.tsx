"use client";

import { useMemo, useState, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import LeadsTable from "./leads-table";
import LeadsBoard from "./leads-board";
import LeadDetail from "./lead-detail";
import LeadsTimeline from "./leads-timeline";
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
  ALL,
  GENUINE,
  PIPELINE_STAGE_IDS,
  filterByStage,
  matchesSearch,
  type Lead,
  type LeadStage,
  type TimelineEvent,
} from "@/lib/leads";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import SearchIcon from "@/public/assets/images/_common/search.svg";

type View = "list" | "board" | "timeline";

const VIEWS: { value: View; label: string }[] = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
  { value: "timeline", label: "Timeline" },
];
export type LeadPatch = Pick<
  TablesUpdate<"leads">,
  "stage" | "active" | "notes" | "organisation" | "phone" | "interest"
>;

export default function Leads({
  stages,
  initialLeads,
  initialEvents,
  title = "Website leads",
  defaultFilter = GENUINE,
  emptyMessage = "New contact-form enquiries from the website land here automatically.",
  subnav,
  board = "leads",
  initialColumns,
}: {
  board?: "leads" | "ai-enquiries";
  initialColumns: BoardColumn[];
  stages: LeadStage[];
  initialLeads: Lead[];
  initialEvents: TimelineEvent[];
  title?: string;
  defaultFilter?: string;
  emptyMessage?: string;
  subnav?: ReactNode;
}) {
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const columnsApi = useBoardColumns(board, initialColumns);
  const [leads, setLeads] = useState(initialLeads);
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState(defaultFilter);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stageLabels = useMemo(
    () => Object.fromEntries(stages.map((s) => [s.id, s.label])),
    [stages],
  );
  const searched = useMemo(
    () => leads.filter((lead) => matchesSearch(lead, query)),
    [leads, query],
  );
  const visible = useMemo(
    () => filterByStage(searched, filter),
    [searched, filter],
  );
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const newCount = leads.filter((lead) => lead.stage === "new").length;
  const tabs = [
    { value: GENUINE, label: "Genuine leads" },
    ...stages.map((stage) => ({
      value: stage.id,
      label: stage.id === "new" ? "To review" : stage.label,
    })),
    { value: ALL, label: "All enquiries" },
  ];
  const boardStages =
    filter === ALL
      ? stages
      : filter === GENUINE
        ? stages.filter((stage) => PIPELINE_STAGE_IDS.includes(stage.id))
        : stages.filter((stage) => stage.id === filter);

  async function updateLead(id: string, patch: LeadPatch) {
    const previous = leads.find((lead) => lead.id === id);
    if (!previous) return false;
    setError(null);
    setLeads((current) =>
      current.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)),
    );
    const { data, error } = await createClient()
      .from("leads")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      setLeads((current) =>
        current.map((lead) => (lead.id === id ? previous : lead)),
      );
      setError(
        `Couldn't save the change to ${previous.name}: ${error?.message ?? "no response"}`,
      );
      return false;
    }
    setLeads((current) =>
      current.map((lead) => (lead.id === id ? data : lead)),
    );
    const at = new Date().toISOString();
    const added: TimelineEvent[] = [];
    if (patch.stage !== undefined && patch.stage !== previous.stage) {
      added.push({
        lead_id: id,
        kind: "stage",
        from_stage: previous.stage,
        to_stage: patch.stage,
        body: null,
        created_at: at,
      });
    }
    if (patch.active !== undefined && patch.active !== previous.active) {
      added.push({
        lead_id: id,
        kind: "active",
        from_stage: null,
        to_stage: null,
        body: patch.active ? "Marked active" : "Marked no longer active",
        created_at: at,
      });
    }
    if (added.length) setEvents((current) => [...current, ...added]);
    return true;
  }

  async function saveCustom(id: string, columnId: string, value: CustomValue) {
    const previous = leads.find((lead) => lead.id === id);
    if (!previous) return;
    setError(null);
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id ? withCustom(lead, columnId, value) : lead,
      ),
    );
    const { data, error } = await saveCustomValue("leads", id, columnId, value);
    setLeads((current) =>
      current.map((lead) =>
        lead.id !== id ? lead : error ? previous : { ...lead, custom: data },
      ),
    );
    if (error)
      setError(
        `Couldn't save the change to ${previous.name}: ${error.message}`,
      );
  }

  return (
    <ColumnsProvider api={columnsApi}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {subnav}
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
              <h1 className="truncate">{title}</h1>
              {newCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter("new")}
                  className="caption-style bg-muted hover:bg-secondary shrink-0 cursor-pointer rounded-full border border-pill px-2 py-[3px] transition-colors duration-150"
                >
                  {newCount} to review
                </button>
              )}
            </div>
          </div>

          <div className="border-border flex flex-col gap-2 border-b px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-[20em]">
              <span className="sr-only">Search leads</span>
              <SearchIcon
                aria-hidden
                className="text-subtle pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
              />
              <Input
                type="search"
                placeholder="Search name, email, organisation…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="caption-style text-subtle">
                {leads.length} {leads.length === 1 ? "enquiry" : "enquiries"}
              </span>
              <div className="flex shrink-0 items-center gap-1 rounded-full">
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

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="border-border overflow-x-auto border-b px-4">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="shrink-0 whitespace-nowrap"
                >
                  {tab.label} ({filterByStage(searched, tab.value).length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </header>

        {error && (
          <p
            role="alert"
            className="caption-style text-danger border-border shrink-0 border-b px-4 py-2"
          >
            {error}
          </p>
        )}

        <div
          className={cn(
            "min-h-0 flex-1",
            view === "list" ? "overflow-auto" : "overflow-hidden",
          )}
        >
          {leads.length === 0 ? (
            <EmptyState message={emptyMessage} />
          ) : view === "list" ? (
            <LeadsTable
              leads={visible}
              stages={stages}
              selectedId={selectedId}
              onOpen={setSelectedId}
              onUpdate={updateLead}
              onCustomChange={saveCustom}
            />
          ) : view === "board" ? (
            <LeadsBoard
              leads={searched}
              stages={boardStages}
              onOpen={setSelectedId}
              onMove={(id, stage) => updateLead(id, { stage })}
            />
          ) : (
            <LeadsTimeline
              leads={visible}
              stages={stages}
              events={events}
              onOpen={setSelectedId}
            />
          )}
        </div>

        <LeadDetail
          lead={selected}
          stages={stages}
          stageLabels={stageLabels}
          onClose={() => setSelectedId(null)}
          onUpdate={updateLead}
        />
      </section>
    </ColumnsProvider>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-16">
      <div className="flex max-w-[28em] flex-col gap-2 text-center">
        <p className="lead-style font-medium">No leads yet</p>
        <p className="text-soft">{message}</p>
      </div>
    </div>
  );
}

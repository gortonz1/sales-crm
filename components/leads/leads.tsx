"use client";

import { useMemo, useState } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import LeadsTable from "./leads-table";
import LeadsBoard from "./leads-board";
import LeadDetail from "./lead-detail";
import { createClient } from "@/lib/supabase/client";
import { useCompaniesStore } from "@/stores/companies-store";
import {
  ALL_OPEN,
  filterByStage,
  matchesSearch,
  type Lead,
  type LeadStage,
} from "@/lib/leads";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import SearchIcon from "@/public/assets/images/_common/search.svg";

type View = "list" | "board";
export type LeadPatch = Pick<
  TablesUpdate<"leads">,
  "stage" | "active" | "notes"
>;

export default function Leads({
  stages,
  initialLeads,
}: {
  stages: LeadStage[];
  initialLeads: Lead[];
}) {
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState(ALL_OPEN);
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
    setLeads((current) => current.map((lead) => (lead.id === id ? data : lead)));
    return true;
  }

  return (
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
            <h1 className="truncate">Website leads</h1>
            {newCount > 0 && (
              <span className="caption-style bg-muted shrink-0 rounded-full border border-[#363636] px-2 py-[3px]">
                {newCount} to review
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full">
            {(["list", "board"] as const).map((option) => (
              <Button
                key={option}
                variant={view === option ? "muted" : "ghost"}
                size="sm"
                aria-pressed={view === option}
                onClick={() => setView(option)}
              >
                {option === "list" ? "List" : "Board"}
              </Button>
            ))}
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
          <span className="caption-style text-subtle">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} from
            themarketingtrainer.co.uk
          </span>
        </div>

        {view === "list" && (
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="border-border overflow-x-auto border-b px-4">
              <TabsTrigger value={ALL_OPEN} className="shrink-0 whitespace-nowrap">
                All open ({filterByStage(searched, ALL_OPEN).length})
              </TabsTrigger>
              {stages.map((stage) => (
                <TabsTrigger
                  key={stage.id}
                  value={stage.id}
                  className="shrink-0 whitespace-nowrap"
                >
                  {stage.label} ({filterByStage(searched, stage.id).length})
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

      <div
        className={cn(
          "min-h-0 flex-1",
          view === "list" ? "overflow-auto" : "overflow-hidden",
        )}
      >
        {leads.length === 0 ? (
          <EmptyState />
        ) : view === "list" ? (
          <LeadsTable
            leads={visible}
            stageLabels={stageLabels}
            selectedId={selectedId}
            onOpen={setSelectedId}
          />
        ) : (
          <LeadsBoard
            leads={searched}
            stages={stages}
            onOpen={setSelectedId}
            onMove={(id, stage) => updateLead(id, { stage })}
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
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-4 py-16">
      <div className="flex max-w-[28em] flex-col gap-2 text-center">
        <p className="lead-style font-medium">No leads yet</p>
        <p className="text-soft">
          New contact-form enquiries from the website land here automatically.
          Past enquiries appear once the website import has been run.
        </p>
      </div>
    </div>
  );
}

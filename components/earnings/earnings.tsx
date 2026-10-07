"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import { buildReport, type Report } from "@/lib/earnings";
import { useCompaniesStore } from "@/stores/companies-store";
import EarningsDashboard from "./earnings-dashboard";
import Upload from "./upload";
import MenuIcon from "@/public/assets/images/_common/menu.svg";

export default function Earnings() {
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState(false);

  function load(file: File) {
    setBusy(true);
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      setBusy(false);
      setError("That file couldn't be read. Try downloading the report again.");
    };
    reader.onload = () => {
      try {
        setReport(
          buildReport(String(reader.result), file.name, file.lastModified),
        );
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : "That file couldn't be read as a CSV.",
        );
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-4 py-[14px]">
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
          <h1 className="truncate">Earnings</h1>
          {report && (
            <span className="caption-style bg-muted border-pill hidden shrink-0 rounded-full border px-2 py-[3px] sm:inline">
              {report.year}
            </span>
          )}
        </div>
        {report && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={masked ? "muted" : "ghost"}
              size="sm"
              aria-pressed={masked}
              onClick={() => setMasked((value) => !value)}
            >
              {masked ? "Names hidden" : "Hide names"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setReport(null);
                setError(null);
              }}
            >
              <span className="sm:hidden">New report</span>
              <span className="hidden sm:inline">Load another report</span>
            </Button>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {report ? (
          <EarningsDashboard report={report} masked={masked} />
        ) : (
          <Upload onLoad={load} error={error} busy={busy} />
        )}
      </div>
    </section>
  );
}

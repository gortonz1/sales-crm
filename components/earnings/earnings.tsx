"use client";

import {
  useEffect,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { lockEarnings, saveEarnings } from "@/app/(app)/earnings/actions";
import Button from "@/components/_ui/button";
import {
  buildReport,
  carryPlan,
  defaultPlan,
  type Plan,
  type Report,
  type SavedWorkspace,
} from "@/lib/earnings";
import { cn } from "@/lib/utils";
import EarningsDashboard from "./earnings-dashboard";
import EarningsShell from "./shell";
import Upload from "./upload";

const savedTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

export default function Earnings({ saved }: { saved: SavedWorkspace | null }) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(saved?.report ?? null);
  const [plan, setPlan] = useState<Plan | null>(saved?.plan ?? null);
  const [savedReport, setSavedReport] = useState<Report | null>(
    saved?.report ?? null,
  );
  const [savedPlan, setSavedPlan] = useState(() =>
    saved ? JSON.stringify(saved.plan) : null,
  );
  const [savedAt, setSavedAt] = useState(saved?.savedAt ?? null);
  const [savedBy, setSavedBy] = useState(saved?.savedBy ?? null);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState(false);
  const [saving, startSaving] = useTransition();
  const [locking, startLocking] = useTransition();

  const updatePlan: Dispatch<SetStateAction<Plan>> = (update) => {
    setSaveError(null);
    setPlan((current) =>
      current === null
        ? current
        : typeof update === "function"
          ? update(current)
          : update,
    );
  };

  const dirty =
    report !== null &&
    plan !== null &&
    (report !== savedReport || JSON.stringify(plan) !== savedPlan);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
        const next = buildReport(
          String(reader.result),
          file.name,
          file.lastModified,
        );
        setSaveError(null);
        setReport(next);
        setPlan((current) =>
          current ? carryPlan(current, next) : defaultPlan(next),
        );
        setReplacing(false);
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

  function save() {
    if (!report || !plan) return;
    setSaveError(null);
    startSaving(async () => {
      const result = await saveEarnings(report, plan);
      if (result.error || !result.savedAt) {
        setSaveError(result.error ?? "Couldn't save. Try again.");
        return;
      }
      setSavedReport(report);
      setSavedPlan(JSON.stringify(plan));
      setSavedAt(result.savedAt);
      setSavedBy(result.savedBy ?? null);
    });
  }

  function lock() {
    if (
      dirty &&
      !window.confirm("Lock the dashboard? Unsaved changes will be lost.")
    ) {
      return;
    }
    startLocking(async () => {
      await lockEarnings();
      router.refresh();
    });
  }

  const showDashboard = report && plan && !replacing;
  const status = saveError
    ? saveError
    : dirty
      ? "Unsaved changes"
      : savedAt
        ? `Saved ${savedTime.format(new Date(savedAt))}${savedBy ? ` by ${savedBy}` : ""}`
        : "Not saved yet";

  return (
    <EarningsShell
      badge={report?.year}
      actions={
        showDashboard && (
          <Button
            variant={dirty ? "primary" : "secondary"}
            size="sm"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        )
      }
      toolbar={
        <>
          <span
            role="status"
            className={cn(
              "caption-style min-w-0 truncate",
              saveError
                ? "text-(--tag-red-text)"
                : dirty
                  ? "text-(--tag-amber-text)"
                  : "text-subtle",
            )}
          >
            {showDashboard ? status : "Upload a report to start"}
          </span>
          <div className="flex items-center gap-2">
            {showDashboard && (
              <>
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
                    setReplacing(true);
                    setError(null);
                  }}
                >
                  <span className="sm:hidden">New report</span>
                  <span className="hidden sm:inline">Load another report</span>
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={lock} disabled={locking}>
              Lock
            </Button>
          </div>
        </>
      }
    >
      {showDashboard ? (
        <EarningsDashboard
          report={report}
          plan={plan}
          setPlan={updatePlan}
          masked={masked}
        />
      ) : (
        <Upload
          onLoad={load}
          error={error}
          busy={busy}
          onCancel={
            report
              ? () => {
                  setReplacing(false);
                  setError(null);
                }
              : undefined
          }
          keepsPlan={plan !== null}
        />
      )}
    </EarningsShell>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Label } from "@/components/_ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  AI_COURSE_ENQUIRY,
  INTEREST_OPTIONS,
  enquiryTypeLabel,
  formatDate,
  formatDateTime,
  isAddedByHand,
  type Lead,
  type LeadActivity,
  type LeadStage,
} from "@/lib/leads";
import type { LeadPatch } from "./leads";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

const NONE = "none";

const textareaClass =
  "border-line-strong bg-secondary placeholder:text-subtle focus-visible:border-ring w-full resize-y rounded-lg border px-3 py-2.5 text-[14px] leading-[1.5] text-foreground outline-none transition-[border-color] duration-150";

export default function LeadDetail({
  lead,
  stages,
  stageLabels,
  onClose,
  onUpdate,
  onDelete,
}: {
  lead: Lead | null;
  stages: LeadStage[];
  stageLabels: Record<string, string>;
  onClose: () => void;
  onUpdate: (id: string, patch: LeadPatch) => Promise<boolean>;
  onDelete: (id: string) => Promise<string | null>;
}) {
  return (
    <Sheet open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[34em]">
        {lead && (
          <LeadDetailBody
            key={lead.id}
            lead={lead}
            stages={stages}
            stageLabels={stageLabels}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function LeadDetailBody({
  lead,
  stages,
  stageLabels,
  onUpdate,
  onDelete,
}: {
  lead: Lead;
  stages: LeadStage[];
  stageLabels: Record<string, string>;
  onUpdate: (id: string, patch: LeadPatch) => Promise<boolean>;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [activity, setActivity] = useState<LeadActivity[] | null>(null);
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const notesChanged = notes !== (lead.notes ?? "");

  const [activityVersion, setActivityVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("lead_activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setActivityError(error.message);
        setActivity(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.stage, lead.active, activityVersion]);

  async function saveNotes() {
    setSavingNotes(true);
    await onUpdate(lead.id, { notes: notes.trim() || null });
    setSavingNotes(false);
  }

  async function addNote() {
    const body = note.trim();
    if (!body) return;
    setAddingNote(true);
    setActivityError(null);
    const { error } = await createClient()
      .from("lead_activities")
      .insert({ lead_id: lead.id, kind: "note", body });
    setAddingNote(false);
    if (error) {
      setActivityError(error.message);
      return;
    }
    setNote("");
    setActivityVersion((version) => version + 1);
  }

  return (
    <>
      <SheetHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle className="truncate">{lead.name}</SheetTitle>
          <SheetDescription className="truncate">
            {lead.organisation ?? "No organisation given"}
          </SheetDescription>
        </div>
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1"
            aria-label="Close lead"
          >
            <XIcon aria-hidden className="text-foreground size-4" />
          </Button>
        </SheetClose>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-stage">Stage</Label>
            <Select
              value={lead.stage}
              onValueChange={(stage) => onUpdate(lead.id, { stage })}
            >
              <SelectTrigger id="lead-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {lead.enquiry_type === AI_COURSE_ENQUIRY && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-interest">Interest in the course</Label>
              <Select
                value={lead.interest ?? NONE}
                onValueChange={(interest) =>
                  onUpdate(lead.id, {
                    interest: interest === NONE ? null : interest,
                  })
                }
              >
                <SelectTrigger id="lead-interest">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not rated yet</SelectItem>
                  {INTEREST_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Checkbox
              id="lead-active"
              checked={lead.active}
              onCheckedChange={(checked) =>
                onUpdate(lead.id, { active: checked === true })
              }
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="lead-active" className="text-foreground">
                Still active
              </Label>
              <span className="caption-style text-subtle">
                Untick if they&apos;ve gone quiet. Leave the stage at how far
                they got.
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="caption-style text-subtle font-medium">Contact</h2>
          <dl className="grid grid-cols-[7em_1fr] gap-x-3 gap-y-2.5 text-[14px]">
            <Row label="Email">
              <a
                href={`mailto:${lead.email}`}
                className="hover:text-soft underline underline-offset-2"
              >
                {lead.email}
              </a>
            </Row>
            <Row label="Phone">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone.replace(/\s/g, "")}`}
                  className="hover:text-soft underline underline-offset-2"
                >
                  {lead.phone}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Organisation">{lead.organisation ?? "—"}</Row>
            <Row label="Enquiry">{enquiryTypeLabel(lead.enquiry_type)}</Row>
            <Row label="Received">{formatDateTime(lead.submitted_at)}</Row>
            <Row label="From page">
              {lead.source_page ? (
                <span className="break-all">
                  {lead.source_page.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Consent">
              {lead.consent ? "Agreed to be contacted" : "Not given"}
            </Row>
          </dl>
        </section>

        {lead.message && (
          <section className="flex flex-col gap-2">
            <h2 className="caption-style text-subtle font-medium">Message</h2>
            <p className="border-line-strong bg-secondary rounded-lg border px-3 py-2.5 text-[14px] leading-[1.5] whitespace-pre-wrap">
              {lead.message}
            </p>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <Label
            htmlFor="lead-notes"
            className="caption-style text-subtle font-medium"
          >
            Internal notes
          </Label>
          <textarea
            id="lead-notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Calls, next steps, who's handling it…"
            className={textareaClass}
          />
          {notesChanged && (
            <div className="flex justify-end gap-2">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setNotes(lead.notes ?? "")}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={saveNotes}
                disabled={savingNotes}
              >
                Save notes
              </Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="caption-style text-subtle font-medium">Activity</h2>
          <div className="flex gap-2">
            <label htmlFor="lead-note" className="sr-only">
              Log an update
            </label>
            <input
              id="lead-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addNote();
              }}
              placeholder="Log a call, email or meeting…"
              className={`${textareaClass} h-9 resize-none py-0`}
            />
            <Button
              variant="muted"
              size="sm"
              onClick={addNote}
              disabled={addingNote || !note.trim()}
            >
              Add
            </Button>
          </div>
          {activityError && (
            <p role="alert" className="caption-style text-danger">
              {activityError}
            </p>
          )}
          {activity === null ? (
            <p className="caption-style text-subtle">Loading…</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {activity.map((item) => (
                <li key={item.id} className="flex flex-col gap-0.5">
                  <span className="text-[14px] leading-[1.4]">
                    {describe(item, stageLabels)}
                  </span>
                  <span className="caption-style text-faint">
                    {formatDateTime(item.created_at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="caption-style text-faint">
            {isAddedByHand(lead)
              ? "Added by hand from an email"
              : `Website enquiry #${lead.external_id}`}{" "}
            · in the CRM since {formatDate(lead.created_at)}
          </p>
          {isAddedByHand(lead) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger -mr-2"
              onClick={() => {
                setDeleteError(null);
                setConfirmingDelete(true);
              }}
            >
              Delete lead
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(open) => !open && setConfirmingDelete(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {lead.name}?</DialogTitle>
            <DialogDescription>
              The lead, its notes and its activity will be removed. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="caption-style text-danger px-6 pt-4">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                const message = await onDelete(lead.id);
                setDeleting(false);
                setDeleteError(message);
              }}
            >
              Delete lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-subtle">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function describe(item: LeadActivity, stageLabels: Record<string, string>) {
  const label = (stage: string | null) =>
    stage ? (stageLabels[stage] ?? stage) : "";
  switch (item.kind) {
    case "stage":
      return `Moved from ${label(item.from_stage)} to ${label(item.to_stage)}`;
    case "received":
    case "imported":
      return item.to_stage && item.to_stage !== "new"
        ? `${item.body} at ${label(item.to_stage)}`
        : (item.body ?? "");
    default:
      return item.body ?? "";
  }
}

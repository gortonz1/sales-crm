"use client";

import { useState, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import { formatDateTime } from "@/lib/leads";
import {
  CONTRACT_STATUSES,
  LEFT_STATUSES,
  PAPERWORK_STATUSES,
  RECRUITMENT_GROUPS,
  RECRUITMENT_STATUSES,
  SOURCES,
  monthOptions,
  type Recruitment,
  type RecruitmentPatch,
} from "@/lib/recruitment";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

const NONE = "none";

type LeadOption = { id: string; name: string; organisation: string | null };

type Draft = {
  client: string;
  contact: string;
  status: string;
  board_group: string;
  est_start: string;
  source: string;
  left_status: string;
  shortlist_delivery: string;
  shortlist_count: string;
  interviewees: string;
  interview_date: string;
  notes: string;
  das: string;
  deposit: string;
  contract: string;
  signed_up_on: string;
  lead_id: string;
};

const EMPTY: Draft = {
  client: "",
  contact: "",
  status: "working-on",
  board_group: "active",
  est_start: NONE,
  source: NONE,
  left_status: NONE,
  shortlist_delivery: "",
  shortlist_count: "",
  interviewees: "",
  interview_date: "",
  notes: "",
  das: NONE,
  deposit: NONE,
  contract: NONE,
  signed_up_on: "",
  lead_id: NONE,
};

function toDraft(item: Recruitment): Draft {
  return {
    client: item.client,
    contact: item.contact ?? "",
    status: item.status,
    board_group: item.board_group,
    est_start: item.est_start ?? NONE,
    source: item.source ?? NONE,
    left_status: item.left_status ?? NONE,
    shortlist_delivery: item.shortlist_delivery ?? "",
    shortlist_count: item.shortlist_count?.toString() ?? "",
    interviewees: item.interviewees ?? "",
    interview_date: item.interview_date ?? "",
    notes: item.notes ?? "",
    das: item.das ?? NONE,
    deposit: item.deposit ?? NONE,
    contract: item.contract ?? NONE,
    signed_up_on: item.signed_up_on ?? "",
    lead_id: item.lead_id ?? NONE,
  };
}

function toPatch(draft: Draft): RecruitmentPatch {
  const opt = (value: string) => (value === NONE ? null : value);
  const text = (value: string) => value.trim() || null;
  const count = parseInt(draft.shortlist_count, 10);
  return {
    client: draft.client.trim(),
    contact: text(draft.contact),
    status: draft.status,
    board_group: draft.board_group,
    est_start: opt(draft.est_start),
    source: opt(draft.source),
    left_status: opt(draft.left_status),
    shortlist_delivery: draft.shortlist_delivery || null,
    shortlist_count: Number.isNaN(count) ? null : Math.max(0, count),
    interviewees: text(draft.interviewees),
    interview_date: draft.interview_date || null,
    notes: text(draft.notes),
    das: opt(draft.das),
    deposit: opt(draft.deposit),
    contract: opt(draft.contract),
    signed_up_on: draft.signed_up_on || null,
    lead_id: opt(draft.lead_id),
  };
}

export default function RecruitmentDetail({
  open,
  item,
  leads,
  onClose,
  onSave,
}: {
  open: boolean;
  item: Recruitment | null;
  leads: LeadOption[];
  onClose: () => void;
  onSave: (id: string | null, patch: RecruitmentPatch) => Promise<boolean>;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="sm:max-w-[36em]">
        {open && (
          <DetailBody
            key={item?.id ?? "new"}
            item={item}
            leads={leads}
            onSave={onSave}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({
  item,
  leads,
  onSave,
  onClose,
}: {
  item: Recruitment | null;
  leads: LeadOption[];
  onSave: (id: string | null, patch: RecruitmentPatch) => Promise<boolean>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(item ? toDraft(item) : EMPTY);
  const [saving, setSaving] = useState(false);
  const original = item ? toDraft(item) : EMPTY;
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const set = (key: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function save() {
    if (!draft.client.trim()) return;
    setSaving(true);
    const ok = await onSave(item?.id ?? null, toPatch(draft));
    setSaving(false);
    if (ok && !item) onClose();
  }

  return (
    <>
      <SheetHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle className="truncate">
            {item ? item.client : "New recruitment"}
          </SheetTitle>
          <SheetDescription className="truncate">
            {item
              ? `Last updated ${formatDateTime(item.updated_at)}`
              : "Add a client recruitment"}
          </SheetDescription>
        </div>
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1"
            aria-label="Close"
          >
            <XIcon aria-hidden className="text-foreground size-4" />
          </Button>
        </SheetClose>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <Section title="Client">
          <Field label="Client" id="r-client">
            <Input
              id="r-client"
              value={draft.client}
              onChange={(e) => set("client")(e.target.value)}
              required
            />
          </Field>
          <Field label="Contact" id="r-contact">
            <Input
              id="r-contact"
              value={draft.contact}
              onChange={(e) => set("contact")(e.target.value)}
            />
          </Field>
          <Field label="Website lead" id="r-lead">
            <Choice
              id="r-lead"
              value={draft.lead_id}
              onChange={set("lead_id")}
              options={leads.map((lead) => ({
                value: lead.id,
                label: lead.organisation
                  ? `${lead.organisation} (${lead.name})`
                  : lead.name,
              }))}
              placeholder="Not linked"
            />
          </Field>
        </Section>

        <Section title="Progress">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" id="r-status">
              <Choice
                id="r-status"
                value={draft.status}
                onChange={set("status")}
                options={RECRUITMENT_STATUSES}
              />
            </Field>
            <Field label="Group" id="r-group">
              <Choice
                id="r-group"
                value={draft.board_group}
                onChange={set("board_group")}
                options={RECRUITMENT_GROUPS}
              />
            </Field>
            <Field label="Est. start" id="r-month">
              <Choice
                id="r-month"
                value={draft.est_start}
                onChange={set("est_start")}
                options={monthOptions(item?.est_start ?? null)}
                placeholder="—"
              />
            </Field>
            <Field label="Source" id="r-source">
              <Choice
                id="r-source"
                value={draft.source}
                onChange={set("source")}
                options={SOURCES}
                placeholder="—"
              />
            </Field>
          </div>
        </Section>

        <Section title="Shortlist & interviews">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shortlist delivery" id="r-sl-date">
              <Input
                id="r-sl-date"
                type="date"
                value={draft.shortlist_delivery}
                onChange={(e) => set("shortlist_delivery")(e.target.value)}
              />
            </Field>
            <Field label="Candidates in shortlist" id="r-sl-count">
              <Input
                id="r-sl-count"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.shortlist_count}
                onChange={(e) => set("shortlist_count")(e.target.value)}
              />
            </Field>
            <Field label="Interviewees" id="r-interviewees">
              <Input
                id="r-interviewees"
                value={draft.interviewees}
                onChange={(e) => set("interviewees")(e.target.value)}
              />
            </Field>
            <Field label="Interview date" id="r-int-date">
              <Input
                id="r-int-date"
                type="date"
                value={draft.interview_date}
                onChange={(e) => set("interview_date")(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Sign-up">
          <div className="grid grid-cols-2 gap-3">
            <Field label="DAS" id="r-das">
              <Choice
                id="r-das"
                value={draft.das}
                onChange={set("das")}
                options={PAPERWORK_STATUSES}
                placeholder="—"
              />
            </Field>
            <Field label="Deposit" id="r-deposit">
              <Choice
                id="r-deposit"
                value={draft.deposit}
                onChange={set("deposit")}
                options={PAPERWORK_STATUSES}
                placeholder="—"
              />
            </Field>
            <Field label="Contract" id="r-contract">
              <Choice
                id="r-contract"
                value={draft.contract}
                onChange={set("contract")}
                options={CONTRACT_STATUSES}
                placeholder="—"
              />
            </Field>
            <Field label="Date of sign-up" id="r-signup">
              <Input
                id="r-signup"
                type="date"
                value={draft.signed_up_on}
                onChange={(e) => set("signed_up_on")(e.target.value)}
              />
            </Field>
            <Field label="Apprentice left?" id="r-left">
              <Choice
                id="r-left"
                value={draft.left_status}
                onChange={set("left_status")}
                options={LEFT_STATUSES}
                placeholder="—"
              />
            </Field>
          </div>
        </Section>

        <Section title="Notes">
          <label htmlFor="r-notes" className="sr-only">
            Notes
          </label>
          <textarea
            id="r-notes"
            rows={5}
            value={draft.notes}
            onChange={(e) => set("notes")(e.target.value)}
            className="border-line-strong bg-secondary placeholder:text-subtle focus-visible:border-ring text-foreground w-full resize-y rounded-lg border px-3 py-2.5 text-[14px] leading-[1.5] transition-[border-color] duration-150 outline-none"
          />
        </Section>
      </div>

      <SheetFooter>
        <Button
          variant="subtle"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => setDraft(original)}
        >
          Discard
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || saving || !draft.client.trim()}
          onClick={save}
        >
          {item ? "Save changes" : "Add recruitment"}
        </Button>
      </SheetFooter>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="caption-style text-subtle font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Choice({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {placeholder !== undefined && (
          <SelectItem value={NONE}>{placeholder}</SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

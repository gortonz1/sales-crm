"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  ENQUIRY_TYPE_OPTIONS,
  type LeadStage,
  type NewLead,
} from "@/lib/leads";

const NONE = "none";

type Form = {
  name: string;
  email: string;
  phone: string;
  organisation: string;
  enquiry_type: string;
  stage: string;
  received: string;
  message: string;
};

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const emptyForm = (): Form => ({
  name: "",
  email: "",
  phone: "",
  organisation: "",
  enquiry_type: NONE,
  stage: "genuine-lead",
  received: today(),
  message: "",
});

const textareaClass =
  "border-line-strong bg-secondary placeholder:text-subtle focus-visible:border-ring text-foreground w-full resize-y rounded-lg border px-3 py-2.5 text-[14px] leading-[1.5] transition-[border-color] duration-150 outline-none";

export default function NewLeadDialog({
  open,
  onOpenChange,
  stages,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: LeadStage[];
  onAdd: (lead: NewLead) => Promise<boolean>;
}) {
  const [form, setForm] = useState<Form>(emptyForm);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [pending, setPending] = useState(false);
  const set = (key: keyof Form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  function reset() {
    setForm(emptyForm());
    setErrors({});
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const next: typeof errors = {};
    if (!name) next.name = "Enter their name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address.";
    setErrors(next);
    if (next.name || next.email) return;

    const text = (value: string) => value.trim() || null;
    const submittedAt = new Date(
      `${form.received || today()}T12:00:00`,
    ).toISOString();
    setPending(true);
    const ok = await onAdd({
      name,
      email,
      phone: text(form.phone),
      organisation: text(form.organisation),
      enquiry_type: form.enquiry_type === NONE ? null : form.enquiry_type,
      message: text(form.message),
      stage: form.stage,
      submitted_at: submittedAt,
      stage_changed_at: submittedAt,
    });
    setPending(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]" onCloseAutoFocus={reset}>
        <form onSubmit={submit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Add a lead from an email</DialogTitle>
            <DialogDescription>
              For enquiries that arrived by email rather than through the
              website form. Form enquiries still come in on their own.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Name"
                htmlFor="new-lead-name"
                required
                error={errors.name}
              >
                <Input
                  id="new-lead-name"
                  autoFocus
                  autoComplete="off"
                  value={form.name}
                  onChange={(event) => set("name")(event.target.value)}
                />
              </Field>
              <Field
                label="Email"
                htmlFor="new-lead-email"
                required
                error={errors.email}
              >
                <Input
                  id="new-lead-email"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(event) => set("email")(event.target.value)}
                />
              </Field>
              <Field label="Organisation" htmlFor="new-lead-organisation">
                <Input
                  id="new-lead-organisation"
                  autoComplete="off"
                  value={form.organisation}
                  onChange={(event) => set("organisation")(event.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="new-lead-phone">
                <Input
                  id="new-lead-phone"
                  type="tel"
                  autoComplete="off"
                  value={form.phone}
                  onChange={(event) => set("phone")(event.target.value)}
                />
              </Field>
              <Field label="Enquiry" htmlFor="new-lead-enquiry">
                <Select
                  value={form.enquiry_type}
                  onValueChange={set("enquiry_type")}
                >
                  <SelectTrigger id="new-lead-enquiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not sure yet</SelectItem>
                    {ENQUIRY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stage" htmlFor="new-lead-stage">
                <Select value={form.stage} onValueChange={set("stage")}>
                  <SelectTrigger id="new-lead-stage">
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
              </Field>
              <Field
                label="Email received on"
                htmlFor="new-lead-received"
                className="sm:col-span-2"
              >
                <Input
                  id="new-lead-received"
                  type="date"
                  max={today()}
                  value={form.received}
                  onChange={(event) => set("received")(event.target.value)}
                  className="sm:max-w-[12em]"
                />
              </Field>
            </div>
            <Field
              label="Their message"
              htmlFor="new-lead-message"
              hint="Paste the email so the detail and timeline match a form enquiry"
            >
              <textarea
                id="new-lead-message"
                rows={5}
                value={form.message}
                onChange={(event) => set("message")(event.target.value)}
                className={textareaClass}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pending}
            >
              Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

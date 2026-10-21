"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
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
import { Label } from "@/components/_ui/label";
import {
  QR_MEDIUM,
  QR_PATH,
  QR_SOURCE,
  SLUG_PATTERN,
  isWebAddress,
  qrBaseUrl,
  suggestSlug,
  type QrCode,
} from "@/lib/qr-codes";

export type QrCodeFields = Pick<
  QrCode,
  "name" | "slug" | "destination" | "tag_links"
>;

type Errors = Partial<Record<"name" | "slug" | "destination", string>>;

export default function QrCodeDialog({
  open,
  onOpenChange,
  code,
  takenSlugs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: QrCode | null;
  takenSlugs: Set<string>;
  onSave: (fields: QrCodeFields) => Promise<string | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        {open && (
          <QrCodeForm
            key={code?.id ?? "new"}
            code={code}
            takenSlugs={takenSlugs}
            onSave={onSave}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function QrCodeForm({
  code,
  takenSlugs,
  onSave,
  onDone,
}: {
  code: QrCode | null;
  takenSlugs: Set<string>;
  onSave: (fields: QrCodeFields) => Promise<string | null>;
  onDone: () => void;
}) {
  const editing = code !== null;
  const [name, setName] = useState(code?.name ?? "");
  const [slug, setSlug] = useState(code?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(editing);
  const [destination, setDestination] = useState(
    code?.destination ?? "https://themarketingtrainer.co.uk/",
  );
  const [tagLinks, setTagLinks] = useState(code?.tag_links ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const base = qrBaseUrl();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanDestination = destination.trim();
    if (!cleanName) next.name = "Give it a name you'll recognise.";
    if (!editing) {
      if (!SLUG_PATTERN.test(cleanSlug))
        next.slug =
          "Use 1–48 lowercase letters, numbers and hyphens, not starting or ending with a hyphen.";
      else if (takenSlugs.has(cleanSlug))
        next.slug = "Another QR code already uses this link.";
    }
    if (!isWebAddress(cleanDestination))
      next.destination = "Enter a full web address starting with https://";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending(true);
    setSaveError(null);
    const message = await onSave({
      name: cleanName,
      slug: editing ? code.slug : cleanSlug,
      destination: cleanDestination,
      tag_links: tagLinks,
    });
    setPending(false);
    if (message) setSaveError(message);
    else onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit QR code" : "New QR code"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Changing where it goes takes effect straight away, including on codes already printed."
            : "Scans go through the CRM, which counts them and then sends people on to the page you choose."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 px-6 py-5">
        <Field label="Name" htmlFor="qr-name" required error={errors.name}>
          <Input
            id="qr-name"
            autoFocus
            autoComplete="off"
            placeholder="Careers fair, October 2026"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(suggestSlug(event.target.value));
            }}
          />
        </Field>

        <Field
          label="Short link"
          htmlFor="qr-slug"
          required={!editing}
          error={errors.slug}
          hint={
            editing
              ? "The short link can't change once it's made, so printed codes keep working."
              : "This is what the QR code holds. It can't be changed later."
          }
        >
          <div className="border-line-strong bg-secondary focus-within:border-ring flex h-9 min-w-0 items-center rounded-lg border transition-[border-color] duration-150">
            <span className="text-subtle shrink-0 truncate pl-3 text-[14px] leading-none">
              {base.replace(/^https?:\/\//, "")}
              {QR_PATH}/
            </span>
            <input
              id="qr-slug"
              autoComplete="off"
              spellCheck={false}
              disabled={editing}
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
              className="text-foreground h-full min-w-0 flex-1 bg-transparent pr-3 text-[14px] leading-none outline-none disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>
        </Field>

        <Field
          label="Sends people to"
          htmlFor="qr-destination"
          required
          error={errors.destination}
        >
          <Input
            id="qr-destination"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
        </Field>

        <div className="flex items-start gap-2">
          <Checkbox
            id="qr-tag-links"
            checked={tagLinks}
            onCheckedChange={(checked) => setTagLinks(checked === true)}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="qr-tag-links" className="text-foreground">
              Link enquiries to this code
            </Label>
            <span className="caption-style text-subtle leading-[1.4]">
              Adds utm_source={QR_SOURCE}, utm_medium={QR_MEDIUM} and
              utm_campaign={slug || "short-link"} to the page address, so
              website enquiries that follow a scan show this code and Google
              Analytics sees the visit too.
            </span>
          </div>
        </div>

        {saveError && (
          <p role="alert" className="caption-style text-danger">
            {saveError}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="sm">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {editing ? "Save changes" : "Create QR code"}
        </Button>
      </DialogFooter>
    </form>
  );
}

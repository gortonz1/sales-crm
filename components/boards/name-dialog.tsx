"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";

export default function NameDialog({
  open,
  title,
  label,
  value,
  maxLength,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  label: string;
  value: string;
  maxLength: number;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && (
        <NameForm
          title={title}
          label={label}
          value={value}
          maxLength={maxLength}
          onSave={(name) => {
            onSave(name);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}

function NameForm({
  title,
  label,
  value,
  maxLength,
  onSave,
}: {
  title: string;
  label: string;
  value: string;
  maxLength: number;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) {
      setError("Enter a name.");
      return;
    }
    onSave(name);
  }

  return (
    <DialogContent className="max-w-[440px]">
      <form onSubmit={submit} noValidate className="flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5">
          <Field
            label={label}
            htmlFor="name-dialog-input"
            error={error ?? undefined}
          >
            <Input
              id="name-dialog-input"
              autoFocus
              autoComplete="off"
              maxLength={maxLength}
              value={draft}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" variant="primary" size="sm">
            Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

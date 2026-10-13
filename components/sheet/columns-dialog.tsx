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
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { useColumns } from "./columns-provider";
import {
  LABEL_MAX,
  typeLabel,
  type BoardColumn,
  type ColumnType,
} from "@/lib/columns";
import ChevronDownIcon from "@/public/assets/images/_common/chevron-down.svg";

export default function ColumnsDialog({
  open,
  onOpenChange,
  boardName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[40em]">
        <ColumnsEditor boardName={boardName} />
      </DialogContent>
    </Dialog>
  );
}

function ColumnsEditor({ boardName }: { boardName: string }) {
  const { api } = useColumns();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [undo, setUndo] = useState<BoardColumn | null>(null);

  async function remove(column: BoardColumn) {
    setDeleting(null);
    const removed = await api.remove(column.id);
    if (removed && api.inBin) setUndo(column);
  }

  const row = (column: BoardColumn, index: number, count: number) => (
    <ColumnRow
      key={column.id}
      column={column}
      index={index}
      count={count}
      confirming={deleting === column.id}
      onConfirm={() => setDeleting(column.id)}
      onCancel={() => setDeleting(null)}
      onDelete={() => remove(column)}
    />
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Columns</DialogTitle>
        <DialogDescription>
          Add, rename, reorder, hide or delete the columns on {boardName}.
          Changes save straight away for everyone.
        </DialogDescription>
      </DialogHeader>
      <AddColumn />
      {api.visible.length === 0 ? (
        <p className="text-soft px-6 py-5">
          This board has no columns yet. Add one above.
        </p>
      ) : (
        <ul className="divide-line-strong flex flex-col divide-y">
          {api.visible.map((column, index) =>
            row(column, index, api.visible.length),
          )}
        </ul>
      )}
      {api.hidden.length > 0 && (
        <>
          <p className="caption-style text-subtle border-line-strong border-t px-6 pt-4 pb-2">
            Hidden columns
          </p>
          <ul className="divide-line-strong flex flex-col divide-y">
            {api.hidden.map((column, index) =>
              row(column, index, api.hidden.length),
            )}
          </ul>
        </>
      )}
      {undo && (
        <div
          role="status"
          className="caption-style border-line-strong flex items-center justify-between gap-3 border-t px-6 py-3"
        >
          <span className="min-w-0 truncate">
            Deleted “{undo.label}”. It&apos;s in the Bin for 30 days.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              api.restore(undo);
              setUndo(null);
            }}
          >
            Undo
          </Button>
        </div>
      )}
      {api.error && (
        <p
          role="alert"
          className="caption-style text-danger border-line-strong border-t px-6 py-3"
        >
          {api.error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="primary" size="sm">
            Done
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

function AddColumn() {
  const { api, types } = useColumns();
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [adding, setAdding] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    const added = await api.add(type, name.trim() || undefined);
    setAdding(false);
    if (added) setName("");
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="border-line-strong flex flex-col gap-2 border-b px-6 py-4 sm:flex-row sm:items-center"
    >
      <Input
        aria-label="New column name"
        placeholder={`New ${typeLabel(type).toLowerCase()} column`}
        autoComplete="off"
        maxLength={LABEL_MAX}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="min-w-0 flex-1"
      />
      <Select
        value={type}
        onValueChange={(value) => setType(value as ColumnType)}
      >
        <SelectTrigger
          aria-label="New column type"
          className="sm:w-[8.5em] sm:shrink-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {types.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" variant="primary" size="sm" disabled={adding}>
        {adding ? "Adding…" : "Add column"}
      </Button>
    </form>
  );
}

function ColumnRow({
  column,
  index,
  count,
  confirming,
  onConfirm,
  onCancel,
  onDelete,
}: {
  column: BoardColumn;
  index: number;
  count: number;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { api, editLabels, types } = useColumns();
  const builtIn = column.field !== null;

  if (confirming) {
    return (
      <li className="bg-overlay/[0.03] flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center">
        <p className="caption-style text-soft min-w-0 flex-1 leading-[1.4]">
          Delete “{column.label}”?{" "}
          {api.inBin
            ? "The column and everything entered in it move to the Bin, where they can be restored for 30 days."
            : `The column and everything entered in it${
                column.type === "file" ? ", including uploaded files," : ""
              } will be removed from every row. This can't be undone.`}
        </p>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onDelete}>
            Delete column
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <NameInput key={`${column.id}:${column.label}`} column={column} />
        {builtIn ? (
          <span className="caption-style text-subtle w-[8.5em] shrink-0 px-1">
            {typeLabel(column.type)}
          </span>
        ) : (
          <Select
            value={column.type}
            onValueChange={(type) =>
              type !== column.type && api.changeType(column, type as ColumnType)
            }
          >
            <SelectTrigger
              aria-label={`Type of ${column.label}`}
              className="w-[8.5em] shrink-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-0.5">
        {column.hidden ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => api.setHidden(column.id, false)}
          >
            Show
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${column.label} left`}
              disabled={index === 0}
              onClick={() => api.move(column.id, index - 1)}
            >
              <ChevronDownIcon aria-hidden className="size-2.5 rotate-90" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${column.label} right`}
              disabled={index === count - 1}
              onClick={() => api.move(column.id, index + 1)}
            >
              <ChevronDownIcon aria-hidden className="size-2.5 -rotate-90" />
            </Button>
            {!builtIn && column.type === "status" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editLabels(column)}
              >
                Labels
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => api.setHidden(column.id, true)}
            >
              Hide
            </Button>
          </>
        )}
        {!builtIn && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={onConfirm}
          >
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

function NameInput({ column }: { column: BoardColumn }) {
  const { api } = useColumns();
  const [draft, setDraft] = useState(column.label);

  function commit() {
    const next = draft.trim();
    if (!next) return setDraft(column.label);
    if (next !== column.label) api.rename(column.id, next);
  }

  return (
    <Input
      aria-label={`Name of ${column.label}`}
      autoComplete="off"
      maxLength={LABEL_MAX}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="min-w-0 flex-1"
    />
  );
}

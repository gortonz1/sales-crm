"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { Input } from "@/components/_ui/input";
import {
  LABEL_COLORS,
  columnOptions,
  newOptionId,
  type BoardColumn,
} from "@/lib/columns";
import type { Option } from "@/lib/recruitment";

export default function LabelsDialog({
  column,
  onClose,
  onSave,
}: {
  column: BoardColumn | null;
  onClose: () => void;
  onSave: (id: string, options: Option[]) => void;
}) {
  return (
    <Dialog open={column !== null} onOpenChange={(open) => !open && onClose()}>
      {column && (
        <LabelsEditor
          key={column.id}
          column={column}
          onCancel={onClose}
          onSave={(options) => {
            onSave(column.id, options);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}

function LabelsEditor({
  column,
  onCancel,
  onSave,
}: {
  column: BoardColumn;
  onCancel: () => void;
  onSave: (options: Option[]) => void;
}) {
  const [options, setOptions] = useState(() => columnOptions(column));
  const change = (value: string, patch: Partial<Option>) =>
    setOptions((current) =>
      current.map((option) =>
        option.value === value ? { ...option, ...patch } : option,
      ),
    );
  const cleaned = options
    .map((option) => ({ ...option, label: option.label.trim() }))
    .filter((option) => option.label);

  return (
    <DialogContent>
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(cleaned);
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit labels: {column.label}</DialogTitle>
          <DialogDescription>
            Renaming a label keeps it on every row that already has it.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 px-6 py-4">
          {options.map((option) => (
            <li key={option.value} className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Colour for ${option.label || "label"}`}
                    className="focus-visible:ring-ring/60 size-8 shrink-0 cursor-pointer rounded-md outline-none focus-visible:ring-2"
                    style={{ backgroundColor: option.color ?? "#6b6b6b" }}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-0">
                  <div className="grid grid-cols-5 gap-1">
                    {LABEL_COLORS.map((color) => (
                      <DropdownMenuItem
                        key={color}
                        aria-label={color}
                        onSelect={() => change(option.value, { color })}
                        className="p-1"
                      >
                        <span
                          className="size-5 rounded-[4px]"
                          style={{ backgroundColor: color }}
                        />
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Input
                aria-label="Label"
                value={option.label}
                maxLength={40}
                onChange={(event) =>
                  change(option.value, { label: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${option.label || "label"}`}
                onClick={() =>
                  setOptions((current) =>
                    current.filter((entry) => entry.value !== option.value),
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
          <li>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setOptions((current) => [
                  ...current,
                  {
                    value: newOptionId(),
                    label: "",
                    color: LABEL_COLORS[current.length % LABEL_COLORS.length],
                  },
                ])
              }
            >
              + Add label
            </Button>
          </li>
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Save labels
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

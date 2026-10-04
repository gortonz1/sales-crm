"use client";

import { useState, type KeyboardEvent } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { readableText, type Option } from "@/lib/recruitment";
import { cn } from "@/lib/utils";

const cellInput =
  "h-9 w-full min-w-0 bg-transparent px-2.5 text-[13px] text-foreground outline-none placeholder:text-faint focus:bg-secondary focus:shadow-[inset_0_0_0_1px_var(--color-ring)]";

function useCommit(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraft(value);
      requestAnimationFrame(() => event.currentTarget?.blur());
    }
  };
  return { draft, setDraft, commit, onKeyDown };
}

export function TextCell({
  value,
  label,
  onCommit,
  className,
}: {
  value: string | null;
  label: string;
  onCommit: (value: string | null) => void;
  className?: string;
}) {
  const { draft, setDraft, commit, onKeyDown } = useCommit(
    value ?? "",
    (next) => onCommit(next.trim() || null),
  );
  return (
    <input
      aria-label={label}
      value={draft}
      title={draft || undefined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(cellInput, "truncate", className)}
    />
  );
}

export function NumberCell({
  value,
  label,
  onCommit,
}: {
  value: number | null;
  label: string;
  onCommit: (value: number | null) => void;
}) {
  const { draft, setDraft, commit, onKeyDown } = useCommit(
    value?.toString() ?? "",
    (next) => {
      const n = parseInt(next, 10);
      onCommit(Number.isNaN(n) ? null : Math.max(0, n));
    },
  );
  return (
    <input
      aria-label={label}
      type="number"
      min={0}
      inputMode="numeric"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(cellInput, "text-center tabular-nums")}
    />
  );
}

export function DateCell({
  value,
  label,
  onCommit,
}: {
  value: string | null;
  label: string;
  onCommit: (value: string | null) => void;
}) {
  const { draft, setDraft, commit, onKeyDown } = useCommit(
    value ?? "",
    (next) => onCommit(next || null),
  );
  return (
    <input
      aria-label={label}
      type="date"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(
        cellInput,
        "tabular-nums [color-scheme:dark]",
        !draft && "text-faint",
      )}
    />
  );
}

export function PillCell({
  value,
  label,
  options,
  onCommit,
  neutral,
  allowEmpty = true,
}: {
  value: string | null;
  label: string;
  options: Option[];
  onCommit: (value: string | null) => void;
  neutral?: boolean;
  allowEmpty?: boolean;
}) {
  const selected = options.find((option) => option.value === value);
  const fill = neutral ? undefined : selected?.color;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${selected?.label ?? "empty"}`}
          className="focus-visible:ring-ring/60 flex h-9 w-full min-w-0 cursor-pointer items-center justify-center px-2 text-center text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-inset"
          style={
            fill
              ? { backgroundColor: fill, color: readableText(fill) }
              : undefined
          }
        >
          <span className={cn("truncate", !selected && "text-faint")}>
            {selected?.label ?? (value ? value : "")}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => option.value !== value && onCommit(option.value)}
            className="gap-2"
          >
            {!neutral && option.color && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: option.color }}
              />
            )}
            {option.label}
          </DropdownMenuItem>
        ))}
        {allowEmpty && value !== null && (
          <DropdownMenuItem
            onSelect={() => onCommit(null)}
            className="text-subtle"
          >
            Clear
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

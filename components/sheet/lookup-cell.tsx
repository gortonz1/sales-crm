"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/_ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/_ui/popover";
import type { LookupOption } from "@/lib/columns";
import { cn } from "@/lib/utils";

const CLEAR = "__clear__";

export default function LookupCell({
  label,
  value,
  options,
  placeholder,
  emptyMessage,
  href,
  onCommit,
}: {
  label: string;
  value: string | null;
  options: LookupOption[];
  placeholder: string;
  emptyMessage: string;
  href?: (value: string) => string;
  onCommit: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;
  const shown = selected?.label ?? (value ? "Deleted role" : "");

  return (
    <span className="group/lookup flex h-9 items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${shown || "empty"}`}
            title={shown || undefined}
            className="focus-visible:ring-ring/60 flex h-9 min-w-0 flex-1 cursor-pointer items-center px-2.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            <span className={cn("truncate", !selected && "text-faint")}>
              {shown}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[22em] p-0">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>
                {options.length ? "No match." : emptyMessage}
              </CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.hint ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    if (option.value !== value) onCommit(option.value);
                  }}
                  className="h-auto min-h-9 py-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[13px] leading-none">
                      {option.label}
                    </span>
                    {option.hint && (
                      <span className="caption-style text-subtle truncate">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {option.value === value && (
                    <span className="caption-style text-subtle shrink-0">
                      Selected
                    </span>
                  )}
                </CommandItem>
              ))}
              {value !== null && (
                <CommandItem
                  value={CLEAR}
                  onSelect={() => {
                    setOpen(false);
                    onCommit(null);
                  }}
                  className="text-subtle h-9"
                >
                  Clear
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && href && (
        <Link
          href={href(selected.value)}
          aria-label={`Open ${selected.label}`}
          className="caption-style text-subtle hover:text-foreground hover:bg-muted mr-1 shrink-0 rounded-md px-1.5 py-1 opacity-0 transition-opacity duration-150 group-hover/lookup:opacity-100 focus-visible:opacity-100"
        >
          Open
        </Link>
      )}
    </span>
  );
}

"use client";

import { useEffect } from "react";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

const VISIBLE_MS = 8000;

export type UndoNotice = { message: string; undo: () => void };

export default function UndoToast({
  notice,
  onClose,
}: {
  notice: UndoNotice | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, onClose]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="bg-popover border-line-strong shadow-overlay caption-style fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border py-2 pr-2 pl-3.5"
    >
      <span className="min-w-0 truncate">{notice.message}</span>
      <button
        type="button"
        onClick={() => {
          notice.undo();
          onClose();
        }}
        className="text-foreground hover:bg-muted focus-visible:ring-ring/60 shrink-0 cursor-pointer rounded-md px-2 py-1 font-medium outline-none focus-visible:ring-2"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="text-subtle hover:text-foreground hover:bg-muted flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md"
      >
        <XIcon aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

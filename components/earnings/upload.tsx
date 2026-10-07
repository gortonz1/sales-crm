"use client";

import { useRef, useState } from "react";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";

export default function Upload({
  onLoad,
  error,
  busy,
  onCancel,
  keepsPlan,
}: {
  onLoad: (file: File) => void;
  error: string | null;
  busy: boolean;
  onCancel?: () => void;
  keepsPlan: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (file: File | undefined) => {
    if (file) onLoad(file);
  };

  return (
    <div className="mx-auto flex w-full max-w-[38em] flex-col gap-5 py-6 sm:py-10">
      <div className="flex flex-col gap-3">
        <span className="eyebrow-style text-subtle">
          Apps indicative earnings
        </span>
        <h2 className="text-[28px] leading-[1.1] font-medium tracking-[-0.02em]">
          Read your earnings report
        </h2>
        <p className="text-soft leading-[1.5]">
          Upload the Apps Indicative Earnings Report CSV exactly as it
          downloads. The file is read in this browser tab and is never uploaded.
          When you press Save, only the figures the dashboard uses and your
          what-ifs are stored in the CRM, behind the earnings password.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "border-line-strong bg-card flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors duration-150",
          over && "border-ring bg-secondary",
        )}
      >
        <span className="lead-style font-medium">
          {busy ? "Reading the file…" : "Drop the CSV here"}
        </span>
        <span className="caption-style text-subtle mb-2">or</span>
        <Button
          variant="primary"
          size="sm"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          Choose a file
        </Button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="caption-style rounded-lg border border-(--tag-red-border) bg-(--tag-red-bg) px-3.5 py-3 leading-[1.5] text-(--tag-red-text)"
        >
          {error}
        </p>
      )}

      <p className="caption-style text-subtle leading-[1.5]">
        {keepsPlan
          ? "Your planned starts and EPA lag carry over to the new report if it covers the same funding year, along with early finishes and EPAs for apprentices still on it. Nothing replaces the saved version until you press Save."
          : "Once it loads you can plan new starts month by month, schedule EPAs for apprentices reaching gateway, and click any apprentice’s cell to model an early finish. Press Save to keep them for next time."}
      </p>
      {onCancel && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onCancel}
        >
          Back to the current report
        </Button>
      )}
    </div>
  );
}

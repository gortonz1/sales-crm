"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { badgeColor, badgeLabel, removeFiles, uploadFile } from "@/lib/files";
import type { StoredFile } from "@/lib/columns";
import { cn } from "@/lib/utils";
import FilePreview from "./file-preview";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const EM_PX = 13;
const CHIP_PX = 38;
const RESERVED_PX = 40;
const MORE_PX = 30;

function visibleCount(widthEm: number, total: number) {
  const space = widthEm * EM_PX - RESERVED_PX;
  if (total * CHIP_PX <= space) return total;
  return Math.max(1, Math.floor((space - MORE_PX) / CHIP_PX));
}

export default function FileCell({
  label,
  width,
  columnId,
  rowId,
  files,
  onCommit,
  onError,
}: {
  label: string;
  width: number;
  columnId: string;
  rowId: string;
  files: StoredFile[];
  onCommit: (files: StoredFile[]) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(files);
  useEffect(() => {
    latest.current = files;
  }, [files]);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const shown = visibleCount(width, files.length);
  const hidden = files.length - shown;

  async function upload(list: FileList | File[]) {
    const picked = Array.from(list);
    if (!picked.length) return;
    setUploading((count) => count + picked.length);
    const results = await Promise.allSettled(
      picked.map((file) => uploadFile(columnId, rowId, file)),
    );
    setUploading((count) => count - picked.length);
    const added = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const failed = results.flatMap((result) =>
      result.status === "rejected"
        ? [
            result.reason instanceof Error
              ? result.reason.message
              : "Upload failed.",
          ]
        : [],
    );
    if (added.length) onCommit([...latest.current, ...added]);
    if (failed.length) onError(failed.join(" "));
  }

  function remove(file: StoredFile) {
    const next = latest.current.filter((entry) => entry.id !== file.id);
    onCommit(next);
    removeFiles([file.path]).catch(() => undefined);
    if (!next.length) setPreviewIndex(null);
    else if (previewIndex !== null && previewIndex >= next.length)
      setPreviewIndex(next.length - 1);
  }

  function onDrop(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    upload(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "group/files relative flex h-9 w-full min-w-0 items-center gap-1 px-1.5",
        dragging && "bg-secondary shadow-[inset_0_0_0_1px_var(--color-ring)]",
      )}
    >
      <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {files.slice(0, shown).map((file, index) => (
          <li key={file.id} className="shrink-0">
            <button
              type="button"
              title={file.name}
              aria-label={`Preview ${file.name}`}
              onClick={() => setPreviewIndex(index)}
              className="focus-visible:ring-ring/60 flex h-6 min-w-8 cursor-pointer items-center justify-center rounded-[4px] px-1 text-[10px] leading-none font-semibold tracking-[0.02em] text-white outline-none hover:brightness-110 focus-visible:ring-2"
              style={{ backgroundColor: badgeColor(file) }}
            >
              {badgeLabel(file)}
            </button>
          </li>
        ))}
        {hidden > 0 && (
          <li className="shrink-0">
            <button
              type="button"
              aria-label={`${hidden} more ${hidden === 1 ? "file" : "files"}`}
              onClick={() => setPreviewIndex(shown)}
              className="caption-style bg-muted text-soft hover:text-foreground focus-visible:ring-ring/60 flex h-6 cursor-pointer items-center rounded-[4px] px-1.5 outline-none focus-visible:ring-2"
            >
              +{hidden}
            </button>
          </li>
        )}
        {uploading > 0 && (
          <li className="caption-style text-subtle shrink-0 animate-pulse px-1">
            Uploading…
          </li>
        )}
      </ul>

      <button
        type="button"
        aria-label={`Add a file to ${label}`}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "text-subtle hover:text-foreground hover:bg-muted focus-visible:ring-ring/60 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:ring-2",
          files.length > 0 &&
            "opacity-0 transition-opacity duration-150 group-hover/files:opacity-100 focus-visible:opacity-100",
        )}
      >
        <PlusIcon aria-hidden className="size-3" />
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) upload(event.target.files);
          event.target.value = "";
        }}
      />

      <FilePreview
        files={files}
        index={previewIndex}
        title={label}
        onIndexChange={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
        onAdd={() => inputRef.current?.click()}
        onDelete={remove}
      />
    </div>
  );
}

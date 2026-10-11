"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import Button, { buttonVariants } from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/_ui/dialog";
import type { StoredFile } from "@/lib/columns";
import {
  MAX_TEXT_PREVIEW_BYTES,
  badgeColor,
  badgeLabel,
  fileKind,
  fileUrl,
  formatBytes,
} from "@/lib/files";
import { cn } from "@/lib/utils";
import ChevronDownIcon from "@/public/assets/images/_common/chevron-down.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const uploadedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function FilePreview({
  files,
  index,
  title,
  onIndexChange,
  onClose,
  onAdd,
  onDelete,
}: {
  files: StoredFile[];
  index: number | null;
  title: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onAdd: () => void;
  onDelete: (file: StoredFile) => void;
}) {
  const file = index !== null ? files[index] : undefined;
  const open = file !== undefined;

  function step(direction: -1 | 1) {
    if (index === null || files.length < 2) return;
    onIndexChange((index + direction + files.length) % files.length);
  }

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, video, audio")) return;
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-w-[min(1100px,calc(100%-2rem))]"
        onKeyDown={onKeyDown}
      >
        {file && index !== null && (
          <div className="flex h-[min(86dvh,calc(100dvh-2rem))] flex-col">
            <div className="border-line-strong flex items-center gap-3 border-b py-3 pr-14 pl-5">
              <span
                aria-hidden
                className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-[5px] px-1 text-[10px] font-semibold text-white"
                style={{ backgroundColor: badgeColor(file) }}
              >
                {badgeLabel(file)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <DialogTitle className="truncate">{file.name}</DialogTitle>
                <DialogDescription>
                  {[
                    title,
                    formatBytes(file.size),
                    file.uploadedAt &&
                      `added ${uploadedFormat.format(new Date(file.uploadedAt))}`,
                    files.length > 1 && `${index + 1} of ${files.length}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <DownloadButton file={file} />
                <DeleteButton key={file.id} onDelete={() => onDelete(file)} />
              </div>
            </div>

            <div className="bg-background relative min-h-0 flex-1">
              <PreviewBody key={file.id} file={file} />
              {files.length > 1 && (
                <>
                  <StepButton direction={-1} onClick={() => step(-1)} />
                  <StepButton direction={1} onClick={() => step(1)} />
                </>
              )}
            </div>

            <div className="border-line-strong flex items-center gap-2 overflow-x-auto border-t px-5 py-3">
              {files.map((entry, i) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-current={i === index ? "true" : undefined}
                  title={entry.name}
                  className={cn(
                    "border-line-strong hover:bg-muted focus-visible:ring-ring/60 flex max-w-[14em] shrink-0 cursor-pointer items-center gap-2 rounded-lg border py-1.5 pr-2.5 pl-1.5 outline-none focus-visible:ring-2",
                    i === index && "border-ring bg-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex h-5 min-w-7 items-center justify-center rounded-[3px] px-0.5 text-[9px] font-semibold text-white"
                    style={{ backgroundColor: badgeColor(entry) }}
                  >
                    {badgeLabel(entry)}
                  </span>
                  <span className="caption-style truncate">{entry.name}</span>
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onAdd}
              >
                <PlusIcon aria-hidden className="size-3" />
                Add file
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function useSignedUrl(path: string, downloadName?: string) {
  const [state, setState] = useState<{
    url: string | null;
    error: string | null;
  }>({ url: null, error: null });
  useEffect(() => {
    let live = true;
    fileUrl(path, downloadName).then(
      (url) => live && setState({ url, error: null }),
      (error: unknown) =>
        live &&
        setState({
          url: null,
          error: error instanceof Error ? error.message : "Couldn't open it.",
        }),
    );
    return () => {
      live = false;
    };
  }, [path, downloadName]);
  return state;
}

function PreviewBody({ file }: { file: StoredFile }) {
  const { url, error } = useSignedUrl(file.path);
  const kind = fileKind(file);

  if (error) return <Message>Couldn&apos;t load this file. {error}</Message>;
  if (!url) return <Message>Loading preview…</Message>;

  switch (kind) {
    case "image":
      return (
        <Image
          src={url}
          alt={file.name}
          fill
          unoptimized
          sizes="1100px"
          className="object-contain p-4"
        />
      );
    case "pdf":
      return (
        <iframe
          src={url}
          title={file.name}
          className="absolute inset-0 size-full border-0 bg-white"
        />
      );
    case "video":
      return (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <video src={url} controls className="max-h-full max-w-full" />
        </div>
      );
    case "audio":
      return (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <audio src={url} controls className="w-full max-w-[32em]" />
        </div>
      );
    case "text":
      return file.size <= MAX_TEXT_PREVIEW_BYTES ? (
        <TextPreview url={url} />
      ) : (
        <NoPreview file={file} reason="This file is too large to preview." />
      );
    default:
      return <NoPreview file={file} />;
  }
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((response) => (response.ok ? response.text() : Promise.reject()))
      .then(
        (body) => live && setText(body),
        () => live && setFailed(true),
      );
    return () => {
      live = false;
    };
  }, [url]);
  if (failed) return <Message>Couldn&apos;t load this file.</Message>;
  if (text === null) return <Message>Loading preview…</Message>;
  return (
    <pre className="absolute inset-0 overflow-auto p-5 font-mono text-[12px] leading-[1.6] whitespace-pre-wrap">
      {text}
    </pre>
  );
}

function NoPreview({ file, reason }: { file: StoredFile; reason?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <span
        aria-hidden
        className="flex h-14 min-w-16 items-center justify-center rounded-lg px-2 text-[15px] font-semibold text-white"
        style={{ backgroundColor: badgeColor(file) }}
      >
        {badgeLabel(file)}
      </span>
      <p className="text-soft max-w-[28em]">
        {reason ?? "There's no preview for this type of file."} Download it to
        open it on your computer.
      </p>
      <DownloadButton file={file} variant="secondary" />
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <p className="caption-style text-subtle absolute inset-0 flex items-center justify-center p-6 text-center">
      {children}
    </p>
  );
}

function DownloadButton({
  file,
  variant = "ghost",
}: {
  file: StoredFile;
  variant?: "ghost" | "secondary";
}) {
  const { url } = useSignedUrl(file.path, file.name);
  if (!url) {
    return (
      <Button variant={variant} size="sm" disabled>
        Download
      </Button>
    );
  }
  return (
    <a
      href={url}
      download={file.name}
      className={buttonVariants({ variant, size: "sm" })}
    >
      Download
    </a>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(confirming && "text-danger")}
      onClick={() => (confirming ? onDelete() : setConfirming(true))}
      onBlur={() => setConfirming(false)}
    >
      {confirming ? "Confirm delete" : "Delete"}
    </Button>
  );
}

function StepButton({
  direction,
  onClick,
}: {
  direction: -1 | 1;
  onClick: () => void;
}) {
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={direction === -1 ? "Previous file" : "Next file"}
      onClick={onClick}
      className={cn(
        "shadow-overlay absolute top-1/2 -translate-y-1/2 rounded-full",
        direction === -1 ? "left-3" : "right-3",
      )}
    >
      <ChevronDownIcon
        aria-hidden
        className={cn("size-3", direction === -1 ? "rotate-90" : "-rotate-90")}
      />
    </Button>
  );
}

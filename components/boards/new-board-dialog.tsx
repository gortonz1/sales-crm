"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  copyMondayFiles,
  createBoard,
  importMondayBoard,
  listMondayBoards,
} from "@/app/(app)/boards/actions";
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
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { FILE_BATCH, NAME_MAX, boardHref } from "@/lib/boards";
import type { MondayBoardSummary } from "@/lib/monday";

type Mode = "blank" | "monday";

export default function NewBoardDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<Mode>("blank");
  const [resetKey, setResetKey] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[520px]"
        onCloseAutoFocus={() => {
          setMode("blank");
          setResetKey((key) => key + 1);
        }}
      >
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
          <DialogDescription>
            Start from a blank board, or bring one over from monday.com with its
            groups, columns and labels.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="border-border border-b px-6">
            <TabsTrigger value="blank" className="py-3">
              Blank board
            </TabsTrigger>
            <TabsTrigger value="monday" className="py-3">
              Import from monday.com
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "blank" ? (
          <BlankForm key={resetKey} onCreated={onCreated} />
        ) : (
          <MondayForm
            key={resetKey}
            onCreated={onCreated}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function useOpenBoard(onCreated: () => void) {
  const router = useRouter();
  return (id: string, close = true) => {
    if (close) onCreated();
    router.push(boardHref(id));
    router.refresh();
  };
}

function BlankForm({ onCreated }: { onCreated: () => void }) {
  const openBoard = useOpenBoard(onCreated);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the board a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createBoard(name);
      if (result.error || !result.id) {
        setError(result.error ?? "Couldn't create the board.");
        return;
      }
      openBoard(result.id);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-4 px-6 py-5">
        <Field
          label="Board name"
          htmlFor="new-board-name"
          required
          error={error ?? undefined}
          hint="It appears under Boards in the sidebar for everyone."
        >
          <Input
            id="new-board-name"
            autoFocus
            autoComplete="off"
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="sm">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create board"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function MondayForm({
  onCreated,
  onDone,
}: {
  onCreated: () => void;
  onDone: () => void;
}) {
  const openBoard = useOpenBoard(onCreated);
  const [token, setToken] = useState("");
  const [boards, setBoards] = useState<MondayBoardSummary[] | null>(null);
  const [boardId, setBoardId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[] | null>(null);
  const [copying, setCopying] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function loadBoards(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await listMondayBoards(token);
      if (result.error || !result.boards) {
        setError(result.error ?? "Couldn't load your boards.");
        return;
      }
      if (!result.boards.length) {
        setError("That account has no boards to import.");
        return;
      }
      setBoards(result.boards);
      setBoardId(result.boards[0].id);
    });
  }

  function runImport(event: FormEvent) {
    event.preventDefault();
    if (!boardId) return;
    setError(null);
    startTransition(async () => {
      const result = await importMondayBoard(token, boardId);
      if (result.error || !result.id) {
        setError(result.error ?? "Couldn't import the board.");
        return;
      }
      const pendingFiles = result.files ?? [];
      const failedFiles: string[] = [];
      let copied = 0;
      if (pendingFiles.length) {
        setCopying({ done: 0, total: pendingFiles.length });
        for (let i = 0; i < pendingFiles.length; i += FILE_BATCH) {
          const batch = pendingFiles.slice(i, i + FILE_BATCH);
          const copy = await copyMondayFiles(token, result.id, batch);
          copied += copy.copied;
          failedFiles.push(...copy.failed);
          setCopying({
            done: Math.min(i + batch.length, pendingFiles.length),
            total: pendingFiles.length,
          });
        }
        setCopying(null);
      }
      const next = [
        `Imported ${result.items ?? 0} ${result.items === 1 ? "item" : "items"}${
          pendingFiles.length
            ? ` and ${copied} ${copied === 1 ? "file" : "files"}`
            : ""
        }.`,
      ];
      if (failedFiles.length) {
        const shown = failedFiles.slice(0, 8).join(", ");
        const more = failedFiles.length - 8;
        next.push(
          `These files couldn't be copied, so download them from monday.com and add them by hand: ${shown}${more > 0 ? ` and ${more} more` : ""}.`,
        );
      }
      if (result.linkedFiles) {
        next.push(
          `${result.linkedFiles} ${result.linkedFiles === 1 ? "file was a link" : "files were links"} to Google Drive or similar rather than an upload, so ${result.linkedFiles === 1 ? "it wasn't" : "they weren't"} copied.`,
        );
      }
      if (result.truncated) {
        next.push(
          "The board has more items than one import can bring over, so only the first 5,000 came across.",
        );
      }
      if (result.skippedColumns?.length) {
        next.push(
          `These columns were left out because the CRM can't hold them yet: ${result.skippedColumns.join(", ")}.`,
        );
      }
      const hasNotes = next.length > 1;
      openBoard(result.id, !hasNotes);
      if (hasNotes) setNotes(next);
      else onDone();
    });
  }

  if (copying) {
    return (
      <div className="flex flex-col gap-3 px-6 py-6" role="status">
        <p>
          Copying files from monday.com… {copying.done} of {copying.total}
        </p>
        <div
          aria-hidden
          className="bg-muted h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${(copying.done / copying.total) * 100}%` }}
          />
        </div>
        <p className="caption-style text-subtle">
          Keep this window open until it finishes. The board and its items are
          already saved.
        </p>
      </div>
    );
  }

  if (notes) {
    return (
      <div className="flex flex-col">
        <ul className="caption-style text-soft flex flex-col gap-2 px-6 py-5 leading-[1.5]">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              onDone();
              onCreated();
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      onSubmit={boards ? runImport : loadBoards}
      noValidate
      className="flex flex-col"
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <Field
          label="monday.com API token"
          htmlFor="monday-token"
          required
          error={boards ? undefined : (error ?? undefined)}
          hint="In monday.com, open your profile picture → Developers → My access tokens, then copy it here. It's only used for this import and isn't saved."
        >
          <Input
            id="monday-token"
            type="password"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={token}
            disabled={boards !== null}
            onChange={(event) => setToken(event.target.value)}
          />
        </Field>
        {boards && (
          <Field
            label="Board"
            htmlFor="monday-board"
            error={error ?? undefined}
            hint="Groups, columns, status labels with their colours, and uploaded files come across. Subitems and updates don't."
          >
            <Select value={boardId} onValueChange={setBoardId}>
              <SelectTrigger id="monday-board">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.name}
                    {board.workspace ? ` · ${board.workspace}` : ""}
                    {board.items !== null ? ` · ${board.items} items` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <DialogFooter>
        {boards ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setBoards(null);
              setError(null);
            }}
          >
            Change token
          </Button>
        ) : (
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
        )}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={pending || !token.trim()}
        >
          {boards
            ? pending
              ? "Importing…"
              : "Import board"
            : pending
              ? "Loading boards…"
              : "Load my boards"}
        </Button>
      </DialogFooter>
    </form>
  );
}

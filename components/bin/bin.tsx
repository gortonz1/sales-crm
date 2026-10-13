"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import { BIN_DAYS, boardHref, type BinEntry, type BinKind } from "@/lib/boards";
import { removeFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import { useCompaniesStore } from "@/stores/companies-store";
import MenuIcon from "@/public/assets/images/_common/menu.svg";

const TABLES = {
  board: "boards",
  group: "board_groups",
  item: "board_items",
  column: "board_columns",
} as const;

const KIND_LABEL: Record<BinKind, string> = {
  board: "Board",
  group: "Group",
  item: "Item",
  column: "Column",
};

type Confirm = { kind: "one"; entry: BinEntry } | { kind: "all" };

export default function Bin({
  entries: initialEntries,
  isAdmin,
}: {
  entries: BinEntry[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const [entries, setEntries] = useState(initialEntries);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState<BinEntry | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const drop = (entry: BinEntry) =>
    setEntries((current) =>
      current.filter(
        (row) => !(row.kind === entry.kind && row.id === entry.id),
      ),
    );

  async function restore(entry: BinEntry) {
    setError(null);
    setBusy(entry.id);
    const { error } = await createClient()
      .from(TABLES[entry.kind])
      .update({ deleted_at: null })
      .eq("id", entry.id);
    setBusy(null);
    if (error) {
      setError(`Couldn't restore ${entry.name}: ${error.message}`);
      return;
    }
    drop(entry);
    setRestored(entry);
    if (entry.kind === "board") router.refresh();
  }

  async function deleteForever(list: BinEntry[]) {
    setError(null);
    setBusy("forever");
    const supabase = createClient();
    const paths: string[] = [];
    for (const entry of list) {
      const { data, error } = await supabase.rpc("delete_forever", {
        kind: entry.kind,
        entry_id: entry.id,
      });
      if (error) {
        setError(`Couldn't delete ${entry.name}: ${error.message}`);
        break;
      }
      paths.push(...(data ?? []));
      drop(entry);
    }
    setBusy(null);
    removeFiles(paths).catch(() => undefined);
  }

  function runConfirm() {
    if (!confirm) return;
    deleteForever(confirm.kind === "all" ? entries : [confirm.entry]);
    setConfirm(null);
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-border shrink-0 border-b">
        <div className="flex items-center justify-between gap-2 px-4 py-[14px]">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon aria-hidden className="size-3.5" />
            </Button>
            <h1 className="truncate">Bin</h1>
            <span className="caption-style bg-muted border-pill shrink-0 rounded-full border px-2 py-[3px]">
              {entries.length}
            </span>
          </div>
          {isAdmin && entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => setConfirm({ kind: "all" })}
            >
              Empty bin
            </Button>
          )}
        </div>
        <p className="caption-style text-subtle px-4 pb-3 leading-[1.4]">
          Deleted boards, groups, columns and items stay here for {BIN_DAYS}{" "}
          days, then they and their files are deleted for good.
        </p>
      </header>

      {(error || restored) && (
        <p
          role={error ? "alert" : "status"}
          className={
            error
              ? "caption-style text-danger border-border shrink-0 border-b px-4 py-2"
              : "caption-style text-soft border-border shrink-0 border-b px-4 py-2"
          }
        >
          {error ?? (
            <>
              Restored “{restored?.name}”.{" "}
              {restored?.boardId && (
                <Link
                  href={boardHref(restored.boardId)}
                  className="text-foreground underline underline-offset-2"
                >
                  Open the board
                </Link>
              )}
            </>
          )}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {entries.length === 0 ? (
          <p className="text-soft">The bin is empty.</p>
        ) : (
          <ul className="border-line-strong bg-card divide-line-strong mx-auto flex max-w-[56em] flex-col divide-y rounded-xl border">
            {entries.map((entry) => {
              const canRestore =
                isAdmin || (entry.kind !== "board" && entry.kind !== "column");
              return (
                <li
                  key={`${entry.kind}-${entry.id}`}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="caption-style bg-muted text-soft shrink-0 rounded-[4px] px-1.5 py-[3px]">
                        {KIND_LABEL[entry.kind]}
                      </span>
                      <span className="truncate font-medium">{entry.name}</span>
                    </div>
                    <span className="caption-style text-subtle truncate">
                      {[
                        entry.place,
                        entry.detail,
                        `deleted ${entry.ago}${entry.deletedBy ? ` by ${entry.deletedBy}` : ""}`,
                        entry.daysLeft === 0
                          ? "goes for good today"
                          : `${entry.daysLeft} ${entry.daysLeft === 1 ? "day" : "days"} left`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!canRestore || busy !== null}
                      title={
                        canRestore
                          ? undefined
                          : "Only admins can restore boards and columns"
                      }
                      onClick={() => restore(entry)}
                    >
                      {busy === entry.id ? "Restoring…" : "Restore"}
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setConfirm({ kind: "one", entry })}
                      >
                        Delete forever
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "all"
                ? "Empty the bin?"
                : `Delete “${confirm?.kind === "one" ? confirm.entry.name : ""}” forever?`}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "all"
                ? `Everything in the bin (${entries.length}), and any files on it, will be deleted for good. This can't be undone.`
                : "It and any files on it will be deleted for good. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={runConfirm}>
              {confirm?.kind === "all" ? "Empty bin" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

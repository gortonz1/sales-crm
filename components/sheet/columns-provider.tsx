"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import UndoToast, { type UndoNotice } from "@/components/_common/undo-toast";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import LabelsDialog from "./labels-dialog";
import type { ColumnsApi } from "./use-board-columns";
import type { BoardColumn } from "@/lib/columns";

type ColumnsContext = {
  api: ColumnsApi;
  editLabels: (column: BoardColumn) => void;
  confirmDelete: (column: BoardColumn) => void;
  notify: (message: string) => void;
};

const Context = createContext<ColumnsContext | null>(null);

export function useColumns() {
  const context = useContext(Context);
  if (!context) throw new Error("useColumns needs a ColumnsProvider");
  return context;
}

export default function ColumnsProvider({
  api,
  children,
}: {
  api: ColumnsApi;
  children: ReactNode;
}) {
  const [labelsId, setLabelsId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BoardColumn | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoNotice | null>(null);
  const closeUndo = useCallback(() => setUndo(null), []);
  const message = api.error ?? notice;
  const labelsColumn =
    api.columns.find((column) => column.id === labelsId) ?? null;

  return (
    <Context.Provider
      value={{
        api,
        editLabels: (column) => setLabelsId(column.id),
        confirmDelete: setDeleting,
        notify: setNotice,
      }}
    >
      {children}
      <LabelsDialog
        column={labelsColumn}
        onClose={() => setLabelsId(null)}
        onSave={api.setOptions}
      />
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.label}”?</DialogTitle>
            <DialogDescription>
              {api.inBin
                ? "The column and everything entered in it will move to the Bin, where it can be restored for 30 days."
                : `The column and everything entered in it${
                    deleting?.type === "file"
                      ? ", including uploaded files,"
                      : ""
                  } will be removed from every row. This can't be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                const column = deleting;
                setDeleting(null);
                if (!column) return;
                const removed = await api.remove(column.id);
                if (removed && api.inBin) {
                  setUndo({
                    message: `Deleted “${column.label}”`,
                    undo: () => api.restore(column),
                  });
                }
              }}
            >
              Delete column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UndoToast notice={undo} onClose={closeUndo} />
      {message && (
        <div
          role="alert"
          className="caption-style text-danger bg-popover border-line-strong shadow-overlay fixed right-4 bottom-4 z-50 flex max-w-[24em] items-start gap-3 rounded-lg border px-3 py-2.5"
        >
          <span className="min-w-0 flex-1">{message}</span>
          <button
            type="button"
            onClick={() => {
              api.clearError();
              setNotice(null);
            }}
            className="text-subtle hover:text-foreground cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </Context.Provider>
  );
}

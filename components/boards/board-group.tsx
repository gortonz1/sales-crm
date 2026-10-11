"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { TextCell } from "@/components/recruitment/cells";
import type { CustomValue } from "@/components/sheet/custom-cell";
import SheetTable from "@/components/sheet/sheet-table";
import { ITEM_NAME_MAX, type BoardGroup, type BoardItem } from "@/lib/boards";
import { LABEL_COLORS } from "@/lib/columns";
import { cn } from "@/lib/utils";
import ChevronDownIcon from "@/public/assets/images/_common/chevron-down.svg";
import GripIcon from "@/public/assets/images/_common/grip.svg";

const ROW_DRAG_TYPE = "application/x-crm-board-item";

export default function BoardGroupSection({
  group,
  groups,
  index,
  items,
  onAddItem,
  onRenameItem,
  onMoveItem,
  onDeleteItem,
  onCustomChange,
  onRename,
  onColor,
  onMove,
  onDelete,
}: {
  group: BoardGroup;
  groups: BoardGroup[];
  index: number;
  items: BoardItem[];
  onAddItem: (name: string) => void;
  onRenameItem: (id: string, name: string) => void;
  onMoveItem: (id: string, groupId: string) => void;
  onDeleteItem: (item: BoardItem) => void;
  onCustomChange: (id: string, columnId: string, value: CustomValue) => void;
  onRename: () => void;
  onColor: (color: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dropping, setDropping] = useState(false);
  const others = groups.filter((entry) => entry.id !== group.id);

  return (
    <section
      aria-label={group.name}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(ROW_DRAG_TYPE)) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDropping(false);
      }}
      onDrop={(event) => {
        const id = event.dataTransfer.getData(ROW_DRAG_TYPE);
        setDropping(false);
        if (!id) return;
        event.preventDefault();
        onMoveItem(id, group.id);
      }}
      className={cn(
        "mt-5 rounded-lg transition-colors duration-150 first:mt-4",
        dropping && "bg-overlay/[0.04]",
      )}
    >
      <div className="bg-background sticky left-0 z-[3] flex w-fit items-center gap-2 px-4 pb-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
          className="focus-visible:ring-ring/60 flex cursor-pointer items-center gap-2 rounded-md outline-none focus-visible:ring-2"
        >
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-3 transition-transform duration-150",
              collapsed && "-rotate-90",
            )}
            style={{ color: group.color }}
          />
          <h2 className="lead-style font-medium" style={{ color: group.color }}>
            {group.name}
          </h2>
        </button>
        <span className="caption-style text-subtle">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${group.name} options`}
              className="caption-style text-subtle hover:text-foreground hover:bg-muted data-[state=open]:bg-muted cursor-pointer rounded-md px-1.5 py-1"
            >
              Edit
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onRename}>
              Rename group
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => onMove(-1)}
            >
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === groups.length - 1}
              onSelect={() => onMove(1)}
            >
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Colour</DropdownMenuLabel>
            <div className="grid grid-cols-5 gap-1 px-1 pb-1">
              {LABEL_COLORS.map((color) => (
                <DropdownMenuItem
                  key={color}
                  aria-label={color}
                  onSelect={() => color !== group.color && onColor(color)}
                  className="p-1"
                >
                  <span
                    className={cn(
                      "size-5 rounded-[4px]",
                      color === group.color &&
                        "ring-foreground ring-2 ring-offset-1",
                    )}
                    style={{ backgroundColor: color }}
                  />
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-danger">
              Delete group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!collapsed && (
        <div className="px-4">
          <SheetTable
            rows={items}
            accent={group.color}
            pinned={{
              label: "Item",
              width: 16,
              render: (item) => (
                <div className="relative flex items-center">
                  <span
                    draggable
                    aria-hidden
                    title="Drag to another group"
                    onDragStart={(event) => {
                      event.dataTransfer.setData(ROW_DRAG_TYPE, item.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDropping(false)}
                    className="text-faint hover:text-subtle flex h-9 w-4 shrink-0 cursor-grab items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 active:cursor-grabbing"
                  >
                    <GripIcon className="size-3.5" />
                  </span>
                  <TextCell
                    label="Item"
                    value={item.name}
                    className="font-medium"
                    onCommit={(name) =>
                      name &&
                      onRenameItem(item.id, name.slice(0, ITEM_NAME_MAX))
                    }
                  />
                  <div className="bg-background group-hover:bg-secondary invisible absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 group-focus-within:visible group-hover:visible has-[[data-state=open]]:visible">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${item.name} options`}
                          className="caption-style text-subtle hover:text-foreground hover:bg-muted data-[state=open]:bg-muted shrink-0 cursor-pointer rounded-md px-1.5 py-1"
                        >
                          More
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {others.length > 0 && (
                          <>
                            <DropdownMenuLabel>Move to</DropdownMenuLabel>
                            {others.map((target) => (
                              <DropdownMenuItem
                                key={target.id}
                                onSelect={() => onMoveItem(item.id, target.id)}
                              >
                                <span
                                  aria-hidden
                                  className="size-2.5 rounded-[3px]"
                                  style={{ backgroundColor: target.color }}
                                />
                                {target.name}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onSelect={() => onDeleteItem(item)}
                          className="text-danger"
                        >
                          Delete item
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ),
            }}
            renderBuiltIn={() => null}
            onCustomChange={(item, column, value) =>
              onCustomChange(item.id, column.id, value)
            }
            footer={<AddItem onAdd={onAddItem} />}
          />
        </div>
      )}
    </section>
  );
}

function AddItem({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="Add an item"
      placeholder="+ Add item"
      value={value}
      maxLength={ITEM_NAME_MAX}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && value.trim()) {
          onAdd(value.trim());
          setValue("");
        }
      }}
      className="placeholder:text-subtle focus:bg-secondary sticky left-0 h-9 w-[16em] bg-transparent px-2.5 text-[13px] outline-none"
    />
  );
}

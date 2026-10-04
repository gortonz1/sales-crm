"use client";

import { useState, type ReactNode } from "react";
import {
  CONTRACT_STATUSES,
  LEFT_STATUSES,
  PAPERWORK_STATUSES,
  RECRUITMENT_GROUPS,
  RECRUITMENT_STATUSES,
  SOURCES,
  monthOptions,
  type Recruitment,
  type RecruitmentPatch,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";
import { DateCell, NumberCell, PillCell, TextCell } from "./cells";
import ChevronDownIcon from "@/public/assets/images/_common/chevron-down.svg";

type Column = {
  key: string;
  label: string;
  width: string;
  render: (
    item: Recruitment,
    save: (patch: RecruitmentPatch) => void,
  ) => ReactNode;
};

const COLUMNS: Column[] = [
  {
    key: "status",
    label: "Status",
    width: "9.5em",
    render: (item, save) => (
      <PillCell
        label="Status"
        value={item.status}
        options={RECRUITMENT_STATUSES}
        allowEmpty={false}
        onCommit={(status) => status && save({ status })}
      />
    ),
  },
  {
    key: "est_start",
    label: "Est. start",
    width: "8em",
    render: (item, save) => (
      <PillCell
        label="Est. start"
        value={item.est_start}
        options={monthOptions(item.est_start)}
        neutral
        onCommit={(est_start) => save({ est_start })}
      />
    ),
  },
  {
    key: "source",
    label: "Source",
    width: "9em",
    render: (item, save) => (
      <PillCell
        label="Source"
        value={item.source}
        options={SOURCES}
        onCommit={(source) => save({ source })}
      />
    ),
  },
  {
    key: "shortlist_delivery",
    label: "Shortlist delivery",
    width: "9.5em",
    render: (item, save) => (
      <DateCell
        label="Shortlist delivery"
        value={item.shortlist_delivery}
        onCommit={(shortlist_delivery) => save({ shortlist_delivery })}
      />
    ),
  },
  {
    key: "shortlist_count",
    label: "# in shortlist",
    width: "6.5em",
    render: (item, save) => (
      <NumberCell
        label="Candidates in shortlist"
        value={item.shortlist_count}
        onCommit={(shortlist_count) => save({ shortlist_count })}
      />
    ),
  },
  {
    key: "interviewees",
    label: "Interviewees",
    width: "8em",
    render: (item, save) => (
      <TextCell
        label="Interviewees"
        value={item.interviewees}
        onCommit={(interviewees) => save({ interviewees })}
      />
    ),
  },
  {
    key: "interview_date",
    label: "Interview date",
    width: "9.5em",
    render: (item, save) => (
      <DateCell
        label="Interview date"
        value={item.interview_date}
        onCommit={(interview_date) => save({ interview_date })}
      />
    ),
  },
  {
    key: "notes",
    label: "Notes",
    width: "22em",
    render: (item, save) => (
      <TextCell
        label="Notes"
        value={item.notes}
        onCommit={(notes) => save({ notes })}
      />
    ),
  },
  {
    key: "das",
    label: "DAS",
    width: "8em",
    render: (item, save) => (
      <PillCell
        label="DAS"
        value={item.das}
        options={PAPERWORK_STATUSES}
        onCommit={(das) => save({ das })}
      />
    ),
  },
  {
    key: "deposit",
    label: "Deposit",
    width: "8em",
    render: (item, save) => (
      <PillCell
        label="Deposit"
        value={item.deposit}
        options={PAPERWORK_STATUSES}
        onCommit={(deposit) => save({ deposit })}
      />
    ),
  },
  {
    key: "contract",
    label: "Contract",
    width: "8em",
    render: (item, save) => (
      <PillCell
        label="Contract"
        value={item.contract}
        options={CONTRACT_STATUSES}
        onCommit={(contract) => save({ contract })}
      />
    ),
  },
  {
    key: "signed_up_on",
    label: "Date of sign-up",
    width: "9.5em",
    render: (item, save) => (
      <DateCell
        label="Date of sign-up"
        value={item.signed_up_on}
        onCommit={(signed_up_on) => save({ signed_up_on })}
      />
    ),
  },
  {
    key: "left_status",
    label: "Left",
    width: "8em",
    render: (item, save) => (
      <PillCell
        label="Left"
        value={item.left_status}
        options={LEFT_STATUSES}
        onCommit={(left_status) => save({ left_status })}
      />
    ),
  },
  {
    key: "contact",
    label: "Contact",
    width: "14em",
    render: (item, save) => (
      <TextCell
        label="Contact"
        value={item.contact}
        onCommit={(contact) => save({ contact })}
      />
    ),
  },
];

const CLIENT_WIDTH = "16em";

export default function RecruitmentSheet({
  items,
  onSave,
  onOpen,
  onAdd,
}: {
  items: Recruitment[];
  onSave: (id: string, patch: RecruitmentPatch) => void;
  onOpen: (id: string) => void;
  onAdd: (client: string, group: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    dead: true,
  });
  const tableWidth = `calc(${CLIENT_WIDTH} + ${COLUMNS.map((c) => c.width).join(" + ")})`;

  return (
    <div className="h-full overflow-auto pb-10">
      {RECRUITMENT_GROUPS.map((group) => {
        const rows = items.filter((item) => item.board_group === group.value);
        const isCollapsed = collapsed[group.value];
        return (
          <section key={group.value} className="mt-5 first:mt-4">
            <div className="bg-background sticky left-0 z-[3] flex w-fit items-center gap-2 px-4 pb-2">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() =>
                  setCollapsed((current) => ({
                    ...current,
                    [group.value]: !current[group.value],
                  }))
                }
                className="focus-visible:ring-ring/60 flex cursor-pointer items-center gap-2 rounded-md outline-none focus-visible:ring-2"
              >
                <ChevronDownIcon
                  aria-hidden
                  className={cn(
                    "size-3 transition-transform duration-150",
                    isCollapsed && "-rotate-90",
                  )}
                  style={{ color: group.color }}
                />
                <h2
                  className="lead-style font-medium"
                  style={{ color: group.color }}
                >
                  {group.label}
                </h2>
              </button>
              <span className="caption-style text-subtle">
                {rows.length} {rows.length === 1 ? "client" : "clients"}
              </span>
            </div>

            {!isCollapsed && (
              <div className="px-4">
                <table
                  className="border-line-strong table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border-y border-r text-[13px]"
                  style={{
                    width: tableWidth,
                    borderLeft: `4px solid ${group.color}`,
                  }}
                >
                  <colgroup>
                    <col style={{ width: CLIENT_WIDTH }} />
                    {COLUMNS.map((column) => (
                      <col key={column.key} style={{ width: column.width }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="bg-card border-line-strong caption-style text-subtle sticky left-0 z-[2] h-9 border-r border-b px-2.5 text-left font-normal">
                        Client
                      </th>
                      {COLUMNS.map((column) => (
                        <th
                          key={column.key}
                          className="bg-card border-line-strong caption-style text-subtle h-9 truncate border-b border-l px-2 text-center font-normal"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id} className="group">
                        <td className="bg-background group-hover:bg-secondary border-line-strong sticky left-0 z-[1] border-r border-b p-0">
                          <div className="flex items-center">
                            <TextCell
                              label="Client"
                              value={item.client}
                              className="font-medium"
                              onCommit={(client) =>
                                client && onSave(item.id, { client })
                              }
                            />
                            <button
                              type="button"
                              onClick={() => onOpen(item.id)}
                              className="caption-style text-subtle hover:text-foreground hover:bg-muted mr-1.5 shrink-0 cursor-pointer rounded-md px-1.5 py-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              Open
                            </button>
                          </div>
                        </td>
                        {COLUMNS.map((column) => (
                          <td
                            key={column.key}
                            className="border-line-strong border-b border-l p-0 group-hover:bg-white/[0.02]"
                          >
                            {column.render(item, (patch) =>
                              onSave(item.id, patch),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td
                        colSpan={COLUMNS.length + 1}
                        className="bg-background p-0"
                      >
                        <AddRow
                          onAdd={(client) => onAdd(client, group.value)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AddRow({ onAdd }: { onAdd: (client: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="Add a client"
      placeholder="+ Add client"
      value={value}
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

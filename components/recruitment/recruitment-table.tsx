import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import StatusTag from "./status-tag";
import { formatDate } from "@/lib/leads";
import { monthLabel, sourceLabel, type Recruitment } from "@/lib/recruitment";

export default function RecruitmentTable({
  items,
  selectedId,
  onOpen,
}: {
  items: Recruitment[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-subtle px-4 py-12 text-center">
        No recruitments match this view.
      </p>
    );
  }

  return (
    <Table className="min-w-[60em]">
      <TableHeader className="bg-background sticky top-0 z-10">
        <TableRow>
          <TableHead className="pl-4">Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Est. start</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Shortlist</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="pr-4">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.id}
            data-selected={item.id === selectedId}
            className="cursor-pointer hover:bg-white/3 data-[selected=true]:bg-white/5"
            onClick={() => onOpen(item.id)}
          >
            <TableCell className="max-w-[16em] pl-4">
              <button
                type="button"
                className="block max-w-full truncate text-left font-medium outline-none focus-visible:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(item.id);
                }}
              >
                {item.client}
              </button>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-1.5">
                <StatusTag status={item.status} />
                {item.left_status === "withdrawn" && (
                  <StatusTag status="leaver" label="Withdrawn" />
                )}
              </span>
            </TableCell>
            <TableCell>{monthLabel(item.est_start_month)}</TableCell>
            <TableCell>{sourceLabel(item.source)}</TableCell>
            <TableCell>
              {item.shortlist_count ?? "—"}
              {item.shortlist_delivery && (
                <span className="caption-style text-subtle ml-1.5">
                  {formatDate(item.shortlist_delivery)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-soft max-w-[24em] truncate">
              {item.notes ?? "—"}
            </TableCell>
            <TableCell className="pr-4">
              {formatDate(item.updated_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

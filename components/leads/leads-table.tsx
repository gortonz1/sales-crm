import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import Tag from "@/components/_ui/tag";
import StageTag from "./stage-tag";
import { daysSince, enquiryTypeLabel, formatDate, type Lead } from "@/lib/leads";
import { cn } from "@/lib/utils";

export default function LeadsTable({
  leads,
  stageLabels,
  selectedId,
  onOpen,
}: {
  leads: Lead[];
  stageLabels: Record<string, string>;
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  if (leads.length === 0) {
    return (
      <p className="text-subtle px-4 py-12 text-center">
        No leads match this view.
      </p>
    );
  }

  return (
    <Table className="min-w-[56em]">
      <TableHeader className="bg-background sticky top-0 z-10">
        <TableRow>
          <TableHead className="pl-4">Name</TableHead>
          <TableHead>Organisation</TableHead>
          <TableHead>Enquiry</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Received</TableHead>
          <TableHead className="pr-4">At stage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow
            key={lead.id}
            data-selected={lead.id === selectedId}
            className={cn(
              "cursor-pointer hover:bg-white/3 data-[selected=true]:bg-white/5",
              !lead.active && "text-subtle",
            )}
            onClick={() => onOpen(lead.id)}
          >
            <TableCell className="max-w-[16em] pl-4">
              <button
                type="button"
                className="block max-w-full truncate text-left font-medium outline-none focus-visible:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(lead.id);
                }}
              >
                {lead.name}
              </button>
              <span className="caption-style text-subtle block truncate">
                {lead.email}
              </span>
            </TableCell>
            <TableCell className="max-w-[14em] truncate">
              {lead.organisation ?? "—"}
            </TableCell>
            <TableCell>{enquiryTypeLabel(lead.enquiry_type)}</TableCell>
            <TableCell>
              <span className="flex items-center gap-1.5">
                <StageTag
                  stage={lead.stage}
                  label={stageLabels[lead.stage] ?? lead.stage}
                />
                {!lead.active && (
                  <Tag tone="neutral" size="sm" className="text-[12px]">
                    Gone cold
                  </Tag>
                )}
              </span>
            </TableCell>
            <TableCell>{formatDate(lead.submitted_at)}</TableCell>
            <TableCell className="pr-4">
              {daysSince(lead.stage_changed_at)}d
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

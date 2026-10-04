import Tag from "@/components/_ui/tag";
import { statusColor, statusLabel } from "@/lib/recruitment";

export default function StatusTag({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <Tag tone="neutral" size="sm" className="gap-1.5 text-[12px]">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: statusColor(status) }}
      />
      {label ?? statusLabel(status)}
    </Tag>
  );
}

import Tag from "@/components/_ui/tag";
import { COLD_COLOR, stageColor } from "@/lib/leads";

export default function StageTag({
  stage,
  label,
}: {
  stage: string;
  label: string;
}) {
  return (
    <Tag tone="neutral" size="sm" className="gap-1.5 text-[12px]">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{
          backgroundColor: stage === "cold" ? COLD_COLOR : stageColor(stage),
        }}
      />
      {label}
    </Tag>
  );
}

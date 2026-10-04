import Tag from "@/components/_ui/tag";
import { stageTone } from "@/lib/leads";

export default function StageTag({
  stage,
  label,
}: {
  stage: string;
  label: string;
}) {
  return (
    <Tag tone={stageTone(stage)} size="sm" className="text-[12px]">
      {label}
    </Tag>
  );
}

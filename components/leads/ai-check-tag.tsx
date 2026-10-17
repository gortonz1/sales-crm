import Tag from "@/components/_ui/tag";
import { isCheckOpen, type Lead } from "@/lib/leads";
import { cn } from "@/lib/utils";

const TAGS: Record<
  string,
  { label: string; tone: "green" | "red" | "amber" | "neutral" }
> = {
  queued: { label: "Checking…", tone: "neutral" },
  running: { label: "Checking…", tone: "neutral" },
  genuine: { label: "Looks genuine", tone: "green" },
  "not-genuine": { label: "Not genuine", tone: "red" },
  unsure: { label: "Unsure", tone: "amber" },
  failed: { label: "Check failed", tone: "neutral" },
};

export const showsAiCheck = (lead: Pick<Lead, "ai_check" | "stage">) =>
  isCheckOpen(lead) ||
  (lead.ai_check !== null && lead.stage === "new") ||
  (lead.ai_check === "not-genuine" && lead.stage === "not-a-lead");

export default function AiCheckTag({
  lead,
  className,
}: {
  lead: Pick<Lead, "ai_check" | "ai_reason">;
  className?: string;
}) {
  const tag = lead.ai_check ? TAGS[lead.ai_check] : undefined;
  if (!tag) return null;
  return (
    <Tag
      tone={tag.tone}
      size="sm"
      title={lead.ai_reason ?? undefined}
      className={cn("h-[18px] text-[11px]", className)}
    >
      {tag.label}
    </Tag>
  );
}

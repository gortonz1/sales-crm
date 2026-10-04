import type { Tables } from "@/lib/supabase/database.types";
import type { Option } from "@/lib/recruitment";

export type Lead = Tables<"leads">;
export type LeadStage = Tables<"lead_stages">;
export type LeadActivity = Tables<"lead_activities">;

export const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  employer: "Employer",
  "ai-level-4": "AI in Marketing L4",
  apprentice: "Apprentice",
  funding: "Funding & levy",
  other: "Other",
};

export const enquiryTypeLabel = (value: string | null) =>
  value ? (ENQUIRY_TYPE_LABELS[value] ?? value) : "—";

export const AI_COURSE_ENQUIRY = "ai-level-4";

export const INTEREST_OPTIONS: (Option & { color: string })[] = [
  { value: "potential", label: "Potential", color: "#eab308" },
  { value: "solid", label: "Solid", color: "#16803c" },
];

const DAY_MS = 86_400_000;

export function daysSince(iso: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) =>
  dateTimeFormat.format(new Date(iso));

export function matchesSearch(lead: Lead, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [lead.name, lead.email, lead.organisation, lead.phone, lead.message]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

export const GENUINE = "genuine";
export const ALL = "all";

export const PIPELINE_STAGE_IDS = [
  "genuine-lead",
  "contacted",
  "meeting-booked",
  "recruiting",
  "started",
];

export const isGenuine = (lead: Pick<Lead, "stage">) =>
  PIPELINE_STAGE_IDS.includes(lead.stage);

export function filterByStage(leads: Lead[], filter: string) {
  if (filter === ALL) return leads;
  if (filter === GENUINE) return leads.filter(isGenuine);
  return leads.filter((lead) => lead.stage === filter);
}

export const STAGE_COLORS: Record<string, string> = {
  new: "#6b6b6b",
  "genuine-lead": "#4c8df6",
  contacted: "#d9480f",
  "meeting-booked": "#eab308",
  recruiting: "#65d38a",
  started: "#16803c",
  "not-a-lead": "#3a3a3a",
};

export const COLD_COLOR = "#ef4444";

export const UNRECORDED = "unrecorded";

export const stageColor = (stage: string) =>
  STAGE_COLORS[stage] ?? STAGE_COLORS.new;

export type TimelineEvent = Pick<
  LeadActivity,
  "lead_id" | "kind" | "from_stage" | "to_stage" | "body" | "created_at"
>;

export type TimelineSegment = {
  stage: string;
  start: number;
  end: number;
};

export type LeadTimeline = {
  segments: TimelineSegment[];
  coldAt: number | null;
};

export function buildTimeline(
  lead: Lead,
  events: TimelineEvent[],
  now = Date.now(),
): LeadTimeline {
  const submitted = new Date(lead.submitted_at).getTime();
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const marks: { stage: string; at: number }[] = [];
  let coldAt: number | null = null;

  for (const event of sorted) {
    const at = Math.max(submitted, new Date(event.created_at).getTime());
    if (event.kind === "received" || event.kind === "imported") {
      const stage = event.to_stage ?? "new";
      if (event.kind === "imported" && stage !== "new" && at > submitted) {
        marks.push({ stage: UNRECORDED, at: submitted });
      }
      marks.push({ stage, at });
    } else if (event.kind === "stage" && event.to_stage) {
      marks.push({ stage: event.to_stage, at });
    } else if (event.kind === "active") {
      coldAt = event.body === "Marked no longer active" ? at : null;
    }
  }

  if (marks.length === 0) marks.push({ stage: lead.stage, at: submitted });
  if (marks[0].at > submitted)
    marks.unshift({ stage: UNRECORDED, at: submitted });

  if (!lead.active && coldAt === null) {
    coldAt = Math.max(submitted, new Date(lead.stage_changed_at).getTime());
  }
  if (lead.active) coldAt = null;
  const end = coldAt ?? now;

  const segments: TimelineSegment[] = [];
  marks.forEach((mark, i) => {
    const next = i + 1 < marks.length ? marks[i + 1].at : end;
    const isLast = i === marks.length - 1;
    const segEnd = Math.min(next, end);
    if (segEnd <= mark.at && !(isLast && mark.at <= end)) return;
    const last = segments[segments.length - 1];
    if (last && last.stage === mark.stage) last.end = segEnd;
    else
      segments.push({
        stage: mark.stage,
        start: mark.at,
        end: Math.max(segEnd, mark.at),
      });
  });

  if (segments.length === 0) {
    segments.push({
      stage: lead.stage,
      start: submitted,
      end: Math.max(end, submitted + 1),
    });
  }

  return { segments, coldAt };
}

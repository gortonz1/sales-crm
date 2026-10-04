import type { TagTone } from "@/data/companies";
import type { Tables } from "@/lib/supabase/database.types";

export type Lead = Tables<"leads">;
export type LeadStage = Tables<"lead_stages">;
export type LeadActivity = Tables<"lead_activities">;

export const STAGE_TONES: Record<string, TagTone> = {
  new: "blue",
  "genuine-lead": "purple",
  contacted: "amber",
  "meeting-booked": "orange",
  recruiting: "teal",
  started: "green",
  "not-a-lead": "neutral",
};

export const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  employer: "Employer",
  "ai-level-4": "AI in Marketing L4",
  apprentice: "Apprentice",
  funding: "Funding & levy",
  other: "Other",
};

export const enquiryTypeLabel = (value: string | null) =>
  value ? (ENQUIRY_TYPE_LABELS[value] ?? value) : "—";

export const stageTone = (stage: string): TagTone =>
  STAGE_TONES[stage] ?? "neutral";

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

export const ALL_OPEN = "open";

export function filterByStage(leads: Lead[], filter: string) {
  if (filter === ALL_OPEN) {
    return leads.filter((lead) => lead.stage !== "not-a-lead");
  }
  return leads.filter((lead) => lead.stage === filter);
}

import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";

export type Recruitment = Tables<"recruitments">;
export type RecruitmentPatch = TablesUpdate<"recruitments">;

type Option = { value: string; label: string };

export const RECRUITMENT_STATUSES: (Option & { color: string })[] = [
  { value: "ad-not-live", label: "Ad not live", color: "#6b6b6b" },
  { value: "working-on", label: "Working on", color: "#4c8df6" },
  { value: "shortlisted", label: "Shortlisted", color: "#d9480f" },
  { value: "interviewing", label: "Interviewing", color: "#eab308" },
  { value: "completed", label: "Completed", color: "#65d38a" },
  { value: "signed-up", label: "Signed up", color: "#16803c" },
  { value: "unsure", label: "Unsure", color: "#9d7cf0" },
  { value: "dead", label: "Dead", color: "#ef4444" },
  { value: "leaver", label: "Leaver", color: "#b91c1c" },
];

export const PIPELINE_STATUSES = [
  "working-on",
  "shortlisted",
  "interviewing",
  "completed",
  "signed-up",
];

export const RECRUITMENT_GROUPS: Option[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "limbo", label: "Limbo" },
  { value: "dead", label: "Dead" },
];

export const SOURCES: Option[] = [
  { value: "website", label: "Website / LLM" },
  { value: "andy", label: "Andy" },
  { value: "mitch", label: "Mitch" },
  { value: "repeat", label: "Repeat" },
  { value: "referral", label: "Referral" },
  { value: "email-marketing", label: "Email marketing" },
];

export const MONTHS: Option[] = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]
  .map((value) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
  }))
  .concat({ value: "unknown", label: "Unknown" });

export const LEFT_STATUSES: Option[] = [
  { value: "shaky", label: "Shaky" },
  { value: "done", label: "Done" },
  { value: "withdrawn", label: "Withdrawn" },
];

export const PAPERWORK_STATUSES: Option[] = [
  { value: "working", label: "Working on it" },
  { value: "done", label: "Done" },
  { value: "stuck", label: "Stuck" },
];

export const CONTRACT_STATUSES: Option[] = [
  { value: "legacy", label: "Legacy" },
  { value: "done", label: "Done" },
  { value: "stuck", label: "Stuck" },
];

export const ALL_GROUPS = "all";

const label = (options: Option[], value: string | null) =>
  value ? (options.find((o) => o.value === value)?.label ?? value) : "—";

export const statusLabel = (value: string) =>
  label(RECRUITMENT_STATUSES, value);
export const statusColor = (value: string) =>
  RECRUITMENT_STATUSES.find((s) => s.value === value)?.color ?? "#6b6b6b";
export const sourceLabel = (value: string | null) => label(SOURCES, value);
export const monthLabel = (value: string | null) => label(MONTHS, value);

export function matchesRecruitmentSearch(item: Recruitment, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.client, item.contact, item.notes, item.interviewees]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

export function filterByGroup(items: Recruitment[], group: string) {
  return group === ALL_GROUPS
    ? items
    : items.filter((item) => item.board_group === group);
}

export function boardStatuses(items: Recruitment[]) {
  const present = new Set(items.map((item) => item.status));
  return RECRUITMENT_STATUSES.filter(
    (s) => PIPELINE_STATUSES.includes(s.value) || present.has(s.value),
  );
}

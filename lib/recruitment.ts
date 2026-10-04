import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";

export type Recruitment = Tables<"recruitments">;
export type RecruitmentPatch = TablesUpdate<"recruitments">;

export type Option = { value: string; label: string; color?: string };

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

export const RECRUITMENT_GROUPS: (Option & { color: string })[] = [
  { value: "active", label: "Active", color: "#4c8df6" },
  { value: "completed", label: "Completed", color: "#16803c" },
  { value: "limbo", label: "Limbo", color: "#eab308" },
  { value: "dead", label: "Dead", color: "#ef4444" },
];

export const SOURCES: Option[] = [
  { value: "website", label: "Website / LLM", color: "#579bfc" },
  { value: "andy", label: "Andy", color: "#2f9e66" },
  { value: "mitch", label: "Mitch", color: "#d9822b" },
  { value: "repeat", label: "Repeat", color: "#8b5cf6" },
  { value: "referral", label: "Referral", color: "#0e7490" },
  { value: "email-marketing", label: "Email marketing", color: "#c026d3" },
];

export const LEFT_STATUSES: Option[] = [
  { value: "shaky", label: "Shaky", color: "#d97706" },
  { value: "done", label: "Done", color: "#16803c" },
  { value: "withdrawn", label: "Withdrawn", color: "#ef4444" },
];

export const PAPERWORK_STATUSES: Option[] = [
  { value: "working", label: "Working on it", color: "#eab308" },
  { value: "done", label: "Done", color: "#16803c" },
  { value: "stuck", label: "Stuck", color: "#ef4444" },
];

export const CONTRACT_STATUSES: Option[] = [
  { value: "legacy", label: "Legacy", color: "#d97706" },
  { value: "done", label: "Done", color: "#16803c" },
  { value: "stuck", label: "Stuck", color: "#ef4444" },
];

export const ALL_GROUPS = "all";

const label = (options: Option[], value: string | null) =>
  value ? (options.find((o) => o.value === value)?.label ?? value) : "—";

export const statusLabel = (value: string) =>
  label(RECRUITMENT_STATUSES, value);
export const statusColor = (value: string) =>
  RECRUITMENT_STATUSES.find((s) => s.value === value)?.color ?? "#6b6b6b";
export const sourceLabel = (value: string | null) => label(SOURCES, value);

export function readableText(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#161616" : "#ffffff";
}

export function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export const monthKey = (date: Date) => date.toISOString().slice(0, 10);

const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const longMonthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const formatMonth = (key: string | null) =>
  key ? monthFormat.format(new Date(`${key}T00:00:00Z`)) : "—";
export const formatLongMonth = (key: string) =>
  longMonthFormat.format(new Date(`${key}T00:00:00Z`));

export function monthOptions(current: string | null, now = new Date()) {
  const base = monthStart(now);
  const keys = Array.from({ length: 19 }, (_, i) =>
    monthKey(addMonths(base, i - 6)),
  );
  if (current && !keys.includes(current)) keys.push(current);
  return keys
    .sort()
    .map((value) => ({ value, label: formatMonth(value) }) as Option);
}

export function forecastMonths(now = new Date()) {
  const base = monthStart(now);
  return Array.from({ length: 7 }, (_, i) => monthKey(addMonths(base, i - 3)));
}

export const isForecastable = (item: Recruitment) =>
  item.board_group !== "dead" &&
  item.status !== "dead" &&
  item.status !== "leaver";

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

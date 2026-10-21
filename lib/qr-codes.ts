import type { Tables } from "@/lib/supabase/database.types";
import { slugify } from "@/lib/utils";

export type QrCode = Tables<"qr_codes">;
export type QrCodeOption = Pick<QrCode, "id" | "name" | "slug">;

export type QrTotals = {
  scans: number;
  visitors: number;
  leads: number;
  last_scan_at: string | null;
};

export type QrBreakdown = { label: string; scans: number };

export type QrReport = {
  daily: { day: string; scans: number; visitors: number }[];
  devices: QrBreakdown[];
  systems: QrBreakdown[];
  countries: QrBreakdown[];
};

export const QR_PATH = "/q";
export const QR_SOURCE = "qr";
export const QR_MEDIUM = "qr-code";
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
export const REPORT_DAYS = 30;

export const EMPTY_TOTALS: QrTotals = {
  scans: 0,
  visitors: 0,
  leads: 0,
  last_scan_at: null,
};

export const DEVICE_LABELS: Record<string, string> = {
  mobile: "Phone",
  tablet: "Tablet",
  desktop: "Computer",
  other: "Other",
};

export function totalsById(
  rows: ({ qr_code_id: string } & QrTotals)[],
): Record<string, QrTotals> {
  return Object.fromEntries(
    rows.map(({ qr_code_id, ...stats }) => [
      qr_code_id,
      {
        scans: Number(stats.scans),
        visitors: Number(stats.visitors),
        leads: Number(stats.leads),
        last_scan_at: stats.last_scan_at,
      },
    ]),
  );
}

export function suggestSlug(name: string) {
  return slugify(name).replace(/_/g, "-").slice(0, 48).replace(/-+$/, "");
}

export const QR_DOMAIN_PINNED = Boolean(
  process.env.NEXT_PUBLIC_QR_BASE_URL?.trim(),
);

export function qrBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_QR_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return typeof window === "undefined" ? "" : window.location.origin;
}

export const qrLink = (slug: string, base = qrBaseUrl()) =>
  `${base}${QR_PATH}/${slug}`;

export function isWebAddress(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function taggedDestination(
  destination: string,
  slug: string,
  tagLinks: boolean,
) {
  if (!tagLinks) return destination;
  const url = new URL(destination);
  url.searchParams.set("utm_source", QR_SOURCE);
  url.searchParams.set("utm_medium", QR_MEDIUM);
  url.searchParams.set("utm_campaign", slug);
  return url.toString();
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|slack|discord|skype|curl|wget|python|httpclient|headless|lighthouse|monitor|uptime/i;

export const isBot = (userAgent: string) =>
  !userAgent.trim() || BOT_PATTERN.test(userAgent);

export function deviceOf(userAgent: string) {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(userAgent))
    return "tablet";
  if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(userAgent))
    return "mobile";
  if (/Windows|Macintosh|X11|CrOS|Linux/i.test(userAgent)) return "desktop";
  return "other";
}

export function systemOf(userAgent: string) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/CrOS/i.test(userAgent)) return "ChromeOS";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return null;
}

const countryNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

export function countryName(code: string) {
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

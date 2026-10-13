import { AutomationError } from "@/lib/automation-error";
import { SMS_MAX_CHARS } from "@/lib/automations";

const RESEND_URL = "https://api.resend.com/emails";
const TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts";
const REQUEST_TIMEOUT_MS = 30_000;
const UK_COUNTRY_CODE = "44";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailConfigured = () =>
  Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim(),
  );

export const smsConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (process.env.TWILIO_FROM?.trim() ||
      process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()),
  );

export function normaliseEmail(value: string) {
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function toE164(value: string, countryCode = UK_COUNTRY_CODE) {
  let digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) {
    const rest = digits.slice(1).replace(/\D/g, "");
    return /^\d{7,15}$/.test(rest) ? `+${rest}` : null;
  }
  if (digits.startsWith("0")) digits = `${countryCode}${digits.slice(1)}`;
  else if (!digits.startsWith(countryCode)) digits = `${countryCode}${digits}`;
  return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
}

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const textToHtml = (text: string) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(text)}</div>`;

async function readError(response: Response) {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    const message = data.message ?? data.error ?? data.detail;
    if (typeof message === "string" && message) return message;
  } catch {}
  return `${response.status} ${response.statusText}`.trim();
}

async function post(url: string, init: RequestInit, service: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AutomationError(
      `Couldn't reach the ${service} service. It will be retried.`,
      true,
    );
  }
  if (!response.ok) {
    const detail = await readError(response);
    if (response.status === 429 || response.status >= 500)
      throw new AutomationError(
        `The ${service} service is busy (${detail}). It will be retried.`,
        true,
      );
    throw new AutomationError(`The ${service} service said: ${detail}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  const replyTo = process.env.RESEND_REPLY_TO?.trim();
  if (!key || !from)
    throw new AutomationError(
      "Email isn't set up: add RESEND_API_KEY and RESEND_FROM to the server.",
    );
  const data = await post(
    RESEND_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html: textToHtml(text),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    },
    "email",
  );
  return { id: typeof data.id === "string" ? data.id : "" };
}

export async function sendSms({ to, body }: { to: string; body: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (!sid || !token || (!from && !service))
    throw new AutomationError(
      "Texts aren't set up: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM to the server.",
    );
  const form = new URLSearchParams({
    To: to,
    Body: body.slice(0, SMS_MAX_CHARS),
  });
  if (service) form.set("MessagingServiceSid", service);
  else if (from) form.set("From", from);
  const data = await post(
    `${TWILIO_URL}/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
    "text message",
  );
  return { id: typeof data.sid === "string" ? data.sid : "" };
}

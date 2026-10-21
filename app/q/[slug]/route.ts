import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deviceOf, isBot, systemOf, taggedDestination } from "@/lib/qr-codes";
import type { Database } from "@/lib/supabase/database.types";

const NOT_FOUND_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>QR code not found</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px; font: 16px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; text-align: center; }
main { max-width: 26em; }
h1 { font-size: 20px; margin: 0 0 8px; }
p { margin: 0; opacity: 0.7; }
</style>
</head>
<body>
<main>
<h1>This QR code isn't in use any more</h1>
<p>Visit <a href="https://themarketingtrainer.co.uk">themarketingtrainer.co.uk</a> to find what you were looking for.</p>
</main>
</body>
</html>`;

const NO_STORE = { "Cache-Control": "no-store" };

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (forwarded ?? request.headers.get("x-real-ip") ?? "").trim() || null;
}

function clientCountry(request: NextRequest) {
  return (
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country-code")
  );
}

function isPrefetch(request: NextRequest) {
  const purpose =
    request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
  return /prefetch|prerender/i.test(purpose);
}

async function resolve(request: NextRequest, slug: string, counted: boolean) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const userAgent = request.headers.get("user-agent") ?? "";
  const { data, error } = await supabase.rpc("record_qr_scan", {
    code_slug: slug,
    visitor_ip: clientIp(request),
    user_agent: userAgent,
    device: deviceOf(userAgent),
    os: systemOf(userAgent),
    country: clientCountry(request),
    counted: counted && !isBot(userAgent) && !isPrefetch(request),
  });
  if (error) console.error(`QR scan for "${slug}" failed: ${error.message}`);
  const code = data?.[0];
  if (!code) {
    return new Response(NOT_FOUND_PAGE, {
      status: 404,
      headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE,
      Location: taggedDestination(code.destination, code.slug, code.tag_links),
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return resolve(request, slug, true);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return resolve(request, slug, false);
}

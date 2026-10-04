import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const MAX_BATCH = 200;

const secretKey = (() => {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) return JSON.parse(keys).default as string;
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
})();

const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = req.headers.get("x-crm-key");
  if (!key) return json({ error: "Missing x-crm-key header" }, 401);
  const keyHash = await sha256(key);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const leads = Array.isArray((body as { leads?: unknown }).leads)
    ? ((body as { leads: unknown[] }).leads)
    : [body];
  if (leads.length === 0) return json({ results: [] });
  if (leads.length > MAX_BATCH) {
    return json({ error: `At most ${MAX_BATCH} leads per request` }, 413);
  }

  const results = [];
  for (const lead of leads) {
    const { data, error } = await admin.rpc("ingest_website_lead", {
      lead,
      key_hash: keyHash,
    });
    if (error?.code === "28000") return json({ error: "Invalid key" }, 401);
    results.push(
      error
        ? { ok: false, external_id: (lead as { external_id?: string })?.external_id, error: error.message }
        : { ok: true, ...data },
    );
  }

  const failed = results.filter((r) => !r.ok).length;
  return json({ results, failed }, failed === results.length ? 400 : 200);
});

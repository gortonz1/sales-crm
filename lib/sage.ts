import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const AUTH_URL = "https://www.sageone.com/oauth2/auth/central";
const TOKEN_URL = "https://oauth.accounting.sage.com/token";
const API_BASE = "https://api.accounting.sage.com/v3.1";
const PAGE_SIZE = 200;

export const SAGE_STATE_COOKIE = "sage_oauth_state";

export type SageConfig = {
  clientId: string;
  clientSecret: string;
};

export function readSageConfig(
  env: NodeJS.ProcessEnv = process.env,
): SageConfig | null {
  const clientId = env.SAGE_CLIENT_ID?.trim();
  const clientSecret = env.SAGE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || url.host;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function sageRedirectUri(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const pinned = env.SAGE_REDIRECT_URI?.trim();
  if (pinned) return pinned;
  return new URL("/api/sage/callback", requestOrigin(req)).toString();
}

export function buildAuthorizeUrl(
  config: SageConfig,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    filter: "apiv3.1",
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: "readonly",
    state,
  }).toString();
  return url.toString();
}

export type SageTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string | null;
};

export class SageAuthError extends Error {}

type TokenGrant =
  | { grant_type: "authorization_code"; code: string; redirect_uri: string }
  | { grant_type: "refresh_token"; refresh_token: string };

export async function requestTokens(
  config: SageConfig,
  grant: TokenGrant,
  now = new Date(),
): Promise<SageTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      ...grant,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && /invalid_grant/i.test(body)) {
      throw new SageAuthError(
        `Sage rejected the token (${res.status}): ${body}`,
      );
    }
    throw new Error(`Sage token request failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Sage token response was missing a token");
  }

  return {
    accessToken: json.access_token,
    accessTokenExpiresAt: new Date(
      now.getTime() + ((json.expires_in ?? 300) - 30) * 1000,
    ).toISOString(),
    refreshToken: json.refresh_token,
    refreshTokenExpiresAt: json.refresh_token_expires_in
      ? new Date(
          now.getTime() + json.refresh_token_expires_in * 1000,
        ).toISOString()
      : null,
  };
}

const tokenKey = (config: SageConfig) =>
  createHash("sha256").update(`sage-tokens:${config.clientSecret}`).digest();

export function sealTokens(tokens: SageTokens, config: SageConfig): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(config), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function openTokens(
  sealed: string,
  config: SageConfig,
): SageTokens | null {
  try {
    const raw = Buffer.from(sealed, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      tokenKey(config),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
    const tokens = JSON.parse(json) as Partial<SageTokens>;
    if (!tokens.accessToken || !tokens.refreshToken) return null;
    return {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt:
        tokens.accessTokenExpiresAt ?? new Date(0).toISOString(),
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt ?? null,
    };
  } catch {
    return null;
  }
}

type Query = Record<string, string | number | undefined>;

export async function sageGet<T>(
  accessToken: string,
  path: string,
  query: Query = {},
  businessId?: string | null,
): Promise<T> {
  const url = new URL(`${API_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  if (businessId) headers["X-Business"] = businessId;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sage ${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

type SagePage<T> = { $items?: T[]; $next?: string | null };

export async function sageGetAll<T>(
  accessToken: string,
  path: string,
  query: Query = {},
  {
    businessId,
    maxPages = 100,
  }: { businessId?: string | null; maxPages?: number } = {},
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await sageGet<SagePage<T> | T[]>(
      accessToken,
      path,
      { ...query, items_per_page: PAGE_SIZE, page },
      businessId,
    );
    const pageItems = Array.isArray(res) ? res : (res.$items ?? []);
    items.push(...pageItems);
    const hasNext = !Array.isArray(res) && Boolean(res.$next);
    if (!hasNext || pageItems.length === 0) return { items, truncated: false };
  }
  return { items, truncated: true };
}

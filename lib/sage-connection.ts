import {
  openTokens,
  requestTokens,
  SageAuthError,
  sageGet,
  sealTokens,
  type SageConfig,
  type SageTokens,
} from "@/lib/sage";
import { createClient } from "@/lib/supabase/server";

export type SageConnection = {
  businessId: string | null;
  businessName: string | null;
  refreshExpiresAt: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
};

type Stored = SageConnection & { tokens: string };

type Loaded =
  | { status: "locked" }
  | { status: "disconnected" }
  | { status: "connected"; stored: Stored };

const text = (value: unknown) => (typeof value === "string" ? value : null);

async function load(session: string): Promise<Loaded> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sage_load", { session });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { status: "locked" };
  }
  const row = data.connection;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { status: "disconnected" };
  }
  const tokens = text(row.tokens);
  if (!tokens) return { status: "disconnected" };
  return {
    status: "connected",
    stored: {
      tokens,
      businessId: text(row.business_id),
      businessName: text(row.business_name),
      refreshExpiresAt: text(row.refresh_expires_at),
      connectedAt: text(row.connected_at),
      connectedBy: text(row.connected_by),
    },
  };
}

export async function getSageConnection(
  session: string,
): Promise<
  | { status: "locked" }
  | { status: "disconnected" }
  | { status: "connected"; connection: SageConnection }
> {
  const loaded = await load(session);
  if (loaded.status !== "connected") return loaded;
  const {
    businessId,
    businessName,
    refreshExpiresAt,
    connectedAt,
    connectedBy,
  } = loaded.stored;
  return {
    status: "connected",
    connection: {
      businessId,
      businessName,
      refreshExpiresAt,
      connectedAt,
      connectedBy,
    },
  };
}

export async function connectSage(
  session: string,
  config: SageConfig,
  tokens: SageTokens,
): Promise<void> {
  type Business = { id?: string; displayed_as?: string; name?: string };
  let business: Business | undefined;
  try {
    const res = await sageGet<Business[] | { $items?: Business[] }>(
      tokens.accessToken,
      "businesses",
    );
    business = (Array.isArray(res) ? res : res.$items)?.[0];
  } catch (err) {
    console.warn("Sage connected but the business lookup failed", err);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sage_connect", {
    session,
    tokens: sealTokens(tokens, config),
    business_id: business?.id ?? null,
    business_name: business?.displayed_as ?? business?.name ?? null,
    refresh_expires_at: tokens.refreshTokenExpiresAt,
  });
  if (error)
    throw new Error(`Couldn't save the Sage connection: ${error.message}`);
}

export async function disconnectSage(session: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sage_disconnect", { session });
  return !error;
}

export class SageUnreadableError extends Error {}

let inflightRefresh: Promise<string> | null = null;

async function refresh(
  session: string,
  config: SageConfig,
  refreshToken: string,
): Promise<string> {
  try {
    const tokens = await requestTokens(config, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    const supabase = await createClient();
    const { error } = await supabase.rpc("sage_rotate", {
      session,
      tokens: sealTokens(tokens, config),
      refresh_expires_at: tokens.refreshTokenExpiresAt,
    });
    if (error) {
      throw new Error(
        `Couldn't store the refreshed Sage token: ${error.message}`,
      );
    }
    return tokens.accessToken;
  } catch (err) {
    if (err instanceof SageAuthError) await disconnectSage(session);
    throw err;
  }
}

export async function getSageAccess(
  session: string,
  config: SageConfig,
): Promise<
  | { status: "locked" | "disconnected" }
  | {
      status: "connected";
      accessToken: string;
      connection: SageConnection;
    }
> {
  const loaded = await load(session);
  if (loaded.status !== "connected") return loaded;
  const { tokens: sealed, ...connection } = loaded.stored;

  const tokens = openTokens(sealed, config);
  if (!tokens)
    throw new SageUnreadableError("The stored Sage login can't be read.");

  if (new Date(tokens.accessTokenExpiresAt).getTime() > Date.now()) {
    return { status: "connected", accessToken: tokens.accessToken, connection };
  }

  if (!inflightRefresh) {
    inflightRefresh = refresh(session, config, tokens.refreshToken).finally(
      () => {
        inflightRefresh = null;
      },
    );
  }
  return {
    status: "connected",
    accessToken: await inflightRefresh,
    connection,
  };
}

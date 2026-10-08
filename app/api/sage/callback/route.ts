import { timingSafeEqual } from "crypto";
import { clearCostsCache } from "@/lib/costs";
import { earningsSession } from "@/lib/earnings-session";
import {
  readSageConfig,
  requestOrigin,
  requestTokens,
  SAGE_STATE_COOKIE,
  sageRedirectUri,
} from "@/lib/sage";
import { connectSage } from "@/lib/sage-connection";

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function sameValue(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const back = (outcome: string, detail?: string) => {
    const url = new URL("/earnings", origin);
    url.searchParams.set("sage", outcome);
    if (detail) url.searchParams.set("detail", detail.slice(0, 200));
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        "Set-Cookie": `${SAGE_STATE_COOKIE}=; Path=/api/sage; Max-Age=0; HttpOnly; SameSite=Lax`,
      },
    });
  };

  const config = readSageConfig();
  if (!config) return back("error", "Sage isn't configured on this server.");

  const session = await earningsSession();
  if (!session) {
    return back(
      "error",
      "The earnings dashboard locked itself. Unlock it and connect again.",
    );
  }

  const params = new URL(req.url).searchParams;
  const sageError = params.get("error");
  if (sageError) {
    return back("error", params.get("error_description") || sageError);
  }

  const state = params.get("state") ?? "";
  const expected = readCookie(req, SAGE_STATE_COOKIE) ?? "";
  if (!state || !expected || !sameValue(state, expected)) {
    return back(
      "error",
      "The connection request expired or didn't match. Try again.",
    );
  }

  const code = params.get("code");
  if (!code) return back("error", "Sage didn't return an authorisation code.");

  try {
    const tokens = await requestTokens(config, {
      grant_type: "authorization_code",
      code,
      redirect_uri: sageRedirectUri(req),
    });
    await connectSage(session, config, tokens);
    clearCostsCache();
  } catch (err) {
    console.error("Sage connection failed", err);
    return back(
      "error",
      "Sage accepted the login but the connection couldn't be saved. Try again.",
    );
  }

  return back("connected");
}

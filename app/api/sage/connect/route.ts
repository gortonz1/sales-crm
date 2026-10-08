import { randomBytes } from "crypto";
import { earningsSession } from "@/lib/earnings-session";
import {
  buildAuthorizeUrl,
  readSageConfig,
  requestOrigin,
  SAGE_STATE_COOKIE,
  sageRedirectUri,
} from "@/lib/sage";
import { getSageConnection } from "@/lib/sage-connection";

export async function GET(req: Request) {
  const back = new URL("/earnings", requestOrigin(req));
  const config = readSageConfig();
  const session = await earningsSession();
  if (!config || !session) return Response.redirect(back, 302);

  const current = await getSageConnection(session);
  if (current.status === "locked") return Response.redirect(back, 302);

  const state = randomBytes(24).toString("hex");
  const secure = requestOrigin(req).startsWith("https:");
  return new Response(null, {
    status: 302,
    headers: {
      Location: buildAuthorizeUrl(config, sageRedirectUri(req), state),
      "Set-Cookie": `${SAGE_STATE_COOKIE}=${state}; Path=/api/sage; Max-Age=600; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { verifySession, createSessionCookie } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/callback"];
const BEXIO_TOKEN_URL = "https://auth.bexio.com/realms/bexio/protocol/openid-connect/token";

function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

async function tryRefresh(refreshToken: string): Promise<string | null> {
  const res = await fetch(BEXIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.BEXIO_CLIENT_ID!,
      client_secret: process.env.BEXIO_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await verifySession(req.headers.get("cookie"));

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  // Refresh proactif si le token expire dans moins de 60 secondes
  const exp = getTokenExp(session.access_token);
  const nowSec = Math.floor(Date.now() / 1000);
  if (exp && exp - nowSec < 60 && session.refresh_token) {
    const newToken = await tryRefresh(session.refresh_token);
    if (newToken) {
      const newCookieHeader = await createSessionCookie({ ...session, access_token: newToken });
      const response = NextResponse.next();
      response.headers.set("Set-Cookie", newCookieHeader);
      return response;
    }
    // Refresh échoué → forcer reconnexion
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

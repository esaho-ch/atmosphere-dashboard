import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/session";

const BEXIO_TOKEN_URL = "https://auth.bexio.com/realms/bexio/protocol/openid-connect/token";
const BEXIO_USERINFO_URL = "https://auth.bexio.com/realms/bexio/protocol/openid-connect/userinfo";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=access_denied", req.nextUrl.origin));
  }

  const clientId = process.env.BEXIO_CLIENT_ID!;
  const clientSecret = process.env.BEXIO_CLIENT_SECRET!;
  const redirectUri = process.env.BEXIO_REDIRECT_URI!;

  // Échange du code contre les tokens
  const tokenRes = await fetch(BEXIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/login?error=token_failed", req.nextUrl.origin));
  }

  const tokens = await tokenRes.json();

  // Récupération des infos utilisateur
  const userRes = await fetch(BEXIO_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = userRes.ok ? await userRes.json() : {};

  const cookie = await createSessionCookie({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    user_id: userInfo.user_id,
    company_id: userInfo.company_id,
    email: userInfo.email,
    name: userInfo.name || userInfo.preferred_username,
  });

  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  res.headers.set("Set-Cookie", cookie);
  return res;
}

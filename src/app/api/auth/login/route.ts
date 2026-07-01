import { NextResponse } from "next/server";

const BEXIO_AUTH_URL = "https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth";

const SCOPES = [
  "openid", "profile", "email",
  "kb_offer_show", "kb_offer_edit",
  "kb_order_show", "kb_order_edit",
  "kb_invoice_show", "kb_invoice_edit",
  "contact_show", "contact_edit",
  "article_show", "article_edit",
  "offline_access",
].join(" ");

export async function GET() {
  const clientId = process.env.BEXIO_CLIENT_ID;
  const redirectUri = process.env.BEXIO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "BEXIO_CLIENT_ID ou BEXIO_REDIRECT_URI manquant" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
  });

  return NextResponse.redirect(`${BEXIO_AUTH_URL}?${params}`);
}

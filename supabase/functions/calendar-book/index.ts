// Creates a Google Calendar event via Service Account + Domain-Wide Delegation
// Impersonates admin@branviq.com to send calendar invites to leads
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as b64encode } from "https://deno.land/std@0.208.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ── Google Service Account JWT auth ── */

async function getAccessToken(sa: { client_email: string; private_key: string }, impersonate?: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim: Record<string, unknown> = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  if (impersonate) claim.sub = impersonate;

  const enc = new TextEncoder();
  const toB64 = (obj: unknown) => b64encode(enc.encode(JSON.stringify(obj)));
  const unsigned = `${toB64(header)}.${toB64(claim)}`;

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );

  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(unsigned));
  const jwt = `${unsigned}.${b64encode(new Uint8Array(sig))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

/* ── main handler ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");

    const sa = JSON.parse(saJson);
    // Impersonate Branviq Workspace user for Domain-Wide Delegation
    const IMPERSONATE_EMAIL = "admin@branviq.com";
    const token = await getAccessToken(sa, IMPERSONATE_EMAIL);

    const body = await req.json();
    const { startIso, firstName, email, phone, calendarId = "admin@branviq.com", notes } = body;
    if (!startIso || !firstName || !email) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = new Date(startIso);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const event = {
      summary: `Branviq Vendor Call — ${firstName}`,
      description:
        `Hi ${firstName}! We'll call you to discuss joining Branviq.\n\n` +
        `📞 (866) 344-8881\n` +
        `🌐 branviq.com\n` +
        `📧 ${email}`,
      start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
      end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
      attendees: [
        { email: email, displayName: firstName },
      ],
    };

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`book failed [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true, eventId: data.id, htmlLink: data.htmlLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calendar-book error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

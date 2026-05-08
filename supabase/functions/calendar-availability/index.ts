// Returns available 30-min slots for the next 7 days, Mon-Fri 11:00-18:00 ET
// Uses Google Service Account (direct API)
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as b64encode } from "https://deno.land/std@0.208.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ── Google Service Account JWT auth ── */

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

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
    const token = await getAccessToken(sa);

    const url = new URL(req.url);
    const calendarId = url.searchParams.get("calendarId") || "alexbouch15@gmail.com";

    // Compute window: now -> +7 days (in UTC)
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const fbRes = await fetch(`https://www.googleapis.com/calendar/v3/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        timeZone: "America/New_York",
        items: [{ id: calendarId }],
      }),
    });

    const fbData = await fbRes.json();
    if (!fbRes.ok) throw new Error(`freeBusy failed [${fbRes.status}]: ${JSON.stringify(fbData)}`);

    const busy: { start: string; end: string }[] =
      fbData.calendars?.[calendarId]?.busy ?? [];
    const busyRanges = busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()]);

    // Build slots in ET (UTC-5/-4). We'll compute by iterating UTC and converting via Intl.
    const slots: { date: string; time: string; iso: string }[] = [];

    // Helper: get ET date parts for a UTC date
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
    });

    // Iterate days
    for (let d = 0; d < 8; d++) {
      const dayBase = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const parts = fmt.formatToParts(dayBase);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const yyyy = get("year"), mm = get("month"), dd = get("day");
      const wd = get("weekday");
      if (["Sat", "Sun"].includes(wd)) continue;

      for (let h = 11; h < 18; h++) {
        for (const m of [0, 30]) {
          const isoLocal = `${yyyy}-${mm}-${dd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
          const probe = new Date(`${isoLocal}Z`);
          const etParts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York", hour12: false,
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          }).formatToParts(probe);
          const etH = Number(etParts.find((p) => p.type === "hour")?.value);
          const offsetHours = h - etH;
          const slotUtc = new Date(probe.getTime() + offsetHours * 3600 * 1000);

          if (slotUtc.getTime() < now.getTime()) continue;
          if (slotUtc.getTime() > end.getTime()) continue;

          const slotEnd = slotUtc.getTime() + 30 * 60 * 1000;
          const overlaps = busyRanges.some(([bs, be]) => slotUtc.getTime() < be && slotEnd > bs);
          if (overlaps) continue;

          slots.push({
            date: `${yyyy}-${mm}-${dd}`,
            time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
            iso: slotUtc.toISOString(),
          });
        }
      }
    }

    return new Response(JSON.stringify({ slots }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("availability error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

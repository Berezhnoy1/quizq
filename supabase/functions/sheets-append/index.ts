// Append a submission row to Google Sheets CRM via Service Account
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as b64encode } from "https://deno.land/std@0.208.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ── helpers ── */

function formatDateMDY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function formatBookedCall(date: string | null, time: string | null): string {
  if (!date) return "";
  try {
    const iso = time ? `${date}T${time}` : `${date}T00:00:00`;
    const d = new Date(iso);
    const month = d.toLocaleString("en-US", { month: "long" });
    const day = d.getDate();
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${month} ${day}, ${year} ${hh}:${mm}`;
  } catch {
    return `${date} ${time ?? ""}`.trim();
  }
}

/* ── Google Service Account JWT auth ── */

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
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
// Sheet columns: A=Date, B=Name, C=Phone, D=Email, E=Areas, F=Team Size,
//                G=Booked Call, H=Status, I=Assigned To, J=New Note (manual),
//                K=Next Follow-up, L=Contact History

const SHEET_NAME = "Vendor Applications";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const SHEET_ID = Deno.env.get("GOOGLE_SHEETS_ID");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    if (!SHEET_ID) throw new Error("GOOGLE_SHEETS_ID not configured");

    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    const body = await req.json();
    // Support both camelCase and snake_case
    const firstName = body.firstName ?? body.first_name ?? "";
    const phone = body.phone ?? "";
    const email = body.email ?? "";
    const areas = Array.isArray(body.areas) ? body.areas.join("; ") : (body.areas ?? "");
    const teamSize = body.teamSize ?? body.team_size ?? "";
    const bookedDate = body.bookedDate ?? body.booked_date ?? null;
    const bookedTime = body.bookedTime ?? body.booked_time ?? null;

    // 12-column row matching CRM v3 structure
    const now = new Date();
    const dateStr = formatDateMDY(now);
    const row = [
      dateStr,                          // A: Date
      firstName,                        // B: Name
      phone,                            // C: Phone
      email,                            // D: Email
      areas,                            // E: Areas of Atlanta
      teamSize,                         // F: Team Size
      formatBookedCall(bookedDate, bookedTime), // G: Booked Call
      bookedDate ? "Booked" : "New",    // H: Status (auto-set)
      "",                               // I: Assigned To (manual)
      "",                               // J: New Note (manual input field)
      "",                               // K: Next Follow-up (manual)
      `${dateStr}: Quiz submitted`,     // L: Contact History (first entry)
    ];

    const API = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
    const authH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // Find last row with data by reading column A
    const readRes = await fetch(
      `${API}/values/${encodeURIComponent(SHEET_NAME)}!A:A?majorDimension=COLUMNS`,
      { headers: authH },
    );
    const readData = await readRes.json();
    if (!readRes.ok) throw new Error(`read failed [${readRes.status}]: ${JSON.stringify(readData)}`);

    const colA = readData.values?.[0] ?? [];
    let lastNonEmpty = 0;
    for (let i = 0; i < colA.length; i++) {
      if (colA[i] && String(colA[i]).trim() !== "") {
        lastNonEmpty = i + 1;
      }
    }
    const nextRow = Math.max(lastNonEmpty + 1, 2);

    // Write to exact row
    const writeRange = `${SHEET_NAME}!A${nextRow}:L${nextRow}`;
    const writeRes = await fetch(
      `${API}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: authH,
        body: JSON.stringify({ values: [row] }),
      },
    );
    const writeData = await writeRes.json();
    if (!writeRes.ok) throw new Error(`write failed [${writeRes.status}]: ${JSON.stringify(writeData)}`);

    return new Response(JSON.stringify({ ok: true, row: nextRow, range: writeRange }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sheets-append error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

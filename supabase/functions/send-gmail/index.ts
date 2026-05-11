// Sends HTML confirmation email to lead via Gmail API (Domain-Wide Delegation)
// Impersonates admin@branviq.com with gmail.send scope
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as b64encode } from "https://deno.land/std@0.208.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMPERSONATE = "admin@branviq.com";
const PHONE = "(866) 344-8881";

/* ── Service Account JWT + DWD ── */

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    sub: IMPERSONATE,
    scope: "https://www.googleapis.com/auth/gmail.send",
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

/* ── HTML email template ── */

function formatCallDate(date: string, time: string): string {
  try {
    const dt = new Date(`${date}T${time}:00`);
    return dt.toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
    });
  } catch {
    return date;
  }
}

function formatCallTime(time: string): string {
  try {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
  } catch {
    return time;
  }
}

function buildCalendarUrl(date: string, time: string, firstName: string): string {
  // Google Calendar event link: YYYYMMDDTHHMMSS format (no dashes/colons)
  try {
    const dt = new Date(`${date}T${time}:00`);
    const end = new Date(dt.getTime() + 30 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Branviq Vendor Call",
      dates: `${fmt(dt)}/${fmt(end)}`,
      details: `Branviq will call you at (866) 344-8881 to discuss joining.\n\nbranviq.com`,
      ctz: "America/New_York",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch {
    return "https://calendar.google.com";
  }
}

function buildHtml(firstName: string, bookedDate: string, bookedTime: string): string {
  const dateStr = formatCallDate(bookedDate, bookedTime);
  const timeStr = formatCallTime(bookedTime);
  const calUrl = buildCalendarUrl(bookedDate, bookedTime, firstName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your Branviq call is confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:540px;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a8a;padding:32px 32px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:0.3px;">Branviq</p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);letter-spacing:0.5px;">Appliance Repair Leads</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px 32px;">

              <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Hi ${firstName},</p>
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;line-height:1.3;">
                Your call is confirmed!
              </h1>

              <!-- Call details card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="border:1px solid #e5e7eb;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #f3f4f6;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:40px;vertical-align:top;">
                          <div style="width:36px;height:36px;background:#eff6ff;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">&#128197;</div>
                        </td>
                        <td style="vertical-align:top;padding-left:12px;">
                          <p style="margin:0 0 2px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Date &amp; Time</p>
                          <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${dateStr} at ${timeStr} ET</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width:40px;vertical-align:top;">
                          <div style="width:36px;height:36px;background:#eff6ff;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">&#128222;</div>
                        </td>
                        <td style="vertical-align:top;padding-left:12px;">
                          <p style="margin:0 0 2px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Phone</p>
                          <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">We'll call you at ${PHONE}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 20px;text-align:center;border-top:1px solid #f3f4f6;">
                    <a href="${calUrl}"
                      style="display:inline-block;background:#eff6ff;color:#1e3a8a;font-size:13px;font-weight:600;
                        text-decoration:none;padding:10px 24px;border-radius:8px;border:1px solid #dbeafe;">
                      &#128197; Add to My Calendar
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What to expect -->
              <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;">What to expect:</p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;" width="100%">
                <tr>
                  <td style="padding-bottom:14px;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:28px;vertical-align:top;">
                        <div style="width:24px;height:24px;background:#1e3a8a;border-radius:50%;font-size:12px;font-weight:700;color:#fff;text-align:center;line-height:24px;">1</div>
                      </td>
                      <td style="padding-left:10px;font-size:14px;color:#374151;line-height:24px;">We'll explain how Branviq works</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:14px;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:28px;vertical-align:top;">
                        <div style="width:24px;height:24px;background:#1e3a8a;border-radius:50%;font-size:12px;font-weight:700;color:#fff;text-align:center;line-height:24px;">2</div>
                      </td>
                      <td style="padding-left:10px;font-size:14px;color:#374151;line-height:24px;">Help you set up your account (~2 hrs)</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:28px;vertical-align:top;">
                        <div style="width:24px;height:24px;background:#1e3a8a;border-radius:50%;font-size:12px;font-weight:700;color:#fff;text-align:center;line-height:24px;">3</div>
                      </td>
                      <td style="padding-left:10px;font-size:14px;color:#374151;line-height:24px;">First leads in your area within 24-48 hrs</td>
                    </tr></table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="https://branviq.com" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" fillcolor="#1e3a8a">
                    <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Visit branviq.com</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="https://branviq.com"
                      style="display:inline-block;background:#1e3a8a;color:#ffffff;font-size:15px;font-weight:600;
                        text-decoration:none;padding:14px 48px;border-radius:10px;letter-spacing:0.2px;">
                      Visit branviq.com
                    </a>
                    <p style="margin:12px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                      Can't wait? You can create your account now at
                      <a href="https://app.branviq.com/register" style="color:#1e3a8a;font-weight:600;text-decoration:none;">app.branviq.com</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
                <a href="https://branviq.com" style="color:#1e3a8a;text-decoration:none;font-weight:600;">branviq.com</a>
                &nbsp;&middot;&nbsp;
                <a href="tel:+18663448881" style="color:#6b7280;text-decoration:none;">${PHONE}</a>
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;">Branviq - Appliance Repair Lead Generation</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── Build RFC 2822 raw message ── */

function encodeSubject(s: string): string {
  // RFC 2047 encoded-word for UTF-8 safety
  const encoded = btoa(unescape(encodeURIComponent(s)));
  return `=?UTF-8?B?${encoded}?=`;
}

function buildRawMessage(to: string, subject: string, html: string): string {
  const boundary = `boundary_${Date.now()}`;
  const mime = [
    `From: Branviq <${IMPERSONATE}>`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  // Gmail API requires URL-safe base64 without padding
  const raw = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return raw;
}

/* ── main handler ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);

    const body = await req.json();
    const firstName: string = body.firstName ?? body.first_name ?? "there";
    const email: string = body.email ?? "";
    const bookedDate: string = body.bookedDate ?? body.booked_date ?? "";
    const bookedTime: string = body.bookedTime ?? body.booked_time ?? "";

    if (!email) return new Response(JSON.stringify({ error: "email required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const token = await getAccessToken(sa);
    const subject = `Your Branviq call is confirmed - ${formatCallDate(bookedDate, bookedTime)} at ${formatCallTime(bookedTime)} ET`;
    const html = buildHtml(firstName, bookedDate, bookedTime);
    const raw = buildRawMessage(email, subject, html);

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      },
    );

    const gmailData = await gmailRes.json();
    if (!gmailRes.ok) throw new Error(`gmail send failed [${gmailRes.status}]: ${JSON.stringify(gmailData)}`);

    return new Response(JSON.stringify({ ok: true, messageId: gmailData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-gmail error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

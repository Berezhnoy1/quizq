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

function buildHtml(firstName: string, bookedDate: string, bookedTime: string): string {
  const dateStr = formatCallDate(bookedDate, bookedTime);
  const timeStr = formatCallTime(bookedTime);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your Branviq call is confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:36px 32px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Branviq</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;">

              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
                Your call is confirmed! ✅
              </h1>

              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
                Hi ${firstName},<br/>
                Thank you for your interest in joining Branviq. We're looking forward to speaking with you!
              </p>

              <!-- Call details card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f0f4ff;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <tr>
                  <td>
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#2563eb;letter-spacing:1.5px;text-transform:uppercase;">
                      Call Details
                    </p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <span style="font-size:18px;vertical-align:middle;">📅</span>
                          <span style="font-size:15px;font-weight:600;color:#111827;vertical-align:middle;margin-left:8px;">
                            ${dateStr} at ${timeStr} ET
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style="font-size:18px;vertical-align:middle;">📞</span>
                          <span style="font-size:15px;color:#374151;vertical-align:middle;margin-left:8px;">
                            We'll call you at <strong>${PHONE}</strong>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What to expect -->
              <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#111827;">What to expect on the call:</p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding-bottom:10px;vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background:#2563eb;border-radius:50%;
                      font-size:12px;font-weight:700;color:#fff;text-align:center;line-height:24px;margin-right:10px;">1</span>
                    <span style="font-size:14px;color:#374151;line-height:24px;">We'll explain how Branviq works</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:10px;vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background:#2563eb;border-radius:50%;
                      font-size:12px;font-weight:700;color:#fff;text-align:center;line-height:24px;margin-right:10px;">2</span>
                    <span style="font-size:14px;color:#374151;line-height:24px;">Help you set up your account (~2 hours)</span>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background:#2563eb;border-radius:50%;
                      font-size:12px;font-weight:700;color:#fff;text-align:center;line-height:24px;margin-right:10px;">3</span>
                    <span style="font-size:14px;color:#374151;line-height:24px;">First leads in your area within 24–48 hours</span>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://app.branviq.com/login"
                      style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;
                        text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                      Visit Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#6b7280;">
                <a href="https://branviq.com" style="color:#2563eb;text-decoration:none;font-weight:500;">branviq.com</a>
                &nbsp;|&nbsp;
                <a href="tel:+18663448881" style="color:#6b7280;text-decoration:none;">${PHONE}</a>
              </p>
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

function buildRawMessage(to: string, subject: string, html: string): string {
  const boundary = `boundary_${Date.now()}`;
  const mime = [
    `From: Branviq <${IMPERSONATE}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return b64encode(new TextEncoder().encode(mime));
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
    const subject = `Your Branviq call is confirmed — ${formatCallDate(bookedDate, bookedTime)} at ${formatCallTime(bookedTime)} ET`;
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

// Creates a Google Calendar event for the booked slot
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GCAL_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY_1");
    if (!LOVABLE_API_KEY || !GCAL_KEY) throw new Error("Missing API keys");

    const body = await req.json();
    const { startIso, firstName, email, phone, calendarId = "primary", notes } = body;
    if (!startIso || !firstName || !email) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = new Date(startIso);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const event = {
      summary: `Branviq Vendor Call — ${firstName}`,
      description: [
        `📞 BRANVIQ — Vendor Onboarding Call`,
        ``,
        `Hi ${firstName}! Thank you for your interest in joining Branviq.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 YOUR APPLICATION`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `• Phone: ${phone}`,
        `• Email: ${email}`,
        notes ? `• ${notes}` : "",
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 WHAT TO EXPECT ON THE CALL`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `1. We'll explain how Branviq works`,
        `2. Help you set up your account (~2 hrs)`,
        `3. First leads in your area within 24–48 hours`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📞 Can't wait? Call us: (866) 344-8881`,
        `🌐 branviq.com`,
      ].filter(Boolean).join("\n"),
      start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
      end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
      attendees: [{ email }],
    };

    const res = await fetch(
      `${GATEWAY_URL}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GCAL_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`book failed: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true, eventId: data.id, htmlLink: data.htmlLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("book error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Send Telegram notification for new submission
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY not configured");
    if (!CHAT_ID) throw new Error("TELEGRAM_CHAT_ID not configured");

    const body = await req.json();
    const { first_name, phone, email, areas, team_size, booked_date, booked_time } = body;

    const areasStr = Array.isArray(areas) ? areas.join("; ") : "";
    const callStr = booked_date
      ? `${booked_date} at ${booked_time ?? ""} ET`
      : "Not scheduled";

    const text =
      `🔔 New Vendor Application\n\n` +
      `👤 ${first_name ?? ""}\n` +
      `📞 ${phone ?? ""}\n` +
      `📧 ${email ?? ""}\n\n` +
      `📍 Areas: ${areasStr}\n` +
      `👥 Team: ${team_size ?? ""}\n\n` +
      `📅 Call: ${callStr}`;

    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`telegram failed [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-notify error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

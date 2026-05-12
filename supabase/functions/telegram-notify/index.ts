// Send Telegram notification for new submission
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHAT_ID = "-5268358973";
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

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

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
      },
    );
    const data = await res.json();
    if (!data.ok) throw new Error(`telegram failed: ${JSON.stringify(data)}`);

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

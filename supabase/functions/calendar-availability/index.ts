// Returns available 30-min slots for the next 7 days, Mon-Fri 11:00-18:00 ET
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

    const url = new URL(req.url);
    const calendarId = url.searchParams.get("calendarId") || "alexbouch15@gmail.com";

    // Compute window: now -> +7 days (in UTC)
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const fbRes = await fetch(`${GATEWAY_URL}/freeBusy`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GCAL_KEY,
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
    if (!fbRes.ok) throw new Error(`freeBusy failed: ${JSON.stringify(fbData)}`);

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
      // For each candidate slot 11:00..17:30 ET, build a UTC instant
      // Approach: pick day in ET via formatting then construct date string
      const parts = fmt.formatToParts(dayBase);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const yyyy = get("year"), mm = get("month"), dd = get("day");
      const wd = get("weekday"); // Mon, Tue...
      if (["Sat", "Sun"].includes(wd)) continue;

      for (let h = 11; h < 18; h++) {
        for (const m of [0, 30]) {
          // Build ET wall-clock time and find corresponding UTC instant by trial
          const isoLocal = `${yyyy}-${mm}-${dd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
          // ET offset: determine by formatting a known timestamp
          const probe = new Date(`${isoLocal}Z`);
          // Compute offset minutes between probe interpreted as UTC and same wall time in ET
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

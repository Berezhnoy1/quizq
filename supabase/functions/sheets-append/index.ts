// Append a submission row to Google Sheets
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SHEETS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    const SHEET_ID = Deno.env.get("GOOGLE_SHEETS_ID");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SHEETS_KEY) throw new Error("GOOGLE_SHEETS_API_KEY not configured");
    if (!SHEET_ID) throw new Error("GOOGLE_SHEETS_ID not configured");

    const body = await req.json();
    const { first_name, phone, email, areas, team_size, booked_date, booked_time } = body;

    const row = [
      formatDateMDY(new Date()),
      first_name ?? "",
      phone ?? "",
      email ?? "",
      Array.isArray(areas) ? areas.join("; ") : "",
      team_size ?? "",
      formatBookedCall(booked_date ?? null, booked_time ?? null),
    ];

    const range = "A:G";
    const url = `${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SHEETS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`sheets append failed [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sheets-append error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

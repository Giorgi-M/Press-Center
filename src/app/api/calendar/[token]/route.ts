import { createAdminClient } from "@/lib/supabase/server";

// Personal iCalendar feed: subscribe once in Google Calendar and shoots appear there.
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
}

function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// RFC 5545 lines must be folded at 75 octets.
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, "utf8") > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("id, active").eq("ics_token", token).maybeSingle();
  if (!profile?.active) return new Response("not found", { status: 404 });

  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  const { data: rows } = await db
    .from("event_assignments")
    .select("role:roles(name), event:events(*)")
    .eq("profile_id", profile.id);

  const appUrl = process.env.APP_URL ?? "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//press-center//ka",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:პრეს ცენტრი — ჩემი გადაღებები",
    "X-WR-TIMEZONE:Asia/Tbilisi",
  ];
  for (const row of rows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = row.event as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (row.role as any)?.name as string | undefined;
    if (!e || e.starts_at < since) continue;
    const desc = [
      role && `პოზიცია: ${role}`,
      e.travel_minutes && `გზაში: ~${e.travel_minutes} წთ`,
      e.contact_name && `საკონტაქტო: ${e.contact_name} ${e.contact_phone ?? ""}`,
      e.map_url,
      e.description,
      `${appUrl}/events/${e.id}`,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@press-center`,
      `DTSTAMP:${stamp(e.updated_at)}`,
      `DTSTART:${stamp(e.starts_at)}`,
      `DTEND:${stamp(e.ends_at)}`,
      `SUMMARY:${esc((e.status === "cancelled" ? "[გაუქმდა] " : "") + e.title)}`,
      e.location_name ? `LOCATION:${esc(e.location_name)}` : "",
      `DESCRIPTION:${esc(desc)}`,
      `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  const body = lines.filter(Boolean).map(fold).join("\r\n") + "\r\n";
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}

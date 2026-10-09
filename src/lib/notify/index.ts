import { createAdminClient } from "@/lib/supabase/server";
import { fmtDateTime, fmtDuration, fmtTime } from "@/lib/time";
import type { Profile, PressEvent } from "@/lib/types";
import {
  channelEnabled,
  sendEmail,
  sendSms,
  sendTelegram,
  sendWhatsapp,
  type Channel,
  type OutgoingMessage,
} from "./channels";

export type NotifyKind = "assigned" | "updated" | "cancelled" | "unassigned" | "reminder";

const HEADLINE: Record<NotifyKind, string> = {
  assigned: "თქვენ დაგნიშნეს გადაღებაზე",
  updated: "გადაღების დეტალები შეიცვალა",
  cancelled: "გადაღება გაუქმდა",
  unassigned: "თქვენ მოგხსნეს გადაღებიდან",
  reminder: "შეხსენება: მალე გადაღებაა",
};

export function composeMessage(
  kind: NotifyKind,
  event: PressEvent,
  position: string | null,
  teamLine: string | null,
): OutgoingMessage {
  const appUrl = process.env.APP_URL ?? "";
  const when = `${fmtDateTime(event.starts_at)}–${fmtTime(event.ends_at)}`;
  const place = event.location_name ?? "";
  const lines = [
    `${HEADLINE[kind]}: ${event.title}`,
    `🕒 ${when} (${fmtDuration(event.duration_minutes)})`,
    place && `📍 ${place}`,
    event.travel_minutes ? `🚗 გზაში: ~${fmtDuration(event.travel_minutes)}` : "",
    event.map_url && `🗺 ${event.map_url}`,
    position && `👤 თქვენი პოზიცია: ${position}`,
    event.contact_name && `☎️ საკონტაქტო: ${event.contact_name}${event.contact_phone ? `, ${event.contact_phone}` : ""}`,
    teamLine && `👥 ${teamLine}`,
    appUrl && `${appUrl}/events/${event.id}`,
  ].filter(Boolean);
  return {
    subject: `${HEADLINE[kind]}: ${event.title} (${fmtDateTime(event.starts_at)})`,
    body: lines.join("\n"),
    fields: { title: event.title, when, place, position: position ?? "" },
  };
}

function destination(p: Profile, c: Channel): string | null {
  switch (c) {
    case "email":
      return p.notify_email ? p.email : null;
    case "sms":
      return p.notify_sms ? p.phone : null;
    case "whatsapp":
      return p.notify_whatsapp ? (p.whatsapp ?? p.phone) : null;
    case "telegram":
      return p.notify_telegram ? p.telegram_chat_id : null;
  }
}

const CHANNELS: Channel[] = ["email", "sms", "whatsapp", "telegram"];

export type Recipient = { profile: Profile; position: string | null };

// Queue one row per recipient per configured channel, then try to send right away.
export async function notify(kind: NotifyKind, event: PressEvent, recipients: Recipient[], teamLine: string | null) {
  if (!recipients.length) return;
  const db = createAdminClient();
  const rows = recipients.flatMap(({ profile, position }) => {
    const msg = composeMessage(kind, event, position, teamLine);
    return CHANNELS.filter((c) => channelEnabled(c) && destination(profile, c)).map((channel) => ({
      profile_id: profile.id,
      event_id: event.id,
      channel,
      kind,
      subject: msg.subject,
      body: msg.body,
    }));
  });
  if (!rows.length) return;
  const { data, error } = await db.from("notifications").insert(rows).select("id");
  if (error) {
    console.error("notify: enqueue failed", error);
    return;
  }
  await processNotifications(data.map((r) => r.id));
}

const MAX_ATTEMPTS = 5;

// Send pending notifications (all of them, or just the given ids).
export async function processNotifications(ids?: string[]) {
  const db = createAdminClient();
  let q = db
    .from("notifications")
    .select("*, profile:profiles(*), event:events(*)")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(100);
  if (ids) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;

  let sent = 0;
  for (const n of data ?? []) {
    const profile = n.profile as Profile;
    const event = n.event as PressEvent | null;
    const to = destination(profile, n.channel);
    const msg: OutgoingMessage = {
      subject: n.subject,
      body: n.body,
      fields: event
        ? {
            title: event.title,
            when: `${fmtDateTime(event.starts_at)}–${fmtTime(event.ends_at)}`,
            place: event.location_name ?? "",
            position: "",
          }
        : { title: n.subject, when: "", place: "", position: "" },
    };
    try {
      if (!to) throw new Error("no destination");
      if (n.channel === "email") await sendEmail(to, msg);
      else if (n.channel === "sms") await sendSms(to, msg);
      else if (n.channel === "whatsapp") await sendWhatsapp(to, msg);
      else if (n.channel === "telegram") await sendTelegram(to, msg);
      await db
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts: n.attempts + 1 })
        .eq("id", n.id);
      sent++;
    } catch (e) {
      const attempts = n.attempts + 1;
      await db
        .from("notifications")
        .update({
          attempts,
          last_error: String(e instanceof Error ? e.message : e).slice(0, 1000),
          status: !to || attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        })
        .eq("id", n.id);
    }
  }
  return { processed: data?.length ?? 0, sent };
}

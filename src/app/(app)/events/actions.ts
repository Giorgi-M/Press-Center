"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEvent, teamLine } from "@/lib/events";
import { notify, type NotifyKind, type Recipient } from "@/lib/notify";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fromLocalInput } from "@/lib/time";
import type { Profile, PressEvent } from "@/lib/types";

export type Conflict = {
  profile_id: string;
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  travel_minutes: number;
};

export async function checkConflicts(
  startLocal: string,
  durationMinutes: number,
  travelMinutes: number,
  excludeEventId: string | null,
): Promise<Conflict[]> {
  await requireUser();
  if (!startLocal || !durationMinutes) return [];
  const start = new Date(fromLocalInput(startLocal));
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_conflicts", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_travel: travelMinutes || 0,
    p_exclude_event: excludeEventId,
  });
  if (error) throw error;
  return data as Conflict[];
}

type AssignmentInput = { profile_id: string; role_id: string | null };

function str(form: FormData, key: string) {
  const v = String(form.get(key) ?? "").trim();
  return v || null;
}

export async function saveEvent(_: unknown, form: FormData): Promise<{ error?: string }> {
  const me = await requireUser();
  const supabase = await createClient();
  const id = str(form, "id");

  const startLocal = str(form, "starts_at");
  const duration = Number(form.get("duration_minutes"));
  const title = str(form, "title");
  if (!title || !startLocal || !(duration > 0)) return { error: "შეავსეთ სათაური, დრო და ხანგრძლივობა" };

  const fields = {
    title,
    description: str(form, "description"),
    starts_at: fromLocalInput(startLocal),
    duration_minutes: duration,
    travel_minutes: Math.max(0, Number(form.get("travel_minutes")) || 0),
    location_name: str(form, "location_name"),
    map_url: str(form, "map_url"),
    contact_name: str(form, "contact_name"),
    contact_phone: str(form, "contact_phone"),
  };

  let assignments: AssignmentInput[] = [];
  try {
    assignments = JSON.parse(String(form.get("assignments") ?? "[]"));
  } catch {
    return { error: "გუნდის სია დაზიანებულია" };
  }
  // one row per person
  assignments = [...new Map(assignments.filter((a) => a.profile_id).map((a) => [a.profile_id, a])).values()];

  const before = id ? await getEvent(supabase, id) : null;
  if (id && !before) return { error: "გადაღება ვერ მოიძებნა" };

  let eventId = id;
  if (before) {
    const canEdit = me.can("events.edit_all") || (before.created_by === me.profile.id && me.can("events.create"));
    if (!canEdit) return { error: "ამ გადაღების რედაქტირების უფლება არ გაქვთ" };
    const { error } = await supabase.from("events").update(fields).eq("id", before.id);
    if (error) return { error: error.message };
  } else {
    if (!me.can("events.create")) return { error: "გადაღების შექმნის უფლება არ გაქვთ" };
    const { data, error } = await supabase
      .from("events")
      .insert({ ...fields, created_by: me.profile.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    eventId = data.id;
  }

  // Location photo
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 10 * 1024 * 1024) return { error: "ფოტო 10 MB-ზე დიდია" };
    const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${eventId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("location-photos").upload(path, photo, { contentType: photo.type });
    if (error) return { error: `ფოტო ვერ აიტვირთა: ${error.message}` };
    if (before?.location_photo_path) await supabase.storage.from("location-photos").remove([before.location_photo_path]);
    await supabase.from("events").update({ location_photo_path: path }).eq("id", eventId);
  } else if (form.get("remove_photo") === "1" && before?.location_photo_path) {
    await supabase.storage.from("location-photos").remove([before.location_photo_path]);
    await supabase.from("events").update({ location_photo_path: null }).eq("id", eventId);
  }

  // Assignments: diff against what was there
  const oldByProfile = new Map((before?.assignments ?? []).map((a) => [a.profile_id, a]));
  const newByProfile = new Map(assignments.map((a) => [a.profile_id, a]));
  const removed = [...oldByProfile.keys()].filter((p) => !newByProfile.has(p));
  const added = assignments.filter((a) => !oldByProfile.has(a.profile_id));
  const changedRole = assignments.filter(
    (a) => oldByProfile.has(a.profile_id) && oldByProfile.get(a.profile_id)!.role_id !== a.role_id,
  );

  if (removed.length || added.length || changedRole.length) {
    if (!me.can("events.assign")) return { error: "თანამშრომლების დანიშვნის უფლება არ გაქვთ" };
    if (removed.length) {
      const { error } = await supabase
        .from("event_assignments")
        .delete()
        .eq("event_id", eventId)
        .in("profile_id", removed);
      if (error) return { error: error.message };
    }
    if (added.length || changedRole.length) {
      const { error } = await supabase
        .from("event_assignments")
        .upsert(
          [...added, ...changedRole].map((a) => ({ event_id: eventId, profile_id: a.profile_id, role_id: a.role_id })),
          { onConflict: "event_id,profile_id" },
        );
      if (error) return { error: error.message };
    }
  }

  // Notifications
  const after = (await getEvent(supabase, eventId!))!;
  const detailsChanged =
    !!before &&
    (["title", "duration_minutes", "travel_minutes", "location_name", "map_url", "contact_name", "contact_phone"] as const).some(
      (k) => String(before[k] ?? "") !== String(after[k] ?? ""),
    ) ||
    (!!before && new Date(before.starts_at).getTime() !== new Date(after.starts_at).getTime());

  if (after.status !== "cancelled") {
    const keptIds = assignments.filter((a) => oldByProfile.has(a.profile_id)).map((a) => a.profile_id);
    await sendTo("assigned", after, added.map((a) => a.profile_id));
    if (detailsChanged) await sendTo("updated", after, keptIds);
    else if (changedRole.length) await sendTo("updated", after, changedRole.map((a) => a.profile_id));
    if (before) await sendTo("unassigned", after, removed);
  }

  revalidatePath("/");
  redirect(`/events/${eventId}`);
}

async function sendTo(kind: NotifyKind, event: Awaited<ReturnType<typeof getEvent>> & object, profileIds: string[]) {
  if (!profileIds.length) return;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("*").in("id", profileIds).eq("active", true);
  const positions = new Map(event.assignments.map((a) => [a.profile_id, a.role?.name ?? null]));
  const recipients: Recipient[] = ((data ?? []) as Profile[]).map((p) => ({
    profile: p,
    position: positions.get(p.id) ?? null,
  }));
  await notify(kind, event as PressEvent, recipients, teamLine(event.assignments));
}

export async function setEventStatus(id: string, status: "planned" | "cancelled" | "done") {
  const me = await requireUser();
  const supabase = await createClient();
  const event = await getEvent(supabase, id);
  if (!event) return;
  const canEdit = me.can("events.edit_all") || (event.created_by === me.profile.id && me.can("events.create"));
  if (!canEdit) return;
  await supabase.from("events").update({ status }).eq("id", id);
  if (status === "cancelled" && event.status !== "cancelled") {
    await sendTo("cancelled", { ...event, status }, event.assignments.map((a) => a.profile_id));
  }
  revalidatePath("/");
  revalidatePath(`/events/${id}`);
}

export async function deleteEvent(id: string) {
  const me = await requireUser();
  if (!me.can("events.edit_all")) return;
  const supabase = await createClient();
  const event = await getEvent(supabase, id);
  if (!event) return;
  if (event.status !== "cancelled") {
    await sendTo("cancelled", { ...event, status: "cancelled" }, event.assignments.map((a) => a.profile_id));
  }
  if (event.location_photo_path) await supabase.storage.from("location-photos").remove([event.location_photo_path]);
  await supabase.from("events").delete().eq("id", id);
  revalidatePath("/");
  redirect("/");
}

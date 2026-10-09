import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assignment, Profile, PressEvent, Role } from "@/lib/types";

export type AssignmentWithPeople = Assignment & {
  profile: Pick<Profile, "id" | "full_name" | "phone"> | null;
  role: Pick<Role, "id" | "name"> | null;
};

export type EventWithTeam = PressEvent & { assignments: AssignmentWithPeople[] };

const SELECT =
  "*, assignments:event_assignments(*, profile:profiles(id, full_name, phone), role:roles(id, name))";

export async function listEvents(db: SupabaseClient, from: Date, to: Date) {
  const { data, error } = await db
    .from("events")
    .select(SELECT)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as EventWithTeam[];
}

export async function getEvent(db: SupabaseClient, id: string) {
  const { data } = await db.from("events").select(SELECT).eq("id", id).maybeSingle();
  return data as EventWithTeam | null;
}

export async function photoUrl(db: SupabaseClient, path: string | null) {
  if (!path) return null;
  const { data } = await db.storage.from("location-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// "ოპერატორი: გიორგი, ნინო · მძღოლი: დავითი"
export function teamLine(assignments: AssignmentWithPeople[]) {
  const groups = new Map<string, string[]>();
  for (const a of assignments) {
    const key = a.role?.name ?? "სხვა";
    groups.set(key, [...(groups.get(key) ?? []), a.profile?.full_name ?? "?"]);
  }
  return [...groups].map(([r, names]) => `${r}: ${names.join(", ")}`).join(" · ");
}

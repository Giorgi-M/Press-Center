import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadFormOptions(db: SupabaseClient) {
  const [{ data: roles }, { data: people }] = await Promise.all([
    db.from("roles").select("id, name, is_position").order("sort_order").order("name"),
    db.from("profiles").select("id, full_name, role_id").eq("active", true).order("full_name"),
  ]);
  return { roles: roles ?? [], people: people ?? [] };
}

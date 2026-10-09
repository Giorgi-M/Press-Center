import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Permission, Profile, Role } from "@/lib/types";

export type CurrentUser = {
  profile: Profile;
  role: Role | null;
  can: (p: Permission) => boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile || !profile.active) return null;

  let role: Role | null = null;
  if (profile.role_id) {
    const { data } = await supabase.from("roles").select("*").eq("id", profile.role_id).maybeSingle<Role>();
    role = data;
  }
  const perms = new Set(role?.permissions ?? []);
  return { profile, role, can: (p) => perms.has(p) };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login?error=no_access");
  return u;
}

export async function requirePerm(p: Permission): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.can(p)) redirect("/?error=forbidden");
  return u;
}

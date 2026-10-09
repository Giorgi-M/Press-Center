"use server";

import { revalidatePath } from "next/cache";
import { requirePerm } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { PERMISSIONS, type Permission } from "@/lib/types";

function readPerms(form: FormData) {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => form.get(`perm:${p}`) === "on");
}

export async function saveRole(form: FormData) {
  const me = await requirePerm("roles.manage");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  const permissions = readPerms(form);
  // Keep admins from locking themselves out of this page.
  if (id && id === me.profile.role_id && !permissions.includes("roles.manage")) permissions.push("roles.manage");

  const row = {
    name,
    permissions,
    is_position: form.get("is_position") === "on",
    sort_order: Number(form.get("sort_order")) || 100,
  };
  const db = createAdminClient();
  if (id) await db.from("roles").update(row).eq("id", id);
  else await db.from("roles").insert(row);
  revalidatePath("/admin/roles");
}

export async function deleteRole(id: string) {
  const me = await requirePerm("roles.manage");
  if (id === me.profile.role_id) return;
  await createAdminClient().from("roles").delete().eq("id", id);
  revalidatePath("/admin/roles");
}

"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePerm } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: string } | null;

function val(form: FormData, k: string) {
  const v = String(form.get(k) ?? "").trim();
  return v || null;
}

export async function createUser(_: Result, form: FormData): Promise<Result> {
  await requirePerm("users.manage");
  const email = val(form, "email")?.toLowerCase();
  const full_name = val(form, "full_name");
  const username = val(form, "username")?.toLowerCase() ?? null;
  const password = val(form, "password");
  if (!email || !full_name) return { error: "ელფოსტა და სახელი სავალდებულოა" };
  if (password && password.length < 8) return { error: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს" };
  if (username && !/^[a-z0-9._-]{3,}$/.test(username)) return { error: "მომხმარებლის სახელი: მინ. 3 სიმბოლო, ლათინური ასოები და ციფრები" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    // Without a password the person signs in with Google only.
    password: password ?? randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (error) return { error: error.message.includes("already") ? "ეს ელფოსტა უკვე რეგისტრირებულია" : error.message };

  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id,
    email,
    username,
    full_name,
    role_id: val(form, "role_id"),
    phone: val(form, "phone"),
    whatsapp: val(form, "whatsapp"),
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: pErr.message.includes("username") ? "ეს მომხმარებლის სახელი დაკავებულია" : pErr.message };
  }
  revalidatePath("/admin/users");
  return { ok: `${full_name} დაემატა` };
}

export async function updateUser(_: Result, form: FormData): Promise<Result> {
  const me = await requirePerm("users.manage");
  const id = val(form, "id")!;
  const username = val(form, "username")?.toLowerCase() ?? null;
  const active = form.get("active") === "on";
  if (id === me.profile.id && !active) return { error: "საკუთარი ანგარიშის გათიშვა შეუძლებელია" };
  if (username && !/^[a-z0-9._-]{3,}$/.test(username)) return { error: "მომხმარებლის სახელი არასწორია" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: val(form, "full_name"),
      username,
      role_id: val(form, "role_id"),
      phone: val(form, "phone"),
      whatsapp: val(form, "whatsapp"),
      active,
    })
    .eq("id", id);
  if (error) return { error: error.message.includes("username") ? "ეს მომხმარებლის სახელი დაკავებულია" : error.message };

  const password = val(form, "password");
  if (password) {
    if (password.length < 8) return { error: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს" };
    const { error: aErr } = await admin.auth.admin.updateUserById(id, { password });
    if (aErr) return { error: aErr.message };
  }
  // Signing out a deactivated user everywhere.
  if (!active) await admin.auth.admin.signOut(id).catch(() => {});
  revalidatePath("/admin/users");
  return { ok: "შენახულია" };
}

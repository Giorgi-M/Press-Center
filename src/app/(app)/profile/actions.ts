"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function saveProfile(form: FormData) {
  const me = await requireUser();
  const v = (k: string) => String(form.get(k) ?? "").trim() || null;
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      full_name: v("full_name") ?? me.profile.full_name,
      phone: v("phone"),
      whatsapp: v("whatsapp"),
      notify_email: form.get("notify_email") === "on",
      notify_sms: form.get("notify_sms") === "on",
      notify_whatsapp: form.get("notify_whatsapp") === "on",
      notify_telegram: form.get("notify_telegram") === "on",
    })
    .eq("id", me.profile.id);
  revalidatePath("/profile");
}

export async function changePassword(form: FormData) {
  await requireUser();
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return;
  const supabase = await createClient();
  await supabase.auth.updateUser({ password });
}

export async function unlinkTelegram() {
  const me = await requireUser();
  await createAdminClient().from("profiles").update({ telegram_chat_id: null }).eq("id", me.profile.id);
  revalidatePath("/profile");
}

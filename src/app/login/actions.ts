"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function signInWithPassword(_: unknown, form: FormData) {
  const login = String(form.get("login") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!login || !password) return { error: "შეიყვანეთ მომხმარებელი და პაროლი" };

  let email = login;
  if (!login.includes("@")) {
    const { data } = await createAdminClient().rpc("email_for_username", { p_username: login });
    if (!data) return { error: "მომხმარებელი ან პაროლი არასწორია" };
    email = data as string;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "მომხმარებელი ან პაროლი არასწორია" };
  redirect("/");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = process.env.APP_URL ?? (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// Google OAuth lands here. Only people an admin already added may stay signed in.
export async function GET(request: NextRequest) {
  const base = process.env.APP_URL ?? request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${base}/login?error=google`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${base}/login?error=google`);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    // Drop auth accounts created by strangers signing in with Google.
    if (!profile) await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.redirect(`${base}/login?error=no_access`);
  }
  return NextResponse.redirect(`${base}/`);
}

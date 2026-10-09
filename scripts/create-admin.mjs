// First admin bootstrap:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs email@x.ge "სახელი გვარი" [username] [password]
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const [email, fullName, username, password] = process.argv.slice(2);
if (!email || !fullName) {
  console.error('usage: node scripts/create-admin.mjs <email> "<full name>" [username] [password]');
  process.exit(1);
}
const url = process.env.SUPABASE_URL ?? process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: role } = await db.from("roles").select("id").eq("name", "ადმინისტრატორი").single();
const { data, error } = await db.auth.admin.createUser({
  email,
  password: password ?? randomBytes(24).toString("base64url"),
  email_confirm: true,
});
if (error) throw error;
const { error: pErr } = await db.from("profiles").insert({
  id: data.user.id,
  email: email.toLowerCase(),
  full_name: fullName,
  username: username?.toLowerCase() ?? null,
  role_id: role.id,
});
if (pErr) throw pErr;
console.log(`admin created: ${email}`);

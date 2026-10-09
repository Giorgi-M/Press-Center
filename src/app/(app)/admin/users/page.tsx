import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateUserForm, EditUserRow } from "./UserForms";

export default async function UsersPage() {
  await requirePerm("users.manage");
  const db = await createClient();
  const [{ data: roles }, { data: users }] = await Promise.all([
    db.from("roles").select("id, name").order("sort_order").order("name"),
    db.from("profiles").select("*").order("active", { ascending: false }).order("full_name"),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">მომხმარებლები ({users?.length ?? 0})</h1>
      <CreateUserForm roles={roles ?? []} />
      <div className="space-y-2">
        {(users ?? []).map((u) => <EditUserRow key={u.id} user={u} roles={roles ?? []} />)}
      </div>
    </div>
  );
}

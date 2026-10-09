import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, type Permission, type Role } from "@/lib/types";
import { deleteRole, saveRole } from "./actions";

function RoleForm({ role, count, isMine }: { role?: Role; count?: number; isMine?: boolean }) {
  return (
    <div className="card space-y-3">
      <form action={saveRole} className="space-y-3">
        {role && <input type="hidden" name="id" value={role.id} />}
        <div className="flex flex-wrap items-center gap-3">
          <input name="name" className="input max-w-xs font-medium" defaultValue={role?.name} placeholder="ახალი როლის სახელი" required />
          <label className="flex items-center gap-1 text-sm text-gray-600">
            რიგი <input name="sort_order" type="number" className="input w-20" defaultValue={role?.sort_order ?? 100} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_position" defaultChecked={role?.is_position ?? true} />
            გადაღებაზე დანიშვნადი პოზიცია
          </label>
          {role && <span className="text-xs text-gray-500">{count ?? 0} მომხმარებელი</span>}
        </div>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(PERMISSIONS) as [Permission, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`perm:${key}`} defaultChecked={role?.permissions.includes(key)} />
              {label}
            </label>
          ))}
        </div>
        <button className="btn-primary">{role ? "შენახვა" : "როლის დამატება"}</button>
      </form>
      {role && !isMine && (
        <form action={deleteRole.bind(null, role.id)}>
          <button className="text-sm text-red-600 hover:underline">როლის წაშლა</button>
        </form>
      )}
    </div>
  );
}

export default async function RolesPage() {
  const me = await requirePerm("roles.manage");
  const db = await createClient();
  const [{ data: roles }, { data: profiles }] = await Promise.all([
    db.from("roles").select("*").order("sort_order").order("name"),
    db.from("profiles").select("role_id").eq("active", true),
  ]);
  const counts = new Map<string, number>();
  for (const p of profiles ?? []) if (p.role_id) counts.set(p.role_id, (counts.get(p.role_id) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">როლები და უფლებები</h1>
      <p className="text-sm text-gray-600">
        მონიშნეთ, რა შეუძლია თითოეულ როლს. „დანიშვნადი პოზიცია“ ნიშნავს, რომ როლი გამოჩნდება გადაღების გუნდის არჩევისას.
      </p>
      <RoleForm />
      {((roles ?? []) as Role[]).map((r) => (
        <RoleForm key={r.id} role={r} count={counts.get(r.id)} isMine={r.id === me.profile.role_id} />
      ))}
    </div>
  );
}

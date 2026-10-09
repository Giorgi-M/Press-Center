"use client";

import { useActionState } from "react";
import { createUser, updateUser } from "./actions";

type RoleOpt = { id: string; name: string };
type UserRow = {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  role_id: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram_chat_id: string | null;
  active: boolean;
};

function Msg({ state }: { state: { error?: string; ok?: string } | null }) {
  if (!state) return null;
  return state.error ? (
    <p className="text-sm text-red-600">{state.error}</p>
  ) : (
    <p className="text-sm text-green-700">{state.ok}</p>
  );
}

function RoleSelect({ roles, value }: { roles: RoleOpt[]; value?: string | null }) {
  return (
    <select name="role_id" className="input" defaultValue={value ?? ""}>
      <option value="">— როლი —</option>
      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  );
}

export function CreateUserForm({ roles }: { roles: RoleOpt[] }) {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <h2 className="font-semibold sm:col-span-2 lg:col-span-4">ახალი მომხმარებელი</h2>
      <input name="full_name" className="input" placeholder="სახელი გვარი *" required />
      <input name="email" type="email" className="input" placeholder="ელფოსტა (Google) *" required />
      <input name="username" className="input" placeholder="მომხმარებლის სახელი" autoComplete="off" />
      <input name="password" type="password" className="input" placeholder="პაროლი (არასავალდებულო)" autoComplete="new-password" />
      <RoleSelect roles={roles} />
      <input name="phone" className="input" placeholder="ტელეფონი (SMS)" inputMode="tel" />
      <input name="whatsapp" className="input" placeholder="WhatsApp (თუ განსხვავდება)" inputMode="tel" />
      <button className="btn-primary" disabled={pending}>დამატება</button>
      <div className="sm:col-span-2 lg:col-span-4">
        <Msg state={state} />
        <p className="text-xs text-gray-500">
          პაროლის გარეშე დამატებული ადამიანი შედის მხოლოდ Google-ით, იმავე ელფოსტით.
        </p>
      </div>
    </form>
  );
}

export function EditUserRow({ user, roles }: { user: UserRow; roles: RoleOpt[] }) {
  const [state, action, pending] = useActionState(updateUser, null);
  return (
    <details className={`card ${user.active ? "" : "opacity-60"}`}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{user.full_name}</span>
        <span className="text-sm text-gray-500">
          {roles.find((r) => r.id === user.role_id)?.name ?? "როლის გარეშე"} · {user.email}
          {user.username && ` · @${user.username}`}
          {user.telegram_chat_id && " · Telegram ✓"}
          {!user.active && " · გათიშულია"}
        </span>
      </summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="id" value={user.id} />
        <label className="text-sm">სახელი<input name="full_name" className="input" defaultValue={user.full_name} required /></label>
        <label className="text-sm">მომხმარებლის სახელი<input name="username" className="input" defaultValue={user.username ?? ""} /></label>
        <label className="text-sm">როლი<RoleSelect roles={roles} value={user.role_id} /></label>
        <label className="text-sm">ტელეფონი<input name="phone" className="input" defaultValue={user.phone ?? ""} /></label>
        <label className="text-sm">WhatsApp<input name="whatsapp" className="input" defaultValue={user.whatsapp ?? ""} /></label>
        <label className="text-sm">ახალი პაროლი<input name="password" type="password" className="input" autoComplete="new-password" /></label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={user.active} /> აქტიური
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="btn-primary" disabled={pending}>შენახვა</button>
          <Msg state={state} />
        </div>
      </form>
    </details>
  );
}

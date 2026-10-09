"use client";

import { useActionState } from "react";
import { signInWithPassword } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInWithPassword, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="login">მომხმარებელი ან ელფოსტა</label>
        <input id="login" name="login" className="input" autoComplete="username" required />
      </div>
      <div>
        <label className="label" htmlFor="password">პაროლი</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "შესვლა..." : "შესვლა"}
      </button>
    </form>
  );
}

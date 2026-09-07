"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/admin/login/actions";

const initialState: SignInState = { error: null };

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form className="admin-login-form" action={formAction} noValidate>
      <label className="admin-login-field">
        <span>E-mail</span>
        <input type="email" name="email" autoComplete="username" required disabled={pending} />
      </label>
      <label className="admin-login-field">
        <span>Palavra-passe</span>
        <input type="password" name="password" autoComplete="current-password" required disabled={pending} />
      </label>
      {state.error ? (
        <p className="admin-login-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="admin-login-submit" disabled={pending}>
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}

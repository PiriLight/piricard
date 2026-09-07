"use client";

import { useActionState } from "react";
import { updatePasswordAction, type UpdatePasswordState } from "@/app/reset-password/actions";

const initialState: UpdatePasswordState = { error: null };

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <form className="admin-login-form" action={formAction} noValidate>
      <label className="admin-login-field">
        <span>Nova palavra-passe</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={pending}
        />
      </label>
      <label className="admin-login-field">
        <span>Confirmar nova palavra-passe</span>
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={pending}
        />
      </label>
      {state.error ? (
        <p className="admin-login-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="admin-login-submit" disabled={pending}>
        {pending ? "A guardar…" : "Guardar nova palavra-passe"}
      </button>
    </form>
  );
}

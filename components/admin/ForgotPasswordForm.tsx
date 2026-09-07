"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type ForgotPasswordState } from "@/app/admin/login/actions";

const initialState: ForgotPasswordState = { message: null };

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.message) {
    return (
      <div className="admin-auth-forbidden">
        <p>{state.message}</p>
        <Link href="/admin/login" className="admin-login-submit admin-login-link-button">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <form className="admin-login-form" action={formAction} noValidate>
      <label className="admin-login-field">
        <span>E-mail</span>
        <input type="email" name="email" autoComplete="username" required disabled={pending} />
      </label>
      <button type="submit" className="admin-login-submit" disabled={pending}>
        {pending ? "A enviar…" : "Enviar link de recuperação"}
      </button>
      <Link href="/admin/login" className="admin-login-back-link">
        Voltar ao login
      </Link>
    </form>
  );
}

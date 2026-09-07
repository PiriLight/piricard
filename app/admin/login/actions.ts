"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";

export type SignInState = { error: string | null };
export type ForgotPasswordState = { message: string | null };

/**
 * Deliberately generic error message on any failure — never reveals whether
 * the email exists, whether it belongs to an admin, or which field was
 * wrong. Admin-vs-not is decided entirely afterwards, server-side, by the
 * protected /admin layout — not here.
 */
export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Introduz o e-mail e a palavra-passe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou palavra-passe inválidos." };
  }

  redirect("/admin");
}

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "Se existir uma conta com esse e-mail, foi enviado um link de recuperação.";

/**
 * Always returns the same generic message regardless of whether the email
 * belongs to an account (let alone an admin) — never reveals account
 * existence. The app itself requests the reset (rather than relying on the
 * Supabase Dashboard's "send recovery email" action) specifically so
 * `redirectTo` can be set correctly here — the project's email template
 * can't be customized without custom SMTP, so this `redirectTo` is what
 * actually determines where the link sends people (see app/auth/confirm).
 */
export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  });

  // Deliberately ignore `error` in the response shown to the user — the
  // outcome must look identical whether the email exists or not.
  return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
}

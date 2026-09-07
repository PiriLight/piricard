"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState = { error: string | null };

const MIN_PASSWORD_LENGTH = 8;

export async function updatePasswordAction(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (password !== confirmPassword) {
    return { error: "As palavras-passe não coincidem." };
  }

  const supabase = await createClient();

  // Requires the recovery session established by /auth/confirm's verifyOtp()
  // call — there is no other way to reach this successfully. updateUser()
  // only ever acts on the current session's own user, never on an email
  // string, so this can't be pointed at a different account.
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error || !data.user) {
    return { error: "Não foi possível atualizar a palavra-passe. O link pode ter expirado — pede um novo." };
  }

  // Clear the one-time recovery session now that the password is set, per
  // the approved requirement — the new password is used via a normal login
  // afterwards, not by staying signed in from the recovery link.
  await supabase.auth.signOut();

  redirect("/admin/login?reset=success");
}

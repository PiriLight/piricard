import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "@/components/admin/ResetPasswordForm";
import "../admin/admin.css";

export const metadata: Metadata = {
  title: "Nova palavra-passe",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No valid session means either the link was invalid/expired (the /auth/
  // confirm route redirects here with ?error=invalid_link in that case) or
  // this page was reached without going through a recovery link at all —
  // both get the same clean, generic error state.
  const showError = !user || error === "invalid_link";

  return (
    <main className="admin-auth-screen">
      <div className="admin-auth-card">
        <p className="admin-auth-brand">PiriLight · PiriCard</p>
        <h1>Nova palavra-passe</h1>

        {showError ? (
          <div className="admin-auth-forbidden">
            <p>Este link de recuperação é inválido ou já expirou.</p>
            <p>Pede um novo link de recuperação de palavra-passe.</p>
          </div>
        ) : (
          <>
            <p className="admin-auth-subtitle">Define a tua nova palavra-passe de acesso.</p>
            <ResetPasswordForm />
          </>
        )}
      </div>
    </main>
  );
}

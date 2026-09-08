import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminAuthState } from "@/lib/supabase/admin-auth";
import { signOutAction } from "@/app/admin/(protected)/actions";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import ForgotPasswordForm from "@/components/admin/ForgotPasswordForm";
import "../admin.css";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

// No signup link, no public registration — accounts are provisioned only
// through trusted Supabase Auth admin provisioning, never from this page.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; mode?: string }>;
}) {
  const state = await getAdminAuthState();
  const { reset, mode } = await searchParams;

  if (state.status === "ok") {
    redirect("/admin");
  }

  const isForgotPasswordMode = mode === "forgot" && state.status === "unauthenticated";

  return (
    <main className="admin-auth-screen">
      <div className="admin-auth-card">
        <Link href="/" className="admin-back-to-site-link">
          ← Voltar ao PiriCard
        </Link>
        <p className="admin-auth-brand">PiriLight · PiriCard</p>
        <h1>{isForgotPasswordMode ? "Recuperar acesso" : "Acesso interno"}</h1>

        {reset === "success" && state.status !== "forbidden" ? (
          <p className="admin-auth-success">Palavra-passe atualizada. Inicia sessão com a nova palavra-passe.</p>
        ) : null}

        {state.status === "forbidden" ? (
          <div className="admin-auth-forbidden">
            <p>
              A sessão atual ({state.email ?? "utilizador"}) não tem acesso de administrador
              PiriLight.
            </p>
            <form action={signOutAction}>
              <button type="submit" className="admin-login-submit">
                Terminar sessão
              </button>
            </form>
          </div>
        ) : isForgotPasswordMode ? (
          <>
            <p className="admin-auth-subtitle">
              Introduz o teu e-mail e enviamos um link para definires uma nova palavra-passe.
            </p>
            <ForgotPasswordForm />
          </>
        ) : (
          <>
            <p className="admin-auth-subtitle">Área reservada à equipa PiriLight.</p>
            <AdminLoginForm />
            <Link href="/admin/login?mode=forgot" className="admin-login-back-link">
              Esqueceu-se da password?
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

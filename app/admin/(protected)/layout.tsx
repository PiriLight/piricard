import { redirect } from "next/navigation";
import { getAdminAuthState } from "@/lib/supabase/admin-auth";
import { signOutAction } from "@/app/admin/(protected)/actions";
import AdminShell from "@/components/admin/AdminShell";
import "../admin.css";

/**
 * Server-side gate for every route under the protected admin shell. Runs on
 * every request (no caching of the auth result) — never relies on the proxy
 * or client-side state alone, per the approved auth model:
 *   no session      -> redirect to /admin/login
 *   session, !admin -> render a clean "not authorized" message, no redirect
 *                      loop (they ARE logged in, just not an admin)
 *   session, admin  -> render the real admin shell
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const state = await getAdminAuthState();

  if (state.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (state.status === "forbidden") {
    return (
      <main className="admin-auth-screen">
        <div className="admin-auth-card">
          <p className="admin-auth-brand">PiriLight · PiriCard</p>
          <h1>Sem acesso</h1>
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
        </div>
      </main>
    );
  }

  return <AdminShell email={state.email}>{children}</AdminShell>;
}

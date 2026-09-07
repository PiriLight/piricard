import { signOutAction } from "@/app/admin/(protected)/actions";

export default function AdminShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <p className="admin-topbar-brand">PiriLight · PiriCard Admin</p>
        <div className="admin-topbar-user">
          {email ? <span className="admin-topbar-email">{email}</span> : null}
          <form action={signOutAction}>
            <button type="submit" className="admin-topbar-logout">
              Terminar sessão
            </button>
          </form>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}

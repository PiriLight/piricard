import { createClient } from "@/lib/supabase/server";

export type AdminAuthState =
  | { status: "unauthenticated" }
  | { status: "forbidden"; email: string | null }
  | { status: "ok"; email: string | null };

/**
 * Single source of truth for "is the current request a PiriLight platform
 * admin?", used by both /admin/login (to redirect an already-authorized
 * admin away) and the protected /admin layout (to gate access).
 *
 * Two checks, both required:
 *   1. a real, currently-valid Supabase Auth session — verified with
 *      `getUser()` (not `getSession()`), which revalidates the JWT against
 *      the Auth server instead of trusting a possibly-stale cookie;
 *   2. `security.is_platform_admin()` is true for that user, checked via the
 *      `public.current_user_is_platform_admin()` RPC bridge (the `security`
 *      schema itself is never exposed to the Data API).
 *
 * Never authorizes based on email, email domain, client-side state, user
 * metadata, or URL secrecy — only this server-side, RLS-backed check.
 */
export async function getAdminAuthState(): Promise<AdminAuthState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: isAdmin, error } = await supabase.rpc("current_user_is_platform_admin");

  if (error || !isAdmin) {
    return { status: "forbidden", email: user.email ?? null };
  }

  return { status: "ok", email: user.email ?? null };
}

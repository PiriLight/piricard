import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Dedicated anonymous Supabase client for PUBLIC PiriCard rendering
 * (Phase 4C) — deliberately NOT the cookie-aware `@supabase/ssr` client in
 * `lib/supabase/server.ts`.
 *
 * Why this exists as a separate file: `lib/supabase/server.ts`'s
 * `createClient()` reads the Next.js cookie store and forwards the CALLING
 * USER'S session to Postgres. That is correct for `/admin` (a member/admin
 * previewing their own unpublished business), but wrong for public profile
 * rendering — a platform admin who happens to be logged in and visits
 * `/<slug>` in the same browser must see exactly what an anonymous visitor
 * sees, never their elevated RLS view. Reusing the cookie-aware client for
 * public reads would silently leak that privilege escalation.
 *
 * This client:
 *   - uses the publishable key only (never the secret/service-role key —
 *     this module has no path to `SUPABASE_SECRET_KEY` at all);
 *   - never reads `next/headers` cookies() and is never given a cookie
 *     adapter, so it cannot inherit or forward any user's session;
 *   - disables session persistence/auto-refresh/URL session detection, so
 *     even if something set a Supabase auth cookie in the browser, this
 *     client on the server has no mechanism to pick it up;
 *   - is therefore always evaluated as Postgres role `anon` under RLS,
 *     regardless of who is browsing — the same guarantee an actually
 *     logged-out visitor gets.
 *   - is safe to reuse as a module-level singleton (unlike the cookie-aware
 *     client, which must be constructed per-request to bind to that
 *     request's cookies): this client carries no per-request state, so nothing
 *     about it needs to vary between requests, and reusing one instance
 *     avoids reconnecting per call — friendly to Next.js's fetch caching/ISR
 *     for public pages.
 *
 * Authorization boundary is still entirely Postgres GRANTs + RLS (see
 * supabase/migrations/20260906210142_piricard_v1_schema.sql section 8) — this
 * client does not implement any access control itself, it just guarantees it
 * always presents as `anon`.
 */
let publicClient: ReturnType<typeof createSupabaseClient> | undefined;

export function getPublicSupabaseClient() {
  if (publicClient) return publicClient;

  publicClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return publicClient;
}

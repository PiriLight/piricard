import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the session via Next.js's cookie store — this is
 * the current official @supabase/ssr pattern for Next.js App Router.
 *
 * Uses the publishable key and the calling user's own session; every query
 * still goes through the same Postgres GRANTs + RLS as the browser client.
 * Never use the secret key here — this factory has no path to it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component (not a Server Action/Route
            // Handler) — cookies can't be written here. Harmless as long as
            // proxy.ts is also refreshing the session, which it is.
          }
        },
      },
    },
  );
}

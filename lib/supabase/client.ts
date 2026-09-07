import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components. Uses the publishable key —
 * safe to expose to the browser, since authorization comes entirely from
 * Postgres GRANTs + Row Level Security (see supabase/migrations/), not from
 * keeping this value secret.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

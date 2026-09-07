import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every /admin request — the
 * current official @supabase/ssr pattern for Next.js (file is named
 * `proxy.ts`, not `middleware.ts`: Next.js 16 renamed the middleware.js file
 * convention to proxy.js, see node_modules/next/dist/docs/.../proxy.md).
 *
 * Scoped ONLY to /admin via the matcher below — deliberately, so this can
 * never affect the public PiriCard routes ([slug], /, /piricard, /api/*).
 * This alone is not the security boundary: every protected page still does
 * its own server-side check (see lib/supabase/admin-auth.ts) rather than
 * relying on this proxy for authorization.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Required by @supabase/ssr to actually refresh an expiring session.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};

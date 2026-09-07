import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirmation endpoint for Supabase Auth email links.
 *
 * The project's Reset Password email template can't be customized without
 * custom SMTP configured (Supabase Dashboard constraint), so we can't rely
 * on a template rewritten to send `token_hash`+`type` directly to us. With
 * the DEFAULT template, `{{ .ConfirmationURL }}` points at Supabase's own
 * hosted verify endpoint first, which then redirects here with a PKCE `code`
 * query param appended to whatever `redirectTo` the app supplied when
 * calling `resetPasswordForEmail()` — see app/admin/login/actions.ts.
 *
 * This route handles that `code` (the actual path in use) via
 * `exchangeCodeForSession`, and also still supports `token_hash`+`type` via
 * `verifyOtp` in case a custom email template is ever configured later —
 * either path lands on the same `next` destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/reset-password";

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirectTo.pathname = next;
      return NextResponse.redirect(redirectTo);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirectTo.pathname = next;
      return NextResponse.redirect(redirectTo);
    }
  }

  // Invalid or expired link — land on /reset-password itself, which renders
  // a clean error state when there is no valid recovery session instead of
  // needing a separate /error page.
  redirectTo.pathname = "/reset-password";
  redirectTo.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(redirectTo);
}

-- =============================================================================
-- PiriCard — Admin auth RPC bridge (Phase 4B.2B)
--
-- WHY THIS EXISTS: security.is_platform_admin() (from the V1 schema
-- migration) was built to be called FROM WITHIN RLS policies, not directly
-- by application code. The `security` schema is deliberately never added to
-- supabase/config.toml's exposed API schemas, so PostgREST never creates a
-- `/rest/v1/rpc/is_platform_admin` endpoint for it — there is no way for the
-- Next.js admin app to ask "am I an admin?" at all without this bridge.
--
-- This is a narrow, additive fix, not a redesign: it does not touch
-- `platform_admins` (still zero grants to any application role), does not
-- expose the `security` schema, and adds exactly one boolean-only function.
-- =============================================================================

create or replace function public.current_user_is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select security.is_platform_admin();
$$;

revoke all on function public.current_user_is_platform_admin() from public;
grant execute on function public.current_user_is_platform_admin() to authenticated;

comment on function public.current_user_is_platform_admin() is
  'Thin, boolean-only Data-API-callable bridge to security.is_platform_admin(), for application '
  'authorization use (e.g. the internal admin''s server-side auth check). SECURITY INVOKER is '
  'correct and safe here: security.is_platform_admin() is itself already SECURITY DEFINER and '
  'performs the actual privilege check; this wrapper adds no elevation of its own. Exposes nothing '
  'beyond a single boolean — no platform_admins row, no other admin metadata.';

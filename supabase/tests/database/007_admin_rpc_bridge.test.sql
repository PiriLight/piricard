-- PiriCard V1 security tests — public.current_user_is_platform_admin() bridge
-- (Phase 4B.2B). Proves the Data-API-callable wrapper matches
-- security.is_platform_admin() exactly, and that anon cannot call it.
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('fa000000-0000-0000-0000-000000000001', 'bridge-admin@test.piricard.local'),
  ('fa000000-0000-0000-0000-000000000002', 'bridge-non-admin@test.piricard.local');
insert into public.platform_admins (user_id) values ('fa000000-0000-0000-0000-000000000001');

-- Admin: bridge returns true.
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"fa000000-0000-0000-0000-000000000001"}';
select is(
  (select public.current_user_is_platform_admin()),
  true,
  'current_user_is_platform_admin() is true for a real platform admin'
);

-- Non-admin: bridge returns false (not an error).
set local request.jwt.claims to '{"role":"authenticated","sub":"fa000000-0000-0000-0000-000000000002"}';
select is(
  (select public.current_user_is_platform_admin()),
  false,
  'current_user_is_platform_admin() is false for a normal authenticated user'
);

-- Bridge still never exposes platform_admins itself.
select throws_ok(
  $$ select 1 from public.platform_admins $$,
  '42501', null,
  'the bridge does not grant any direct access to platform_admins'
);

-- anon: EXECUTE was granted only to authenticated, so this must fail.
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.current_user_is_platform_admin() $$,
  '42501', null,
  'anon cannot call current_user_is_platform_admin() at all (no EXECUTE grant)'
);

select * from finish();
rollback;

-- PiriCard V1 security tests — platform admin authorization mechanism.
--
-- Scope note (Task 19 / Task 17): admin MUTATION routes (creating a
-- membership, activating a module, editing `businesses`) are intentionally
-- NOT implemented in Phase 4B.1 — Task 17 allows platform-admin provisioning
-- to remain a trusted, manual SQL operation for this phase. This file tests
-- only what actually exists: the is_platform_admin() gate itself, that it is
-- unreachable by ordinary users, and that admin status still cannot be used
-- to read platform_admins directly (only through the function).
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'ordinary-user@test.piricard.local'),
  ('d0000000-0000-0000-0000-000000000002', 'platform-admin@test.piricard.local');

-- Admin provisioning done here exactly as it will be done in production for
-- V1: a trusted, direct SQL insert — not through any Data API grant.
insert into public.platform_admins (user_id) values ('d0000000-0000-0000-0000-000000000002');

insert into public.businesses (id, slug, organization, layout_variant, published) values
  ('00000000-0000-0000-0000-000000000301', 'admin-visibility-test', 'Admin Visibility Test', 'editorial', false);

-- ---------------------------------------------------------------------------
-- Ordinary authenticated user: is_platform_admin() must be false, and direct
-- access to platform_admins must fail outright (no grant on the table).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"c0000000-0000-0000-0000-000000000001"}';

select is(
  (select security.is_platform_admin()),
  false,
  'is_platform_admin() is false for an ordinary authenticated user'
);

select throws_ok(
  $$ select 1 from public.platform_admins $$,
  '42501',
  null,
  'an ordinary authenticated user cannot query platform_admins directly (no grant exists)'
);

select is_empty(
  $$ select 1 from public.businesses where id = '00000000-0000-0000-0000-000000000301' $$,
  'ordinary user cannot see the unpublished test business'
);

-- ---------------------------------------------------------------------------
-- Platform admin: is_platform_admin() must be true, sees everything through
-- the member_admin_read policies, but STILL cannot read platform_admins
-- directly — admin status is only ever visible through the function.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"role":"authenticated","sub":"d0000000-0000-0000-0000-000000000002"}';

select is(
  (select security.is_platform_admin()),
  true,
  'is_platform_admin() is true for a provisioned platform admin'
);

select lives_ok(
  $$ select 1 from public.businesses where id = '00000000-0000-0000-0000-000000000301' $$,
  'platform admin can see the unpublished test business via the admin-read policy'
);

select throws_ok(
  $$ select 1 from public.platform_admins $$,
  '42501',
  null,
  'even a platform admin cannot query platform_admins directly — no role has any grant on it, ' ||
  'admin status is only ever exposed through security.is_platform_admin()'
);

select * from finish();
rollback;

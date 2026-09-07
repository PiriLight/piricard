-- PiriCard V1 security tests — Business A owner/editor.
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner-a@test.piricard.local');

insert into public.businesses (id, slug, organization, layout_variant, published)
values ('00000000-0000-0000-0000-000000000101', 'business-a', 'Business A', 'editorial', true);

insert into public.business_profile_content (business_id, name, category, directory_description)
values ('00000000-0000-0000-0000-000000000101', 'Business A', 'Test', 'Owner-editable content.');

insert into public.business_memberships (business_id, user_id, role)
values ('00000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'owner');

insert into public.business_modules (business_id, module_key, enabled) values
  ('00000000-0000-0000-0000-000000000101', 'services', true),
  ('00000000-0000-0000-0000-000000000101', 'gallery', false);

insert into public.services (id, business_id, label) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000101', 'Existing service');

-- ---------------------------------------------------------------------------
-- Act as Business A's authenticated owner.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"a0000000-0000-0000-0000-000000000001"}';

-- PASS: can read own business (even fields not covered by the public policy).
select results_eq(
  $$ select organization from public.businesses where id = '00000000-0000-0000-0000-000000000101' $$,
  $$ values ('Business A'::text) $$,
  'owner can read their own business row'
);

-- PASS: can update own profile content.
select lives_ok(
  $$ update public.business_profile_content set profile_description = 'Updated by owner' where business_id = '00000000-0000-0000-0000-000000000101' $$,
  'owner can update their own business_profile_content'
);

-- PASS: can edit own hours/social links.
select lives_ok(
  $$ insert into public.business_hours (business_id, label, days) values ('00000000-0000-0000-0000-000000000101', 'Weekdays', array[1,2,3,4,5]::smallint[]) $$,
  'owner can insert their own business_hours'
);
select lives_ok(
  $$ insert into public.social_links (business_id, platform, url, label) values ('00000000-0000-0000-0000-000000000101', 'instagram', 'https://instagram.com/test', 'Instagram') $$,
  'owner can insert their own social_links'
);

-- PASS: can edit enabled own module content (services is enabled).
select lives_ok(
  $$ insert into public.services (business_id, label) values ('00000000-0000-0000-0000-000000000101', 'New service') $$,
  'owner can insert services content while the services module is enabled'
);

-- FAIL: cannot edit disabled own module content (gallery is disabled).
select throws_ok(
  $$ insert into public.gallery (business_id, alt) values ('00000000-0000-0000-0000-000000000101', 'Should not be allowed') $$,
  '42501',
  null,
  'owner cannot insert gallery content while the gallery module is disabled'
);

-- FAIL: cannot access Business B management data (see fixture below).
-- Fixture setup needs to happen as the unrestricted test-runner role, not as
-- Business A's owner (who rightly has no INSERT grant on `businesses` at all) —
-- reset to that role for the fixture, then resume acting as the owner.
reset role;
reset request.jwt.claims;
insert into public.businesses (id, slug, organization, layout_variant, published)
values ('00000000-0000-0000-0000-000000000102', 'business-b', 'Business B', 'editorial', false);
insert into public.business_profile_content (business_id, name, category, directory_description)
values ('00000000-0000-0000-0000-000000000102', 'Business B', 'Test', 'Business B private content.');
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"a0000000-0000-0000-0000-000000000001"}';

select is_empty(
  $$ select 1 from public.businesses where id = '00000000-0000-0000-0000-000000000102' $$,
  'Business A owner cannot see unpublished Business B (no membership, not published)'
);
select is_empty(
  $$ select 1 from public.business_profile_content where business_id = '00000000-0000-0000-0000-000000000102' $$,
  'Business A owner cannot read Business B profile content'
);

-- FAIL: cannot update Business B. The GRANT allows UPDATE for `authenticated` in
-- general (RLS, not the grant, is what scopes it to "own business") — so an
-- unauthorized cross-tenant UPDATE does not throw, it just matches zero rows
-- (standard Postgres RLS behavior for a row a USING clause filters out). Prove
-- that with RETURNING rather than expecting an exception.
select results_ne(
  $$ update public.business_profile_content set name = 'Hacked B' where business_id = '00000000-0000-0000-0000-000000000102' returning 1 $$,
  $$ values (1) $$,
  'Business A owner cannot update Business B profile content (RLS silently matches zero rows)'
);

-- FAIL: cannot update businesses' protected config.
select throws_ok(
  $$ update public.businesses set published = false where id = '00000000-0000-0000-0000-000000000101' $$,
  '42501',
  null,
  'owner cannot update the businesses table at all (no UPDATE grant exists)'
);

-- FAIL: cannot activate a module.
select throws_ok(
  $$ update public.business_modules set enabled = true where business_id = '00000000-0000-0000-0000-000000000101' and module_key = 'gallery' $$,
  '42501',
  null,
  'owner cannot activate/deactivate their own module (no UPDATE grant exists)'
);

-- FAIL: cannot create a membership (for themselves or anyone else).
select throws_ok(
  $$ insert into public.business_memberships (business_id, user_id, role) values ('00000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'owner') $$,
  '42501',
  null,
  'owner cannot create memberships (no INSERT grant exists)'
);

-- FAIL: cannot change their own membership role.
select throws_ok(
  $$ update public.business_memberships set role = 'owner' where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'owner cannot change their own membership role (no UPDATE grant exists)'
);

-- FAIL: cannot create a platform admin (for themselves or anyone else).
select throws_ok(
  $$ insert into public.platform_admins (user_id) values ('a0000000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'owner cannot self-promote to platform admin (no grant on platform_admins exists at all)'
);

select * from finish();
rollback;

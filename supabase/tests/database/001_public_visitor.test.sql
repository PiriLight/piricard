-- PiriCard V1 security tests — anonymous/public visitor.
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as the unrestricted test-runner role, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into public.businesses (id, slug, organization, layout_variant, published, archived_at)
values
  ('00000000-0000-0000-0000-000000000001', 'test-published', 'Published Co', 'editorial', true, null),
  ('00000000-0000-0000-0000-000000000002', 'test-unpublished', 'Unpublished Co', 'editorial', false, null),
  ('00000000-0000-0000-0000-000000000003', 'test-archived', 'Archived Co', 'editorial', true, now());

insert into public.business_profile_content (business_id, name, category, directory_description)
values
  ('00000000-0000-0000-0000-000000000001', 'Published Co', 'Test', 'A published test business.'),
  ('00000000-0000-0000-0000-000000000002', 'Unpublished Co', 'Test', 'An unpublished test business.'),
  ('00000000-0000-0000-0000-000000000003', 'Archived Co', 'Test', 'An archived test business.');

insert into public.business_modules (business_id, module_key, enabled) values
  ('00000000-0000-0000-0000-000000000001', 'gallery', true),
  ('00000000-0000-0000-0000-000000000001', 'services', false);

insert into public.gallery (id, business_id, alt) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Enabled module photo');

insert into public.services (id, business_id, label) values
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Disabled module service');

-- ---------------------------------------------------------------------------
-- Act as an anonymous, unauthenticated visitor.
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

-- PASS: can read published business public data.
select results_eq(
  $$ select slug from public.businesses where id = '00000000-0000-0000-0000-000000000001' $$,
  $$ values ('test-published'::text) $$,
  'anon can read the published business row'
);

select results_eq(
  $$ select name from public.business_profile_content where business_id = '00000000-0000-0000-0000-000000000001' $$,
  $$ values ('Published Co'::text) $$,
  'anon can read published business profile content'
);

-- PASS: can read enabled module content of a published business.
select results_eq(
  $$ select alt from public.gallery where business_id = '00000000-0000-0000-0000-000000000001' $$,
  $$ values ('Enabled module photo'::text) $$,
  'anon can read gallery content when the gallery module is enabled'
);

-- FAIL: cannot read unpublished business.
select is_empty(
  $$ select 1 from public.businesses where id = '00000000-0000-0000-0000-000000000002' $$,
  'anon cannot read an unpublished business'
);
select is_empty(
  $$ select 1 from public.business_profile_content where business_id = '00000000-0000-0000-0000-000000000002' $$,
  'anon cannot read profile content of an unpublished business'
);

-- FAIL: cannot read archived business (published = true but archived_at set).
select is_empty(
  $$ select 1 from public.businesses where id = '00000000-0000-0000-0000-000000000003' $$,
  'anon cannot read an archived business even though published = true'
);

-- FAIL: cannot read disabled module content, even though the row physically exists.
select is_empty(
  $$ select 1 from public.services where business_id = '00000000-0000-0000-0000-000000000001' $$,
  'anon cannot read services content while the services module is disabled'
);

-- FAIL: cannot write anything.
select throws_ok(
  $$ insert into public.business_hours (business_id, label, days) values ('00000000-0000-0000-0000-000000000001', 'Test', array[1]::smallint[]) $$,
  '42501',
  null,
  'anon cannot insert into business_hours'
);

select throws_ok(
  $$ update public.business_profile_content set name = 'Hacked' where business_id = '00000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'anon cannot update business_profile_content'
);

select * from finish();
rollback;

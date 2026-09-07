-- PiriCard V1 security tests — Phase 4B.5/4B.6 admin business lifecycle RPCs:
-- admin_create_business, admin_update_business_config,
-- admin_set_business_publish_state, admin_archive_business,
-- admin_unarchive_business.
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('f2000000-0000-0000-0000-000000000001', 'lifecycle-admin@test.piricard.local'),
  ('f2000000-0000-0000-0000-000000000002', 'lifecycle-outsider@test.piricard.local');
insert into public.platform_admins (user_id) values ('f2000000-0000-0000-0000-000000000001');

-- =============================================================================
-- admin_create_business
-- =============================================================================

reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.admin_create_business('verify-lifecycle-a', 'Org', 'editorial', 'Nome', 'Categoria', 'Descrição') $$,
  '42501', null,
  '[create] anon cannot call admin_create_business at all (no EXECUTE grant)'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"f2000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_create_business('verify-lifecycle-a', 'Org', 'editorial', 'Nome', 'Categoria', 'Descrição') $$,
  '42501', null,
  '[create] a non-admin authenticated user cannot create a business'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f2000000-0000-0000-0000-000000000001"}';
select throws_ok(
  $$ select public.admin_create_business('Not A Valid Slug!', 'Org', 'editorial', 'Nome', 'Categoria', 'Descrição') $$,
  '22023', null,
  '[create] an invalid slug format is rejected'
);
select throws_ok(
  $$ select public.admin_create_business('verify-lifecycle-badlayout', 'Org', 'not-a-real-layout', 'Nome', 'Categoria', 'Descrição') $$,
  '22023', null,
  '[create] an invalid layout variant is rejected'
);
select is_empty(
  $$ select 1 from public.businesses where slug = 'verify-lifecycle-badlayout' $$,
  '[create] a rejected create (invalid layout) leaves no businesses row behind (atomic)'
);

select lives_ok(
  $$ select public.admin_create_business('verify-lifecycle-a', 'Verify Org', 'editorial', 'Nome do Negócio', 'Categoria X', 'Descrição do diretório', array['services','gallery']) $$,
  '[create] a platform admin can create a business with initial modules'
);

select is(
  (select published from public.businesses where slug = 'verify-lifecycle-a'),
  false,
  '[create] the new business defaults to published=false'
);
select is(
  (select archived_at from public.businesses where slug = 'verify-lifecycle-a'),
  null,
  '[create] the new business defaults to archived_at=null'
);
select results_eq(
  $$ select name, category, directory_description from public.business_profile_content bpc
     join public.businesses b on b.id = bpc.business_id where b.slug = 'verify-lifecycle-a' $$,
  $$ values ('Nome do Negócio'::text, 'Categoria X'::text, 'Descrição do diretório'::text) $$,
  '[create] business_profile_content was created with the given core fields'
);
select isnt_empty(
  $$ select 1 from public.business_modules bm join public.businesses b on b.id = bm.business_id
     where b.slug = 'verify-lifecycle-a' and bm.module_key = 'services' and bm.enabled = true $$,
  '[create] the selected "services" module was created enabled'
);
select is_empty(
  $$ select 1 from public.business_modules bm join public.businesses b on b.id = bm.business_id
     where b.slug = 'verify-lifecycle-a' and bm.module_key = 'menu' $$,
  '[create] an unselected module ("menu") has NO row at all — never implicitly enabled'
);
select is_empty(
  $$ select 1 from public.business_memberships bm join public.businesses b on b.id = bm.business_id
     where b.slug = 'verify-lifecycle-a' $$,
  '[create] no business_membership row was created (not needed for Internal Admin V1)'
);

select throws_ok(
  $$ select public.admin_create_business('verify-lifecycle-a', 'Other Org', 'editorial', 'Outro', 'Outra', 'Outra descrição') $$,
  '23505', null,
  '[create] a duplicate slug is rejected (database-level uniqueness is authoritative)'
);

-- =============================================================================
-- admin_update_business_config
-- =============================================================================

set local request.jwt.claims to '{"role":"authenticated","sub":"f2000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_update_business_config(
       (select id from public.businesses where slug = 'verify-lifecycle-a'),
       'verify-lifecycle-a', 'Verify Org', 'editorial', '{}'::jsonb, '{}'::jsonb,
       null, null, null, null, null, '{}'::jsonb, null, false, true
     ) $$,
  '42501', null,
  '[config] a non-admin cannot update protected business config'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f2000000-0000-0000-0000-000000000001"}';
select throws_ok(
  $$ select public.admin_update_business_config(
       (select id from public.businesses where slug = 'verify-lifecycle-a'),
       'verify-lifecycle-a', 'Verify Org', 'not-a-real-layout', '{}'::jsonb, '{}'::jsonb,
       null, null, null, null, null, '{}'::jsonb, null, false, true
     ) $$,
  '22023', null,
  '[config] an invalid layout variant is rejected on update'
);
select throws_ok(
  $$ select public.admin_update_business_config(
       (select id from public.businesses where slug = 'verify-lifecycle-a'),
       'verify-lifecycle-a', 'Verify Org', 'editorial', '{}'::jsonb, '{}'::jsonb,
       'javascript:alert(1)', null, null, null, null, '{}'::jsonb, null, false, true
     ) $$,
  '22023', null,
  '[config] an unsafe (non-http) maps_url is rejected'
);

select lives_ok(
  $$ select public.admin_update_business_config(
       (select id from public.businesses where slug = 'verify-lifecycle-a'),
       'verify-lifecycle-a-renamed', 'Verify Org Renamed', 'editorial',
       '{"primary":"#112233"}'::jsonb, '{"logo":"/x/logo.png"}'::jsonb,
       'https://maps.google.com/?q=x', 'places/abc', 'https://google.com/r', 'https://google.com/w',
       '{"rating":4.5,"count":10,"source":"Google","asOf":"2026"}'::jsonb, '{}'::jsonb, null, true, false
     ) $$,
  '[config] a platform admin can update every editable field while unpublished (including the slug)'
);
select results_eq(
  $$ select slug, organization, featured, indexable from public.businesses where slug = 'verify-lifecycle-a-renamed' $$,
  $$ values ('verify-lifecycle-a-renamed'::text, 'Verify Org Renamed'::text, true, false) $$,
  '[config] the updated fields were persisted'
);

-- Publish, then confirm the slug becomes locked.
select public.admin_set_business_publish_state((select id from public.businesses where slug = 'verify-lifecycle-a-renamed'), true);
select throws_ok(
  $$ select public.admin_update_business_config(
       (select id from public.businesses where slug = 'verify-lifecycle-a-renamed'),
       'verify-lifecycle-a-published-change', 'Verify Org Renamed', 'editorial', '{}'::jsonb, '{}'::jsonb,
       null, null, null, null, null, '{}'::jsonb, null, true, false
     ) $$,
  '42501', null,
  '[config] the slug is locked once the business is published'
);
select lives_ok(
  $$ select public.admin_update_business_config(
       (select id from public.businesses where slug = 'verify-lifecycle-a-renamed'),
       'verify-lifecycle-a-renamed', 'Verify Org Renamed Again', 'editorial', '{}'::jsonb, '{}'::jsonb,
       null, null, null, null, null, '{}'::jsonb, null, true, false
     ) $$,
  '[config] non-slug fields can still be updated while published (same slug given)'
);

-- =============================================================================
-- admin_set_business_publish_state / admin_archive_business / admin_unarchive_business
-- =============================================================================

set local request.jwt.claims to '{"role":"authenticated","sub":"f2000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_set_business_publish_state((select id from public.businesses where slug = 'verify-lifecycle-a-renamed'), false) $$,
  '42501', null,
  '[publish] a non-admin cannot change publish state'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f2000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ select public.admin_set_business_publish_state((select id from public.businesses where slug = 'verify-lifecycle-a-renamed'), false) $$,
  '[publish] a platform admin can unpublish'
);
select is(
  (select published from public.businesses where slug = 'verify-lifecycle-a-renamed'),
  false,
  '[publish] unpublish persisted'
);
select lives_ok(
  $$ select public.admin_set_business_publish_state((select id from public.businesses where slug = 'verify-lifecycle-a-renamed'), true) $$,
  '[publish] a platform admin can re-publish'
);

-- Seed a real content row so "archive preserves data" has something to check.
insert into public.services (business_id, label)
select id, 'Serviço antes do arquivo' from public.businesses where slug = 'verify-lifecycle-a-renamed';

select lives_ok(
  $$ select public.admin_archive_business((select id from public.businesses where slug = 'verify-lifecycle-a-renamed')) $$,
  '[archive] a platform admin can archive a business'
);
select results_eq(
  $$ select published, (archived_at is not null) from public.businesses where slug = 'verify-lifecycle-a-renamed' $$,
  $$ values (false, true) $$,
  '[archive] archiving forces published=false and stamps archived_at'
);
select is(
  (select slug from public.businesses where slug = 'verify-lifecycle-a-renamed'),
  'verify-lifecycle-a-renamed',
  '[archive] the slug is preserved on the archived row, never freed'
);
select isnt_empty(
  $$ select 1 from public.services s join public.businesses b on b.id = s.business_id
     where b.slug = 'verify-lifecycle-a-renamed' and s.label = 'Serviço antes do arquivo' $$,
  '[archive] archiving preserves existing content rows (no deletion)'
);
select throws_ok(
  $$ select public.admin_create_business('verify-lifecycle-a-renamed', 'New Org', 'editorial', 'Novo', 'Nova', 'Nova descrição') $$,
  '23505', null,
  '[archive] the archived business''s slug can never be reused by a new business'
);
select throws_ok(
  $$ select public.admin_set_business_publish_state((select id from public.businesses where slug = 'verify-lifecycle-a-renamed'), true) $$,
  'P0002', null,
  '[archive] an archived business cannot be re-published directly (must unarchive first)'
);

select lives_ok(
  $$ select public.admin_unarchive_business((select id from public.businesses where slug = 'verify-lifecycle-a-renamed')) $$,
  '[archive] a platform admin can unarchive'
);
select is(
  (select archived_at from public.businesses where slug = 'verify-lifecycle-a-renamed'),
  null,
  '[archive] unarchiving clears archived_at'
);

select * from finish();
rollback;

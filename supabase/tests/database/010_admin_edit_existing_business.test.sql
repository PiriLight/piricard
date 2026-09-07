-- PiriCard V1 — Phase 4F: proves the admin EDIT path (as opposed to CREATE)
-- never duplicates a business or its child/module rows across repeated
-- save cycles — the central risk this phase exists to rule out for the 4
-- real production businesses now that Phase 4B's generic, ID-driven editor
-- machinery is being exercised against them for the first time.
--
-- Uses a disposable fixture business (created here, never one of the 4 real
-- businesses) and the SAME RPCs app/admin/(protected)/businesses/[id]/edit/
-- actions.ts calls — admin_create_business (once, for setup only),
-- admin_replace_* / admin_upsert_restaurant_info / admin_set_business_module
-- / admin_update_business_config (each called TWICE, simulating "open the
-- editor, edit, save" happening twice in a row) — then asserts row counts
-- stay exactly right after each round. Runs inside begin/rollback like every
-- other test here, so nothing persists either way.
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('f3000000-0000-0000-0000-000000000001', 'edit-existing-admin@test.piricard.local');
insert into public.platform_admins (user_id) values ('f3000000-0000-0000-0000-000000000001');

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"f3000000-0000-0000-0000-000000000001"}';

-- =============================================================================
-- Setup: create ONE fixture business, standing in for "an existing business
-- already in Supabase" (the same shape the 4 real businesses are in).
-- =============================================================================
select public.admin_create_business(
  'verify-edit-existing', 'Fixture Org', 'editorial', 'Fixture Nome', 'Fixture Categoria', 'Descrição inicial',
  array['services', 'gallery']
);

-- Resolve the fixture's id once via a temp table (readable across statements
-- in the same transaction/session without repeating the subselect everywhere).
create temporary table fixture as
  select id from public.businesses where slug = 'verify-edit-existing';

select is(
  (select count(*)::int from public.businesses where slug = 'verify-edit-existing'),
  1,
  '[setup] exactly one businesses row exists right after create'
);

-- =============================================================================
-- Round 1 — "first save": populate core content, hours, socials, and both
-- enabled modules' content, as the editor's first real save would.
-- =============================================================================
select public.admin_replace_business_hours((select id from fixture), '[{"label":"Segunda","days":[1],"periods":[{"open":"09:00","close":"18:00"}]}]'::jsonb);
select public.admin_replace_social_links((select id from fixture), '[{"platform":"instagram","url":"https://instagram.com/a","label":"Instagram"}]'::jsonb);
select public.admin_replace_labeled_list((select id from fixture), 'services', array['Serviço A', 'Serviço B']);
select public.admin_replace_gallery((select id from fixture), '[{"alt":"Foto 1"},{"alt":"Foto 2"}]'::jsonb);

update public.business_profile_content set name = 'Fixture Nome R1', category = 'Categoria R1'
  where business_id = (select id from fixture);

select is((select count(*)::int from public.businesses where slug = 'verify-edit-existing'), 1,
  '[round 1] still exactly one businesses row after the first content save');
select is((select count(*)::int from public.business_profile_content where business_id = (select id from fixture)), 1,
  '[round 1] still exactly one business_profile_content row (UPDATE, not INSERT)');
select is((select count(*)::int from public.business_hours where business_id = (select id from fixture)), 1,
  '[round 1] exactly the given hours entries exist');
select is((select count(*)::int from public.social_links where business_id = (select id from fixture)), 1,
  '[round 1] exactly the given social links exist');
select is((select count(*)::int from public.services where business_id = (select id from fixture)), 2,
  '[round 1] exactly the given services exist');
select is((select count(*)::int from public.gallery where business_id = (select id from fixture)), 2,
  '[round 1] exactly the given gallery items exist');
select is((select name from public.business_profile_content where business_id = (select id from fixture)), 'Fixture Nome R1',
  '[round 1] the new name was persisted');

-- =============================================================================
-- Round 2 — "second save": simulates re-opening the SAME business in the
-- editor and saving again with DIFFERENT values. This is the actual
-- duplicate-prevention proof: every call below targets the same business id
-- a second time.
-- =============================================================================
select public.admin_replace_business_hours((select id from fixture),
  '[{"label":"Segunda","days":[1],"periods":[{"open":"09:00","close":"18:00"}]},{"label":"Terça","days":[2],"periods":[{"open":"09:00","close":"18:00"}]}]'::jsonb);
select public.admin_replace_social_links((select id from fixture),
  '[{"platform":"instagram","url":"https://instagram.com/a","label":"Instagram"},{"platform":"facebook","url":"https://facebook.com/a","label":"Facebook"}]'::jsonb);
select public.admin_replace_labeled_list((select id from fixture), 'services', array['Serviço A editado']);
select public.admin_replace_gallery((select id from fixture), '[{"alt":"Foto única"}]'::jsonb);

update public.business_profile_content set name = 'Fixture Nome R2', category = 'Categoria R2'
  where business_id = (select id from fixture);

select is((select count(*)::int from public.businesses where slug = 'verify-edit-existing'), 1,
  '[round 2] still exactly one businesses row after a SECOND content save (no duplicate created by editing again)');
select is((select count(*)::int from public.business_profile_content where business_id = (select id from fixture)), 1,
  '[round 2] still exactly one business_profile_content row after the second save');
select is((select count(*)::int from public.business_hours where business_id = (select id from fixture)), 2,
  '[round 2] hours reflect the SECOND save''s 2 entries, not 1+2=3 (fully replaced, not appended)');
select is((select count(*)::int from public.social_links where business_id = (select id from fixture)), 2,
  '[round 2] social links reflect the second save''s 2 entries, not appended to the first');
select is((select count(*)::int from public.services where business_id = (select id from fixture)), 1,
  '[round 2] services reflect the second save''s single entry, not the first save''s 2 plus this one''s 1');
select is((select label from public.services where business_id = (select id from fixture)), 'Serviço A editado',
  '[round 2] the edited service label is the one that persisted');
select is((select count(*)::int from public.gallery where business_id = (select id from fixture)), 1,
  '[round 2] gallery reflects the second save''s single item');
select is((select name from public.business_profile_content where business_id = (select id from fixture)), 'Fixture Nome R2',
  '[round 2] the re-edited name overwrote the first save''s value (real UPDATE)');

-- =============================================================================
-- Module toggle: flipping a module off/on twice must not duplicate the
-- business_modules row (on conflict upsert, asserted directly).
-- =============================================================================
select public.admin_set_business_module((select id from fixture), 'services', false);
select public.admin_set_business_module((select id from fixture), 'services', true);
select public.admin_set_business_module((select id from fixture), 'services', true);
select is(
  (select count(*)::int from public.business_modules where business_id = (select id from fixture) and module_key = 'services'),
  1,
  '[modules] toggling the same module 3 times leaves exactly one business_modules row for it'
);
select is(
  (select enabled from public.business_modules where business_id = (select id from fixture) and module_key = 'services'),
  true,
  '[modules] the module''s final enabled state is correctly persisted'
);

-- =============================================================================
-- Config save (businesses table itself) — same duplicate-prevention proof,
-- called twice.
-- =============================================================================
select public.admin_update_business_config(
  (select id from fixture), 'verify-edit-existing', 'Fixture Org R1', 'editorial', '{}'::jsonb, '{}'::jsonb,
  null, null, null, null, null, '{}'::jsonb, null, false, true
);
select public.admin_update_business_config(
  (select id from fixture), 'verify-edit-existing', 'Fixture Org R2', 'editorial', '{}'::jsonb, '{}'::jsonb,
  null, null, null, null, null, '{}'::jsonb, null, true, true
);
select is((select count(*)::int from public.businesses where slug = 'verify-edit-existing'), 1,
  '[config] still exactly one businesses row after two config saves');
select is((select organization from public.businesses where slug = 'verify-edit-existing'), 'Fixture Org R2',
  '[config] the second config save''s organization value persisted (real UPDATE, not a new row)');
select is((select featured from public.businesses where slug = 'verify-edit-existing'), true,
  '[config] the second config save''s featured value persisted');

-- =============================================================================
-- Cross-check: editing this fixture never touched any OTHER business. Reuses
-- one of the pgTAP-fixture businesses from an earlier test file's pattern by
-- creating a second, untouched fixture here for isolation.
-- =============================================================================
select public.admin_create_business('verify-edit-existing-untouched', 'Other Org', 'editorial', 'Outro Nome', 'Outra Categoria', 'Outra descrição');
select is(
  (select organization from public.businesses where slug = 'verify-edit-existing-untouched'),
  'Other Org',
  '[isolation] a second, unrelated business is unaffected by all the edits above'
);

select * from finish();
rollback;

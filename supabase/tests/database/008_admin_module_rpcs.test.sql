-- PiriCard V1 security tests — Phase 4B.4 admin module write RPCs:
-- admin_set_business_module, admin_require_business_write (via its callers),
-- admin_replace_labeled_list, admin_replace_gallery,
-- admin_upsert_restaurant_info, admin_replace_menu, admin_replace_treatments,
-- admin_replace_business_hours, admin_replace_social_links.
--
-- Fixture shape (distinct ids from 005_module_gates.test.sql):
--   Business M — published, ALL 7 modules ENABLED, owned by owner_m.
--   Business N — published, ALL 7 modules DISABLED, owned by owner_n, with
--                pre-existing content in every module table (to prove a
--                blocked write never deletes it).
--   admin      — a platform admin (member of neither M nor N).
--   outsider   — authenticated, member of neither.
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'owner-m@test.piricard.local'),
  ('f1000000-0000-0000-0000-000000000002', 'owner-n@test.piricard.local'),
  ('f1000000-0000-0000-0000-000000000003', 'admin@test.piricard.local'),
  ('f1000000-0000-0000-0000-000000000004', 'outsider@test.piricard.local');

insert into public.platform_admins (user_id) values ('f1000000-0000-0000-0000-000000000003');

insert into public.businesses (id, slug, organization, layout_variant, published) values
  ('00000000-0000-0000-0000-000000000501', 'module-rpc-m', 'Module RPC M', 'editorial', true),
  ('00000000-0000-0000-0000-000000000502', 'module-rpc-n', 'Module RPC N', 'editorial', true);

insert into public.business_memberships (business_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000501', 'f1000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000502', 'f1000000-0000-0000-0000-000000000002', 'owner');

insert into public.business_modules (business_id, module_key, enabled)
select '00000000-0000-0000-0000-000000000501'::uuid, key, true
from unnest(array['services','gallery','restaurant_info','menu','treatments','brands','product_categories']) as key
union all
select '00000000-0000-0000-0000-000000000502'::uuid, key, false
from unnest(array['services','gallery','restaurant_info','menu','treatments','brands','product_categories']) as key;

-- Pre-existing content for M, so the "disabling does not delete content" check
-- below has something real to look for.
insert into public.services (business_id, label) values ('00000000-0000-0000-0000-000000000501', 'M pre-existing service');

-- Pre-existing content for N (disabled) — must survive every blocked-write check.
insert into public.services (business_id, label) values ('00000000-0000-0000-0000-000000000502', 'N existing service');
insert into public.gallery (business_id, alt) values ('00000000-0000-0000-0000-000000000502', 'N existing photo');
insert into public.restaurant_info (business_id, cuisine) values ('00000000-0000-0000-0000-000000000502', 'N existing cuisine');
insert into public.represented_brands (business_id, label) values ('00000000-0000-0000-0000-000000000502', 'N existing brand');
insert into public.product_categories (business_id, label) values ('00000000-0000-0000-0000-000000000502', 'N existing category');
insert into public.menu_sections (id, business_id, title) values ('00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000502', 'N existing section');
insert into public.menu_items (menu_section_id, name) values ('00000000-0000-0000-0000-000000000510', 'N existing item');
insert into public.treatment_groups (id, business_id, slug_key, title, description) values ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000502', 'n-group', 'N existing group', 'N description');
insert into public.treatment_items (treatment_group_id, label) values ('00000000-0000-0000-0000-000000000511', 'N existing treatment');

-- =============================================================================
-- admin_set_business_module
-- =============================================================================
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000004"}';
select throws_ok(
  $$ select public.admin_set_business_module('00000000-0000-0000-0000-000000000501', 'services', false) $$,
  '42501', null,
  '[activation] a non-admin (even the business owner) cannot call admin_set_business_module'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000001"}';
select throws_ok(
  $$ select public.admin_set_business_module('00000000-0000-0000-0000-000000000501', 'services', false) $$,
  '42501', null,
  '[activation] the business owner (member, not platform admin) cannot call admin_set_business_module'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000003"}';
select lives_ok(
  $$ select public.admin_set_business_module('00000000-0000-0000-0000-000000000501', 'services', false) $$,
  '[activation] a platform admin can disable a module'
);
select is(
  (select enabled from public.business_modules where business_id = '00000000-0000-0000-0000-000000000501' and module_key = 'services'),
  false,
  '[activation] services is now disabled for M'
);
select isnt_empty(
  $$ select 1 from public.services where business_id = '00000000-0000-0000-0000-000000000501' $$,
  '[activation] disabling a module does not delete its existing content'
);
select lives_ok(
  $$ select public.admin_set_business_module('00000000-0000-0000-0000-000000000501', 'services', true) $$,
  '[activation] a platform admin can re-enable a module'
);
select lives_ok(
  $$ select public.admin_set_business_module('00000000-0000-0000-0000-000000000501', 'gallery', true) $$,
  '[activation] admin_set_business_module upserts cleanly for an already-enabled module'
);

-- =============================================================================
-- admin_replace_labeled_list — services / represented_brands / product_categories
-- =============================================================================
set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000501', 'services', array['Service A','Service B']) $$,
  '[services] member can replace the list when enabled'
);
select results_eq(
  $$ select label from public.services where business_id = '00000000-0000-0000-0000-000000000501' order by sort_order $$,
  $$ values ('Service A'), ('Service B') $$,
  '[services] replaced list preserves given order via sort_order'
);
select lives_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000501', 'represented_brands', array['Brand A']) $$,
  '[brands] member can replace represented_brands (module_key maps to ''brands'')'
);
select lives_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000501', 'product_categories', array['Cat A']) $$,
  '[product_categories] member can replace the list when enabled'
);
select throws_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000501', 'businesses', array['x']) $$,
  'P0001', null,
  '[services] an unsupported table name is rejected before any dynamic SQL runs'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000502', 'services', array['New']) $$,
  '42501', null,
  '[services] member cannot write when the module is disabled'
);
select isnt_empty(
  $$ select 1 from public.services where business_id = '00000000-0000-0000-0000-000000000502' and label = 'N existing service' $$,
  '[services] the blocked write left existing disabled-module content untouched'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000003"}';
select throws_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000502', 'services', array['Admin write']) $$,
  '42501', null,
  '[services] a platform admin ALSO cannot write when the module is disabled (this phase''s new rule)'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000004"}';
select throws_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000501', 'services', array['Outsider']) $$,
  '42501', null,
  '[services] a non-member cannot write even to an enabled business'
);

-- =============================================================================
-- admin_replace_gallery — max 5 items, enforced server-side
-- =============================================================================
set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ select public.admin_replace_gallery('00000000-0000-0000-0000-000000000501', '[{"alt":"Photo 1"},{"alt":"Photo 2"}]'::jsonb) $$,
  '[gallery] member can replace the gallery (2 items) when enabled'
);
select is(
  (select count(*) from public.gallery where business_id = '00000000-0000-0000-0000-000000000501'),
  2::bigint,
  '[gallery] exactly the given items were written'
);
select throws_ok(
  $$ select public.admin_replace_gallery('00000000-0000-0000-0000-000000000501', '[{"alt":"1"},{"alt":"2"},{"alt":"3"},{"alt":"4"},{"alt":"5"},{"alt":"6"}]'::jsonb) $$,
  '23514', null,
  '[gallery] a 6th item is rejected server-side (max 5 enforced)'
);
select is(
  (select count(*) from public.gallery where business_id = '00000000-0000-0000-0000-000000000501'),
  2::bigint,
  '[gallery] the rejected over-limit write left the previous gallery untouched (whole call rolled back)'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_replace_gallery('00000000-0000-0000-0000-000000000502', '[{"alt":"New"}]'::jsonb) $$,
  '42501', null,
  '[gallery] member cannot write when the module is disabled'
);

-- =============================================================================
-- admin_upsert_restaurant_info
-- =============================================================================
set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ select public.admin_upsert_restaurant_info('00000000-0000-0000-0000-000000000501', '10-15 €', null, 'Grelhados', null) $$,
  '[restaurant_info] member can upsert when enabled'
);
select is(
  (select cuisine from public.restaurant_info where business_id = '00000000-0000-0000-0000-000000000501'),
  'Grelhados',
  '[restaurant_info] upsert wrote the given value'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_upsert_restaurant_info('00000000-0000-0000-0000-000000000502', 'x', null, 'y', null) $$,
  '42501', null,
  '[restaurant_info] member cannot write when the module is disabled'
);
select is(
  (select cuisine from public.restaurant_info where business_id = '00000000-0000-0000-0000-000000000502'),
  'N existing cuisine',
  '[restaurant_info] the blocked write left existing disabled-module content untouched'
);

-- =============================================================================
-- admin_replace_menu — nested sections -> items
-- =============================================================================
set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ select public.admin_replace_menu('00000000-0000-0000-0000-000000000501',
       '[{"title":"Principal","items":[{"name":"Prato A","price":"10€"},{"name":"Prato B"}]},{"title":"Sobremesas","items":[{"name":"Doce"}]}]'::jsonb) $$,
  '[menu] member can replace the full menu when enabled'
);
select is(
  (select count(*) from public.menu_sections where business_id = '00000000-0000-0000-0000-000000000501'),
  2::bigint,
  '[menu] both sections were created'
);
select is(
  (select count(*) from public.menu_items where business_id = '00000000-0000-0000-0000-000000000501'),
  3::bigint,
  '[menu] all items across both sections were created, business_id trigger-derived correctly'
);
select results_eq(
  $$ select mi.name from public.menu_items mi join public.menu_sections ms on ms.id = mi.menu_section_id
     where ms.business_id = '00000000-0000-0000-0000-000000000501' and ms.title = 'Principal' order by mi.sort_order $$,
  $$ values ('Prato A'), ('Prato B') $$,
  '[menu] item order within a section is preserved'
);
select lives_ok(
  $$ select public.admin_replace_menu('00000000-0000-0000-0000-000000000501', '[{"title":"Novo","items":[]}]'::jsonb) $$,
  '[menu] replacing again fully removes the previous sections/items (cascade)'
);
select is(
  (select count(*) from public.menu_sections where business_id = '00000000-0000-0000-0000-000000000501'),
  1::bigint,
  '[menu] only the new section remains after replace'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_replace_menu('00000000-0000-0000-0000-000000000502', '[{"title":"x","items":[]}]'::jsonb) $$,
  '42501', null,
  '[menu] member cannot write when the module is disabled'
);
select isnt_empty(
  $$ select 1 from public.menu_sections where business_id = '00000000-0000-0000-0000-000000000502' and title = 'N existing section' $$,
  '[menu] the blocked write left the existing disabled-module menu untouched'
);

-- =============================================================================
-- admin_replace_treatments — nested groups -> items
-- =============================================================================
set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ select public.admin_replace_treatments('00000000-0000-0000-0000-000000000501',
       '[{"id":"rosto","title":"Rosto","description":"Cuidados faciais","items":["Limpeza","Peeling"]}]'::jsonb) $$,
  '[treatments] member can replace the full set when enabled'
);
select is(
  (select slug_key from public.treatment_groups where business_id = '00000000-0000-0000-0000-000000000501'),
  'rosto',
  '[treatments] the given id is stored as slug_key'
);
select results_eq(
  $$ select ti.label from public.treatment_items ti join public.treatment_groups tg on tg.id = ti.treatment_group_id
     where tg.business_id = '00000000-0000-0000-0000-000000000501' order by ti.sort_order $$,
  $$ values ('Limpeza'), ('Peeling') $$,
  '[treatments] item order within a group is preserved'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_replace_treatments('00000000-0000-0000-0000-000000000502', '[{"id":"x","title":"x","items":[]}]'::jsonb) $$,
  '42501', null,
  '[treatments] member cannot write when the module is disabled'
);

-- =============================================================================
-- admin_replace_business_hours / admin_replace_social_links (core, ungated —
-- fixes the Phase 4B.3 insert-then-delete atomicity note)
-- =============================================================================
set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ select public.admin_replace_business_hours('00000000-0000-0000-0000-000000000501',
       '[{"label":"Segunda","days":[1],"periods":[{"open":"09:00","close":"18:00"}]},{"label":"Domingo","days":[0],"periods":[]}]'::jsonb) $$,
  '[hours] member can atomically replace business_hours'
);
select is(
  (select count(*) from public.business_hours where business_id = '00000000-0000-0000-0000-000000000501'),
  2::bigint,
  '[hours] both rows were written in one call'
);
select lives_ok(
  $$ select public.admin_replace_social_links('00000000-0000-0000-0000-000000000501',
       '[{"platform":"instagram","url":"https://instagram.com/a","label":"Instagram"}]'::jsonb) $$,
  '[social] member can atomically replace social_links'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"f1000000-0000-0000-0000-000000000004"}';
select throws_ok(
  $$ select public.admin_replace_business_hours('00000000-0000-0000-0000-000000000501', '[]'::jsonb) $$,
  '42501', null,
  '[hours] a non-member cannot write even to an enabled business'
);
select throws_ok(
  $$ select public.admin_replace_social_links('00000000-0000-0000-0000-000000000501', '[]'::jsonb) $$,
  '42501', null,
  '[social] a non-member cannot write even to an enabled business'
);

-- =============================================================================
-- No application role may call the underlying functions with elevated
-- privilege beyond what's documented: anon can call none of these at all.
-- =============================================================================
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.admin_set_business_module('00000000-0000-0000-0000-000000000501', 'services', false) $$,
  '42501', null,
  '[activation] anon cannot call admin_set_business_module at all (no EXECUTE grant)'
);
select throws_ok(
  $$ select public.admin_replace_labeled_list('00000000-0000-0000-0000-000000000501', 'services', array['x']) $$,
  '42501', null,
  '[services] anon cannot call admin_replace_labeled_list at all (no EXECUTE grant)'
);

select * from finish();
rollback;

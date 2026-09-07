-- PiriCard V1 security tests — full module-gating matrix for all 7 modules:
-- services, gallery, restaurant_info, menu, treatments, brands, product_categories.
--
-- Fixture shape, shared across all 7 modules:
--   Business G — published, ALL 7 modules ENABLED, owned by owner_g.
--   Business H — published, ALL 7 modules DISABLED, owned by owner_h, but with
--                the SAME pre-existing content rows as G (proving disabled
--                content isn't deleted, only hidden).
--   outsider   — an authenticated user who is a member of neither G nor H.
--
-- Per module, six checks:
--   1. ENABLED + published  -> public (anon) can read.
--   2. ENABLED               -> owner can write (insert new content / update
--                                the 1:1 row for restaurant_info).
--   3. DISABLED + published -> public (anon) cannot read existing content.
--   4. DISABLED              -> owner CAN still read their own existing
--                                content (approved V1 behavior).
--   5. DISABLED              -> owner cannot write.
--   6. cross-business        -> a non-member (outsider) cannot write, even
--                                against the ENABLED business G.
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- ---------------------------------------------------------------------------
-- Fixtures (as the unrestricted test-runner role)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'owner-g@test.piricard.local'),
  ('e0000000-0000-0000-0000-000000000002', 'owner-h@test.piricard.local'),
  ('e0000000-0000-0000-0000-000000000003', 'outsider@test.piricard.local');

insert into public.businesses (id, slug, organization, layout_variant, published) values
  ('00000000-0000-0000-0000-000000000401', 'module-gate-g', 'Module Gate G', 'editorial', true),
  ('00000000-0000-0000-0000-000000000402', 'module-gate-h', 'Module Gate H', 'editorial', true);

insert into public.business_memberships (business_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000401', 'e0000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000402', 'e0000000-0000-0000-0000-000000000002', 'owner');

insert into public.business_modules (business_id, module_key, enabled)
select '00000000-0000-0000-0000-000000000401'::uuid, key, true
from unnest(array['services','gallery','restaurant_info','menu','treatments','brands','product_categories']) as key
union all
select '00000000-0000-0000-0000-000000000402'::uuid, key, false
from unnest(array['services','gallery','restaurant_info','menu','treatments','brands','product_categories']) as key;

-- services
insert into public.services (id, business_id, label) values
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000401', 'G service'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000402', 'H service');
-- gallery
insert into public.gallery (id, business_id, alt) values
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000401', 'G photo'),
  ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000402', 'H photo');
-- restaurant_info (1:1)
insert into public.restaurant_info (business_id, cuisine) values
  ('00000000-0000-0000-0000-000000000401', 'G cuisine'),
  ('00000000-0000-0000-0000-000000000402', 'H cuisine');
-- represented_brands
insert into public.represented_brands (id, business_id, label) values
  ('00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-000000000401', 'G brand'),
  ('00000000-0000-0000-0000-000000000416', '00000000-0000-0000-0000-000000000402', 'H brand');
-- product_categories
insert into public.product_categories (id, business_id, label) values
  ('00000000-0000-0000-0000-000000000417', '00000000-0000-0000-0000-000000000401', 'G category'),
  ('00000000-0000-0000-0000-000000000418', '00000000-0000-0000-0000-000000000402', 'H category');
-- menu (section + item; item.business_id is trigger-derived, not supplied)
insert into public.menu_sections (id, business_id, title) values
  ('00000000-0000-0000-0000-000000000419', '00000000-0000-0000-0000-000000000401', 'G section'),
  ('00000000-0000-0000-0000-000000000421', '00000000-0000-0000-0000-000000000402', 'H section');
insert into public.menu_items (id, menu_section_id, name) values
  ('00000000-0000-0000-0000-000000000420', '00000000-0000-0000-0000-000000000419', 'G item'),
  ('00000000-0000-0000-0000-000000000422', '00000000-0000-0000-0000-000000000421', 'H item');
-- treatments (group + item; item.business_id is trigger-derived, not supplied)
insert into public.treatment_groups (id, business_id, slug_key, title, description) values
  ('00000000-0000-0000-0000-000000000423', '00000000-0000-0000-0000-000000000401', 'g-group', 'G group', 'G description'),
  ('00000000-0000-0000-0000-000000000425', '00000000-0000-0000-0000-000000000402', 'h-group', 'H group', 'H description');
insert into public.treatment_items (id, treatment_group_id, label) values
  ('00000000-0000-0000-0000-000000000424', '00000000-0000-0000-0000-000000000423', 'G treatment item'),
  ('00000000-0000-0000-0000-000000000426', '00000000-0000-0000-0000-000000000425', 'H treatment item');

-- =============================================================================
-- services
-- =============================================================================
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select isnt_empty(
  $$ select 1 from public.services where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[services] public can read when enabled + published'
);
select is_empty(
  $$ select 1 from public.services where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[services] public cannot read when disabled'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ insert into public.services (business_id, label) values ('00000000-0000-0000-0000-000000000401', 'G new service') $$,
  '[services] member can write when enabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000002"}';
select isnt_empty(
  $$ select 1 from public.services where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[services] member can still read own content when disabled'
);
select throws_ok(
  $$ insert into public.services (business_id, label) values ('00000000-0000-0000-0000-000000000402', 'H new service') $$,
  '42501', null,
  '[services] member cannot write when disabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000003"}';
select throws_ok(
  $$ insert into public.services (business_id, label) values ('00000000-0000-0000-0000-000000000401', 'Outsider service') $$,
  '42501', null,
  '[services] non-member cannot write even to an enabled business'
);

-- =============================================================================
-- gallery
-- =============================================================================
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select isnt_empty(
  $$ select 1 from public.gallery where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[gallery] public can read when enabled + published'
);
select is_empty(
  $$ select 1 from public.gallery where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[gallery] public cannot read when disabled'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ insert into public.gallery (business_id, alt) values ('00000000-0000-0000-0000-000000000401', 'G new photo') $$,
  '[gallery] member can write when enabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000002"}';
select isnt_empty(
  $$ select 1 from public.gallery where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[gallery] member can still read own content when disabled'
);
select throws_ok(
  $$ insert into public.gallery (business_id, alt) values ('00000000-0000-0000-0000-000000000402', 'H new photo') $$,
  '42501', null,
  '[gallery] member cannot write when disabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000003"}';
select throws_ok(
  $$ insert into public.gallery (business_id, alt) values ('00000000-0000-0000-0000-000000000401', 'Outsider photo') $$,
  '42501', null,
  '[gallery] non-member cannot write even to an enabled business'
);

-- =============================================================================
-- restaurant_info (1:1 — write is UPDATE, so disabled/cross-business checks use
-- the RETURNING/results_ne pattern: USING filters the row out silently, no throw)
-- =============================================================================
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select isnt_empty(
  $$ select 1 from public.restaurant_info where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[restaurant_info] public can read when enabled + published'
);
select is_empty(
  $$ select 1 from public.restaurant_info where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[restaurant_info] public cannot read when disabled'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ update public.restaurant_info set cuisine = 'G cuisine updated' where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[restaurant_info] member can write when enabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000002"}';
select isnt_empty(
  $$ select 1 from public.restaurant_info where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[restaurant_info] member can still read own content when disabled'
);
select results_ne(
  $$ update public.restaurant_info set cuisine = 'Should not stick' where business_id = '00000000-0000-0000-0000-000000000402' returning 1 $$,
  $$ values (1) $$,
  '[restaurant_info] member cannot write when disabled (RLS silently matches zero rows)'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000003"}';
select results_ne(
  $$ update public.restaurant_info set cuisine = 'Outsider write' where business_id = '00000000-0000-0000-0000-000000000401' returning 1 $$,
  $$ values (1) $$,
  '[restaurant_info] non-member cannot write even to an enabled business (RLS silently matches zero rows)'
);

-- =============================================================================
-- represented_brands ("brands" module key)
-- =============================================================================
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select isnt_empty(
  $$ select 1 from public.represented_brands where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[brands] public can read when enabled + published'
);
select is_empty(
  $$ select 1 from public.represented_brands where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[brands] public cannot read when disabled'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ insert into public.represented_brands (business_id, label) values ('00000000-0000-0000-0000-000000000401', 'G new brand') $$,
  '[brands] member can write when enabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000002"}';
select isnt_empty(
  $$ select 1 from public.represented_brands where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[brands] member can still read own content when disabled'
);
select throws_ok(
  $$ insert into public.represented_brands (business_id, label) values ('00000000-0000-0000-0000-000000000402', 'H new brand') $$,
  '42501', null,
  '[brands] member cannot write when disabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000003"}';
select throws_ok(
  $$ insert into public.represented_brands (business_id, label) values ('00000000-0000-0000-0000-000000000401', 'Outsider brand') $$,
  '42501', null,
  '[brands] non-member cannot write even to an enabled business'
);

-- =============================================================================
-- product_categories
-- =============================================================================
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select isnt_empty(
  $$ select 1 from public.product_categories where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[product_categories] public can read when enabled + published'
);
select is_empty(
  $$ select 1 from public.product_categories where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[product_categories] public cannot read when disabled'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ insert into public.product_categories (business_id, label) values ('00000000-0000-0000-0000-000000000401', 'G new category') $$,
  '[product_categories] member can write when enabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000002"}';
select isnt_empty(
  $$ select 1 from public.product_categories where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[product_categories] member can still read own content when disabled'
);
select throws_ok(
  $$ insert into public.product_categories (business_id, label) values ('00000000-0000-0000-0000-000000000402', 'H new category') $$,
  '42501', null,
  '[product_categories] member cannot write when disabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000003"}';
select throws_ok(
  $$ insert into public.product_categories (business_id, label) values ('00000000-0000-0000-0000-000000000401', 'Outsider category') $$,
  '42501', null,
  '[product_categories] non-member cannot write even to an enabled business'
);

-- =============================================================================
-- menu (via menu_items; business_id is trigger-derived from menu_section_id)
-- =============================================================================
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select isnt_empty(
  $$ select 1 from public.menu_items where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[menu] public can read when enabled + published'
);
select is_empty(
  $$ select 1 from public.menu_items where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[menu] public cannot read when disabled'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ insert into public.menu_items (menu_section_id, name) values ('00000000-0000-0000-0000-000000000419', 'G new item') $$,
  '[menu] member can write when enabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000002"}';
select isnt_empty(
  $$ select 1 from public.menu_items where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[menu] member can still read own content when disabled'
);
select throws_ok(
  $$ insert into public.menu_items (menu_section_id, name) values ('00000000-0000-0000-0000-000000000421', 'H new item') $$,
  '42501', null,
  '[menu] member cannot write when disabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000003"}';
select throws_ok(
  $$ insert into public.menu_items (menu_section_id, name) values ('00000000-0000-0000-0000-000000000419', 'Outsider item') $$,
  '42501', null,
  '[menu] non-member cannot write even to an enabled business'
);

-- =============================================================================
-- treatments (via treatment_items; business_id is trigger-derived from
-- treatment_group_id)
-- =============================================================================
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select isnt_empty(
  $$ select 1 from public.treatment_items where business_id = '00000000-0000-0000-0000-000000000401' $$,
  '[treatments] public can read when enabled + published'
);
select is_empty(
  $$ select 1 from public.treatment_items where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[treatments] public cannot read when disabled'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000001"}';
select lives_ok(
  $$ insert into public.treatment_items (treatment_group_id, label) values ('00000000-0000-0000-0000-000000000423', 'G new treatment item') $$,
  '[treatments] member can write when enabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000002"}';
select isnt_empty(
  $$ select 1 from public.treatment_items where business_id = '00000000-0000-0000-0000-000000000402' $$,
  '[treatments] member can still read own content when disabled'
);
select throws_ok(
  $$ insert into public.treatment_items (treatment_group_id, label) values ('00000000-0000-0000-0000-000000000425', 'H new treatment item') $$,
  '42501', null,
  '[treatments] member cannot write when disabled'
);

set local request.jwt.claims to '{"role":"authenticated","sub":"e0000000-0000-0000-0000-000000000003"}';
select throws_ok(
  $$ insert into public.treatment_items (treatment_group_id, label) values ('00000000-0000-0000-0000-000000000423', 'Outsider treatment item') $$,
  '42501', null,
  '[treatments] non-member cannot write even to an enabled business'
);

select * from finish();
rollback;

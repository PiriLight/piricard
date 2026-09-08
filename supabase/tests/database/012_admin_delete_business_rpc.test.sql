-- PiriCard V1 security tests — pre-deployment addition: admin_delete_business
-- (20260908120000_admin_delete_business_rpc.sql).
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email) values
  ('f5000000-0000-0000-0000-000000000001', 'delete-admin@test.piricard.local'),
  ('f5000000-0000-0000-0000-000000000002', 'delete-outsider@test.piricard.local');
insert into public.platform_admins (user_id) values ('f5000000-0000-0000-0000-000000000001');

-- Two businesses (A = the one actually deleted, B = the control that must
-- stay completely untouched throughout every test below).
insert into public.businesses (id, slug, organization, layout_variant, published, archived_at) values
  ('f5100000-0000-0000-0000-00000000000a', 'verify-delete-a', 'Org A', 'editorial', false, null),
  ('f5100000-0000-0000-0000-00000000000b', 'verify-delete-b', 'Org B', 'editorial', false, null);
insert into public.business_profile_content (business_id, name, category, directory_description) values
  ('f5100000-0000-0000-0000-00000000000a', 'Business A', 'Test', 'A, the one being deleted.'),
  ('f5100000-0000-0000-0000-00000000000b', 'Business B', 'Test', 'B, the control.');

-- Give A one row in every remaining business-owned table so cascade can be
-- checked exhaustively — including the two tables (menu_items,
-- treatment_items) that carry their OWN direct business_id FK in addition
-- to their parent-row FK, per the actual schema (verified via
-- information_schema.referential_constraints before writing this test).
insert into public.business_hours (business_id, label, days) values ('f5100000-0000-0000-0000-00000000000a', 'Segunda', array[1]::smallint[]);
insert into public.social_links (business_id, platform, url, label) values ('f5100000-0000-0000-0000-00000000000a', 'instagram', 'https://instagram.com/x', 'Instagram');
insert into public.business_modules (business_id, module_key, enabled) values ('f5100000-0000-0000-0000-00000000000a', 'services', true);
insert into public.services (business_id, label) values ('f5100000-0000-0000-0000-00000000000a', 'Serviço A');
insert into public.gallery (business_id, alt) values ('f5100000-0000-0000-0000-00000000000a', 'Foto A');
insert into public.restaurant_info (business_id, cuisine) values ('f5100000-0000-0000-0000-00000000000a', 'Cozinha A');
insert into public.represented_brands (business_id, label) values ('f5100000-0000-0000-0000-00000000000a', 'Marca A');
insert into public.product_categories (business_id, label) values ('f5100000-0000-0000-0000-00000000000a', 'Categoria A');
insert into public.menu_sections (id, business_id, title) values ('f5200000-0000-0000-0000-00000000000a', 'f5100000-0000-0000-0000-00000000000a', 'Secção A');
insert into public.menu_items (business_id, menu_section_id, name) values ('f5100000-0000-0000-0000-00000000000a', 'f5200000-0000-0000-0000-00000000000a', 'Prato A');
insert into public.treatment_groups (id, business_id, slug_key, title, description) values ('f5300000-0000-0000-0000-00000000000a', 'f5100000-0000-0000-0000-00000000000a', 'grupo-a', 'Grupo A', 'Descrição');
insert into public.treatment_items (business_id, treatment_group_id, label) values ('f5100000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a', 'Tratamento A');
-- business_memberships needs a real auth.users row; reuse the outsider.
insert into public.business_memberships (business_id, user_id, role) values ('f5100000-0000-0000-0000-00000000000a', 'f5000000-0000-0000-0000-000000000002', 'owner');

-- =============================================================================
-- Authorization
-- =============================================================================

reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.admin_delete_business('f5100000-0000-0000-0000-00000000000a', 'verify-delete-a') $$,
  '42501', null,
  '[auth] anon cannot call admin_delete_business at all (no EXECUTE grant)'
);

reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"f5000000-0000-0000-0000-000000000002"}';
select throws_ok(
  $$ select public.admin_delete_business('f5100000-0000-0000-0000-00000000000a', 'verify-delete-a') $$,
  '42501', null,
  '[auth] a non-admin authenticated user (even a business member) cannot delete a business'
);
select isnt_empty(
  $$ select 1 from public.businesses where id = 'f5100000-0000-0000-0000-00000000000a' $$,
  '[auth] the rejected non-admin call left business A untouched'
);

-- =============================================================================
-- Identity verification (Step 8: stale/mismatched id+slug aborts)
-- =============================================================================

set local request.jwt.claims to '{"role":"authenticated","sub":"f5000000-0000-0000-0000-000000000001"}';

select throws_ok(
  $$ select public.admin_delete_business('f5100000-0000-0000-0000-00000000000a', 'wrong-slug-entirely') $$,
  '42501', null,
  '[identity] a business_id that exists but with the WRONG expected_slug aborts'
);
select isnt_empty(
  $$ select 1 from public.businesses where id = 'f5100000-0000-0000-0000-00000000000a' $$,
  '[identity] the slug-mismatch call deleted nothing'
);

select throws_ok(
  $$ select public.admin_delete_business('f5100000-0000-0000-0000-00000000000a', 'verify-delete-b') $$,
  '42501', null,
  '[identity] business A''s id with business B''s slug also aborts (cross-business confusion is not silently accepted)'
);

select throws_ok(
  $$ select public.admin_delete_business('00000000-0000-0000-0000-000000000000', 'verify-delete-a') $$,
  'P0002', null,
  '[identity] a nonexistent business_id aborts with "not found", never silently succeeds'
);

select throws_ok(
  $$ select public.admin_delete_business(null, 'verify-delete-a') $$,
  '22023', null,
  '[identity] a null business_id is rejected outright'
);
select throws_ok(
  $$ select public.admin_delete_business('f5100000-0000-0000-0000-00000000000a', '') $$,
  '22023', null,
  '[identity] an empty expected_slug is rejected outright'
);

-- =============================================================================
-- The actual deletion + full cascade verification
-- =============================================================================

select lives_ok(
  $$ select public.admin_delete_business('f5100000-0000-0000-0000-00000000000a', 'verify-delete-a') $$,
  '[delete] a platform admin can delete business A once id+slug both match exactly'
);

select is_empty(
  $$ select 1 from public.businesses where id = 'f5100000-0000-0000-0000-00000000000a' $$,
  '[delete] business A''s own row is gone'
);
select is(
  (select count(*)::int from public.businesses),
  1,
  '[delete] exactly one business row remains — the count decreased by exactly 1, not more'
);

-- Every child table checked individually, by business_id — none may have a
-- leftover row for A's (now-deleted) id.
select is_empty($$ select 1 from public.business_profile_content where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] business_profile_content row is gone');
select is_empty($$ select 1 from public.business_hours where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] business_hours row is gone');
select is_empty($$ select 1 from public.social_links where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] social_links row is gone');
select is_empty($$ select 1 from public.business_modules where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] business_modules row is gone');
select is_empty($$ select 1 from public.services where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] services row is gone');
select is_empty($$ select 1 from public.gallery where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] gallery row is gone');
select is_empty($$ select 1 from public.restaurant_info where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] restaurant_info row is gone');
select is_empty($$ select 1 from public.represented_brands where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] represented_brands row is gone');
select is_empty($$ select 1 from public.product_categories where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] product_categories row is gone');
select is_empty($$ select 1 from public.menu_sections where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] menu_sections row is gone');
select is_empty($$ select 1 from public.menu_items where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] menu_items row is gone');
select is_empty($$ select 1 from public.treatment_groups where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] treatment_groups row is gone');
select is_empty($$ select 1 from public.treatment_items where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] treatment_items row is gone');
select is_empty($$ select 1 from public.business_memberships where business_id = 'f5100000-0000-0000-0000-00000000000a' $$, '[cascade] business_memberships row is gone');

-- =============================================================================
-- Cross-business isolation and repeated-delete safety
-- =============================================================================

select results_eq(
  $$ select slug, organization from public.businesses where id = 'f5100000-0000-0000-0000-00000000000b' $$,
  $$ values ('verify-delete-b'::text, 'Org B'::text) $$,
  '[isolation] business B (never targeted) is completely unaffected — same slug, same organization'
);
select isnt_empty(
  $$ select 1 from public.business_profile_content where business_id = 'f5100000-0000-0000-0000-00000000000b' and name = 'Business B' $$,
  '[isolation] business B''s content row is untouched'
);

select throws_ok(
  $$ select public.admin_delete_business('f5100000-0000-0000-0000-00000000000a', 'verify-delete-a') $$,
  'P0002', null,
  '[repeat] deleting the same (now-gone) id again aborts with "not found" — never affects any other row'
);
select results_eq(
  $$ select slug from public.businesses where id = 'f5100000-0000-0000-0000-00000000000b' $$,
  $$ values ('verify-delete-b'::text) $$,
  '[repeat] the repeated-delete attempt still left business B untouched'
);

select * from finish();
rollback;

-- PiriCard V1 security tests — cross-tenant isolation with two real, separate
-- membership fixtures (Business A owner vs Business B editor).
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner-a@test.piricard.local'),
  ('b0000000-0000-0000-0000-000000000002', 'editor-b@test.piricard.local');

insert into public.businesses (id, slug, organization, layout_variant, published) values
  ('00000000-0000-0000-0000-000000000201', 'cross-a', 'Cross Test A', 'editorial', true),
  ('00000000-0000-0000-0000-000000000202', 'cross-b', 'Cross Test B', 'editorial', false);

insert into public.business_profile_content (business_id, name, category, directory_description) values
  ('00000000-0000-0000-0000-000000000201', 'Cross Test A', 'Test', 'A content.'),
  ('00000000-0000-0000-0000-000000000202', 'Cross Test B', 'Test', 'B content.');

insert into public.business_memberships (business_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000202', 'b0000000-0000-0000-0000-000000000002', 'editor');

-- ---------------------------------------------------------------------------
-- As Business A's owner: only see Business A's membership row, not B's.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"a0000000-0000-0000-0000-000000000001"}';

select results_eq(
  $$ select business_id from public.business_memberships order by business_id $$,
  $$ values ('00000000-0000-0000-0000-000000000201'::uuid) $$,
  'Business A owner sees only their own membership row, not Business B''s'
);

-- GRANT allows UPDATE for `authenticated` in general; RLS filters the row out of
-- the USING clause instead of throwing, so the update just matches zero rows.
select results_ne(
  $$ update public.business_profile_content set name = 'Pwned' where business_id = '00000000-0000-0000-0000-000000000202' returning 1 $$,
  $$ values (1) $$,
  'Business A owner cannot update Business B profile content (RLS silently matches zero rows)'
);

select is_empty(
  $$ select 1 from public.business_profile_content where business_id = '00000000-0000-0000-0000-000000000202' $$,
  'Business A owner cannot even read Business B''s (unpublished) profile content'
);

-- ---------------------------------------------------------------------------
-- As Business B's editor: symmetric checks the other direction.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"role":"authenticated","sub":"b0000000-0000-0000-0000-000000000002"}';

select results_eq(
  $$ select business_id from public.business_memberships order by business_id $$,
  $$ values ('00000000-0000-0000-0000-000000000202'::uuid) $$,
  'Business B editor sees only their own membership row, not Business A''s'
);

select results_ne(
  $$ update public.business_profile_content set name = 'Pwned' where business_id = '00000000-0000-0000-0000-000000000201' returning 1 $$,
  $$ values (1) $$,
  'Business B editor cannot update Business A profile content (RLS silently matches zero rows)'
);

-- Business A is published, so B *can* read A's public content (that's expected
-- and correct — publication is public by design) but still cannot write it.
select lives_ok(
  $$ select 1 from public.business_profile_content where business_id = '00000000-0000-0000-0000-000000000201' $$,
  'Business B editor CAN read Business A''s published profile content (public data), just not write it'
);

select * from finish();
rollback;

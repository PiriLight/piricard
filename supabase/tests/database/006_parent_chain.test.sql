-- PiriCard V1 security tests — parent-ownership chain enforcement (Task 9):
--   menu_items       -> menu_sections       -> business
--   treatment_items  -> treatment_groups    -> business
--
-- Proves the redundant business_id column on both child tables can never
-- drift from its true parent, and that RLS correctly uses that column to
-- block cross-business writes and business_id-spoofing attempts.
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'owner-p@test.piricard.local'),
  ('f0000000-0000-0000-0000-000000000002', 'owner-q@test.piricard.local');

insert into public.businesses (id, slug, organization, layout_variant, published) values
  ('00000000-0000-0000-0000-000000000601', 'chain-p', 'Chain P', 'editorial', true),
  ('00000000-0000-0000-0000-000000000602', 'chain-q', 'Chain Q', 'editorial', true);

insert into public.business_memberships (business_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000601', 'f0000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000602', 'f0000000-0000-0000-0000-000000000002', 'owner');

insert into public.business_modules (business_id, module_key, enabled)
select business_id, key, true
from (values ('00000000-0000-0000-0000-000000000601'::uuid), ('00000000-0000-0000-0000-000000000602'::uuid)) as b(business_id)
cross join unnest(array['menu','treatments']) as key;

insert into public.menu_sections (id, business_id, title) values
  ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000601', 'P section'),
  ('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-000000000602', 'Q section');
insert into public.menu_items (id, menu_section_id, name) values
  ('00000000-0000-0000-0000-000000000615', '00000000-0000-0000-0000-000000000611', 'P existing item');

insert into public.treatment_groups (id, business_id, slug_key, title, description) values
  ('00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000601', 'p-group', 'P group', 'P description'),
  ('00000000-0000-0000-0000-000000000614', '00000000-0000-0000-0000-000000000602', 'q-group', 'Q group', 'Q description');
insert into public.treatment_items (id, treatment_group_id, label) values
  ('00000000-0000-0000-0000-000000000616', '00000000-0000-0000-0000-000000000613', 'P existing treatment item');

-- ---------------------------------------------------------------------------
-- menu_items -> menu_sections -> business
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"f0000000-0000-0000-0000-000000000001"}';

-- 1. Owner P inserts into their own section, business_id left unset by the
-- client entirely — the trigger must still fill it correctly.
select lives_ok(
  $$ insert into public.menu_items (menu_section_id, name) values ('00000000-0000-0000-0000-000000000611', 'P new item') $$,
  '[menu chain] owner P can insert into their own menu_section'
);
select results_eq(
  $$ select business_id from public.menu_items where menu_section_id = '00000000-0000-0000-0000-000000000611' and name = 'P new item' $$,
  $$ values ('00000000-0000-0000-0000-000000000601'::uuid) $$,
  '[menu chain] the trigger correctly derives business_id from the parent section, unset by the client'
);

-- 2. Owner P cannot insert into Q''s section at all (not a member of Q).
select throws_ok(
  $$ insert into public.menu_items (menu_section_id, name) values ('00000000-0000-0000-0000-000000000612', 'P intrusion into Q') $$,
  '42501', null,
  '[menu chain] owner P cannot insert into a menu_section belonging to business Q'
);

-- 3. Owner P inserts into their OWN section but spoofs business_id = Q''s id.
-- The trigger must overwrite it back to P before RLS evaluates WITH CHECK, so
-- the insert succeeds AND lands with the true (P) business_id, not the spoof.
select lives_ok(
  $$ insert into public.menu_items (menu_section_id, business_id, name) values ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000602', 'P spoof attempt') $$,
  '[menu chain] spoofing business_id on insert does not block the legitimate owner'
);
select results_eq(
  $$ select business_id from public.menu_items where menu_section_id = '00000000-0000-0000-0000-000000000611' and name = 'P spoof attempt' $$,
  $$ values ('00000000-0000-0000-0000-000000000601'::uuid) $$,
  '[menu chain] the trigger overwrites a spoofed business_id back to the true parent business (P, not Q)'
);

-- 4. Owner P cannot move their existing item to Q''s section (escalation via
-- UPDATE) — the trigger recomputes business_id=Q on the new row, and WITH
-- CHECK then correctly rejects it since P is not a member of Q.
select throws_ok(
  $$ update public.menu_items set menu_section_id = '00000000-0000-0000-0000-000000000612' where id = '00000000-0000-0000-0000-000000000615' $$,
  '42501', null,
  '[menu chain] owner P cannot re-parent their own item onto business Q''s section'
);

-- ---------------------------------------------------------------------------
-- treatment_items -> treatment_groups -> business
-- ---------------------------------------------------------------------------

-- 5. Owner P inserts into their own group, business_id left unset.
select lives_ok(
  $$ insert into public.treatment_items (treatment_group_id, label) values ('00000000-0000-0000-0000-000000000613', 'P new treatment item') $$,
  '[treatment chain] owner P can insert into their own treatment_group'
);
select results_eq(
  $$ select business_id from public.treatment_items where treatment_group_id = '00000000-0000-0000-0000-000000000613' and label = 'P new treatment item' $$,
  $$ values ('00000000-0000-0000-0000-000000000601'::uuid) $$,
  '[treatment chain] the trigger correctly derives business_id from the parent group, unset by the client'
);

-- 6. Owner P cannot insert into Q''s group.
select throws_ok(
  $$ insert into public.treatment_items (treatment_group_id, label) values ('00000000-0000-0000-0000-000000000614', 'P intrusion into Q') $$,
  '42501', null,
  '[treatment chain] owner P cannot insert into a treatment_group belonging to business Q'
);

-- 7. Owner P inserts into their own group but spoofs business_id = Q''s id.
select lives_ok(
  $$ insert into public.treatment_items (treatment_group_id, business_id, label) values ('00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000602', 'P spoof attempt') $$,
  '[treatment chain] spoofing business_id on insert does not block the legitimate owner'
);
select results_eq(
  $$ select business_id from public.treatment_items where treatment_group_id = '00000000-0000-0000-0000-000000000613' and label = 'P spoof attempt' $$,
  $$ values ('00000000-0000-0000-0000-000000000601'::uuid) $$,
  '[treatment chain] the trigger overwrites a spoofed business_id back to the true parent business (P, not Q)'
);

select * from finish();
rollback;

-- PiriCard V1 security tests — Phase 4H: piricard-assets Storage bucket +
-- RLS policies (supabase/migrations/20260907150000_piricard_assets_storage.sql).
--
-- Run with: supabase test db   (requires `supabase start`, i.e. Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('f4000000-0000-0000-0000-000000000001', 'storage-admin@test.piricard.local'),
  ('f4000000-0000-0000-0000-000000000002', 'storage-outsider@test.piricard.local');
insert into public.platform_admins (user_id) values ('f4000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Bucket configuration itself.
-- ---------------------------------------------------------------------------
select is(
  (select public from storage.buckets where id = 'piricard-assets'),
  true,
  '[bucket] piricard-assets is public (durable, non-expiring public object URLs)'
);
select is(
  (select file_size_limit from storage.buckets where id = 'piricard-assets'),
  5242880::bigint,
  '[bucket] file_size_limit matches the app''s own 5 MiB validation'
);
select results_eq(
  $$ select unnest(allowed_mime_types) from storage.buckets where id = 'piricard-assets' order by 1 $$,
  $$ values ('image/gif'), ('image/jpeg'), ('image/png'), ('image/webp') $$,
  '[bucket] allowed_mime_types matches the app''s own validateImageFile allowlist'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitor: can read, cannot write.
-- ---------------------------------------------------------------------------
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select lives_ok(
  $$ select 1 from storage.objects where bucket_id = 'piricard-assets' limit 1 $$,
  '[anon] can read (select) objects in the piricard-assets bucket'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('piricard-assets', 'businesses/anon-test/logo/x.png') $$,
  '42501', null,
  '[anon] cannot INSERT into the piricard-assets bucket'
);

-- ---------------------------------------------------------------------------
-- Authenticated, non-admin: still cannot write.
-- ---------------------------------------------------------------------------
reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated","sub":"f4000000-0000-0000-0000-000000000002"}';

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('piricard-assets', 'businesses/outsider-test/logo/x.png') $$,
  '42501', null,
  '[authenticated non-admin] cannot INSERT into the piricard-assets bucket'
);

-- ---------------------------------------------------------------------------
-- Platform admin: can write (insert/update/delete), scoped to this bucket.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"role":"authenticated","sub":"f4000000-0000-0000-0000-000000000001"}';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('piricard-assets', 'businesses/admin-test/logo/x.png') $$,
  '[admin] can INSERT into the piricard-assets bucket'
);
select lives_ok(
  $$ update storage.objects set metadata = '{"note":"updated"}'::jsonb
     where bucket_id = 'piricard-assets' and name = 'businesses/admin-test/logo/x.png' $$,
  '[admin] can UPDATE an object in the piricard-assets bucket'
);
-- Local Supabase deliberately blocks a raw SQL DELETE against
-- storage.objects ("Use the Storage API instead" — a safety trigger, not
-- an RLS check) — real deletion happens through the JS Storage client
-- (.remove(), see deleteBusinessImageAction), a different code path this
-- trigger doesn't intercept. So the DELETE RLS policy itself is verified
-- by inspecting its definition rather than by attempting a raw delete here.
select ok(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'piricard_assets_admin_delete' and cmd = 'DELETE') = 1,
  '[admin] a DELETE policy scoped to piricard_assets_admin_delete exists for storage.objects'
);
select matches(
  (select qual from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'piricard_assets_admin_delete'),
  'security\.is_platform_admin',
  '[admin] the DELETE policy is gated on security.is_platform_admin(), the same function every other admin-only write path uses'
);

-- ---------------------------------------------------------------------------
-- No other bucket/table's RLS was touched by this migration.
-- ---------------------------------------------------------------------------
reset role; reset request.jwt.claims;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ insert into public.businesses (slug, organization, layout_variant) values ('storage-phase-guard', 'X', 'editorial') $$,
  '42501', null,
  '[isolation] anon still cannot write to public.businesses (unrelated RLS unchanged)'
);

select * from finish();
rollback;

-- =============================================================================
-- PiriCard — Phase 4H: Supabase Storage bucket + RLS for business image
-- assets (logo, cover, gallery).
--
-- ONE shared public bucket (`piricard-assets`), business-scoped paths:
--   businesses/{business-id-or-draft-key}/logo/{uuid}.{ext}
--   businesses/{business-id-or-draft-key}/cover/{uuid}.{ext}
--   businesses/{business-id-or-draft-key}/gallery/{uuid}.{ext}
-- The filename is always a fresh random id (see lib in
-- app/admin/(protected)/businesses/storage-actions.ts), never the original
-- filename, so two uploads can never collide, and no asset is ever placed at
-- the bucket root. "draft-<uuid>" keys are used by the Create wizard before
-- a real business id exists (see finalizeDraftAssetsAction), and are moved
-- to the real business id's prefix once admin_create_business succeeds.
--
-- Security model — same pattern as every other admin-only write path in
-- this schema (security.is_platform_admin(), already granted USAGE+EXECUTE
-- to `authenticated` in 20260906210142_piricard_v1_schema.sql section 5.5):
--   - bucket is PUBLIC (durable, non-expiring public object URLs — public
--     profiles need to embed these without a signed-URL refresh problem)
--     with an explicit SELECT policy for defense-in-depth and for
--     authenticated-endpoint reads;
--   - INSERT/UPDATE/DELETE are platform-admin-only, scoped to this ONE
--     bucket only — never a blanket "authenticated can write" policy, and
--     no other bucket/table's RLS is touched.
--   - file_size_limit + allowed_mime_types are enforced by Storage itself
--     (defense-in-depth alongside the app's own client/server validation —
--     see validateImageFile in storage-actions.ts), so a malformed upload
--     is rejected even if the app-level check were ever bypassed.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'piricard-assets',
  'piricard-assets',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "piricard_assets_public_read"
on storage.objects for select
to public
using (bucket_id = 'piricard-assets');

create policy "piricard_assets_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'piricard-assets' and security.is_platform_admin());

create policy "piricard_assets_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'piricard-assets' and security.is_platform_admin())
with check (bucket_id = 'piricard-assets' and security.is_platform_admin());

create policy "piricard_assets_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'piricard-assets' and security.is_platform_admin());

comment on policy "piricard_assets_public_read" on storage.objects is
  'Public read for the piricard-assets bucket only — matches the bucket''s own public=true flag; '
  'anonymous visitors need to load business logos/covers/gallery images on public profiles.';

comment on policy "piricard_assets_admin_insert" on storage.objects is
  'Platform-admin-only write, scoped to bucket_id = piricard-assets only. Never a blanket '
  '"authenticated can write" policy, and never touches any other bucket.';

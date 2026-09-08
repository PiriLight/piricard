-- =============================================================================
-- PiriCard — Admin permanent business deletion RPC (pre-deployment addition)
--
-- WHY THIS EXISTS: `businesses` has ZERO write grant to any application role
-- (see 20260906210142_piricard_v1_schema.sql section 6.1), so DELETE is no
-- more reachable than INSERT/UPDATE already were — admin_create_business and
-- admin_update_business_config/admin_archive_business are the existing
-- INSERT/UPDATE paths (20260907130000_admin_business_lifecycle_rpcs.sql);
-- this is the one, single DELETE path, added so a disposable/test business
-- (e.g. `novos-e-usados`) can be permanently removed from the Admin without
-- hand-running SQL against production.
--
-- Same conventions as every other admin lifecycle RPC in this project:
-- SECURITY DEFINER (required — `businesses` has no grant for `authenticated`
-- to fall back on), gated on security.is_platform_admin(), `set search_path
-- = ''`, fully schema-qualified relations, EXECUTE revoked from public/anon,
-- granted only to authenticated.
--
-- IDENTITY SAFETY (the actual point of this migration): the caller supplies
-- both `p_business_id` and `p_expected_slug`. The function re-reads the row
-- by id and requires `slug = p_expected_slug` before deleting anything — a
-- stale Admin tab (business edited/renamed elsewhere since the page loaded)
-- or a caller that got the id/slug pairing wrong aborts with an error
-- instead of deleting the wrong (or a since-changed) business. This is
-- checked HERE, inside the same statement that performs the delete, not
-- only in the calling Server Action — the database, not the client, is the
-- final authority on whether the id/slug pairing is still current.
--
-- CASCADE: every one of the 14 tables with a `business_id` foreign key to
-- `businesses.id` (business_profile_content, business_hours, social_links,
-- business_modules, business_memberships, services, gallery,
-- restaurant_info, represented_brands, product_categories, menu_sections,
-- menu_items, treatment_groups, treatment_items) was already declared
-- `on delete cascade` in the original V1 schema migration — verified by
-- querying information_schema.referential_constraints before writing this
-- migration, not assumed. A single `delete from public.businesses where id
-- = ...` is therefore sufficient; this function does not need to (and does
-- not) touch any child table itself. Storage object cleanup is a separate
-- concern, handled by the calling Server Action (see
-- app/admin/(protected)/businesses/[id]/edit/actions.ts) — Storage objects
-- are not Postgres rows and have no FK to cascade from.
-- =============================================================================

create function public.admin_delete_business(p_business_id uuid, p_expected_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current record;
begin
  if not security.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_business_id is null or p_expected_slug is null or btrim(p_expected_slug) = '' then
    raise exception 'business_id and expected_slug are required' using errcode = '22023';
  end if;

  -- Re-read by id (never trust a client-supplied slug alone) and require it
  -- to still match the caller's expected slug before deleting anything.
  select id, slug into v_current from public.businesses where id = p_business_id;

  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  if v_current.slug <> p_expected_slug then
    raise exception 'business identity mismatch — the record changed since it was loaded; reload and try again' using errcode = '42501';
  end if;

  -- Exactly one row, targeted by its immutable primary key — never by slug,
  -- name, or any broader predicate. Child rows across all 14 tables above
  -- cascade automatically (verified `on delete cascade`, see comment above).
  delete from public.businesses where id = p_business_id;

  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_delete_business(uuid, text) from public, anon;
grant execute on function public.admin_delete_business(uuid, text) to authenticated;

comment on function public.admin_delete_business(uuid, text) is
  'The only DELETE path for businesses (and, via verified on-delete-cascade FKs, all 14 of its child '
  'tables). Platform-admin-only. Requires the caller to supply the business''s CURRENT slug, re-checked '
  'against the live row inside this same statement — a stale or mismatched id/slug pairing aborts '
  'instead of deleting anything. Storage object cleanup under businesses/{id}/ is handled by the '
  'calling Server Action, not here (Storage objects are not part of this database).';

-- =============================================================================
-- End of pre-deployment admin business deletion RPC migration.
-- =============================================================================

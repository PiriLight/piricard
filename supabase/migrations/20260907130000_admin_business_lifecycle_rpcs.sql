-- =============================================================================
-- PiriCard — Admin business lifecycle RPCs (Phase 4B.5/4B.6)
--
-- WHY THIS EXISTS: `businesses` has ZERO write grant to any application role
-- (V1 schema migration, section 6.1 — "PiriLight-only writes... trusted SQL
-- or a future admin RPC"). `business_profile_content` has SELECT+UPDATE only
-- (no INSERT/DELETE). `business_modules` has SELECT only. There is currently
-- no way for the internal admin app to create a business, edit its protected
-- config, publish/unpublish it, or archive it. This migration adds exactly
-- that — six narrow, explicit, platform-admin-only RPCs. No table GRANT or
-- RLS policy is touched; every function is additive.
--
-- Deliberately PLATFORM-ADMIN-ONLY (not member-or-admin, unlike the Phase
-- 4B.3/4B.4 content RPCs): business lifecycle — identity, layout, theme,
-- technical config, publish state, archive — stays PiriLight-controlled by
-- design (matches the original schema's stated intent for `businesses`).
-- Content editing (business_profile_content, module tables) already has its
-- own, separately-scoped member-or-admin RPCs from earlier phases; this
-- migration does not change that boundary.
--
-- Every function: SECURITY DEFINER (required — the underlying tables have no
-- grant for `authenticated` to fall back on), gated on
-- security.is_platform_admin(), `set search_path = ''`, fully schema-
-- qualified relations, EXECUTE revoked from public/anon, granted only to
-- authenticated. Explicit format/allowlist checks give friendly, consistent
-- error codes; the table's own CHECK constraints (slug format, layout
-- variant) remain the ultimate backstop, unchanged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. admin_create_business — one atomic call creates the minimal valid
--    business skeleton: businesses + business_profile_content + (only the
--    explicitly chosen) business_modules rows. No business_membership row
--    (not needed for Internal Admin V1). Always published=false,
--    archived_at=null. A duplicate slug fails on the table's own UNIQUE
--    constraint (23505) — not pre-checked, so create stays race-safe and
--    the database remains the single source of truth for uniqueness.
-- ---------------------------------------------------------------------------

create function public.admin_create_business(
  p_slug text,
  p_organization text,
  p_layout_variant text,
  p_name text,
  p_category text,
  p_directory_description text,
  p_enabled_modules text[] default '{}'::text[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_module_key text;
begin
  if not security.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid slug format' using errcode = '22023';
  end if;

  if p_layout_variant is null or p_layout_variant not in ('editorial', 'compact', 'restaurant', 'racing', 'beauty', 'workshop') then
    raise exception 'invalid layout variant' using errcode = '22023';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'name is required' using errcode = '22023';
  end if;
  if p_category is null or btrim(p_category) = '' then
    raise exception 'category is required' using errcode = '22023';
  end if;
  if p_directory_description is null or btrim(p_directory_description) = '' then
    raise exception 'directory_description is required' using errcode = '22023';
  end if;

  insert into public.businesses (slug, organization, layout_variant, published, archived_at)
  values (p_slug, coalesce(nullif(btrim(p_organization), ''), p_name), p_layout_variant, false, null)
  returning id into v_business_id;

  insert into public.business_profile_content (business_id, name, category, directory_description)
  values (v_business_id, p_name, p_category, p_directory_description);

  -- Only the explicitly chosen modules get a row (enabled=true). Everything
  -- else stays with no row at all, which mapModuleActivation() (Phase 4B.4)
  -- already treats as disabled — never implicitly enabled.
  if p_enabled_modules is not null then
    foreach v_module_key in array p_enabled_modules
    loop
      insert into public.business_modules (business_id, module_key, enabled)
      values (v_business_id, v_module_key, true);
    end loop;
  end if;

  return v_business_id;
end;
$$;

revoke all on function public.admin_create_business(text, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.admin_create_business(text, text, text, text, text, text, text[]) to authenticated;

comment on function public.admin_create_business(text, text, text, text, text, text, text[]) is
  'The only INSERT path for businesses/business_profile_content/business_modules. Platform-admin-only. '
  'Creates the minimal valid skeleton (published=false); the existing core/module editors complete it.';

-- ---------------------------------------------------------------------------
-- 2. admin_update_business_config — full-replace update of every editable
--    `businesses` column, explicit named+typed parameters (never a generic
--    JSON-patch-any-column function). The physical-product slug rule: a
--    slug change is rejected while the business is published (42501) —
--    staff must unpublish first, a deliberate two-step action, since a
--    published slug may already be printed on a physical QR/NFC card.
-- ---------------------------------------------------------------------------

create function public.admin_update_business_config(
  p_business_id uuid,
  p_slug text,
  p_organization text,
  p_layout_variant text,
  p_theme jsonb,
  p_assets jsonb,
  p_maps_url text,
  p_google_place_id text,
  p_review_url text,
  p_review_write_url text,
  p_review_fallback jsonb,
  p_external_links jsonb,
  p_digital_card jsonb,
  p_featured boolean,
  p_indexable boolean
) returns void
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

  select slug, published into v_current from public.businesses where id = p_business_id;
  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid slug format' using errcode = '22023';
  end if;

  if p_slug <> v_current.slug and v_current.published then
    raise exception 'slug is locked while the business is published — unpublish first' using errcode = '42501';
  end if;

  if p_layout_variant is null or p_layout_variant not in ('editorial', 'compact', 'restaurant', 'racing', 'beauty', 'workshop') then
    raise exception 'invalid layout variant' using errcode = '22023';
  end if;

  if p_maps_url is not null and p_maps_url !~ '^https?://' then
    raise exception 'maps_url must be http(s)' using errcode = '22023';
  end if;
  if p_review_url is not null and p_review_url !~ '^https?://' then
    raise exception 'review_url must be http(s)' using errcode = '22023';
  end if;
  if p_review_write_url is not null and p_review_write_url !~ '^https?://' then
    raise exception 'review_write_url must be http(s)' using errcode = '22023';
  end if;

  update public.businesses set
    slug = p_slug,
    organization = coalesce(nullif(btrim(p_organization), ''), organization),
    layout_variant = p_layout_variant,
    theme = coalesce(p_theme, '{}'::jsonb),
    assets = coalesce(p_assets, '{}'::jsonb),
    maps_url = p_maps_url,
    google_place_id = p_google_place_id,
    review_url = p_review_url,
    review_write_url = p_review_write_url,
    review_fallback = p_review_fallback,
    external_links = coalesce(p_external_links, '{}'::jsonb),
    digital_card = p_digital_card,
    featured = coalesce(p_featured, false),
    indexable = coalesce(p_indexable, true)
  where id = p_business_id;
end;
$$;

revoke all on function public.admin_update_business_config(uuid, text, text, text, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, boolean, boolean) from public, anon;
grant execute on function public.admin_update_business_config(uuid, text, text, text, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, boolean, boolean) to authenticated;

comment on function public.admin_update_business_config(uuid, text, text, text, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, boolean, boolean) is
  'The only UPDATE path for businesses'' protected config. Platform-admin-only. Rejects a slug change '
  'while published=true — physical QR/NFC cards may already carry the old slug; unpublish first.';

-- ---------------------------------------------------------------------------
-- 3. admin_set_business_publish_state — a dedicated, deliberately separate
--    action from general config saves (publish/unpublish is a meaningful
--    state transition on its own). Disallowed while archived — an archived
--    business must be explicitly unarchived first.
-- ---------------------------------------------------------------------------

create function public.admin_set_business_publish_state(p_business_id uuid, p_published boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not security.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.businesses
  set published = p_published
  where id = p_business_id and archived_at is null;

  if not found then
    raise exception 'business not found or archived' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_business_publish_state(uuid, boolean) from public, anon;
grant execute on function public.admin_set_business_publish_state(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_archive_business / admin_unarchive_business — long-term retire.
--    Never deletes rows; never frees the slug (the row and its slug simply
--    remain, archived_at stamped). Archiving always forces published=false.
--    Unarchiving is safe and trivial (clears archived_at only) — supported.
-- ---------------------------------------------------------------------------

create function public.admin_archive_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not security.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.businesses
  set published = false, archived_at = coalesce(archived_at, now())
  where id = p_business_id;

  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_archive_business(uuid) from public, anon;
grant execute on function public.admin_archive_business(uuid) to authenticated;

create function public.admin_unarchive_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not security.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.businesses
  set archived_at = null
  where id = p_business_id;

  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_unarchive_business(uuid) from public, anon;
grant execute on function public.admin_unarchive_business(uuid) to authenticated;

-- =============================================================================
-- End of Phase 4B.5/4B.6 admin business lifecycle RPCs migration.
-- =============================================================================

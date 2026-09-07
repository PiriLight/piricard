-- =============================================================================
-- PiriCard V1 — Database foundation
-- Phase 4B.1 — schema, constraints, indexes, RLS, grants, platform-admin auth,
-- module activation.
--
-- Source of truth: FINAL corrected Phase 4A architecture (approved in-chat).
-- This migration creates the SECURITY FOUNDATION ONLY.
-- It does NOT seed the four production businesses and does NOT change how the
-- Next.js app renders profiles (still reading from lib/businesses.ts).
--
-- Sections:
--   1. Extensions / schemas
--   2. Tables
--   3. Foreign keys
--   4. Indexes
--   5. Helper functions (timestamps, ownership, module gating, platform admin)
--   6. Grants (Data API outer boundary)
--   7. Row Level Security (enable)
--   8. Policies (row boundary)
--   9. Comments documenting non-obvious security reasoning are inlined
--      throughout sections 5-8 rather than collected at the end, so each
--      decision is next to the code it explains.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS / SCHEMAS
-- =============================================================================

-- gen_random_uuid() is built into Postgres core since v13 — no pgcrypto needed.

-- Private schema for privilege-elevated helper functions. Deliberately NOT
-- added to supabase/config.toml's [api].schemas (which stays ["public",
-- "graphql_public"]), so PostgREST never exposes it as an RPC endpoint no
-- matter what functions live inside it.
create schema if not exists security;
revoke all on schema security from public, anon, authenticated;

comment on schema security is
  'Unexposed schema for SECURITY DEFINER helpers only (currently: platform-admin check). '
  'Never add this schema to supabase/config.toml [api].schemas.';


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 businesses — protected platform/config table.
-- Business owners/editors get READ access only (see grants). All writes to
-- this table happen through trusted PiriLight tooling (direct SQL or a future
-- admin RPC), never through the normal `authenticated` Data API grant.
-- ---------------------------------------------------------------------------
create table public.businesses (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null,
  organization       text not null,
  layout_variant     text not null,
  theme              jsonb not null default '{}'::jsonb,
  assets             jsonb not null default '{}'::jsonb,
  maps_url           text,
  google_place_id    text,
  review_url         text,
  review_write_url   text,
  -- Static fallback shown until/if the live Google Places lookup fails.
  -- Shape mirrors lib/google-reviews.ts: { rating, count, source, asOf }.
  review_fallback    jsonb,
  external_links     jsonb not null default '{}'::jsonb,
  digital_card       jsonb,
  published          boolean not null default false,
  featured           boolean not null default false,
  indexable          boolean not null default true,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint businesses_slug_unique unique (slug),
  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint businesses_layout_variant_check check (
    layout_variant in ('editorial', 'compact', 'restaurant', 'racing', 'beauty', 'workshop')
  )
);

comment on table public.businesses is
  'Platform/config row per business: identity, theme, layout, technical Google/QR config, '
  'publish state. business-editable CONTENT lives in business_profile_content, not here. '
  'authenticated (business members) get SELECT only — see section 6.';
comment on column public.businesses.slug is
  'Routing key. Deliberately decoupled from the human-editable display name '
  '(business_profile_content.name) — Phase 3.5 correction.';

-- ---------------------------------------------------------------------------
-- 2.2 business_profile_content — 1:1 always-editable content core.
-- Only the fields that have NO module gate and NO technical/Google meaning.
-- ---------------------------------------------------------------------------
create table public.business_profile_content (
  business_id            uuid primary key,
  name                   text not null,
  category               text not null,
  directory_description  text not null,
  profile_description    text,
  positioning            text,
  -- { heading?: string, paragraphs?: string[] } — mirrors lib/businesses.ts BusinessAbout.
  about                  jsonb,
  phone                  text,
  whatsapp               text,
  email                  text,
  website                text,
  address                text,
  street_address         text,
  city                   text,
  country                text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid
);

comment on table public.business_profile_content is
  'Always-editable 1:1 profile content. Deliberately excludes slug, theme, layout_variant, '
  'module activation, Google technical config, and any module-specific content (restaurant_info, '
  'represented_brands, product_categories, menu, treatments, services, gallery) — those live in '
  'their own module-gated tables so RLS can gate them at the ROW level, not just hide columns.';

-- ---------------------------------------------------------------------------
-- 2.3 business_memberships — who can edit which business.
-- ---------------------------------------------------------------------------
create table public.business_memberships (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  user_id      uuid not null,
  role         text not null,
  created_at   timestamptz not null default now(),
  constraint business_memberships_role_check check (role in ('owner', 'editor')),
  constraint business_memberships_unique unique (business_id, user_id)
);

comment on table public.business_memberships is
  'owner/editor have identical content-edit permissions in V1 — role is stored for future '
  'differentiation, not yet used to differentiate access. No INSERT/UPDATE/DELETE grant is given '
  'to `authenticated` (see section 6): membership is provisioned by trusted PiriLight tooling only.';

-- ---------------------------------------------------------------------------
-- 2.4 platform_admins — platform-level, NOT a per-business membership row.
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id     uuid primary key,
  created_at  timestamptz not null default now()
);

comment on table public.platform_admins is
  'PiriLight staff. Deliberately NOT modeled as a business_memberships row (Phase 3.5 correction: '
  'admin access is platform-level, not tied to any one business). No role gets ANY direct grant on '
  'this table (see section 6) — the only way to check admin status is security.is_platform_admin(). '
  'V1 provisioning is a trusted manual/SQL operation (Task 17) — never inferred from email/metadata.';

-- ---------------------------------------------------------------------------
-- 2.5 business_modules — entitlement, separate from content.
-- ---------------------------------------------------------------------------
create table public.business_modules (
  business_id  uuid not null,
  module_key   text not null,
  enabled      boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (business_id, module_key),
  constraint business_modules_key_check check (
    module_key in ('services', 'gallery', 'restaurant_info', 'menu', 'treatments', 'brands', 'product_categories')
  )
);

comment on table public.business_modules is
  'Module ENTITLEMENT only — never content. Public/member read is allowed (module activation is not '
  'confidential); only PiriLight can write (see grants). Content tables consult this via '
  'module_enabled() so a disabled module''s rows never leak even though they still physically exist.';

-- ---------------------------------------------------------------------------
-- 2.6 business_hours / social_links — core, ungated child tables.
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  label        text not null,
  days         smallint[] not null,
  -- [{ open: "HH:MM", close: "HH:MM" }, ...] — mirrors BusinessHoursEntry.periods.
  periods      jsonb not null default '[]'::jsonb,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  constraint business_hours_days_check check (days <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table public.social_links (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  platform     text not null,
  url          text not null,
  label        text not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.7 services / gallery — module-gated core child tables.
-- ---------------------------------------------------------------------------
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  label        text not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);
comment on table public.services is 'Module-gated by business_modules.module_key = ''services''.';

create table public.gallery (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null,
  src                 text,
  alt                 text not null,
  aspect_ratio        text,
  placeholder_label   text,
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now(),
  constraint gallery_aspect_ratio_check check (aspect_ratio is null or aspect_ratio in ('wide', 'landscape', 'square'))
);
comment on table public.gallery is 'Module-gated by business_modules.module_key = ''gallery''.';

-- ---------------------------------------------------------------------------
-- 2.8 Optional module tables.
-- ---------------------------------------------------------------------------
create table public.restaurant_info (
  business_id          uuid primary key,
  average_spend        text,
  average_spend_note   text,
  cuisine              text,
  cuisine_note         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);
comment on table public.restaurant_info is
  'Module-gated by business_modules.module_key = ''restaurant_info''. Split out of '
  'business_profile_content on purpose (Correction 1 / row-vs-column RLS argument): RLS protects '
  'rows, not columns, so a gated field cannot live in an always-readable row.';

create table public.represented_brands (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  label        text not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);
comment on table public.represented_brands is 'Module-gated by business_modules.module_key = ''brands''.';

create table public.product_categories (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  label        text not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);
comment on table public.product_categories is 'Module-gated by business_modules.module_key = ''product_categories''.';

create table public.menu_sections (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  title        text not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);
comment on table public.menu_sections is 'Module-gated by business_modules.module_key = ''menu''.';

create table public.menu_items (
  id               uuid primary key default gen_random_uuid(),
  menu_section_id  uuid not null,
  -- Redundant against menu_section_id -> menu_sections.business_id, kept deliberately
  -- (Task 16 decision, see trigger in section 5): a direct business_id column lets every
  -- RLS policy and index on this table match its siblings instead of joining through
  -- menu_sections, and a trigger guarantees it can never drift from the parent.
  business_id      uuid not null,
  name             text not null,
  price            text,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now()
);
comment on table public.menu_items is 'Module-gated by business_modules.module_key = ''menu'' (via parent menu_sections.business_id).';

create table public.treatment_groups (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  -- Mirrors the current TreatmentGroup.id string (e.g. "facial", "corporal").
  slug_key     text not null,
  title        text not null,
  description  text not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);
comment on table public.treatment_groups is 'Module-gated by business_modules.module_key = ''treatments''.';

create table public.treatment_items (
  id                  uuid primary key default gen_random_uuid(),
  treatment_group_id  uuid not null,
  -- Redundant, same justification and trigger-enforced guarantee as menu_items.business_id.
  business_id         uuid not null,
  label               text not null,
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now()
);
comment on table public.treatment_items is 'Module-gated by business_modules.module_key = ''treatments'' (via parent treatment_groups.business_id).';


-- =============================================================================
-- 3. FOREIGN KEYS
-- =============================================================================

alter table public.business_profile_content
  add constraint business_profile_content_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.business_memberships
  add constraint business_memberships_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade,
  add constraint business_memberships_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.platform_admins
  add constraint platform_admins_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.business_modules
  add constraint business_modules_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.business_hours
  add constraint business_hours_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.social_links
  add constraint social_links_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.services
  add constraint services_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.gallery
  add constraint gallery_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.restaurant_info
  add constraint restaurant_info_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.represented_brands
  add constraint represented_brands_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.product_categories
  add constraint product_categories_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.menu_sections
  add constraint menu_sections_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.menu_items
  add constraint menu_items_menu_section_id_fkey
  foreign key (menu_section_id) references public.menu_sections (id) on delete cascade,
  add constraint menu_items_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.treatment_groups
  add constraint treatment_groups_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;

alter table public.treatment_items
  add constraint treatment_items_treatment_group_id_fkey
  foreign key (treatment_group_id) references public.treatment_groups (id) on delete cascade,
  add constraint treatment_items_business_id_fkey
  foreign key (business_id) references public.businesses (id) on delete cascade;


-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- businesses.slug already has a UNIQUE constraint (implicit btree index).
create index businesses_published_idx on public.businesses (published) where archived_at is null;

create index business_memberships_user_id_idx on public.business_memberships (user_id);
-- business_memberships (business_id, user_id) already covered by the UNIQUE constraint.

create index business_profile_content_business_id_idx on public.business_profile_content (business_id);
-- (redundant with the PK, kept only for symmetry/clarity — Postgres already indexes the PK)

create index business_hours_business_id_idx on public.business_hours (business_id);
create index social_links_business_id_idx on public.social_links (business_id);
create index services_business_id_idx on public.services (business_id);
create index gallery_business_id_idx on public.gallery (business_id);
create index represented_brands_business_id_idx on public.represented_brands (business_id);
create index product_categories_business_id_idx on public.product_categories (business_id);
create index menu_sections_business_id_idx on public.menu_sections (business_id);
create index menu_items_business_id_idx on public.menu_items (business_id);
create index menu_items_menu_section_id_idx on public.menu_items (menu_section_id);
create index treatment_groups_business_id_idx on public.treatment_groups (business_id);
create index treatment_items_business_id_idx on public.treatment_items (business_id);
create index treatment_items_treatment_group_id_idx on public.treatment_items (treatment_group_id);

comment on index public.business_profile_content_business_id_idx is
  'Redundant with the primary key; not required for correctness, kept only so every child table '
  'has a matching business_id index for readability.';


-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 Timestamp maintenance — SECURITY INVOKER (default), no privilege issue.
-- Only applied to tables with direct field-level edits in place
-- (businesses, business_profile_content, restaurant_info, business_modules).
-- Child "list" tables (services, gallery, hours, ...) are simple enough in V1
-- that they don't need their own updated_at/trigger — Task 10 "keep it simple".
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'SECURITY INVOKER (default) — pure timestamp bookkeeping, no elevated privilege needed.';

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

create trigger business_profile_content_set_updated_at
  before update on public.business_profile_content
  for each row execute function public.set_updated_at();

create trigger restaurant_info_set_updated_at
  before update on public.restaurant_info
  for each row execute function public.set_updated_at();

create trigger business_modules_set_updated_at
  before update on public.business_modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5.2 Child-ownership enforcement for menu_items / treatment_items (Task 16).
-- Guarantees the redundant business_id column can never drift from the
-- parent's business_id, regardless of what an authenticated caller sends.
-- SECURITY INVOKER is fine: it only reads menu_sections/treatment_groups,
-- both readable by the same caller under normal RLS.
-- ---------------------------------------------------------------------------
create function public.enforce_menu_item_business_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select business_id into new.business_id
  from public.menu_sections
  where id = new.menu_section_id;

  if new.business_id is null then
    raise exception 'menu_section_id % does not exist', new.menu_section_id;
  end if;

  return new;
end;
$$;

create trigger menu_items_enforce_business_id
  before insert or update of menu_section_id, business_id on public.menu_items
  for each row execute function public.enforce_menu_item_business_id();

create function public.enforce_treatment_item_business_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select business_id into new.business_id
  from public.treatment_groups
  where id = new.treatment_group_id;

  if new.business_id is null then
    raise exception 'treatment_group_id % does not exist', new.treatment_group_id;
  end if;

  return new;
end;
$$;

create trigger treatment_items_enforce_business_id
  before insert or update of treatment_group_id, business_id on public.treatment_items
  for each row execute function public.enforce_treatment_item_business_id();

comment on function public.enforce_menu_item_business_id() is
  'Forces menu_items.business_id to always equal its parent menu_sections.business_id, no matter '
  'what the client sends — closes the "escape the parent''s ownership" gap named in Task 16.';
comment on function public.enforce_treatment_item_business_id() is
  'Forces treatment_items.business_id to always equal its parent treatment_groups.business_id — '
  'same reasoning as enforce_menu_item_business_id().';

-- ---------------------------------------------------------------------------
-- 5.3 is_business_member() — SECURITY INVOKER on purpose.
-- It queries business_memberships filtered to (select auth.uid()) — exactly
-- the row(s) the caller's own RLS policy on business_memberships already lets
-- them see. No privilege elevation is needed or wanted: an anon caller must
-- NEVER be able to run this and get "permission denied" instead of a clean
-- false, which is why every policy that uses it is scoped `to authenticated`
-- only (see section 8) — anon never evaluates it, so the anon-vs-privileges
-- question never arises for this function in practice.
-- ---------------------------------------------------------------------------
create function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships m
    where m.business_id = target_business_id
      and m.user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_business_member(uuid) to authenticated;
revoke execute on function public.is_business_member(uuid) from public, anon;

comment on function public.is_business_member(uuid) is
  'SECURITY INVOKER — safe because it only ever surfaces the caller''s own membership row, the '
  'same row their own business_memberships SELECT policy already allows. Only ever called from '
  'policies scoped `to authenticated`.';

-- ---------------------------------------------------------------------------
-- 5.4 module_enabled() — SECURITY INVOKER on purpose (Correction 5).
-- business_modules already grants public/authenticated SELECT under RLS
-- (module activation is not confidential — Correction 4), so this needs no
-- elevated privilege. Callable by anon AND authenticated.
-- ---------------------------------------------------------------------------
create function public.module_enabled(target_business_id uuid, target_module_key text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select bm.enabled
      from public.business_modules bm
      where bm.business_id = target_business_id
        and bm.module_key = target_module_key
    ),
    false
  );
$$;

grant execute on function public.module_enabled(uuid, text) to anon, authenticated;

comment on function public.module_enabled(uuid, text) is
  'SECURITY INVOKER — safe for anon because business_modules already has a public SELECT policy '
  'for published businesses (module activation is not confidential, only module CONTENT is gated). '
  'Missing row = false (fail-closed), not an error.';

-- ---------------------------------------------------------------------------
-- 5.5 security.is_platform_admin() — the ONE privileged function in the system.
-- SECURITY DEFINER is required here because platform_admins has NO grant to
-- any application role (not even SELECT of one's own row) — the safest
-- posture for the single most sensitive table. Hardening per Task 6 / the
-- Phase 4A security-correction pass:
--   - lives in the unexposed `security` schema (never add it to
--     supabase/config.toml [api].schemas);
--   - zero arguments — always resolves the caller from auth.uid(), never
--     accepts a caller-supplied user id;
--   - `set search_path = ''` with every relation schema-qualified;
--   - EXECUTE revoked from PUBLIC, granted only to `authenticated`
--     (anon is never an admin, so it gets nothing);
--   - returns boolean only, no admin row data is ever exposed by it.
-- ---------------------------------------------------------------------------
create function security.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

revoke all on function security.is_platform_admin() from public;
grant execute on function security.is_platform_admin() to authenticated;

-- USAGE on the schema is required to even resolve `security.is_platform_admin()` by
-- name — EXECUTE on the function alone is not enough (Postgres checks schema USAGE
-- before function EXECUTE). Only `authenticated`-scoped policies ever reference this
-- function (see section 8), so only `authenticated` needs it; `anon` gets nothing.
grant usage on schema security to authenticated;

comment on function security.is_platform_admin() is
  'The only point of access to platform_admins. platform_admins itself must never be directly '
  'queryable by any application role — this function is the sole, boolean-only gate. '
  'SECURITY DEFINER + search_path='''' + schema-qualified relations + PUBLIC execute revoked.';


-- =============================================================================
-- 6. GRANTS — the outer (Postgres) permission boundary.
-- Explicit throughout: Supabase's `auto_expose_new_tables` default (see
-- supabase/config.toml) would otherwise auto-grant broad CRUD to anon/
-- authenticated on every new public table, matching the cloud default. This
-- migration does not rely on that default — every REVOKE below removes it
-- before the intended, narrower GRANT is applied.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- 6.1 businesses — read-only for both Data API roles. No role gets INSERT/
-- UPDATE/DELETE; PiriLight-only writes happen outside the normal Data API
-- grant (trusted SQL / a future admin RPC), matching Task 3's requirement
-- that business users must not have normal UPDATE access to this table.
revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to anon, authenticated;

-- 6.2 business_profile_content — read for both; write only for authenticated
-- (RLS restricts that further to members of the owning business, or admins).
revoke all on public.business_profile_content from anon, authenticated;
grant select on public.business_profile_content to anon, authenticated;
grant update on public.business_profile_content to authenticated;

-- 6.3 business_memberships — SELECT only, no writes at all for `authenticated`
-- in V1 (Task 5: users must not create/change/delete their own membership).
revoke all on public.business_memberships from anon, authenticated;
grant select on public.business_memberships to authenticated;

-- 6.4 platform_admins — NO grant to any application role, ever.
revoke all on public.platform_admins from public, anon, authenticated;

-- 6.5 business_modules — read for both; PiriLight-only writes (no
-- INSERT/UPDATE/DELETE grant to authenticated in V1).
revoke all on public.business_modules from anon, authenticated;
grant select on public.business_modules to anon, authenticated;

-- 6.6 Core, ungated, business-editable child tables.
revoke all on public.business_hours from anon, authenticated;
grant select on public.business_hours to anon, authenticated;
grant insert, update, delete on public.business_hours to authenticated;

revoke all on public.social_links from anon, authenticated;
grant select on public.social_links to anon, authenticated;
grant insert, update, delete on public.social_links to authenticated;

-- 6.7 Module-gated, business-editable child tables — grant shape is identical
-- to the core child tables (the module gate is enforced by RLS, not by the
-- GRANT); listed individually for clarity and easy future divergence.
revoke all on public.services from anon, authenticated;
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;

revoke all on public.gallery from anon, authenticated;
grant select on public.gallery to anon, authenticated;
grant insert, update, delete on public.gallery to authenticated;

revoke all on public.restaurant_info from anon, authenticated;
grant select on public.restaurant_info to anon, authenticated;
grant insert, update, delete on public.restaurant_info to authenticated;

revoke all on public.represented_brands from anon, authenticated;
grant select on public.represented_brands to anon, authenticated;
grant insert, update, delete on public.represented_brands to authenticated;

revoke all on public.product_categories from anon, authenticated;
grant select on public.product_categories to anon, authenticated;
grant insert, update, delete on public.product_categories to authenticated;

revoke all on public.menu_sections from anon, authenticated;
grant select on public.menu_sections to anon, authenticated;
grant insert, update, delete on public.menu_sections to authenticated;

revoke all on public.menu_items from anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;

revoke all on public.treatment_groups from anon, authenticated;
grant select on public.treatment_groups to anon, authenticated;
grant insert, update, delete on public.treatment_groups to authenticated;

revoke all on public.treatment_items from anon, authenticated;
grant select on public.treatment_items to anon, authenticated;
grant insert, update, delete on public.treatment_items to authenticated;


-- =============================================================================
-- 7. ROW LEVEL SECURITY — enable on every table (default deny).
-- =============================================================================

alter table public.businesses enable row level security;
alter table public.business_profile_content enable row level security;
alter table public.business_memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.business_modules enable row level security;
alter table public.business_hours enable row level security;
alter table public.social_links enable row level security;
alter table public.services enable row level security;
alter table public.gallery enable row level security;
alter table public.restaurant_info enable row level security;
alter table public.represented_brands enable row level security;
alter table public.product_categories enable row level security;
alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;
alter table public.treatment_groups enable row level security;
alter table public.treatment_items enable row level security;

-- platform_admins has RLS enabled for defense-in-depth even though no role
-- holds any grant on it at all (section 6.4) — belt and braces: if a future
-- migration ever accidentally grants access, RLS is still there to deny it
-- (no policy = default deny).


-- =============================================================================
-- 8. POLICIES
--
-- Pattern used throughout (revised after the local performance-advisor pass —
-- see the comment at the end of this section for what changed and why):
--   - exactly ONE `to anon` policy per readable table, containing only the
--     public-read condition (businesses.published/archived_at and, for gated
--     tables, module_enabled()) — it never touches business_memberships, so
--     anon can never hit a permission-denied evaluating it;
--   - exactly ONE `to authenticated` policy per command (select/insert/
--     update/delete), each ORing together every case that command should
--     allow (public condition OR is_business_member() OR
--     security.is_platform_admin()) — never split across multiple policies
--     for the same role+command, which is what the advisor flags.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 8.1 businesses — no write policy at all (matches the GRANT boundary: no
-- role has INSERT/UPDATE/DELETE on this table).
-- ---------------------------------------------------------------------------
create policy businesses_anon_read
  on public.businesses for select
  to anon
  using (published = true and archived_at is null);

create policy businesses_read
  on public.businesses for select
  to authenticated
  using (
    (published = true and archived_at is null)
    or public.is_business_member(id)
    or security.is_platform_admin()
  );

comment on policy businesses_read on public.businesses is
  'Lets an owner/editor preview their own business before it is published, and lets platform '
  'admins see everything, in a single policy (avoids the "multiple permissive policies" '
  'performance warning that a separate public+member policy pair would trigger for this role).';

-- ---------------------------------------------------------------------------
-- 8.2 business_profile_content
-- ---------------------------------------------------------------------------
create policy business_profile_content_anon_read
  on public.business_profile_content for select
  to anon
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_profile_content.business_id
        and b.published = true
        and b.archived_at is null
    )
  );

create policy business_profile_content_read
  on public.business_profile_content for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_profile_content.business_id
        and b.published = true
        and b.archived_at is null
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );

create policy business_profile_content_update
  on public.business_profile_content for update
  to authenticated
  using (public.is_business_member(business_id) or security.is_platform_admin())
  with check (public.is_business_member(business_id) or security.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 8.3 business_memberships — authenticated may only ever see their OWN row
-- (or, for admins, any row). No INSERT/UPDATE/DELETE policy: matches the
-- section 6.3 GRANT boundary that gives authenticated no write privilege at
-- all on this table (Task 5).
-- ---------------------------------------------------------------------------
create policy business_memberships_self_or_admin_read
  on public.business_memberships for select
  to authenticated
  using (user_id = (select auth.uid()) or security.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 8.4 platform_admins — deliberately NO policies at all. With zero grants
-- (section 6.4) no application role can even attempt a query against it, so
-- there is nothing for a policy to usefully restrict; RLS stays enabled only
-- as the belt-and-braces default-deny described in section 7.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 8.5 business_modules — public/member read; no write policy (Task 7:
-- PiriLight-only writes; section 6.5 gives authenticated no write grant).
-- ---------------------------------------------------------------------------
create policy business_modules_anon_read
  on public.business_modules for select
  to anon
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_modules.business_id
        and b.published = true
        and b.archived_at is null
    )
  );

create policy business_modules_read
  on public.business_modules for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_modules.business_id
        and b.published = true
        and b.archived_at is null
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );

comment on policy business_modules_read on public.business_modules is
  'Deliberate V1 choice: a member can read their own module flags even when a module is disabled '
  '(so their future dashboard can say "this section is off" instead of just vanishing); they can '
  'never write here (Task 7 — activation is PiriLight-only).';

-- ---------------------------------------------------------------------------
-- 8.6 business_hours / social_links — core, ungated. Read is public+member+
-- admin in one policy per role; write is split into insert/update/delete
-- (rather than a single `for all`) so it never overlaps the read policy's
-- SELECT — "for all" would otherwise count as a second permissive SELECT
-- policy for `authenticated`.
-- ---------------------------------------------------------------------------
create policy business_hours_anon_read
  on public.business_hours for select
  to anon
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_hours.business_id and b.published = true and b.archived_at is null
    )
  );
create policy business_hours_read
  on public.business_hours for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_hours.business_id and b.published = true and b.archived_at is null
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy business_hours_insert
  on public.business_hours for insert
  to authenticated
  with check (public.is_business_member(business_id) or security.is_platform_admin());
create policy business_hours_update
  on public.business_hours for update
  to authenticated
  using (public.is_business_member(business_id) or security.is_platform_admin())
  with check (public.is_business_member(business_id) or security.is_platform_admin());
create policy business_hours_delete
  on public.business_hours for delete
  to authenticated
  using (public.is_business_member(business_id) or security.is_platform_admin());

create policy social_links_anon_read
  on public.social_links for select
  to anon
  using (
    exists (
      select 1 from public.businesses b
      where b.id = social_links.business_id and b.published = true and b.archived_at is null
    )
  );
create policy social_links_read
  on public.social_links for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = social_links.business_id and b.published = true and b.archived_at is null
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy social_links_insert
  on public.social_links for insert
  to authenticated
  with check (public.is_business_member(business_id) or security.is_platform_admin());
create policy social_links_update
  on public.social_links for update
  to authenticated
  using (public.is_business_member(business_id) or security.is_platform_admin())
  with check (public.is_business_member(business_id) or security.is_platform_admin());
create policy social_links_delete
  on public.social_links for delete
  to authenticated
  using (public.is_business_member(business_id) or security.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 8.7 Module-gated child tables. Same one-policy-per-role-per-command shape
-- as 8.6, plus module_enabled() folded into both the public and the write
-- conditions. Member/admin READ is not module-gated (Task 15: a member can
-- always see their own content, even disabled); member WRITE is gated.
-- ---------------------------------------------------------------------------

-- services (module_key = 'services')
create policy services_anon_read
  on public.services for select
  to anon
  using (
    public.module_enabled(business_id, 'services')
    and exists (
      select 1 from public.businesses b
      where b.id = services.business_id and b.published = true and b.archived_at is null
    )
  );
create policy services_read
  on public.services for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'services')
      and exists (
        select 1 from public.businesses b
        where b.id = services.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy services_insert
  on public.services for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'services'))
    or security.is_platform_admin()
  );
create policy services_update
  on public.services for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'services'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'services'))
    or security.is_platform_admin()
  );
create policy services_delete
  on public.services for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'services'))
    or security.is_platform_admin()
  );

-- gallery (module_key = 'gallery')
create policy gallery_anon_read
  on public.gallery for select
  to anon
  using (
    public.module_enabled(business_id, 'gallery')
    and exists (
      select 1 from public.businesses b
      where b.id = gallery.business_id and b.published = true and b.archived_at is null
    )
  );
create policy gallery_read
  on public.gallery for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'gallery')
      and exists (
        select 1 from public.businesses b
        where b.id = gallery.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy gallery_insert
  on public.gallery for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'gallery'))
    or security.is_platform_admin()
  );
create policy gallery_update
  on public.gallery for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'gallery'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'gallery'))
    or security.is_platform_admin()
  );
create policy gallery_delete
  on public.gallery for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'gallery'))
    or security.is_platform_admin()
  );

-- restaurant_info (module_key = 'restaurant_info')
create policy restaurant_info_anon_read
  on public.restaurant_info for select
  to anon
  using (
    public.module_enabled(business_id, 'restaurant_info')
    and exists (
      select 1 from public.businesses b
      where b.id = restaurant_info.business_id and b.published = true and b.archived_at is null
    )
  );
create policy restaurant_info_read
  on public.restaurant_info for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'restaurant_info')
      and exists (
        select 1 from public.businesses b
        where b.id = restaurant_info.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy restaurant_info_insert
  on public.restaurant_info for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'restaurant_info'))
    or security.is_platform_admin()
  );
create policy restaurant_info_update
  on public.restaurant_info for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'restaurant_info'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'restaurant_info'))
    or security.is_platform_admin()
  );
create policy restaurant_info_delete
  on public.restaurant_info for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'restaurant_info'))
    or security.is_platform_admin()
  );

-- represented_brands (module_key = 'brands')
create policy represented_brands_anon_read
  on public.represented_brands for select
  to anon
  using (
    public.module_enabled(business_id, 'brands')
    and exists (
      select 1 from public.businesses b
      where b.id = represented_brands.business_id and b.published = true and b.archived_at is null
    )
  );
create policy represented_brands_read
  on public.represented_brands for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'brands')
      and exists (
        select 1 from public.businesses b
        where b.id = represented_brands.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy represented_brands_insert
  on public.represented_brands for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'brands'))
    or security.is_platform_admin()
  );
create policy represented_brands_update
  on public.represented_brands for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'brands'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'brands'))
    or security.is_platform_admin()
  );
create policy represented_brands_delete
  on public.represented_brands for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'brands'))
    or security.is_platform_admin()
  );

-- product_categories (module_key = 'product_categories')
create policy product_categories_anon_read
  on public.product_categories for select
  to anon
  using (
    public.module_enabled(business_id, 'product_categories')
    and exists (
      select 1 from public.businesses b
      where b.id = product_categories.business_id and b.published = true and b.archived_at is null
    )
  );
create policy product_categories_read
  on public.product_categories for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'product_categories')
      and exists (
        select 1 from public.businesses b
        where b.id = product_categories.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy product_categories_insert
  on public.product_categories for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'product_categories'))
    or security.is_platform_admin()
  );
create policy product_categories_update
  on public.product_categories for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'product_categories'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'product_categories'))
    or security.is_platform_admin()
  );
create policy product_categories_delete
  on public.product_categories for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'product_categories'))
    or security.is_platform_admin()
  );

-- menu_sections (module_key = 'menu')
create policy menu_sections_anon_read
  on public.menu_sections for select
  to anon
  using (
    public.module_enabled(business_id, 'menu')
    and exists (
      select 1 from public.businesses b
      where b.id = menu_sections.business_id and b.published = true and b.archived_at is null
    )
  );
create policy menu_sections_read
  on public.menu_sections for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'menu')
      and exists (
        select 1 from public.businesses b
        where b.id = menu_sections.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy menu_sections_insert
  on public.menu_sections for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  );
create policy menu_sections_update
  on public.menu_sections for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  );
create policy menu_sections_delete
  on public.menu_sections for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  );

-- menu_items (business_id is the trigger-enforced, always-consistent copy of
-- its parent menu_sections.business_id — see section 5.2)
create policy menu_items_anon_read
  on public.menu_items for select
  to anon
  using (
    public.module_enabled(business_id, 'menu')
    and exists (
      select 1 from public.businesses b
      where b.id = menu_items.business_id and b.published = true and b.archived_at is null
    )
  );
create policy menu_items_read
  on public.menu_items for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'menu')
      and exists (
        select 1 from public.businesses b
        where b.id = menu_items.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy menu_items_insert
  on public.menu_items for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  );
create policy menu_items_update
  on public.menu_items for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  );
create policy menu_items_delete
  on public.menu_items for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'menu'))
    or security.is_platform_admin()
  );

-- treatment_groups (module_key = 'treatments')
create policy treatment_groups_anon_read
  on public.treatment_groups for select
  to anon
  using (
    public.module_enabled(business_id, 'treatments')
    and exists (
      select 1 from public.businesses b
      where b.id = treatment_groups.business_id and b.published = true and b.archived_at is null
    )
  );
create policy treatment_groups_read
  on public.treatment_groups for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'treatments')
      and exists (
        select 1 from public.businesses b
        where b.id = treatment_groups.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy treatment_groups_insert
  on public.treatment_groups for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  );
create policy treatment_groups_update
  on public.treatment_groups for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  );
create policy treatment_groups_delete
  on public.treatment_groups for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  );

-- treatment_items (business_id trigger-enforced from parent treatment_groups)
create policy treatment_items_anon_read
  on public.treatment_items for select
  to anon
  using (
    public.module_enabled(business_id, 'treatments')
    and exists (
      select 1 from public.businesses b
      where b.id = treatment_items.business_id and b.published = true and b.archived_at is null
    )
  );
create policy treatment_items_read
  on public.treatment_items for select
  to authenticated
  using (
    (
      public.module_enabled(business_id, 'treatments')
      and exists (
        select 1 from public.businesses b
        where b.id = treatment_items.business_id and b.published = true and b.archived_at is null
      )
    )
    or public.is_business_member(business_id)
    or security.is_platform_admin()
  );
create policy treatment_items_insert
  on public.treatment_items for insert
  to authenticated
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  );
create policy treatment_items_update
  on public.treatment_items for update
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  )
  with check (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  );
create policy treatment_items_delete
  on public.treatment_items for delete
  to authenticated
  using (
    (public.is_business_member(business_id) and public.module_enabled(business_id, 'treatments'))
    or security.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- 8.8 Why this shape, and what changed from the first draft of this migration:
-- the first draft used a separate "public read" policy (scoped `to anon,
-- authenticated`) plus a separate "member/admin read" policy (`to
-- authenticated`), and a `for all` write policy (which also covers SELECT).
-- That is easy to reason about but means `authenticated` had 2-3 separate
-- permissive SELECT policies evaluated per query on most tables — flagged by
-- `supabase db advisors --type performance` (lint 0006,
-- multiple_permissive_policies) after the first local test run. The fix kept
-- here is exactly one policy per (role, command) pair: `anon` gets one SELECT
-- policy with only the public condition; `authenticated` gets one SELECT
-- policy that ORs every case together, and separate INSERT/UPDATE/DELETE
-- policies instead of a `for all`. The anon-safety property from the first
-- draft is preserved: `anon`'s policy still never references
-- is_business_member()/security.is_platform_admin(), so it can never trigger
-- a permission-denied evaluating those.
-- =============================================================================
-- =============================================================================
-- End of PiriCard V1 schema migration.
-- =============================================================================

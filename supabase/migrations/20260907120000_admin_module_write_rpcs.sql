-- =============================================================================
-- PiriCard — Admin module write RPCs (Phase 4B.4)
--
-- WHY THIS EXISTS:
--
-- 1. Module activation (business_modules) currently has ZERO write grant to
--    any application role (see the V1 schema migration, section 6.5 —
--    "PiriLight-only writes; no INSERT/UPDATE/DELETE grant to authenticated
--    in V1"). The internal admin app needs a way for a platform admin to
--    flip a module on/off through the Data API. Rather than loosening the
--    table's GRANT/RLS boundary (which would need to reintroduce a write
--    policy and risk the "multiple permissive policies" advisor warning the
--    original migration deliberately avoided), this adds ONE narrow
--    SECURITY DEFINER bridge — same pattern as
--    public.current_user_is_platform_admin() from Phase 4B.2B: checks
--    security.is_platform_admin() internally, exposes nothing else, no
--    table grant changes at all.
--
-- 2. Phase 4B.3 noted (and this phase was told not to ignore) that replacing
--    an ordered child collection (business_hours, social_links, and now the
--    module content tables) via the app doing insert-then-delete as two
--    separate Data-API calls is not atomic. A single SQL function is one
--    transaction: if anything inside it raises, everything in it rolls
--    back. These RPCs replace that app-level workaround with real
--    atomicity, with NO privilege elevation — they are SECURITY INVOKER,
--    relying on the exact same table GRANTs + RLS policies (is_business_member()
--    OR security.is_platform_admin(), plus module_enabled() for module-gated
--    tables) that already govern every other authenticated write in this
--    schema. They add no new capability an authenticated business member or
--    platform admin didn't already have — only atomicity.
--
-- 3. Approved behavior for a DISABLED module (this phase's explicit
--    requirement) is that NO ONE may write module content while disabled —
--    not even a platform admin. The existing module-gated RLS write
--    policies intentionally let security.is_platform_admin() bypass
--    module_enabled() (see e.g. services_insert in the V1 schema migration —
--    admins can already write disabled-module content today via a direct
--    Data API call). Changing those policies is a bigger, riskier edit to
--    an already carefully-tuned RLS surface (see that migration's section
--    8.8 note on avoiding duplicate permissive policies). Since these RPCs
--    are the ONLY way the app writes module content, each module-gated
--    function below adds its OWN unconditional module_enabled() check
--    (no admin bypass) as the effective, narrower enforcement point — the
--    underlying RLS policies are untouched and still just as permissive as
--    before for any other, non-app caller.
--
-- Every function is `set search_path = ''` with fully schema-qualified
-- relations, matching every other function in this schema.
-- =============================================================================


-- =============================================================================
-- 1. Module activation — the ONE SECURITY DEFINER function in this migration.
-- =============================================================================

create function public.admin_set_business_module(
  p_business_id uuid,
  p_module_key text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not security.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- business_modules.module_key already has a check constraint restricting
  -- it to the 7 approved keys — an unknown key fails there, not here.
  insert into public.business_modules (business_id, module_key, enabled, updated_at)
  values (p_business_id, p_module_key, p_enabled, now())
  on conflict (business_id, module_key) do update set
    enabled = excluded.enabled,
    updated_at = now();
end;
$$;

revoke all on function public.admin_set_business_module(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_business_module(uuid, text, boolean) to authenticated;

comment on function public.admin_set_business_module(uuid, text, boolean) is
  'The only write path for business_modules (which otherwise has zero grant to any application '
  'role). SECURITY DEFINER, gated entirely on security.is_platform_admin() — never touches or '
  'exposes module content, only the boolean entitlement flag. Never toggles content presence.';


-- =============================================================================
-- 2. Shared ownership + module-gate guard, reused by every INVOKER function
--    below (kept as a function, not copy-pasted, so the one true rule lives
--    in one place).
-- =============================================================================

create function public.admin_require_business_write(p_business_id uuid, p_module_key text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (public.is_business_member(p_business_id) or security.is_platform_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_module_key is not null and not public.module_enabled(p_business_id, p_module_key) then
    raise exception 'module % is disabled', p_module_key using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.admin_require_business_write(uuid, text) from public, anon;
grant execute on function public.admin_require_business_write(uuid, text) to authenticated;

comment on function public.admin_require_business_write(uuid, text) is
  'Shared guard for the admin_replace_*/admin_upsert_* functions below: membership-or-admin, plus '
  '(when p_module_key is given) an UNCONDITIONAL module_enabled() check — deliberately with no '
  'admin bypass, unlike the underlying RLS policies (see migration header). Pass NULL for a core, '
  'ungated table (business_hours, social_links).';


-- =============================================================================
-- 3. Core, ungated ordered collections — atomic replace (fixes the Phase 4B.3
--    insert-then-delete note).
-- =============================================================================

create function public.admin_replace_business_hours(p_business_id uuid, p_hours jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.admin_require_business_write(p_business_id, null);

  if jsonb_typeof(p_hours) is distinct from 'array' then
    raise exception 'p_hours must be a JSON array';
  end if;

  delete from public.business_hours where business_id = p_business_id;

  insert into public.business_hours (business_id, label, days, periods, sort_order)
  select
    p_business_id,
    entry ->> 'label',
    array(select jsonb_array_elements_text(entry -> 'days'))::smallint[],
    coalesce(entry -> 'periods', '[]'::jsonb),
    ordinality - 1
  from jsonb_array_elements(p_hours) with ordinality as t(entry, ordinality);
end;
$$;

revoke all on function public.admin_replace_business_hours(uuid, jsonb) from public, anon;
grant execute on function public.admin_replace_business_hours(uuid, jsonb) to authenticated;

create function public.admin_replace_social_links(p_business_id uuid, p_links jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.admin_require_business_write(p_business_id, null);

  if jsonb_typeof(p_links) is distinct from 'array' then
    raise exception 'p_links must be a JSON array';
  end if;

  delete from public.social_links where business_id = p_business_id;

  insert into public.social_links (business_id, platform, url, label, sort_order)
  select p_business_id, entry ->> 'platform', entry ->> 'url', entry ->> 'label', ordinality - 1
  from jsonb_array_elements(p_links) with ordinality as t(entry, ordinality);
end;
$$;

revoke all on function public.admin_replace_social_links(uuid, jsonb) from public, anon;
grant execute on function public.admin_replace_social_links(uuid, jsonb) to authenticated;


-- =============================================================================
-- 4. Module-gated flat ordered lists.
-- =============================================================================

-- services / represented_brands / product_categories share an identical
-- shape (id, business_id, label, sort_order) — one function, an explicit
-- allowlist (never client-supplied SQL), format(%I) for identifier safety.
create function public.admin_replace_labeled_list(p_business_id uuid, p_table text, p_labels text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_module_key text;
begin
  case p_table
    when 'services' then v_module_key := 'services';
    when 'represented_brands' then v_module_key := 'brands';
    when 'product_categories' then v_module_key := 'product_categories';
    else raise exception 'admin_replace_labeled_list: unsupported table %', p_table;
  end case;

  perform public.admin_require_business_write(p_business_id, v_module_key);

  execute format('delete from public.%I where business_id = $1', p_table) using p_business_id;

  if p_labels is not null and array_length(p_labels, 1) is not null then
    execute format(
      'insert into public.%I (business_id, label, sort_order) '
      'select $1, label, ordinality - 1 from unnest($2::text[]) with ordinality as t(label, ordinality)',
      p_table
    ) using p_business_id, p_labels;
  end if;
end;
$$;

revoke all on function public.admin_replace_labeled_list(uuid, text, text[]) from public, anon;
grant execute on function public.admin_replace_labeled_list(uuid, text, text[]) to authenticated;

comment on function public.admin_replace_labeled_list(uuid, text, text[]) is
  'p_table is restricted to a fixed allowlist (services, represented_brands, product_categories) '
  'via an explicit CASE before any dynamic SQL runs — never a client-supplied identifier used '
  'directly.';

-- gallery — its own shape, plus the phase's explicit "max 5 items" rule
-- enforced here (server-side), not only in the client form.
create function public.admin_replace_gallery(p_business_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.admin_require_business_write(p_business_id, 'gallery');

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'p_items must be a JSON array';
  end if;

  if jsonb_array_length(p_items) > 5 then
    raise exception 'gallery allows at most 5 items' using errcode = '23514';
  end if;

  delete from public.gallery where business_id = p_business_id;

  insert into public.gallery (business_id, src, alt, aspect_ratio, placeholder_label, sort_order)
  select
    p_business_id,
    nullif(item ->> 'src', ''),
    item ->> 'alt',
    nullif(item ->> 'aspectRatio', ''),
    nullif(item ->> 'placeholderLabel', ''),
    ordinality - 1
  from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);
end;
$$;

revoke all on function public.admin_replace_gallery(uuid, jsonb) from public, anon;
grant execute on function public.admin_replace_gallery(uuid, jsonb) to authenticated;


-- =============================================================================
-- 5. restaurant_info — 1:1, so this is a plain gated upsert (a single-row
--    statement is already atomic; the value of this function is the shared
--    unconditional module-gate check, for consistency with every other
--    module writer).
-- =============================================================================

create function public.admin_upsert_restaurant_info(
  p_business_id uuid,
  p_average_spend text,
  p_average_spend_note text,
  p_cuisine text,
  p_cuisine_note text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.admin_require_business_write(p_business_id, 'restaurant_info');

  insert into public.restaurant_info (business_id, average_spend, average_spend_note, cuisine, cuisine_note, updated_by)
  values (p_business_id, p_average_spend, p_average_spend_note, p_cuisine, p_cuisine_note, (select auth.uid()))
  on conflict (business_id) do update set
    average_spend = excluded.average_spend,
    average_spend_note = excluded.average_spend_note,
    cuisine = excluded.cuisine,
    cuisine_note = excluded.cuisine_note,
    updated_by = excluded.updated_by;
  -- updated_at is set by the existing restaurant_info_set_updated_at trigger.
end;
$$;

revoke all on function public.admin_upsert_restaurant_info(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_upsert_restaurant_info(uuid, text, text, text, text) to authenticated;


-- =============================================================================
-- 6. Nested collections — menu (sections -> items) and treatments (groups ->
--    items). Both child tables cascade-delete with their parent (see the V1
--    schema migration's foreign keys), so replacing the parent rows is
--    enough; a single function call is one transaction, so a mid-loop error
--    rolls back the whole replace instead of leaving a half-written menu.
-- =============================================================================

create function public.admin_replace_menu(p_business_id uuid, p_sections jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_section jsonb;
  v_section_id uuid;
  v_section_ord int := 0;
  v_item jsonb;
  v_item_ord int;
begin
  perform public.admin_require_business_write(p_business_id, 'menu');

  if jsonb_typeof(p_sections) is distinct from 'array' then
    raise exception 'p_sections must be a JSON array';
  end if;

  delete from public.menu_sections where business_id = p_business_id;

  for v_section in select * from jsonb_array_elements(p_sections)
  loop
    insert into public.menu_sections (business_id, title, sort_order)
    values (p_business_id, v_section ->> 'title', v_section_ord)
    returning id into v_section_id;

    v_item_ord := 0;
    for v_item in select * from jsonb_array_elements(coalesce(v_section -> 'items', '[]'::jsonb))
    loop
      insert into public.menu_items (menu_section_id, name, price, sort_order)
      values (v_section_id, v_item ->> 'name', nullif(v_item ->> 'price', ''), v_item_ord);
      v_item_ord := v_item_ord + 1;
    end loop;

    v_section_ord := v_section_ord + 1;
  end loop;
end;
$$;

revoke all on function public.admin_replace_menu(uuid, jsonb) from public, anon;
grant execute on function public.admin_replace_menu(uuid, jsonb) to authenticated;

create function public.admin_replace_treatments(p_business_id uuid, p_groups jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group jsonb;
  v_group_id uuid;
  v_group_ord int := 0;
  v_item text;
  v_item_ord int;
begin
  perform public.admin_require_business_write(p_business_id, 'treatments');

  if jsonb_typeof(p_groups) is distinct from 'array' then
    raise exception 'p_groups must be a JSON array';
  end if;

  delete from public.treatment_groups where business_id = p_business_id;

  for v_group in select * from jsonb_array_elements(p_groups)
  loop
    insert into public.treatment_groups (business_id, slug_key, title, description, sort_order)
    values (
      p_business_id,
      coalesce(nullif(v_group ->> 'id', ''), 'group-' || v_group_ord),
      v_group ->> 'title',
      coalesce(v_group ->> 'description', ''),
      v_group_ord
    )
    returning id into v_group_id;

    v_item_ord := 0;
    for v_item in select value from jsonb_array_elements_text(coalesce(v_group -> 'items', '[]'::jsonb))
    loop
      insert into public.treatment_items (treatment_group_id, label, sort_order)
      values (v_group_id, v_item, v_item_ord);
      v_item_ord := v_item_ord + 1;
    end loop;

    v_group_ord := v_group_ord + 1;
  end loop;
end;
$$;

revoke all on function public.admin_replace_treatments(uuid, jsonb) from public, anon;
grant execute on function public.admin_replace_treatments(uuid, jsonb) to authenticated;

-- =============================================================================
-- End of Phase 4B.4 admin module write RPCs migration.
-- =============================================================================

import type { Business, DirectoryBusiness } from "@/lib/businesses";
import { isValidSlug } from "@/lib/businesses";
import {
  buildPreviewBusiness,
  mapBusinessFromDatabase,
  mapModuleActivation,
  type BusinessRecord,
} from "@/lib/admin/business-mapping";
import { getPublicSupabaseClient } from "@/lib/supabase/public";
import type {
  BusinessHoursRow,
  BusinessModuleRow,
  BusinessProfileContentRow,
  BusinessRow,
  GalleryRow,
  MenuItemRow,
  MenuSectionRow,
  ProductCategoryRow,
  RepresentedBrandRow,
  RestaurantInfoRow,
  ServiceRow,
  SocialLinkRow,
  TreatmentGroupRow,
  TreatmentItemRow,
} from "@/lib/supabase/types";

/**
 * Canonical Supabase -> `Business` data layer for PUBLIC rendering
 * (Phase 4C) — the public-facing counterpart to the admin editor's loader in
 * `app/admin/(protected)/businesses/[id]/edit/page.tsx`.
 *
 * Deliberately the SAME query shape and the SAME mapper
 * (`mapBusinessFromDatabase`) as the admin loader, so admin and public never
 * diverge into two different `Business` representations — the only
 * differences from the admin loader are:
 *   - looked up by `slug` (the public identifier) instead of `id`;
 *   - always goes through `getPublicSupabaseClient()` (cookie-free, anon
 *     RLS — see lib/supabase/public.ts), never the cookie-aware admin
 *     client, so a logged-in admin browsing the public site never sees more
 *     than an anonymous visitor would;
 *   - explicitly narrows content by `business_modules` activation via
 *     `buildPreviewBusiness` — module activation is NOT inferred from
 *     whether content rows happen to exist (RLS already hides a disabled
 *     module's rows from anon, but this makes the intent explicit and keeps
 *     behavior correct even if a future policy change ever loosened that).
 *
 * `published`/`archived_at` filtering is NOT re-implemented here — it is
 * enforced by Postgres RLS itself (see
 * supabase/migrations/20260906210142_piricard_v1_schema.sql section 8):
 * an unpublished or archived business simply never comes back from these
 * queries for the anon role, so "not found" and "not visible yet" are
 * indistinguishable here by construction, exactly like the existing static
 * `getPublishedBusinessBySlug`.
 */

const BUSINESS_ROW_COLUMNS =
  "id, slug, organization, layout_variant, theme, assets, maps_url, google_place_id, review_url, review_write_url, review_fallback, external_links, digital_card, published, featured, indexable, archived_at, created_at, updated_at";

const CONTENT_COLUMNS =
  "business_id, name, category, directory_description, profile_description, positioning, about, phone, whatsapp, email, website, address, street_address, city, country, updated_at, updated_by";

async function fetchModuleContent(businessId: string): Promise<Pick<
  BusinessRecord,
  | "modules"
  | "services"
  | "gallery"
  | "restaurantInfo"
  | "representedBrands"
  | "productCategories"
  | "menuSections"
  | "menuItems"
  | "treatmentGroups"
  | "treatmentItems"
>> {
  const supabase = getPublicSupabaseClient();
  const [
    { data: modules },
    { data: services },
    { data: gallery },
    { data: restaurantInfo },
    { data: representedBrands },
    { data: productCategories },
    { data: menuSections },
    { data: menuItems },
    { data: treatmentGroups },
    { data: treatmentItems },
  ] = await Promise.all([
    supabase
      .from("business_modules")
      .select("business_id, module_key, enabled, updated_at")
      .eq("business_id", businessId)
      .returns<BusinessModuleRow[]>(),
    supabase
      .from("services")
      .select("id, business_id, label, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<ServiceRow[]>(),
    supabase
      .from("gallery")
      .select("id, business_id, src, alt, aspect_ratio, placeholder_label, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<GalleryRow[]>(),
    supabase
      .from("restaurant_info")
      .select("business_id, average_spend, average_spend_note, cuisine, cuisine_note, updated_at, updated_by")
      .eq("business_id", businessId)
      .maybeSingle()
      .returns<RestaurantInfoRow | null>(),
    supabase
      .from("represented_brands")
      .select("id, business_id, label, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<RepresentedBrandRow[]>(),
    supabase
      .from("product_categories")
      .select("id, business_id, label, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<ProductCategoryRow[]>(),
    supabase
      .from("menu_sections")
      .select("id, business_id, title, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<MenuSectionRow[]>(),
    supabase
      .from("menu_items")
      .select("id, menu_section_id, business_id, name, price, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<MenuItemRow[]>(),
    supabase
      .from("treatment_groups")
      .select("id, business_id, slug_key, title, description, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<TreatmentGroupRow[]>(),
    supabase
      .from("treatment_items")
      .select("id, treatment_group_id, business_id, label, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .returns<TreatmentItemRow[]>(),
  ]);

  return {
    modules: modules ?? [],
    services: services ?? [],
    gallery: gallery ?? [],
    restaurantInfo: restaurantInfo ?? null,
    representedBrands: representedBrands ?? [],
    productCategories: productCategories ?? [],
    menuSections: menuSections ?? [],
    menuItems: menuItems ?? [],
    treatmentGroups: treatmentGroups ?? [],
    treatmentItems: treatmentItems ?? [],
  };
}

/**
 * Fetches the published business for `slug` and maps it into the public
 * `Business` domain model. Returns `undefined` for: a malformed slug, a
 * slug with no matching row, an unpublished business, or an archived
 * business — all indistinguishable here by design (anon RLS never returns
 * the row), matching `notFound()` handling in `app/[slug]/page.tsx`.
 */
export async function getPublicBusinessBySlug(slug: string): Promise<Business | undefined> {
  if (!isValidSlug(slug)) return undefined;

  const supabase = getPublicSupabaseClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(BUSINESS_ROW_COLUMNS)
    .eq("slug", slug)
    .maybeSingle()
    .returns<BusinessRow | null>();

  if (businessError || !business) return undefined;

  const [{ data: content }, { data: hours }, { data: socialLinks }, moduleContent] = await Promise.all([
    supabase
      .from("business_profile_content")
      .select(CONTENT_COLUMNS)
      .eq("business_id", business.id)
      .maybeSingle()
      .returns<BusinessProfileContentRow | null>(),
    supabase
      .from("business_hours")
      .select("id, business_id, label, days, periods, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<BusinessHoursRow[]>(),
    supabase
      .from("social_links")
      .select("id, business_id, platform, url, label, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<SocialLinkRow[]>(),
    fetchModuleContent(business.id),
  ]);

  const mapped = mapBusinessFromDatabase({
    business,
    content: content ?? null,
    hours: hours ?? [],
    socialLinks: socialLinks ?? [],
    ...moduleContent,
  });

  const activation = mapModuleActivation(moduleContent.modules ?? []);
  return buildPreviewBusiness(mapped, activation);
}

/**
 * Fetches every published, non-archived business's directory-card fields.
 * Reuses `mapBusinessFromDatabase` (rather than re-deriving the
 * `name`/`category`/`directoryDescription` fallback rules a second time) so
 * the directory can never drift from the profile's own name resolution —
 * `hours`/`socialLinks` are irrelevant to a directory card, so empty arrays
 * are passed rather than fetched.
 *
 * Ordering matches the existing static `getPublishedDirectoryBusinesses`
 * exactly: featured businesses first, then Portuguese-locale name order.
 */
export async function getPublicDirectoryBusinesses(): Promise<DirectoryBusiness[]> {
  const supabase = getPublicSupabaseClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select(BUSINESS_ROW_COLUMNS)
    .eq("published", true)
    .is("archived_at", null)
    .returns<BusinessRow[]>();

  const rows = businesses ?? [];
  if (rows.length === 0) return [];

  const { data: contentRows } = await supabase
    .from("business_profile_content")
    .select(CONTENT_COLUMNS)
    .in(
      "business_id",
      rows.map((row) => row.id),
    )
    .returns<BusinessProfileContentRow[]>();

  const contentByBusinessId = new Map((contentRows ?? []).map((row) => [row.business_id, row]));

  const mapped = rows.map((business) =>
    mapBusinessFromDatabase({
      business,
      content: contentByBusinessId.get(business.id) ?? null,
      hours: [],
      socialLinks: [],
    }),
  );

  return mapped
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "pt"))
    .map((business) => ({
      slug: business.slug,
      name: business.name,
      category: business.category,
      directoryDescription: business.directoryDescription,
      city: business.location?.city,
      logo: business.assets.logo,
      logoOnLight: business.assets.logoOnLight,
    }));
}

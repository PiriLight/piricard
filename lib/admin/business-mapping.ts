import type {
  Business,
  BusinessAbout,
  BusinessGalleryImage,
  BusinessHoursEntry,
  BusinessTheme,
  MenuSection,
  RestaurantInfo,
  SocialPlatform,
  TreatmentGroup,
} from "@/lib/businesses";
import type {
  BusinessHoursRow,
  BusinessModuleRow,
  BusinessProfileContentRow,
  BusinessRow,
  GalleryRow,
  MenuItemRow,
  MenuSectionRow,
  ModuleKey,
  ProductCategoryRow,
  RepresentedBrandRow,
  RestaurantInfoRow,
  ServiceRow,
  SocialLinkRow,
  TreatmentGroupRow,
  TreatmentItemRow,
} from "@/lib/supabase/types";

/**
 * Supabase rows -> admin draft <-> the public `Business` domain model.
 *
 * This is the single mapping layer between Supabase and `Business` — the
 * admin app is not meant to spread raw row shapes through components. Phase
 * 4C (public profiles migrating to Supabase) should be able to reuse
 * `mapBusinessFromDatabase` as-is rather than writing a second mapper.
 *
 * Phase 4B.4 extends this with the 7 module-gated content tables (services,
 * gallery, restaurant_info, menu_sections/menu_items,
 * treatment_groups/treatment_items, represented_brands, product_categories)
 * and with `ModuleActivation` — module ENTITLEMENT (business_modules), which
 * is deliberately NOT a `Business` field. `Business` is the public rendering
 * model; whether a module is on/off is an admin-only concern, so it travels
 * as a sibling value next to the draft, never inside it.
 */

const FALLBACK_THEME: BusinessTheme = {
  primary: "#141f52",
  secondary: "#0f0c0a",
  accent: "#4f8ffb",
  background: "#eef1f8",
  surface: "#ffffff",
  text: "#141f52",
  mutedText: "#525c80",
  border: "#dce3f2",
  appearance: "light",
  fontFamily: "modern",
};

const VALID_LAYOUT_VARIANTS: ReadonlyArray<Business["layoutVariant"]> = [
  "editorial",
  "compact",
  "restaurant",
  "racing",
  "beauty",
  "workshop",
];

const VALID_SOCIAL_PLATFORMS: ReadonlyArray<SocialPlatform> = ["facebook", "instagram", "linkedin", "youtube", "tiktok"];

function toLayoutVariant(value: string): Business["layoutVariant"] {
  return (VALID_LAYOUT_VARIANTS as readonly string[]).includes(value)
    ? (value as Business["layoutVariant"])
    : "editorial";
}

function toTheme(value: Record<string, unknown> | null): BusinessTheme {
  return { ...FALLBACK_THEME, ...(value ?? {}) } as BusinessTheme;
}

function toSocialPlatform(value: string): SocialPlatform {
  return (VALID_SOCIAL_PLATFORMS as readonly string[]).includes(value) ? (value as SocialPlatform) : "instagram";
}

export interface BusinessRecord {
  business: BusinessRow;
  content: BusinessProfileContentRow | null;
  hours: BusinessHoursRow[];
  socialLinks: SocialLinkRow[];
  modules?: BusinessModuleRow[];
  services?: ServiceRow[];
  gallery?: GalleryRow[];
  restaurantInfo?: RestaurantInfoRow | null;
  representedBrands?: RepresentedBrandRow[];
  productCategories?: ProductCategoryRow[];
  menuSections?: MenuSectionRow[];
  menuItems?: MenuItemRow[];
  treatmentGroups?: TreatmentGroupRow[];
  treatmentItems?: TreatmentItemRow[];
}

function bySortOrder<T extends { sort_order: number }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.sort_order - b.sort_order);
}

export function mapBusinessFromDatabase(record: BusinessRecord): Business {
  const { business, content, hours, socialLinks } = record;

  const about: BusinessAbout | undefined = content?.about
    ? {
        heading: content.about.heading || undefined,
        paragraphs: content.about.paragraphs?.length ? content.about.paragraphs : undefined,
      }
    : undefined;

  const services = record.services?.length ? bySortOrder(record.services).map((row) => row.label) : undefined;

  const gallery: BusinessGalleryImage[] | undefined = record.gallery?.length
    ? bySortOrder(record.gallery).map((row) => ({
        src: row.src ?? undefined,
        alt: row.alt,
        aspectRatio: (row.aspect_ratio ?? undefined) as BusinessGalleryImage["aspectRatio"],
        placeholderLabel: row.placeholder_label ?? undefined,
      }))
    : undefined;

  const restaurantInfo: RestaurantInfo | undefined = record.restaurantInfo
    ? {
        averageSpend: record.restaurantInfo.average_spend ?? undefined,
        averageSpendNote: record.restaurantInfo.average_spend_note ?? undefined,
        cuisine: record.restaurantInfo.cuisine ?? undefined,
        cuisineNote: record.restaurantInfo.cuisine_note ?? undefined,
      }
    : undefined;

  const representedBrands = record.representedBrands?.length
    ? bySortOrder(record.representedBrands).map((row) => row.label)
    : undefined;

  const productCategories = record.productCategories?.length
    ? bySortOrder(record.productCategories).map((row) => row.label)
    : undefined;

  const menu: MenuSection[] | undefined = record.menuSections?.length
    ? bySortOrder(record.menuSections).map((section) => ({
        title: section.title,
        items: bySortOrder((record.menuItems ?? []).filter((item) => item.menu_section_id === section.id)).map((item) => ({
          name: item.name,
          price: item.price ?? undefined,
        })),
      }))
    : undefined;

  const treatmentGroups: TreatmentGroup[] | undefined = record.treatmentGroups?.length
    ? bySortOrder(record.treatmentGroups).map((group) => ({
        id: group.slug_key,
        title: group.title,
        description: group.description,
        items: bySortOrder((record.treatmentItems ?? []).filter((item) => item.treatment_group_id === group.id)).map(
          (item) => item.label,
        ),
      }))
    : undefined;

  return {
    slug: business.slug,
    name: content?.name ?? business.organization,
    organization: business.organization,
    category: content?.category ?? "",
    published: business.published,
    featured: business.featured,
    indexable: business.indexable,
    directoryDescription: content?.directory_description ?? "",
    profileDescription: content?.profile_description ?? undefined,
    positioning: content?.positioning ?? undefined,
    about,
    contact: {
      phone: content?.phone ?? undefined,
      whatsapp: content?.whatsapp ?? undefined,
      email: content?.email ?? undefined,
      website: content?.website ?? undefined,
    },
    location: {
      city: content?.city ?? undefined,
      address: content?.address ?? undefined,
      streetAddress: content?.street_address ?? undefined,
      country: content?.country ?? undefined,
      mapsUrl: business.maps_url ?? undefined,
    },
    reviewUrl: business.review_url ?? undefined,
    reviewWriteUrl: business.review_write_url ?? undefined,
    externalLinks: business.external_links ?? undefined,
    reviewSnapshot: business.review_fallback ?? undefined,
    googlePlaceId: business.google_place_id ?? undefined,
    socialLinks: socialLinks
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => ({ platform: toSocialPlatform(link.platform), url: link.url, label: link.label })),
    services,
    hours: hours
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row): BusinessHoursEntry => ({ label: row.label, days: row.days, periods: row.periods })),
    assets: (business.assets ?? {}) as Business["assets"],
    gallery,
    menu,
    restaurantInfo,
    treatmentGroups,
    representedBrands,
    productCategories,
    digitalCard: business.digital_card ?? undefined,
    theme: toTheme(business.theme),
    layoutVariant: toLayoutVariant(business.layout_variant),
  };
}

// ---------------------------------------------------------------------------
// Module activation (business_modules) — entitlement, deliberately separate
// from `Business` (see file header). ALWAYS derived from business_modules
// rows only, never inferred from whether content happens to exist.
// ---------------------------------------------------------------------------

export const MODULE_KEYS: readonly ModuleKey[] = [
  "services",
  "gallery",
  "restaurant_info",
  "menu",
  "treatments",
  "brands",
  "product_categories",
];

export type ModuleActivation = Record<ModuleKey, boolean>;

export function mapModuleActivation(rows: BusinessModuleRow[]): ModuleActivation {
  const activation = Object.fromEntries(MODULE_KEYS.map((key) => [key, false])) as ModuleActivation;
  for (const row of rows) {
    if (MODULE_KEYS.includes(row.module_key)) activation[row.module_key] = row.enabled;
  }
  return activation;
}

/**
 * Builds the `Business` object actually handed to the preview (and, later,
 * the public site once Phase 4C migrates it to Supabase): a disabled
 * module's fields are neutralized here, in the DTO, rather than by teaching
 * BusinessProfile/the bespoke profile components a new "is this enabled"
 * concept they don't otherwise need. The module editor's own draft state
 * keeps the full content regardless of activation, so turning a module back
 * on never loses what was there.
 */
export function buildPreviewBusiness(business: Business, activation: ModuleActivation): Business {
  return {
    ...business,
    services: activation.services ? business.services : undefined,
    gallery: activation.gallery ? business.gallery : undefined,
    restaurantInfo: activation.restaurant_info ? business.restaurantInfo : undefined,
    menu: activation.menu ? business.menu : undefined,
    treatmentGroups: activation.treatments ? business.treatmentGroups : undefined,
    representedBrands: activation.brands ? business.representedBrands : undefined,
    productCategories: activation.product_categories ? business.productCategories : undefined,
  };
}

// ---------------------------------------------------------------------------
// Draft (Business) -> save payload. Extracts only the fields this phase's
// editor is allowed to write (see AGENTS/phase spec: business_profile_content
// + business_hours + social_links only — never businesses' protected config).
// ---------------------------------------------------------------------------

export interface BusinessCoreContentPayload {
  name: string;
  category: string;
  directoryDescription: string;
  profileDescription: string;
  positioning: string;
  aboutHeading: string;
  aboutParagraphs: string[];
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  streetAddress: string;
  city: string;
  country: string;
}

export interface BusinessCoreHoursPayload {
  label: string;
  days: number[];
  periods: Array<{ open: string; close: string }>;
}

export interface BusinessCoreSocialLinkPayload {
  platform: SocialPlatform;
  url: string;
  label: string;
}

export interface BusinessCoreSavePayload {
  content: BusinessCoreContentPayload;
  hours: BusinessCoreHoursPayload[];
  socialLinks: BusinessCoreSocialLinkPayload[];
}

export function toBusinessCoreSavePayload(draft: Business): BusinessCoreSavePayload {
  return {
    content: {
      name: draft.name.trim(),
      category: draft.category.trim(),
      directoryDescription: draft.directoryDescription.trim(),
      profileDescription: (draft.profileDescription ?? "").trim(),
      positioning: (draft.positioning ?? "").trim(),
      aboutHeading: (draft.about?.heading ?? "").trim(),
      aboutParagraphs: (draft.about?.paragraphs ?? []).map((paragraph) => paragraph.trim()).filter(Boolean),
      phone: (draft.contact.phone ?? "").trim(),
      whatsapp: (draft.contact.whatsapp ?? "").trim(),
      email: (draft.contact.email ?? "").trim(),
      website: (draft.contact.website ?? "").trim(),
      address: (draft.location?.address ?? "").trim(),
      streetAddress: (draft.location?.streetAddress ?? "").trim(),
      city: (draft.location?.city ?? "").trim(),
      country: (draft.location?.country ?? "").trim(),
    },
    hours: (draft.hours ?? []).map((entry) => ({ label: entry.label, days: entry.days, periods: entry.periods })),
    socialLinks: (draft.socialLinks ?? []).map((link) => ({
      platform: link.platform,
      url: link.url.trim(),
      label: link.label.trim(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Module content: draft (Business) -> save payload. One payload per module,
// sent only for modules that are currently enabled (see the save action) —
// mirrors the RPCs added in supabase/migrations/20260907120000_admin_module_write_rpcs.sql.
// ---------------------------------------------------------------------------

export interface GalleryItemPayload {
  src: string;
  alt: string;
  aspectRatio?: BusinessGalleryImage["aspectRatio"];
  placeholderLabel?: string;
}

export interface RestaurantInfoPayload {
  averageSpend: string;
  averageSpendNote: string;
  cuisine: string;
  cuisineNote: string;
}

export interface MenuSectionPayload {
  title: string;
  items: Array<{ name: string; price: string }>;
}

export interface TreatmentGroupPayload {
  id: string;
  title: string;
  description: string;
  items: string[];
}

export interface ModuleContentSavePayload {
  services: string[];
  gallery: GalleryItemPayload[];
  restaurantInfo: RestaurantInfoPayload;
  menu: MenuSectionPayload[];
  treatmentGroups: TreatmentGroupPayload[];
  representedBrands: string[];
  productCategories: string[];
}

export function toModuleContentSavePayload(draft: Business): ModuleContentSavePayload {
  return {
    services: (draft.services ?? []).map((label) => label.trim()).filter(Boolean),
    gallery: (draft.gallery ?? []).map((image) => ({
      src: (image.src ?? "").trim(),
      alt: image.alt.trim(),
      aspectRatio: image.aspectRatio,
      placeholderLabel: image.placeholderLabel?.trim() || undefined,
    })),
    restaurantInfo: {
      averageSpend: (draft.restaurantInfo?.averageSpend ?? "").trim(),
      averageSpendNote: (draft.restaurantInfo?.averageSpendNote ?? "").trim(),
      cuisine: (draft.restaurantInfo?.cuisine ?? "").trim(),
      cuisineNote: (draft.restaurantInfo?.cuisineNote ?? "").trim(),
    },
    menu: (draft.menu ?? []).map((section) => ({
      title: section.title.trim(),
      items: section.items.map((item) => ({ name: item.name.trim(), price: (item.price ?? "").trim() })),
    })),
    treatmentGroups: (draft.treatmentGroups ?? []).map((group) => ({
      id: group.id.trim(),
      title: group.title.trim(),
      description: group.description.trim(),
      items: group.items.map((item) => item.trim()).filter(Boolean),
    })),
    representedBrands: (draft.representedBrands ?? []).map((label) => label.trim()).filter(Boolean),
    productCategories: (draft.productCategories ?? []).map((label) => label.trim()).filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Phase 4B.5/4B.6 — protected business config (the `businesses` table
// itself): identity, layout, theme, assets, technical/Google fields,
// featured/indexable. Deliberately a separate save boundary from core
// content/modules above — a different RPC, a different admin-only
// authorization rule (platform-admin-only, not member-or-admin).
// ---------------------------------------------------------------------------

export interface BusinessConfigPayload {
  slug: string;
  organization: string;
  layoutVariant: Business["layoutVariant"];
  theme: BusinessTheme;
  assets: Business["assets"];
  mapsUrl: string;
  googlePlaceId: string;
  reviewUrl: string;
  reviewWriteUrl: string;
  reviewFallback: { rating: number; count: number; source: string; asOf: string } | null;
  externalLinks: { tripAdvisor: string; delivery: string; collection: string };
  digitalCard: { path: string; format: "PNG" | "PDF" } | null;
  featured: boolean;
  indexable: boolean;
}

export function toBusinessConfigPayload(draft: Business): BusinessConfigPayload {
  const reviewSnapshot = draft.reviewSnapshot;
  return {
    slug: draft.slug.trim(),
    organization: draft.organization.trim(),
    layoutVariant: draft.layoutVariant,
    theme: draft.theme,
    assets: draft.assets,
    mapsUrl: (draft.location?.mapsUrl ?? "").trim(),
    googlePlaceId: (draft.googlePlaceId ?? "").trim(),
    reviewUrl: (draft.reviewUrl ?? "").trim(),
    reviewWriteUrl: (draft.reviewWriteUrl ?? "").trim(),
    reviewFallback: reviewSnapshot && reviewSnapshot.source.trim() ? reviewSnapshot : null,
    externalLinks: {
      tripAdvisor: (draft.externalLinks?.tripAdvisor ?? "").trim(),
      delivery: (draft.externalLinks?.delivery ?? "").trim(),
      collection: (draft.externalLinks?.collection ?? "").trim(),
    },
    digitalCard: draft.digitalCard && draft.digitalCard.path.trim() ? draft.digitalCard : null,
    featured: draft.featured,
    indexable: draft.indexable,
  };
}

const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "auth",
  "piricard",
  "reset-password",
  "login",
  "logout",
  "app",
  "www",
  "static",
  "assets",
  "public",
  "_next",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

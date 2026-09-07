/**
 * Hand-written row types for the tables touched by the admin editor (Phases
 * 4B.3-4B.4). Mirrors supabase/migrations/20260906210142_piricard_v1_schema.sql
 * column-for-column — kept in sync manually rather than generated, since the
 * project's actual remote database is not reachable from this environment's
 * Supabase MCP connection (a different account/project shows up there).
 */

export interface BusinessRow {
  id: string;
  slug: string;
  organization: string;
  layout_variant: string;
  theme: Record<string, unknown> | null;
  assets: Record<string, unknown> | null;
  maps_url: string | null;
  google_place_id: string | null;
  review_url: string | null;
  review_write_url: string | null;
  review_fallback: { rating: number; count: number; source: string; asOf: string } | null;
  external_links: { tripAdvisor?: string; delivery?: string; collection?: string } | null;
  digital_card: { path: string; format: "PNG" | "PDF" } | null;
  published: boolean;
  featured: boolean;
  indexable: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessProfileContentRow {
  business_id: string;
  name: string;
  category: string;
  directory_description: string;
  profile_description: string | null;
  positioning: string | null;
  about: { heading?: string; paragraphs?: string[] } | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  street_address: string | null;
  city: string | null;
  country: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface BusinessHoursRow {
  id: string;
  business_id: string;
  label: string;
  days: number[];
  periods: Array<{ open: string; close: string }>;
  sort_order: number;
}

export interface SocialLinkRow {
  id: string;
  business_id: string;
  platform: string;
  url: string;
  label: string;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Phase 4B.4 — module entitlement + module-gated content tables.
// ---------------------------------------------------------------------------

export type ModuleKey =
  | "services"
  | "gallery"
  | "restaurant_info"
  | "menu"
  | "treatments"
  | "brands"
  | "product_categories";

export interface BusinessModuleRow {
  business_id: string;
  module_key: ModuleKey;
  enabled: boolean;
  updated_at: string;
}

export interface ServiceRow {
  id: string;
  business_id: string;
  label: string;
  sort_order: number;
}

export interface GalleryRow {
  id: string;
  business_id: string;
  src: string | null;
  alt: string;
  aspect_ratio: string | null;
  placeholder_label: string | null;
  sort_order: number;
}

export interface RestaurantInfoRow {
  business_id: string;
  average_spend: string | null;
  average_spend_note: string | null;
  cuisine: string | null;
  cuisine_note: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface RepresentedBrandRow {
  id: string;
  business_id: string;
  label: string;
  sort_order: number;
}

export interface ProductCategoryRow {
  id: string;
  business_id: string;
  label: string;
  sort_order: number;
}

export interface MenuSectionRow {
  id: string;
  business_id: string;
  title: string;
  sort_order: number;
}

export interface MenuItemRow {
  id: string;
  menu_section_id: string;
  business_id: string;
  name: string;
  price: string | null;
  sort_order: number;
}

export interface TreatmentGroupRow {
  id: string;
  business_id: string;
  slug_key: string;
  title: string;
  description: string;
  sort_order: number;
}

export interface TreatmentItemRow {
  id: string;
  treatment_group_id: string;
  business_id: string;
  label: string;
  sort_order: number;
}

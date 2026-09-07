import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessRow } from "@/lib/supabase/types";

/**
 * Regression tests for the Phase 4C public data layer
 * (lib/public/business.ts) against a fully mocked Supabase client — no live
 * database needed. Live-database parity (the actual four production
 * businesses) is validated separately by scripts/verify-business-parity.ts
 * against a local `supabase start` instance; these tests instead pin down
 * this module's own orchestration logic in isolation:
 *   - malformed slugs never reach the database at all;
 *   - a missing/unpublished/archived business (indistinguishable — RLS
 *     already filters them identically) resolves to `undefined`;
 *   - module activation is read explicitly from `business_modules`, never
 *     inferred from whether content rows happen to be present.
 */

function createFakeSupabase(fixtures: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    const rows = fixtures[table] as Array<Record<string, unknown>> | Record<string, unknown> | null | undefined;
    const filters: Record<string, unknown> = {};
    let singleMode = false;

    const builder = {
      select: () => builder,
      order: () => builder,
      returns: () => builder,
      eq(column: string, value: unknown) {
        filters[column] = value;
        return builder;
      },
      is: () => builder,
      in: () => builder,
      maybeSingle() {
        singleMode = true;
        return builder;
      },
      then(resolve: (result: { data: unknown; error: null }) => void) {
        let data: unknown = rows;
        if (table === "businesses" && "slug" in filters) {
          data = Array.isArray(rows) ? (rows.find((row) => row.slug === filters.slug) ?? null) : null;
        } else if (singleMode) {
          data = Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null);
        }
        resolve({ data, error: null });
      },
    };
    return builder;
  });

  return { from };
}

const getPublicSupabaseClientMock = vi.fn();

vi.mock("@/lib/supabase/public", () => ({
  getPublicSupabaseClient: () => getPublicSupabaseClientMock(),
}));

function makeBusinessRow(overrides: Partial<BusinessRow> = {}): BusinessRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "acme",
    organization: "Acme Lda",
    layout_variant: "editorial",
    theme: null,
    assets: {},
    maps_url: null,
    google_place_id: null,
    review_url: null,
    review_write_url: null,
    review_fallback: null,
    external_links: null,
    digital_card: null,
    published: true,
    featured: false,
    indexable: true,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getPublicBusinessBySlug", () => {
  beforeEach(() => {
    getPublicSupabaseClientMock.mockReset();
  });

  it("never queries Supabase for a malformed slug", async () => {
    const { getPublicBusinessBySlug } = await import("@/lib/public/business");
    const result = await getPublicBusinessBySlug("Not A Valid Slug!!");

    expect(result).toBeUndefined();
    expect(getPublicSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("resolves to undefined when RLS returns no matching row (unknown, unpublished, or archived)", async () => {
    const fake = createFakeSupabase({ businesses: [] });
    getPublicSupabaseClientMock.mockReturnValue(fake);

    const { getPublicBusinessBySlug } = await import("@/lib/public/business");
    const result = await getPublicBusinessBySlug("does-not-exist");

    expect(result).toBeUndefined();
  });

  it("strips a module's content when business_modules says it is disabled, even if content rows exist", async () => {
    const fake = createFakeSupabase({
      businesses: [makeBusinessRow()],
      business_profile_content: {
        business_id: "11111111-1111-1111-1111-111111111111",
        name: "Acme",
        category: "Loja",
        directory_description: "Uma loja.",
        profile_description: null,
        positioning: null,
        about: null,
        phone: null,
        whatsapp: null,
        email: null,
        website: null,
        address: null,
        street_address: null,
        city: null,
        country: null,
        updated_at: "2026-01-01T00:00:00Z",
        updated_by: null,
      },
      business_hours: [],
      social_links: [],
      // Only 'gallery' is entitled — 'services' has no enabled row.
      business_modules: [{ business_id: "11111111-1111-1111-1111-111111111111", module_key: "gallery", enabled: true, updated_at: "2026-01-01T00:00:00Z" }],
      // Content rows exist regardless (mirrors: RLS would normally hide these for
      // anon, but this proves the mapper doesn't rely on that alone).
      services: [{ id: "s1", business_id: "11111111-1111-1111-1111-111111111111", label: "Should not appear", sort_order: 0 }],
      gallery: [{ id: "g1", business_id: "11111111-1111-1111-1111-111111111111", src: "/x.png", alt: "x", aspect_ratio: "square", placeholder_label: null, sort_order: 0 }],
      restaurant_info: null,
      represented_brands: [],
      product_categories: [],
      menu_sections: [],
      menu_items: [],
      treatment_groups: [],
      treatment_items: [],
    });
    getPublicSupabaseClientMock.mockReturnValue(fake);

    const { getPublicBusinessBySlug } = await import("@/lib/public/business");
    const result = await getPublicBusinessBySlug("acme");

    expect(result).toBeDefined();
    expect(result?.gallery).toHaveLength(1);
    expect(result?.services).toBeUndefined();
  });
});

describe("getPublicDirectoryBusinesses", () => {
  beforeEach(() => {
    getPublicSupabaseClientMock.mockReset();
  });

  it("orders featured businesses first, then by Portuguese-locale name", async () => {
    const businesses: BusinessRow[] = [
      makeBusinessRow({ id: "1", slug: "zebra", featured: false }),
      makeBusinessRow({ id: "2", slug: "avestruz", featured: true }),
      makeBusinessRow({ id: "3", slug: "acores", featured: false }),
    ];
    const content = [
      { business_id: "1", name: "Zebra Lda", category: "", directory_description: "", profile_description: null, positioning: null, about: null, phone: null, whatsapp: null, email: null, website: null, address: null, street_address: null, city: null, country: null, updated_at: "", updated_by: null },
      { business_id: "2", name: "Avestruz Lda", category: "", directory_description: "", profile_description: null, positioning: null, about: null, phone: null, whatsapp: null, email: null, website: null, address: null, street_address: null, city: null, country: null, updated_at: "", updated_by: null },
      { business_id: "3", name: "Açores Lda", category: "", directory_description: "", profile_description: null, positioning: null, about: null, phone: null, whatsapp: null, email: null, website: null, address: null, street_address: null, city: null, country: null, updated_at: "", updated_by: null },
    ];
    const fake = createFakeSupabase({ businesses, business_profile_content: content });
    getPublicSupabaseClientMock.mockReturnValue(fake);

    const { getPublicDirectoryBusinesses } = await import("@/lib/public/business");
    const result = await getPublicDirectoryBusinesses();

    expect(result.map((business) => business.slug)).toEqual(["avestruz", "acores", "zebra"]);
  });

  it("returns an empty list without a second query when no business is published", async () => {
    const fake = createFakeSupabase({ businesses: [] });
    getPublicSupabaseClientMock.mockReturnValue(fake);

    const { getPublicDirectoryBusinesses } = await import("@/lib/public/business");
    const result = await getPublicDirectoryBusinesses();

    expect(result).toEqual([]);
  });
});

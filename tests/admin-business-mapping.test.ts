import { describe, expect, it } from "vitest";
import { mapBusinessFromDatabase, toBusinessCoreSavePayload } from "@/lib/admin/business-mapping";
import type { BusinessHoursRow, BusinessProfileContentRow, BusinessRow, SocialLinkRow } from "@/lib/supabase/types";

function makeBusinessRow(overrides: Partial<BusinessRow> = {}): BusinessRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "test-business",
    organization: "Test Business Lda",
    layout_variant: "editorial",
    theme: null,
    assets: null,
    maps_url: null,
    google_place_id: null,
    review_url: null,
    review_write_url: null,
    review_fallback: null,
    external_links: null,
    digital_card: null,
    published: false,
    featured: false,
    indexable: true,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeContentRow(overrides: Partial<BusinessProfileContentRow> = {}): BusinessProfileContentRow {
  return {
    business_id: "11111111-1111-1111-1111-111111111111",
    name: "Test Business",
    category: "Serviços",
    directory_description: "Uma descrição de teste.",
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
    ...overrides,
  };
}

describe("mapBusinessFromDatabase", () => {
  it("maps core fields from businesses + business_profile_content", () => {
    const business = mapBusinessFromDatabase({
      business: makeBusinessRow({ layout_variant: "restaurant" }),
      content: makeContentRow({ name: "Restaurante Teste", category: "Restaurante", phone: "+351000000000" }),
      hours: [],
      socialLinks: [],
    });

    expect(business.name).toBe("Restaurante Teste");
    expect(business.category).toBe("Restaurante");
    expect(business.layoutVariant).toBe("restaurant");
    expect(business.contact.phone).toBe("+351000000000");
    expect(business.slug).toBe("test-business");
  });

  it("falls back to a safe layout variant when the stored value is unexpected", () => {
    const business = mapBusinessFromDatabase({
      business: makeBusinessRow({ layout_variant: "not-a-real-layout" }),
      content: makeContentRow(),
      hours: [],
      socialLinks: [],
    });
    expect(business.layoutVariant).toBe("editorial");
  });

  it("degrades gracefully with no profile content row yet (defensive fallback)", () => {
    const business = mapBusinessFromDatabase({
      business: makeBusinessRow(),
      content: null,
      hours: [],
      socialLinks: [],
    });
    expect(business.name).toBe("Test Business Lda"); // falls back to organization
    expect(business.category).toBe("");
    expect(business.directoryDescription).toBe("");
  });

  it("sorts hours and social links by sort_order", () => {
    const hours: BusinessHoursRow[] = [
      { id: "h2", business_id: "b1", label: "Terça", days: [2], periods: [], sort_order: 1 },
      { id: "h1", business_id: "b1", label: "Segunda", days: [1], periods: [{ open: "09:00", close: "18:00" }], sort_order: 0 },
    ];
    const socialLinks: SocialLinkRow[] = [
      { id: "s2", business_id: "b1", platform: "facebook", url: "https://facebook.com/b", label: "Facebook", sort_order: 1 },
      { id: "s1", business_id: "b1", platform: "instagram", url: "https://instagram.com/a", label: "Instagram", sort_order: 0 },
    ];

    const business = mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours, socialLinks });

    expect(business.hours?.map((h) => h.label)).toEqual(["Segunda", "Terça"]);
    expect(business.socialLinks?.map((s) => s.platform)).toEqual(["instagram", "facebook"]);
  });

  it("does not surface module-gated content this phase has no editor for", () => {
    const business = mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] });
    expect(business.services).toBeUndefined();
    expect(business.gallery).toBeUndefined();
    expect(business.menu).toBeUndefined();
    expect(business.restaurantInfo).toBeUndefined();
    expect(business.treatmentGroups).toBeUndefined();
  });
});

describe("toBusinessCoreSavePayload", () => {
  it("extracts and trims only the editable core fields", () => {
    const business = mapBusinessFromDatabase({
      business: makeBusinessRow(),
      content: makeContentRow({ name: "  Nome com espaços  ", phone: " +351123456789 " }),
      hours: [],
      socialLinks: [],
    });
    const payload = toBusinessCoreSavePayload(business);
    expect(payload.content.name).toBe("Nome com espaços");
    expect(payload.content.phone).toBe("+351123456789");
  });

  it("round-trips about heading/paragraphs", () => {
    const business = mapBusinessFromDatabase({
      business: makeBusinessRow(),
      content: makeContentRow({ about: { heading: "Título", paragraphs: ["Parágrafo um."] } }),
      hours: [],
      socialLinks: [],
    });
    const payload = toBusinessCoreSavePayload(business);
    expect(payload.content.aboutHeading).toBe("Título");
    expect(payload.content.aboutParagraphs).toEqual(["Parágrafo um."]);
  });
});

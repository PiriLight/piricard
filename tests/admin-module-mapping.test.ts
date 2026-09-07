import { describe, expect, it } from "vitest";
import {
  buildPreviewBusiness,
  mapBusinessFromDatabase,
  mapModuleActivation,
  MODULE_KEYS,
  toModuleContentSavePayload,
  type ModuleActivation,
} from "@/lib/admin/business-mapping";
import type {
  BusinessModuleRow,
  BusinessProfileContentRow,
  BusinessRow,
  GalleryRow,
  MenuItemRow,
  MenuSectionRow,
  ServiceRow,
  TreatmentGroupRow,
  TreatmentItemRow,
} from "@/lib/supabase/types";

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

describe("mapModuleActivation", () => {
  it("defaults every module to disabled when no rows exist", () => {
    const activation = mapModuleActivation([]);
    for (const key of MODULE_KEYS) expect(activation[key]).toBe(false);
  });

  it("reflects exactly the given rows, ignoring content presence", () => {
    const rows: BusinessModuleRow[] = [
      { business_id: "b1", module_key: "services", enabled: true, updated_at: "2026-01-01T00:00:00Z" },
      { business_id: "b1", module_key: "gallery", enabled: false, updated_at: "2026-01-01T00:00:00Z" },
    ];
    const activation = mapModuleActivation(rows);
    expect(activation.services).toBe(true);
    expect(activation.gallery).toBe(false);
    expect(activation.menu).toBe(false); // no row at all -> false, not inferred
  });
});

describe("mapBusinessFromDatabase — module content", () => {
  it("maps services, gallery, and treatment groups/items with correct ordering and nesting", () => {
    const services: ServiceRow[] = [
      { id: "s2", business_id: "b1", label: "Second", sort_order: 1 },
      { id: "s1", business_id: "b1", label: "First", sort_order: 0 },
    ];
    const gallery: GalleryRow[] = [
      { id: "g1", business_id: "b1", src: "/a.webp", alt: "A", aspect_ratio: "wide", placeholder_label: null, sort_order: 0 },
    ];
    const treatmentGroups: TreatmentGroupRow[] = [
      { id: "tg1", business_id: "b1", slug_key: "rosto", title: "Rosto", description: "Cuidados", sort_order: 0 },
    ];
    const treatmentItems: TreatmentItemRow[] = [
      { id: "ti2", treatment_group_id: "tg1", business_id: "b1", label: "Peeling", sort_order: 1 },
      { id: "ti1", treatment_group_id: "tg1", business_id: "b1", label: "Limpeza", sort_order: 0 },
    ];

    const business = mapBusinessFromDatabase({
      business: makeBusinessRow(),
      content: makeContentRow(),
      hours: [],
      socialLinks: [],
      services,
      gallery,
      treatmentGroups,
      treatmentItems,
    });

    expect(business.services).toEqual(["First", "Second"]);
    expect(business.gallery).toEqual([{ src: "/a.webp", alt: "A", aspectRatio: "wide", placeholderLabel: undefined }]);
    expect(business.treatmentGroups).toEqual([
      { id: "rosto", title: "Rosto", description: "Cuidados", items: ["Limpeza", "Peeling"] },
    ]);
  });

  it("maps nested menu sections/items, associating items with the correct section", () => {
    const menuSections: MenuSectionRow[] = [
      { id: "sec1", business_id: "b1", title: "Principal", sort_order: 0 },
      { id: "sec2", business_id: "b1", title: "Sobremesas", sort_order: 1 },
    ];
    const menuItems: MenuItemRow[] = [
      { id: "i1", menu_section_id: "sec1", business_id: "b1", name: "Prato A", price: "10€", sort_order: 0 },
      { id: "i2", menu_section_id: "sec2", business_id: "b1", name: "Doce", price: null, sort_order: 0 },
    ];

    const business = mapBusinessFromDatabase({
      business: makeBusinessRow(),
      content: makeContentRow(),
      hours: [],
      socialLinks: [],
      menuSections,
      menuItems,
    });

    expect(business.menu).toEqual([
      { title: "Principal", items: [{ name: "Prato A", price: "10€" }] },
      { title: "Sobremesas", items: [{ name: "Doce", price: undefined }] },
    ]);
  });

  it("leaves module fields undefined when no rows are given at all", () => {
    const business = mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] });
    expect(business.services).toBeUndefined();
    expect(business.gallery).toBeUndefined();
    expect(business.menu).toBeUndefined();
    expect(business.treatmentGroups).toBeUndefined();
    expect(business.restaurantInfo).toBeUndefined();
  });
});

describe("buildPreviewBusiness", () => {
  const business = mapBusinessFromDatabase({
    business: makeBusinessRow(),
    content: makeContentRow(),
    hours: [],
    socialLinks: [],
    services: [{ id: "s1", business_id: "b1", label: "A service", sort_order: 0 }],
    representedBrands: [{ id: "br1", business_id: "b1", label: "A brand", sort_order: 0 }],
  });

  it("keeps a module's fields when enabled", () => {
    const activation: ModuleActivation = {
      services: true,
      gallery: false,
      restaurant_info: false,
      menu: false,
      treatments: false,
      brands: true,
      product_categories: false,
    };
    const preview = buildPreviewBusiness(business, activation);
    expect(preview.services).toEqual(["A service"]);
    expect(preview.representedBrands).toEqual(["A brand"]);
  });

  it("neutralizes a module's fields when disabled, without mutating the source draft", () => {
    const activation: ModuleActivation = {
      services: false,
      gallery: false,
      restaurant_info: false,
      menu: false,
      treatments: false,
      brands: false,
      product_categories: false,
    };
    const preview = buildPreviewBusiness(business, activation);
    expect(preview.services).toBeUndefined();
    expect(preview.representedBrands).toBeUndefined();
    // The original draft (what the module editor still shows) is untouched.
    expect(business.services).toEqual(["A service"]);
  });
});

describe("toModuleContentSavePayload", () => {
  it("trims and shapes every module's content", () => {
    const business = mapBusinessFromDatabase({
      business: makeBusinessRow(),
      content: makeContentRow(),
      hours: [],
      socialLinks: [],
      services: [{ id: "s1", business_id: "b1", label: "  Spaced  ", sort_order: 0 }],
    });
    const payload = toModuleContentSavePayload(business);
    expect(payload.services).toEqual(["Spaced"]);
    expect(payload.restaurantInfo).toEqual({ averageSpend: "", averageSpendNote: "", cuisine: "", cuisineNote: "" });
  });
});

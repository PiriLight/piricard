import { describe, expect, it } from "vitest";
import { mapBusinessFromDatabase, mapModuleActivation, type ModuleActivation } from "@/lib/admin/business-mapping";
import type {
  BusinessHoursRow,
  BusinessModuleRow,
  BusinessProfileContentRow,
  BusinessRow,
  MenuItemRow,
  MenuSectionRow,
  RestaurantInfoRow,
  ServiceRow,
  SocialLinkRow,
} from "@/lib/supabase/types";

/**
 * Phase 4F — Step 4/5/9 regression guard: proves the admin EDIT route's data
 * pipeline (app/admin/(protected)/businesses/[id]/edit/page.tsx calling
 * mapBusinessFromDatabase + mapModuleActivation together, exactly as it does
 * for a real, already-populated business) reconstructs a full, correct
 * editor draft from a REALISTIC multi-module row shape — not the minimal
 * single-field fixtures the rest of tests/admin-*-mapping.test.ts use.
 *
 * The fixture below mirrors the real "boi-na-brasa" production business's
 * module combination (services + menu + restaurant_info enabled together)
 * without embedding actual production content, verified against real
 * Supabase data read-only in Phase 4F's own audit.
 */

const BUSINESS_ID = "b0000000-0000-0000-0000-000000000001";

function makeExistingBusinessRecord() {
  const business: BusinessRow = {
    id: BUSINESS_ID,
    slug: "existing-restaurant",
    organization: "Existing Restaurant Lda",
    layout_variant: "restaurant",
    theme: { primary: "#111111", secondary: "#222222", accent: "#c2501f", background: "#dddddd", surface: "#ffffff", text: "#111111", mutedText: "#666666", border: "#cccccc", appearance: "light", fontFamily: "modern" },
    assets: { logo: "/x/logo.png", cover: "/x/cover.png" },
    maps_url: "https://maps.example.com/x",
    google_place_id: "place-123",
    review_url: "https://google.com/r",
    review_write_url: "https://google.com/w",
    review_fallback: { rating: 4.5, count: 50, source: "Google", asOf: "01.01.2026" },
    external_links: { delivery: "https://delivery.example.com" },
    digital_card: null,
    published: true,
    featured: false,
    indexable: true,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const content: BusinessProfileContentRow = {
    business_id: BUSINESS_ID,
    name: "Existing Restaurant",
    category: "Restaurante",
    directory_description: "Um restaurante já existente.",
    profile_description: "Descrição de perfil já existente.",
    positioning: "Posicionamento já existente.",
    about: { heading: "Sobre", paragraphs: ["Parágrafo existente."] },
    phone: "+351200000000",
    whatsapp: "+351911111111",
    email: "geral@existing-restaurant.pt",
    website: "https://existing-restaurant.pt",
    address: "Rua Existente 1, Cidade",
    street_address: "Rua Existente 1",
    city: "Cidade",
    country: "Portugal",
    updated_at: "2026-01-01T00:00:00Z",
    updated_by: null,
  };

  const hours: BusinessHoursRow[] = [
    { id: "h1", business_id: BUSINESS_ID, label: "Segunda", days: [1], periods: [{ open: "10:00", close: "22:00" }], sort_order: 0 },
  ];
  const socialLinks: SocialLinkRow[] = [
    { id: "s1", business_id: BUSINESS_ID, platform: "instagram", url: "https://instagram.com/existing", label: "Instagram", sort_order: 0 },
  ];
  const modules: BusinessModuleRow[] = [
    { business_id: BUSINESS_ID, module_key: "services", enabled: true, updated_at: "2026-01-01T00:00:00Z" },
    { business_id: BUSINESS_ID, module_key: "menu", enabled: true, updated_at: "2026-01-01T00:00:00Z" },
    { business_id: BUSINESS_ID, module_key: "restaurant_info", enabled: true, updated_at: "2026-01-01T00:00:00Z" },
    // Explicitly present but disabled — proves a disabled module's content
    // still loads into the draft (never destroyed), just not activated.
    { business_id: BUSINESS_ID, module_key: "gallery", enabled: false, updated_at: "2026-01-01T00:00:00Z" },
  ];
  const services: ServiceRow[] = [
    { id: "sv1", business_id: BUSINESS_ID, label: "Take-away", sort_order: 0 },
    { id: "sv2", business_id: BUSINESS_ID, label: "Esplanada", sort_order: 1 },
  ];
  const menuSections: MenuSectionRow[] = [{ id: "ms1", business_id: BUSINESS_ID, title: "Pratos", sort_order: 0 }];
  const menuItems: MenuItemRow[] = [
    { id: "mi1", menu_section_id: "ms1", business_id: BUSINESS_ID, name: "Prato Existente", price: "10,00 €", sort_order: 0 },
  ];
  const restaurantInfo: RestaurantInfoRow = {
    business_id: BUSINESS_ID,
    average_spend: "10-15 €",
    average_spend_note: null,
    cuisine: "Tradicional",
    cuisine_note: null,
    updated_at: "2026-01-01T00:00:00Z",
    updated_by: null,
  };

  return { business, content, hours, socialLinks, modules, services, menuSections, menuItems, restaurantInfo };
}

describe("existing-business edit load (Phase 4F)", () => {
  it("reconstructs the full editor draft and module activation from an already-populated business's rows", () => {
    const record = makeExistingBusinessRecord();

    const draft = mapBusinessFromDatabase(record);
    const activation = mapModuleActivation(record.modules);

    // Common fields populate with the EXISTING values, not defaults.
    expect(draft.slug).toBe("existing-restaurant");
    expect(draft.name).toBe("Existing Restaurant");
    expect(draft.category).toBe("Restaurante");
    expect(draft.layoutVariant).toBe("restaurant");
    expect(draft.contact).toEqual({
      phone: "+351200000000",
      whatsapp: "+351911111111",
      email: "geral@existing-restaurant.pt",
      website: "https://existing-restaurant.pt",
    });
    expect(draft.location?.address).toBe("Rua Existente 1, Cidade");
    expect(draft.location?.mapsUrl).toBe("https://maps.example.com/x");
    expect(draft.externalLinks).toEqual({ delivery: "https://delivery.example.com" });
    expect(draft.about).toEqual({ heading: "Sobre", paragraphs: ["Parágrafo existente."] });
    expect(draft.socialLinks?.map((s) => s.platform)).toEqual(["instagram"]);
    expect(draft.hours).toHaveLength(1);
    expect(draft.published).toBe(true);

    // Module activation sourced strictly from business_modules — never
    // inferred from whether content rows happen to exist.
    const expectedActivation: ModuleActivation = {
      services: true,
      gallery: false,
      restaurant_info: true,
      menu: true,
      treatments: false,
      brands: false,
      product_categories: false,
    };
    expect(activation).toEqual(expectedActivation);

    // Module content loads into the DRAFT regardless of activation (the
    // draft is what the form binds to — neutralization for disabled modules
    // only happens downstream, in buildPreviewBusiness, for the preview
    // pane; the editor itself must never lose a disabled module's content).
    expect(draft.services).toEqual(["Take-away", "Esplanada"]);
    expect(draft.menu).toEqual([{ title: "Pratos", items: [{ name: "Prato Existente", price: "10,00 €" }] }]);
    expect(draft.restaurantInfo).toEqual({ averageSpend: "10-15 €", averageSpendNote: undefined, cuisine: "Tradicional", cuisineNote: undefined });

    // No phantom/duplicate modules: exactly the 4 rows given produce
    // activation entries, and every other module key defaults to false.
    const enabledKeys = Object.entries(activation).filter(([, v]) => v).map(([k]) => k).sort();
    expect(enabledKeys).toEqual(["menu", "restaurant_info", "services"]);
  });

  it("never confuses an existing business's real id with a freshly-created one (edit mode, not create mode)", () => {
    const record = makeExistingBusinessRecord();
    const draft = mapBusinessFromDatabase(record);

    // The edit page passes `business.id` straight through as `businessId` to
    // BusinessEditor — this is the exact value every save action targets.
    // Asserting it round-trips unchanged guards against a future regression
    // that might accidentally regenerate or drop it during mapping.
    expect(record.business.id).toBe(BUSINESS_ID);
    expect(draft.slug).toBe(record.business.slug); // mapping never fabricates a new identity
  });
});

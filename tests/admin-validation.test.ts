import { describe, expect, it } from "vitest";
import {
  GALLERY_MAX_ITEMS,
  evaluatePublishChecklist,
  validateBusinessConfig,
  validateBusinessCore,
  validateCreateBusinessForm,
  validateModuleContent,
  validateSlug,
} from "@/lib/admin/validation";
import type { BusinessConfigPayload, BusinessCoreSavePayload, ModuleContentSavePayload } from "@/lib/admin/business-mapping";
import { getBusinessBySlug } from "@/lib/businesses";

function makePayload(overrides: Partial<BusinessCoreSavePayload["content"]> = {}): BusinessCoreSavePayload {
  return {
    content: {
      name: "Negócio Teste",
      category: "Categoria",
      directoryDescription: "Descrição",
      profileDescription: "",
      positioning: "",
      aboutHeading: "",
      aboutParagraphs: [],
      phone: "",
      whatsapp: "",
      email: "",
      website: "",
      address: "",
      streetAddress: "",
      city: "",
      country: "",
      ...overrides,
    },
    hours: [],
    socialLinks: [],
  };
}

describe("validateBusinessCore", () => {
  it("accepts a minimal valid payload", () => {
    expect(validateBusinessCore(makePayload())).toBeNull();
  });

  it("requires name, category and directory description", () => {
    const errors = validateBusinessCore(makePayload({ name: "", category: "", directoryDescription: "" }));
    expect(errors?.name).toBeTruthy();
    expect(errors?.category).toBeTruthy();
    expect(errors?.directoryDescription).toBeTruthy();
  });

  it("rejects an invalid email", () => {
    const errors = validateBusinessCore(makePayload({ email: "not-an-email" }));
    expect(errors?.email).toBeTruthy();
  });

  it("rejects a non-http(s) website", () => {
    const errors = validateBusinessCore(makePayload({ website: "javascript:alert(1)" }));
    expect(errors?.website).toBeTruthy();
  });

  it("accepts a valid https website", () => {
    const errors = validateBusinessCore(makePayload({ website: "https://example.com" }));
    expect(errors).toBeNull();
  });

  it("flags an hours period with an invalid time", () => {
    const payload = makePayload();
    payload.hours = [{ label: "Segunda", days: [1], periods: [{ open: "9:00", close: "18:00" }] }];
    const errors = validateBusinessCore(payload);
    expect(errors?.hours?.[0]).toBeTruthy();
  });

  it("flags a social link with an unsafe or missing URL", () => {
    const payload = makePayload();
    payload.socialLinks = [{ platform: "instagram", url: "javascript:alert(1)", label: "Instagram" }];
    const errors = validateBusinessCore(payload);
    expect(errors?.socialLinks?.[0]).toBeTruthy();
  });
});

function makeModulePayload(overrides: Partial<ModuleContentSavePayload> = {}): ModuleContentSavePayload {
  return {
    services: [],
    gallery: [],
    restaurantInfo: { averageSpend: "", averageSpendNote: "", cuisine: "", cuisineNote: "" },
    menu: [],
    treatmentGroups: [],
    representedBrands: [],
    productCategories: [],
    ...overrides,
  };
}

describe("validateModuleContent", () => {
  it("accepts an empty payload", () => {
    expect(validateModuleContent(makeModulePayload())).toBeNull();
  });

  it(`rejects more than ${GALLERY_MAX_ITEMS} gallery items`, () => {
    const gallery = Array.from({ length: GALLERY_MAX_ITEMS + 1 }, (_, i) => ({ src: "", alt: `Photo ${i}` }));
    const errors = validateModuleContent(makeModulePayload({ gallery }));
    expect(errors?.gallery).toBeTruthy();
  });

  it(`accepts exactly ${GALLERY_MAX_ITEMS} gallery items`, () => {
    const gallery = Array.from({ length: GALLERY_MAX_ITEMS }, (_, i) => ({ src: "", alt: `Photo ${i}` }));
    expect(validateModuleContent(makeModulePayload({ gallery }))).toBeNull();
  });

  it("requires alt text on every gallery item", () => {
    const errors = validateModuleContent(makeModulePayload({ gallery: [{ src: "", alt: "" }] }));
    expect(errors?.galleryItems?.[0]).toBeTruthy();
  });

  it("requires a menu section title and item names", () => {
    const errors = validateModuleContent(
      makeModulePayload({ menu: [{ title: "", items: [{ name: "", price: "" }] }] }),
    );
    expect(errors?.menuSections?.[0]).toBeTruthy();
    expect(errors?.menuItems?.["0.0"]).toBeTruthy();
  });

  it("requires a treatment group title and rejects empty items", () => {
    const errors = validateModuleContent(
      makeModulePayload({ treatmentGroups: [{ id: "g", title: "", description: "", items: [""] }] }),
    );
    expect(errors?.treatmentGroups?.[0]).toBeTruthy();
    expect(errors?.treatmentItems?.["0.0"]).toBeTruthy();
  });
});

describe("validateSlug", () => {
  it("accepts a valid slug", () => expect(validateSlug("meu-negocio-2")).toBeNull());
  it("rejects uppercase", () => expect(validateSlug("Meu-Negocio")).toBeTruthy());
  it("rejects spaces and invalid characters", () => expect(validateSlug("meu negocio!")).toBeTruthy());
  it("rejects leading/trailing hyphens", () => {
    expect(validateSlug("-meu-negocio")).toBeTruthy();
    expect(validateSlug("meu-negocio-")).toBeTruthy();
  });
  it("rejects a reserved route name", () => {
    expect(validateSlug("admin")).toBeTruthy();
    expect(validateSlug("api")).toBeTruthy();
    expect(validateSlug("auth")).toBeTruthy();
  });
  it("rejects an empty slug", () => expect(validateSlug("")).toBeTruthy());
});

function makeConfigPayload(overrides: Partial<BusinessConfigPayload> = {}): BusinessConfigPayload {
  const base = getBusinessBySlug("autoformigal")!;
  return {
    slug: "meu-negocio",
    organization: base.organization,
    layoutVariant: "editorial",
    theme: base.theme,
    assets: base.assets,
    mapsUrl: "",
    googlePlaceId: "",
    reviewUrl: "",
    reviewWriteUrl: "",
    reviewFallback: null,
    externalLinks: { tripAdvisor: "", delivery: "", collection: "" },
    digitalCard: null,
    featured: false,
    indexable: true,
    ...overrides,
  };
}

describe("validateBusinessConfig", () => {
  it("accepts a minimal valid config", () => expect(validateBusinessConfig(makeConfigPayload())).toBeNull());

  it("rejects an unavailable layout variant", () => {
    const errors = validateBusinessConfig(makeConfigPayload({ layoutVariant: "restaurant" }));
    expect(errors?.layoutVariant).toBeTruthy();
  });

  it("rejects an invalid slug", () => {
    const errors = validateBusinessConfig(makeConfigPayload({ slug: "Not Valid!" }));
    expect(errors?.slug).toBeTruthy();
  });

  it("rejects an invalid hex color in the theme", () => {
    const errors = validateBusinessConfig(makeConfigPayload({ theme: { ...getBusinessBySlug("autoformigal")!.theme, primary: "not-a-color" } }));
    expect(errors?.theme?.primary).toBeTruthy();
  });

  it("rejects an unsafe maps_url", () => {
    const errors = validateBusinessConfig(makeConfigPayload({ mapsUrl: "javascript:alert(1)" }));
    expect(errors?.mapsUrl).toBeTruthy();
  });

  it("rejects an unsafe external link", () => {
    const errors = validateBusinessConfig(makeConfigPayload({ externalLinks: { tripAdvisor: "javascript:x", delivery: "", collection: "" } }));
    expect(errors?.externalLinks?.tripAdvisor).toBeTruthy();
  });
});

describe("validateCreateBusinessForm", () => {
  it("accepts a minimal valid form", () => {
    expect(validateCreateBusinessForm({ name: "Negócio", category: "Categoria", slug: "negocio", layoutVariant: "editorial" })).toBeNull();
  });
  it("requires name and category", () => {
    const errors = validateCreateBusinessForm({ name: "", category: "", slug: "negocio", layoutVariant: "editorial" });
    expect(errors?.name).toBeTruthy();
    expect(errors?.category).toBeTruthy();
  });
  it("rejects an unavailable layout", () => {
    const errors = validateCreateBusinessForm({ name: "Negócio", category: "Categoria", slug: "negocio", layoutVariant: "restaurant" });
    expect(errors?.layoutVariant).toBeTruthy();
  });
});

describe("evaluatePublishChecklist", () => {
  it("passes every item for a well-formed, available-layout business", () => {
    const business = { ...getBusinessBySlug("autoformigal")!, layoutVariant: "editorial" as const };
    const checklist = evaluatePublishChecklist(business);
    expect(checklist.every((item) => item.passed)).toBe(true);
  });

  it("fails the layout item for an unavailable (bespoke) layout", () => {
    const business = getBusinessBySlug("boi-na-brasa")!; // layoutVariant: "restaurant"
    const checklist = evaluatePublishChecklist(business);
    const layoutItem = checklist.find((item) => item.key === "layout");
    expect(layoutItem?.passed).toBe(false);
  });

  it("fails the name item when name is blank", () => {
    const business = { ...getBusinessBySlug("autoformigal")!, layoutVariant: "editorial" as const, name: "" };
    const checklist = evaluatePublishChecklist(business);
    expect(checklist.find((item) => item.key === "name")?.passed).toBe(false);
  });
});

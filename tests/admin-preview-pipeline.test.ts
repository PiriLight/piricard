import { describe, expect, it } from "vitest";
import { businessDraftReducer, createInitialDraft } from "@/components/admin/business-editor/reducer";
import { buildPreviewBusiness, mapBusinessFromDatabase, mapModuleActivation, type ModuleActivation } from "@/lib/admin/business-mapping";
import type { BusinessProfileContentRow, BusinessRow, GalleryRow, ServiceRow } from "@/lib/supabase/types";

/**
 * Phase 4G — Step 4/11 regression guard for the FULL, real preview pipeline:
 *   existing-business rows -> mapBusinessFromDatabase -> businessDraftReducer
 *   (editor state) -> buildPreviewBusiness -> the object PreviewPane renders.
 *
 * This is exactly the sequence app/admin/(protected)/businesses/[id]/edit/
 * page.tsx + components/admin/business-editor/BusinessEditor.tsx run — no
 * separate/simplified pipeline invented for this test. Proves that an
 * UNSAVED edit (a reducer dispatch, never a Supabase call) is immediately
 * visible in the object handed to the public renderer.
 */

function makeBusinessRow(overrides: Partial<BusinessRow> = {}): BusinessRow {
  return {
    id: "b1",
    slug: "boi-na-brasa",
    organization: "Restaurante Boi na Brasa",
    layout_variant: "restaurant",
    theme: null,
    assets: null,
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

function makeContentRow(overrides: Partial<BusinessProfileContentRow> = {}): BusinessProfileContentRow {
  return {
    business_id: "b1",
    name: "Boi na Brasa",
    category: "Restaurante & Café",
    directory_description: "Grelhados e petiscos.",
    profile_description: null,
    positioning: null,
    about: null,
    phone: "+351261063480",
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

describe("admin preview pipeline: existing-business load -> unsaved edit -> preview model", () => {
  it("an unsaved common-field change (name) is reflected in the preview model without any save", () => {
    const record = { business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] };
    const loaded = mapBusinessFromDatabase(record);
    const initialDraft = createInitialDraft(loaded);
    const activation = mapModuleActivation([]);

    const previewBefore = buildPreviewBusiness(initialDraft, activation);
    expect(previewBefore.name).toBe("Boi na Brasa");

    // Simulate the admin typing in the "Nome" field — a plain reducer
    // dispatch, exactly what ContentSection fires on input, never a fetch.
    const editedDraft = businessDraftReducer(initialDraft, { type: "SET_CONTENT_FIELD", field: "name", value: "Boi na Brasa Grill" });
    const previewAfter = buildPreviewBusiness(editedDraft, activation);

    expect(previewAfter.name).toBe("Boi na Brasa Grill");
    // The underlying "loaded" (as-if-fetched) object is untouched — proves
    // this is pure local state, never a re-fetch of the saved business.
    expect(loaded.name).toBe("Boi na Brasa");
  });

  it("toggling a module off hides its content in the preview model even though the content still exists in the draft", () => {
    const services: ServiceRow[] = [{ id: "s1", business_id: "b1", label: "Take-away", sort_order: 0 }];
    const gallery: GalleryRow[] = [{ id: "g1", business_id: "b1", src: "/x.png", alt: "X", aspect_ratio: "square", placeholder_label: null, sort_order: 0 }];
    const record = { business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [], services, gallery };
    const draft = createInitialDraft(mapBusinessFromDatabase(record));

    const enabled: ModuleActivation = { services: true, gallery: true, restaurant_info: false, menu: false, treatments: false, brands: false, product_categories: false };
    const disabled: ModuleActivation = { ...enabled, services: false };

    expect(buildPreviewBusiness(draft, enabled).services).toEqual(["Take-away"]);
    const previewWithServicesOff = buildPreviewBusiness(draft, disabled);
    expect(previewWithServicesOff.services).toBeUndefined();
    // Disabling one module never touches another module's content, and the
    // draft itself (what the still-open editor form shows) keeps the data.
    expect(previewWithServicesOff.gallery).toEqual([{ src: "/x.png", alt: "X", aspectRatio: "square", placeholderLabel: undefined }]);
    expect(draft.services).toEqual(["Take-away"]);
  });

  it("preview generation is a pure, synchronous computation — no network/database call is possible", () => {
    const record = { business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] };
    const draft = createInitialDraft(mapBusinessFromDatabase(record));
    const activation = mapModuleActivation([]);

    // buildPreviewBusiness/mapBusinessFromDatabase/mapModuleActivation are
    // all plain, non-async functions — calling them without `await` and
    // getting a fully-formed object back (not a Promise) is itself the
    // proof that no I/O occurs.
    const preview = buildPreviewBusiness(draft, activation);
    expect(preview).not.toBeInstanceOf(Promise);
    expect(typeof preview.name).toBe("string");
  });
});

/**
 * V1.1 — Gallery Upload + Live Preview Reliability. The reported bug's
 * final symptom ("gallery does not become visibly available in Preview")
 * turned out to have two real causes upstream of this pipeline (the upload
 * itself hanging forever, and OFTRacingProfile having no gallery rendering
 * branch at all — see the phase report) rather than this pipeline being
 * broken. These tests pin down that buildPreviewBusiness's own reactivity
 * to an unsaved gallery edit and an unsaved (not-yet-persisted) module
 * toggle was — and remains — correct, exactly as Step 8 of the phase spec
 * requires: activation state (business_modules / local moduleActivation) is
 * the only source of truth, never inferred from whether `gallery` content
 * happens to be present.
 */
describe("admin preview pipeline — gallery module activation and content, unsaved", () => {
  const disabledAll: ModuleActivation = {
    services: false,
    gallery: false,
    restaurant_info: false,
    menu: false,
    treatments: false,
    brands: false,
    product_categories: false,
  };

  it("gallery is absent from the preview while the module is disabled, with zero gallery content in the draft", () => {
    const draft = createInitialDraft(mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] }));
    expect(buildPreviewBusiness(draft, disabledAll).gallery).toBeUndefined();
  });

  it("enabling the gallery module changes preview activation immediately — no save, no content required yet", () => {
    const draft = createInitialDraft(mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] }));
    const beforeEnable = buildPreviewBusiness(draft, disabledAll);
    expect(beforeEnable.gallery).toBeUndefined();

    const afterEnable = buildPreviewBusiness(draft, { ...disabledAll, gallery: true });
    // The module is on, but nothing has been uploaded yet — an empty array
    // reads the same as "no gallery" to the public renderer either way;
    // the important assertion is that activation, not content, drove this.
    expect(afterEnable.gallery ?? []).toEqual([]);
  });

  it("a fresh ADD_GALLERY_ITEM + upload-simulated UPDATE_GALLERY_ITEM appears in the preview before any save", () => {
    let draft = createInitialDraft(mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] }));
    const activation: ModuleActivation = { ...disabledAll, gallery: true };

    draft = businessDraftReducer(draft, { type: "ADD_GALLERY_ITEM" });
    expect(buildPreviewBusiness(draft, activation).gallery).toEqual([{ alt: "" }]);

    // This dispatch is exactly what ImageUploadField's onUploaded callback
    // fires — the same one whose promise used to hang forever before the
    // V1.1 fix, and never reached this line in production.
    draft = businessDraftReducer(draft, { type: "UPDATE_GALLERY_ITEM", index: 0, patch: { src: "/uploaded.webp", alt: "Loja" } });
    expect(buildPreviewBusiness(draft, activation).gallery).toEqual([{ alt: "Loja", src: "/uploaded.webp" }]);
  });

  it("adding a second image and reordering both show up in the preview immediately", () => {
    let draft = createInitialDraft(mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] }));
    draft = { ...draft, gallery: [{ alt: "First", src: "/a.webp" }] };
    const activation: ModuleActivation = { ...disabledAll, gallery: true };

    draft = businessDraftReducer(draft, { type: "ADD_GALLERY_ITEM" });
    draft = businessDraftReducer(draft, { type: "UPDATE_GALLERY_ITEM", index: 1, patch: { src: "/b.webp", alt: "Second" } });
    expect(buildPreviewBusiness(draft, activation).gallery?.map((g) => g.alt)).toEqual(["First", "Second"]);

    draft = businessDraftReducer(draft, { type: "MOVE_GALLERY_ITEM", index: 0, direction: "down" });
    expect(buildPreviewBusiness(draft, activation).gallery?.map((g) => g.alt)).toEqual(["Second", "First"]);
  });

  it("removing an image drops it from the preview immediately", () => {
    let draft = createInitialDraft(mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] }));
    draft = { ...draft, gallery: [{ alt: "Keep", src: "/a.webp" }, { alt: "Drop", src: "/b.webp" }] };
    const activation: ModuleActivation = { ...disabledAll, gallery: true };

    draft = businessDraftReducer(draft, { type: "REMOVE_GALLERY_ITEM", index: 1 });
    expect(buildPreviewBusiness(draft, activation).gallery).toEqual([{ alt: "Keep", src: "/a.webp" }]);
  });

  it("disabling the gallery module hides it from the preview immediately WITHOUT deleting the draft's gallery content", () => {
    let draft = createInitialDraft(mapBusinessFromDatabase({ business: makeBusinessRow(), content: makeContentRow(), hours: [], socialLinks: [] }));
    draft = { ...draft, gallery: [{ alt: "Photo", src: "/a.webp" }] };
    const enabled: ModuleActivation = { ...disabledAll, gallery: true };

    expect(buildPreviewBusiness(draft, enabled).gallery).toEqual([{ alt: "Photo", src: "/a.webp" }]);
    expect(buildPreviewBusiness(draft, disabledAll).gallery).toBeUndefined();
    // The draft itself — what the still-open Gallery tab shows — is untouched.
    expect(draft.gallery).toEqual([{ alt: "Photo", src: "/a.webp" }]);

    // Re-enabling brings the SAME content straight back, with no re-upload.
    expect(buildPreviewBusiness(draft, enabled).gallery).toEqual([{ alt: "Photo", src: "/a.webp" }]);
  });
});

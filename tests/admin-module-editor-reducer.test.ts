import { describe, expect, it } from "vitest";
import { businessDraftReducer, createInitialDraft, GALLERY_MAX_ITEMS } from "@/components/admin/business-editor/reducer";
import { getBusinessBySlug } from "@/lib/businesses";

const sampleBusiness = getBusinessBySlug("beauty-connection-360")!; // has treatmentGroups + gallery seeded

describe("businessDraftReducer — simple ordered lists (services/brands/categories)", () => {
  const draft = createInitialDraft(sampleBusiness);

  it("adds, updates, reorders and removes a services item", () => {
    const withItem = businessDraftReducer(draft, { type: "ADD_LIST_ITEM", list: "services" });
    const index = (withItem.services?.length ?? 1) - 1;
    const updated = businessDraftReducer(withItem, { type: "UPDATE_LIST_ITEM", list: "services", index, value: "Novo serviço" });
    expect(updated.services?.[index]).toBe("Novo serviço");

    const removed = businessDraftReducer(updated, { type: "REMOVE_LIST_ITEM", list: "services", index });
    expect(removed.services).toHaveLength(draft.services?.length ?? 0);
  });

  it("moves a list item without losing entries", () => {
    const twoItems = businessDraftReducer(businessDraftReducer(draft, { type: "ADD_LIST_ITEM", list: "productCategories" }), {
      type: "ADD_LIST_ITEM",
      list: "productCategories",
    });
    const moved = businessDraftReducer(twoItems, { type: "MOVE_LIST_ITEM", list: "productCategories", index: 0, direction: "down" });
    expect(moved.productCategories).toHaveLength(twoItems.productCategories?.length ?? 0);
  });
});

describe("businessDraftReducer — gallery (max items enforced)", () => {
  it("refuses to add beyond GALLERY_MAX_ITEMS", () => {
    let draft = createInitialDraft(sampleBusiness);
    draft = { ...draft, gallery: Array.from({ length: GALLERY_MAX_ITEMS }, (_, i) => ({ alt: `Photo ${i}` })) };
    const next = businessDraftReducer(draft, { type: "ADD_GALLERY_ITEM" });
    expect(next.gallery).toHaveLength(GALLERY_MAX_ITEMS); // unchanged — already at the limit
  });

  it("updates a gallery item's fields immutably", () => {
    const draft = { ...createInitialDraft(sampleBusiness), gallery: [{ alt: "Original" }] };
    const next = businessDraftReducer(draft, { type: "UPDATE_GALLERY_ITEM", index: 0, patch: { alt: "Updated", src: "/x.webp" } });
    expect(next.gallery?.[0]).toEqual({ alt: "Updated", src: "/x.webp" });
    expect(draft.gallery?.[0]).toEqual({ alt: "Original" });
  });

  // V1.1 regression coverage — the reported "Adicionar imagem" bug and the
  // upload-completion path (Step 15 of the phase).
  it("ADD_GALLERY_ITEM never creates a fake/placeholder src — the new item has none at all", () => {
    const draft = { ...createInitialDraft(sampleBusiness), gallery: [] };
    const next = businessDraftReducer(draft, { type: "ADD_GALLERY_ITEM" });
    expect(next.gallery).toHaveLength(1);
    expect(next.gallery?.[0]).toEqual({ alt: "" });
    expect(next.gallery?.[0].src).toBeUndefined();
    expect(next.gallery?.[0].src).not.toBe("/clients/exemplo/gallery/foto.webp");
  });

  it("a successful upload's UPDATE_GALLERY_ITEM call gives the freshly-added item a real src, without adding a second row", () => {
    const withEmptyItem = businessDraftReducer({ ...createInitialDraft(sampleBusiness), gallery: [] }, { type: "ADD_GALLERY_ITEM" });
    const afterUpload = businessDraftReducer(withEmptyItem, {
      type: "UPDATE_GALLERY_ITEM",
      index: 0,
      patch: { src: "https://scneuxxgzlqcsxdzthxb.supabase.co/storage/v1/object/public/piricard-assets/businesses/b1/gallery/x.webp" },
    });
    expect(afterUpload.gallery).toHaveLength(1);
    expect(afterUpload.gallery?.[0].src).toContain("piricard-assets");
  });

  it("repeated UPDATE_GALLERY_ITEM calls on the same index replace, never duplicate, the row", () => {
    const draft = { ...createInitialDraft(sampleBusiness), gallery: [{ alt: "" }] };
    const first = businessDraftReducer(draft, { type: "UPDATE_GALLERY_ITEM", index: 0, patch: { src: "/a.webp" } });
    const second = businessDraftReducer(first, { type: "UPDATE_GALLERY_ITEM", index: 0, patch: { src: "/b.webp" } });
    expect(second.gallery).toHaveLength(1);
    expect(second.gallery?.[0].src).toBe("/b.webp");
  });

  it("MOVE_GALLERY_ITEM reorders without losing or duplicating entries", () => {
    const draft = { ...createInitialDraft(sampleBusiness), gallery: [{ alt: "First", src: "/a.webp" }, { alt: "Second", src: "/b.webp" }] };
    const moved = businessDraftReducer(draft, { type: "MOVE_GALLERY_ITEM", index: 0, direction: "down" });
    expect(moved.gallery).toHaveLength(2);
    expect(moved.gallery?.[0].alt).toBe("Second");
    expect(moved.gallery?.[1].alt).toBe("First");
  });

  it("REMOVE_GALLERY_ITEM removes exactly the targeted item", () => {
    const draft = { ...createInitialDraft(sampleBusiness), gallery: [{ alt: "Keep", src: "/a.webp" }, { alt: "Drop", src: "/b.webp" }] };
    const next = businessDraftReducer(draft, { type: "REMOVE_GALLERY_ITEM", index: 1 });
    expect(next.gallery).toHaveLength(1);
    expect(next.gallery?.[0].alt).toBe("Keep");
  });

  it("legacy static and external src values pass through UPDATE_GALLERY_ITEM unchanged (backwards compatibility)", () => {
    const draft = { ...createInitialDraft(sampleBusiness), gallery: [{ alt: "" }] };
    const withLegacy = businessDraftReducer(draft, {
      type: "UPDATE_GALLERY_ITEM",
      index: 0,
      patch: { src: "/clients/autoformigal/gallery/interior-recepcao.png" },
    });
    expect(withLegacy.gallery?.[0].src).toBe("/clients/autoformigal/gallery/interior-recepcao.png");

    const withExternal = businessDraftReducer(draft, { type: "UPDATE_GALLERY_ITEM", index: 0, patch: { src: "https://example.com/photo.jpg" } });
    expect(withExternal.gallery?.[0].src).toBe("https://example.com/photo.jpg");
  });
});

describe("businessDraftReducer — restaurant info", () => {
  it("sets a single field without touching the others", () => {
    const draft = { ...createInitialDraft(sampleBusiness), restaurantInfo: { cuisine: "Grelhados" } };
    const next = businessDraftReducer(draft, { type: "SET_RESTAURANT_INFO_FIELD", field: "averageSpend", value: "10-15€" });
    expect(next.restaurantInfo).toEqual({ cuisine: "Grelhados", averageSpend: "10-15€" });
  });
});

describe("businessDraftReducer — nested menu (sections -> items)", () => {
  it("adds a section, adds an item to it, and reorders both levels", () => {
    let draft = createInitialDraft(sampleBusiness);
    draft = businessDraftReducer(draft, { type: "ADD_MENU_SECTION" });
    draft = businessDraftReducer(draft, { type: "UPDATE_MENU_SECTION_TITLE", index: 0, value: "Principal" });
    draft = businessDraftReducer(draft, { type: "ADD_MENU_ITEM", sectionIndex: 0 });
    draft = businessDraftReducer(draft, { type: "ADD_MENU_ITEM", sectionIndex: 0 });
    draft = businessDraftReducer(draft, {
      type: "UPDATE_MENU_ITEM",
      sectionIndex: 0,
      itemIndex: 0,
      patch: { name: "Prato A", price: "10€" },
    });

    expect(draft.menu?.[0].title).toBe("Principal");
    expect(draft.menu?.[0].items).toHaveLength(2);
    expect(draft.menu?.[0].items[0]).toEqual({ name: "Prato A", price: "10€" });

    const reordered = businessDraftReducer(draft, { type: "MOVE_MENU_ITEM", sectionIndex: 0, itemIndex: 0, direction: "down" });
    expect(reordered.menu?.[0].items[1].name).toBe("Prato A");

    const removedItem = businessDraftReducer(draft, { type: "REMOVE_MENU_ITEM", sectionIndex: 0, itemIndex: 1 });
    expect(removedItem.menu?.[0].items).toHaveLength(1);

    const removedSection = businessDraftReducer(draft, { type: "REMOVE_MENU_SECTION", index: 0 });
    expect(removedSection.menu).toHaveLength((draft.menu?.length ?? 1) - 1);
  });
});

describe("businessDraftReducer — nested treatments (groups -> items)", () => {
  it("adds a group, adds an item, updates group fields, and reorders", () => {
    let draft = createInitialDraft(sampleBusiness);
    const initialGroupCount = draft.treatmentGroups?.length ?? 0;
    draft = businessDraftReducer(draft, { type: "ADD_TREATMENT_GROUP" });
    const newIndex = initialGroupCount;
    draft = businessDraftReducer(draft, {
      type: "UPDATE_TREATMENT_GROUP",
      index: newIndex,
      patch: { id: "novo", title: "Novo grupo", description: "Descrição" },
    });
    draft = businessDraftReducer(draft, { type: "ADD_TREATMENT_ITEM", groupIndex: newIndex });
    draft = businessDraftReducer(draft, { type: "UPDATE_TREATMENT_ITEM", groupIndex: newIndex, itemIndex: 0, value: "Item A" });

    expect(draft.treatmentGroups?.[newIndex]).toEqual({ id: "novo", title: "Novo grupo", description: "Descrição", items: ["Item A"] });

    const removed = businessDraftReducer(draft, { type: "REMOVE_TREATMENT_GROUP", index: newIndex });
    expect(removed.treatmentGroups).toHaveLength(initialGroupCount);
  });
});

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

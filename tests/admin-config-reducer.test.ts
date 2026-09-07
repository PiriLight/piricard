import { describe, expect, it } from "vitest";
import { businessDraftReducer, createInitialDraft } from "@/components/admin/business-editor/reducer";
import { buildPreviewBusiness, toBusinessConfigPayload } from "@/lib/admin/business-mapping";
import { getBusinessBySlug } from "@/lib/businesses";

const sampleBusiness = getBusinessBySlug("autoformigal")!;

describe("businessDraftReducer — layout/theme/assets/technical (Phase 4B.5/4B.6)", () => {
  const draft = createInitialDraft(sampleBusiness);

  it("SET_LAYOUT_VARIANT updates layoutVariant immutably", () => {
    const next = businessDraftReducer(draft, { type: "SET_LAYOUT_VARIANT", value: "editorial" });
    expect(next.layoutVariant).toBe("editorial");
    expect(draft.layoutVariant).toBe(sampleBusiness.layoutVariant);
  });

  it("SET_THEME_FIELD updates a single color without touching the rest of the theme", () => {
    const next = businessDraftReducer(draft, { type: "SET_THEME_FIELD", field: "primary", value: "#ff0000" });
    expect(next.theme.primary).toBe("#ff0000");
    expect(next.theme.secondary).toBe(draft.theme.secondary);
  });

  it("SET_ASSET_FIELD updates a single asset field", () => {
    const next = businessDraftReducer(draft, { type: "SET_ASSET_FIELD", field: "logo", value: "/new/logo.png" });
    expect(next.assets.logo).toBe("/new/logo.png");
    expect(next.assets.cover).toBe(draft.assets.cover);
  });

  it("SET_TECHNICAL_FIELD updates slug/organization/googlePlaceId independently", () => {
    const withSlug = businessDraftReducer(draft, { type: "SET_TECHNICAL_FIELD", field: "slug", value: "novo-slug" });
    expect(withSlug.slug).toBe("novo-slug");
    expect(withSlug.organization).toBe(draft.organization);
  });

  it("SET_FEATURED / SET_INDEXABLE toggle independently", () => {
    const next = businessDraftReducer(draft, { type: "SET_FEATURED", value: true });
    expect(next.featured).toBe(true);
    expect(next.indexable).toBe(draft.indexable);
  });

  it("SET_REVIEW_SNAPSHOT / SET_EXTERNAL_LINKS / SET_DIGITAL_CARD replace their whole object", () => {
    const withReview = businessDraftReducer(draft, {
      type: "SET_REVIEW_SNAPSHOT",
      value: { rating: 4.2, count: 12, source: "Google", asOf: "hoje" },
    });
    expect(withReview.reviewSnapshot).toEqual({ rating: 4.2, count: 12, source: "Google", asOf: "hoje" });

    const withLinks = businessDraftReducer(draft, {
      type: "SET_EXTERNAL_LINKS",
      value: { tripAdvisor: "https://x", delivery: "", collection: "" },
    });
    expect(withLinks.externalLinks?.tripAdvisor).toBe("https://x");

    const withCard = businessDraftReducer(draft, { type: "SET_DIGITAL_CARD", value: { path: "/x.pdf", format: "PDF" } });
    expect(withCard.digitalCard).toEqual({ path: "/x.pdf", format: "PDF" });
  });
});

describe("toBusinessConfigPayload dirty-tracking subset", () => {
  it("changes when a config field changes but not when only content changes", () => {
    const draft = createInitialDraft(sampleBusiness);
    const withThemeChange = businessDraftReducer(draft, { type: "SET_THEME_FIELD", field: "primary", value: "#000000" });
    expect(JSON.stringify(toBusinessConfigPayload(withThemeChange))).not.toBe(JSON.stringify(toBusinessConfigPayload(draft)));

    const withContentChange = businessDraftReducer(draft, { type: "SET_CONTENT_FIELD", field: "name", value: "Novo Nome" });
    expect(JSON.stringify(toBusinessConfigPayload(withContentChange))).toBe(JSON.stringify(toBusinessConfigPayload(draft)));
  });
});

describe("buildPreviewBusiness — layout switching before save", () => {
  it("reflects a layoutVariant change immediately in the preview-facing Business", () => {
    const draft = createInitialDraft(sampleBusiness);
    const switched = businessDraftReducer(draft, { type: "SET_LAYOUT_VARIANT", value: "editorial" });
    const preview = buildPreviewBusiness(switched, {
      services: false,
      gallery: false,
      restaurant_info: false,
      menu: false,
      treatments: false,
      brands: false,
      product_categories: false,
    });
    expect(preview.layoutVariant).toBe("editorial");
  });
});

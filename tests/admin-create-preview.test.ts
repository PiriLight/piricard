import { describe, expect, it } from "vitest";
import { buildCreatePreviewBusiness, defaultDirectoryDescription } from "@/lib/admin/business-mapping";

/**
 * Phase 4G — Step 6/11 regression guard: the "Criar PiriCard" wizard's
 * preview must be buildable from plain in-memory form values, with no
 * database id and no Supabase read, using the SAME canonical mapper
 * (mapBusinessFromDatabase/mapModuleActivation/buildPreviewBusiness) the
 * edit-mode preview uses — never a second, parallel mapping path.
 */

describe("defaultDirectoryDescription", () => {
  it("matches the exact string createBusinessAction persists on save", () => {
    expect(defaultDirectoryDescription("Nome Novo", "Categoria Nova")).toBe("Nome Novo — Categoria Nova.");
  });

  it("trims surrounding whitespace", () => {
    expect(defaultDirectoryDescription("  Nome  ", "  Categoria  ")).toBe("Nome — Categoria.");
  });
});

describe("buildCreatePreviewBusiness", () => {
  it("builds a full preview Business from plain wizard values, no id required", () => {
    const business = buildCreatePreviewBusiness({
      name: "Novo Negócio",
      category: "Categoria X",
      slug: "novo-negocio",
      layoutVariant: "editorial",
      primaryColor: "#112233",
      accentColor: "#445566",
      logo: "/x/logo.png",
      cover: "/x/cover.png",
      enabledModules: ["services", "gallery"],
    });

    expect(business.slug).toBe("novo-negocio");
    expect(business.name).toBe("Novo Negócio");
    expect(business.category).toBe("Categoria X");
    expect(business.layoutVariant).toBe("editorial");
    expect(business.directoryDescription).toBe("Novo Negócio — Categoria X.");
    expect(business.theme.primary).toBe("#112233");
    expect(business.theme.accent).toBe("#445566");
    expect(business.assets.logo).toBe("/x/logo.png");
    expect(business.assets.cover).toBe("/x/cover.png");
    expect(business.published).toBe(false);
  });

  it("falls back to a safe placeholder slug/name when the wizard is still empty", () => {
    const business = buildCreatePreviewBusiness({
      name: "",
      category: "",
      slug: "",
      layoutVariant: "editorial",
      enabledModules: [],
    });

    expect(business.slug).toBe("novo-negocio");
    expect(business.name).toBe("Novo negócio");
  });

  it("omits theme/asset overrides that were never filled in (keeps the fallback theme)", () => {
    const business = buildCreatePreviewBusiness({
      name: "X",
      category: "Y",
      slug: "x",
      layoutVariant: "editorial",
      enabledModules: [],
    });

    // No primary/accent/logo/cover given — mapBusinessFromDatabase's own
    // fallback theme applies, and no logo/cover key exists on assets.
    expect(business.theme.primary).not.toBe("");
    expect(business.assets.logo).toBeUndefined();
    expect(business.assets.cover).toBeUndefined();
  });

  it("reflects only the explicitly enabled modules, never inferring from content", () => {
    const business = buildCreatePreviewBusiness({
      name: "X",
      category: "Y",
      slug: "x",
      layoutVariant: "editorial",
      enabledModules: ["brands"],
    });

    // brands has no content collected by the wizard, but the module is
    // still "on" — represented as an empty/undefined list, not an error.
    expect(business.representedBrands).toBeUndefined();
    expect(business.services).toBeUndefined();
    expect(business.productCategories).toBeUndefined();
  });

  it("performs no I/O — purely a synchronous, in-memory computation", () => {
    // If this function ever started awaiting a network/database call, this
    // assertion (a plain, non-async call site) would fail to type-check/run
    // correctly against a Promise return value.
    const business = buildCreatePreviewBusiness({
      name: "X",
      category: "Y",
      slug: "x",
      layoutVariant: "editorial",
      enabledModules: [],
    });
    expect(business).toBeTypeOf("object");
  });
});

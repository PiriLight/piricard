import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Business } from "@/lib/businesses";

/**
 * Phase 4E.1 — regression guard for the public vCard download route
 * (app/api/contact/[slug]/route.ts) after its cutover from the static
 * lib/businesses.ts source to the canonical anonymous Supabase public data
 * layer (lib/public/business.ts). Mocks that data layer directly (its own
 * behavior — RLS-backed visibility, malformed-slug short-circuiting — is
 * already covered by tests/public-business.test.ts) so this file pins down
 * only the route's own logic: it must call the Supabase-backed lookup, not
 * the static one, and must keep producing the same vCard response shape.
 */

const getPublicBusinessBySlugMock = vi.fn();

vi.mock("@/lib/public/business", () => ({
  getPublicBusinessBySlug: (slug: string) => getPublicBusinessBySlugMock(slug),
}));

// Guard against a regression back to the static source: if the route ever
// imports lib/businesses' data functions again, this mock throws instead of
// silently succeeding, so the test fails loudly rather than passing by luck.
vi.mock("@/lib/businesses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/businesses")>();
  return {
    ...actual,
    getPublishedBusinessBySlug: () => {
      throw new Error("app/api/contact/[slug]/route.ts must not use the static lib/businesses.ts lookup");
    },
    getBusinessBySlug: () => {
      throw new Error("app/api/contact/[slug]/route.ts must not use the static lib/businesses.ts lookup");
    },
  };
});

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    slug: "autoformigal",
    name: "Auto Formigal",
    organization: "Auto Formigal",
    category: "Oficina automóvel",
    published: true,
    featured: true,
    indexable: true,
    directoryDescription: "Oficina multimarca.",
    contact: { phone: "+351261858239", email: "geral@autoformigal.pt" },
    location: { address: "Rua do Aranha 19, São Pedro da Cadeira", streetAddress: "Rua do Aranha 19", city: "São Pedro da Cadeira", country: "Portugal" },
    assets: { logo: "/clients/autoformigal/logo/autoformigal-approved.jpg" },
    theme: { primary: "#223196", secondary: "#1b2a80", accent: "#31b009", background: "#eef1f8", surface: "#ffffff", text: "#141f52", mutedText: "#525c80", border: "#dce3f2", appearance: "light", fontFamily: "modern" },
    layoutVariant: "workshop",
    ...overrides,
  };
}

describe("GET /api/contact/[slug]", () => {
  beforeEach(() => {
    getPublicBusinessBySlugMock.mockReset();
  });

  it("looks up the business through the canonical public Supabase data layer, not the static source", async () => {
    getPublicBusinessBySlugMock.mockResolvedValue(makeBusiness());
    const { GET } = await import("@/app/api/contact/[slug]/route");

    await GET(new Request("http://localhost/api/contact/autoformigal"), { params: Promise.resolve({ slug: "autoformigal" }) });

    expect(getPublicBusinessBySlugMock).toHaveBeenCalledWith("autoformigal");
  });

  it("returns a correctly-shaped vCard response for a published business", async () => {
    getPublicBusinessBySlugMock.mockResolvedValue(makeBusiness());
    const { GET } = await import("@/app/api/contact/[slug]/route");

    const response = await GET(new Request("http://localhost/api/contact/autoformigal"), { params: Promise.resolve({ slug: "autoformigal" }) });
    // `Response.text()` decodes via TextDecoder, which strips a leading BOM by
    // spec — read the raw bytes instead to confirm the wire format (BOM +
    // UTF-8 vCard) is unchanged from before the cutover.
    const bytes = new Uint8Array(await response.arrayBuffer());
    const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/vcard;charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="autoformigal.vcf"');
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(bytes[0]).toBe(0xef); // UTF-8 BOM's first byte, unchanged from before the cutover
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
    expect(body).toContain("BEGIN:VCARD");
    expect(body).toContain("FN:Auto Formigal");
    expect(body).toContain("TEL;TYPE=WORK,VOICE:+351261858239");
  });

  it("returns the existing 404 shape when the business is missing, unpublished, or archived (all indistinguishable via RLS)", async () => {
    getPublicBusinessBySlugMock.mockResolvedValue(undefined);
    const { GET } = await import("@/app/api/contact/[slug]/route");

    const response = await GET(new Request("http://localhost/api/contact/does-not-exist"), { params: Promise.resolve({ slug: "does-not-exist" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Perfil não encontrado." });
  });
});

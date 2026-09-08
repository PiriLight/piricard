import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 4H.5 — Issue 2 regression guard: the obsolete "Cartão digital"
 * flip-card (the DigitalBusinessCard component + its section heading) must
 * never reappear in the default/"editorial" BusinessProfile — the layout
 * every new "Criar PiriCard" business gets, so this is exactly what the
 * Create wizard's live preview renders. Source-content assertions rather
 * than a render test: this repo's Vitest config runs a plain "node"
 * environment (no jsdom/React Testing Library), so asserting on the actual
 * component source is the practical, in-infra way to pin this down — see
 * AGENTS.md / the project's existing test conventions.
 */

const ROOT = path.resolve(__dirname, "..");

describe("BusinessProfile: obsolete Cartão Digital removal", () => {
  it("no longer imports or renders DigitalBusinessCard", async () => {
    const source = await readFile(path.join(ROOT, "components/BusinessProfile.tsx"), "utf8");
    expect(source).not.toMatch(/DigitalBusinessCard/);
  });

  it("no longer renders the 'Cartão digital' heading", async () => {
    const source = await readFile(path.join(ROOT, "components/BusinessProfile.tsx"), "utf8");
    expect(source.toLowerCase()).not.toContain("cartão digital");
  });

  it("still renders the real PiriCard/QR profile actions (Share/QR/download) in the same section", async () => {
    const source = await readFile(path.join(ROOT, "components/BusinessProfile.tsx"), "utf8");
    expect(source).toMatch(/<ProfileActions[\s\S]*?showContact=\{false\}/);
  });

  it("the DigitalBusinessCard component file itself was deleted, not just unused", async () => {
    await expect(stat(path.join(ROOT, "components/DigitalBusinessCard.tsx"))).rejects.toThrow();
  });

  it("profile.css no longer defines the obsolete .digital-business-card/.digital-card-* rules", async () => {
    const raw = await readFile(path.join(ROOT, "app/profile.css"), "utf8");
    // Strip /* ... */ comments first — the removal is explained in prose in
    // a comment right above this spot, which would otherwise self-match.
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/\.digital-business-card/);
    expect(css).not.toMatch(/\.digital-card-/);
    // The shared section wrapper and ProfileActions' own button-row class
    // are NOT obsolete — they still lay out the real Share/QR/download row.
    expect(css).toMatch(/\.profile-digital-tools/);
    expect(css).toMatch(/\.card-actions/);
  });
});

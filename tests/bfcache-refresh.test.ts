import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression coverage for the Autoformigal "Deixar avaliação -> Google ->
 * Back -> old profile" investigation (corrected root cause).
 *
 * Classification: B/D — a real device's browser/webview can restore a
 * public profile page from its own back-forward cache (bfcache) instead of
 * re-fetching, showing a frozen snapshot of a previous visit. This is NOT
 * reproducible against current code/data in a clean session (verified live
 * against the production URL — see the phase report): the live edge
 * response is fresh (`x-vercel-cache: HIT`, low `age`), the document's own
 * `Cache-Control: public, max-age=0, must-revalidate` forces revalidation
 * on any real network request, the live Supabase `layout_variant` for
 * autoformigal is "workshop" (the current bespoke design), and Next.js's
 * `cacheComponents` (which would introduce its OWN client-side route
 * bfcache via React's `<Activity>`) is not enabled in this project — see
 * next.config.ts. None of that governs the BROWSER's native bfcache,
 * though, which is a separate mechanism entirely outside this app's
 * control. `components/BfcacheRefresh.tsx` is the smallest safe mitigation
 * available: on bfcache restore (the standard `pageshow` event with
 * `persisted: true`), it asks Next.js to re-fetch the route's data instead
 * of leaving a stale snapshot on screen. This is a NODE-environment test
 * suite (no jsdom) — see other tests in this repo for the same convention
 * — so this is a source-content contract test, not a DOM/event simulation.
 */

const ROOT = path.resolve(__dirname, "..");

async function read(relPath: string): Promise<string> {
  return readFile(path.join(ROOT, relPath), "utf8");
}

describe("BfcacheRefresh: re-fetches fresh data when a page is restored from bfcache", () => {
  it("is a client component (bfcache restore only happens in the browser)", async () => {
    const source = await read("components/BfcacheRefresh.tsx");
    expect(source).toMatch(/^"use client";/);
  });

  it("listens for the standard pageshow event and checks event.persisted", async () => {
    const source = await read("components/BfcacheRefresh.tsx");
    expect(source).toMatch(/addEventListener\("pageshow"/);
    expect(source).toMatch(/event\.persisted/);
  });

  it("calls router.refresh() only on a persisted (bfcache) show, not every mount", async () => {
    const source = await read("components/BfcacheRefresh.tsx");
    expect(source).toMatch(/if\s*\(event\.persisted\)\s*router\.refresh\(\)/);
  });

  it("cleans up its own listener (no leaked handler across route changes)", async () => {
    const source = await read("components/BfcacheRefresh.tsx");
    expect(source).toMatch(/removeEventListener\("pageshow"/);
  });

  it("renders nothing — purely a side-effect component", async () => {
    const source = await read("components/BfcacheRefresh.tsx");
    expect(source).toMatch(/return null;/);
  });
});

describe("the public profile route mounts BfcacheRefresh for every business, not just one", () => {
  it("app/[slug]/page.tsx imports and renders <BfcacheRefresh /> alongside <BusinessProfile />", async () => {
    const source = await read("app/[slug]/page.tsx");
    expect(source).toMatch(/import\s*\{\s*BfcacheRefresh\s*\}\s*from\s*"@\/components\/BfcacheRefresh"/);
    expect(source).toMatch(/<BfcacheRefresh\s*\/>/);
    // Mounted in the one shared route component — every published business
    // (not a business-specific file) gets the same protection.
    expect(source).toMatch(/<BusinessProfile business=\{withLiveReviews\}\s*\/>/);
  });
});

describe("ruled-out mechanisms stay ruled out (regression guards for the investigation's own findings)", () => {
  it("Next.js cacheComponents (which would add its own client-side route bfcache) is not enabled", async () => {
    const source = await read("next.config.ts");
    expect(source).not.toMatch(/cacheComponents/);
  });

  it("there is still exactly one public profile route reading from Supabase, not a stale static source", async () => {
    const source = await read("app/[slug]/page.tsx");
    expect(source).toMatch(/getPublicBusinessBySlug/);
    expect(source).not.toMatch(/from ["']@\/lib\/businesses["']/);
  });

  it("Autoformigal's business.website is untouched (autoformigal.vercel.app is the real, intended site)", async () => {
    const source = await read("lib/businesses.ts");
    expect(source).toMatch(/website:\s*"https:\/\/autoformigal\.vercel\.app"/);
  });
});

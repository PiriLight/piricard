import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the Autoformigal "Deixar avaliação -> Google -> Back
 * -> old/legacy profile" report investigated after Phase 4H.5.
 *
 * Investigation summary (see the phase report for the full trace):
 *   - "Deixar avaliação" resolves to `getSafeExternalUrl(reviewUrl) ??
 *     getSafeExternalUrl(reviewWriteUrl) ?? mapsHref` — a plain anchor, not
 *     `window.location`/`router.push`, not a redirect, not a stale internal
 *     route (there is no legacy Autoformigal route/component left in this
 *     app — `app/[slug]/page.tsx` is the ONLY public profile route and it
 *     reads from Supabase, not the legacy `lib/businesses.ts`).
 *   - The reachable "old/legacy" page is `https://autoformigal.vercel.app`
 *     — a separate, still-live, unrelated brochure site for the same
 *     business, wired in as this business's own `contact.website` (both in
 *     the live Supabase `business_profile_content.website` row and in the
 *     legacy static `lib/businesses.ts` mirror, present since this repo's
 *     initial commit). That is a PRODUCTION DATA fix (update/clear the
 *     website field via the Admin — Phase 4F/4G tooling), deliberately NOT
 *     made here per this task's "do not modify production data" rule.
 *   - What IS a code-level property worth pinning down: every external
 *     action on this route (Deixar avaliação, Como chegar, Website,
 *     Instagram, Facebook, WhatsApp) opens via `target="_blank" rel=
 *     "noopener noreferrer"`, the strongest same-app guarantee that an
 *     external destination lands in an independent browsing context rather
 *     than the profile's own tab/history stack. (This does NOT fully
 *     eliminate the class of bug in every host environment — an in-app
 *     webview or standalone/PWA context without real multi-tab support can
 *     still collapse `target="_blank"` to same-tab navigation regardless of
 *     what this app does; that is a platform limitation, not something any
 *     anchor attribute can force. See the phase report.) This test locks in
 *     the one thing this codebase DOES control, across every bespoke
 *     profile layout, so a future edit can't silently drop it for one
 *     action and reopen the same class of issue.
 */

const ROOT = path.resolve(__dirname, "..");

async function read(relPath: string): Promise<string> {
  return readFile(path.join(ROOT, relPath), "utf8");
}

/** Extracts the body of `function name(...) { ... }`, up to its matching closing brace — good enough for this file's small, single-purpose helper components. Skips past the parameter list (which itself may destructure a `{ ... }` object) to find the body's own opening brace. */
function functionBody(source: string, name: string): string {
  const paramsStart = source.indexOf(`function ${name}(`);
  if (paramsStart === -1) throw new Error(`Could not find function "${name}"`);
  const parenOpen = source.indexOf("(", paramsStart);

  let parenDepth = 0;
  let bodyBraceStart = -1;
  for (let i = parenOpen; i < source.length; i++) {
    if (source[i] === "(") parenDepth++;
    else if (source[i] === ")") {
      parenDepth--;
      if (parenDepth === 0) {
        bodyBraceStart = source.indexOf("{", i);
        break;
      }
    }
  }
  if (bodyBraceStart === -1) throw new Error(`Could not find body of "${name}"`);

  let braceDepth = 0;
  for (let i = bodyBraceStart; i < source.length; i++) {
    if (source[i] === "{") braceDepth++;
    else if (source[i] === "}") {
      braceDepth--;
      if (braceDepth === 0) return source.slice(bodyBraceStart, i + 1);
    }
  }
  throw new Error(`Unbalanced braces reading "${name}"`);
}

describe("bespoke profile ExternalLink helpers open a genuinely independent browsing context", () => {
  const filesWithHelper = [
    "components/AutoformigalProfile.tsx",
    "components/BoiNaBrasaProfile.tsx",
    "components/OFTRacingProfile.tsx",
  ];

  it.each(filesWithHelper)("%s's shared ExternalLink renders target=_blank + rel=noopener noreferrer", async (relPath) => {
    const source = await read(relPath);
    const body = functionBody(source, "ExternalLink");
    expect(body).toMatch(/target="_blank"/);
    expect(body).toMatch(/rel="noopener noreferrer"/);
  });

  it.each(filesWithHelper)("%s routes every known external action through <ExternalLink>, not a bare <a>", async (relPath) => {
    const source = await read(relPath);
    // Every one of these variables is an external (Google Maps/review,
    // website, Instagram/Facebook, delivery/collection/TripAdvisor, etc.)
    // href built by lib/links.ts — never an internal in-app route. Only
    // assert on the ones this specific file actually references.
    const externalHrefVars = [
      "reviewHref",
      "reviewWriteHref",
      "mapsHref",
      "directionsUrl",
      "websiteHref",
      "instagramHref",
      "facebookHref",
      "tripAdvisorHref",
      "deliveryUrl",
      "collectionUrl",
    ];
    for (const hrefVar of externalHrefVars) {
      if (!source.includes(`={${hrefVar}}`)) continue; // this profile doesn't use this action
      const bareAnchorMisuse = new RegExp(`<a\\b(?![^>]*ExternalLink)[^>]*href=\\{${hrefVar}\\}`);
      expect(source).not.toMatch(bareAnchorMisuse);
      expect(source).toMatch(new RegExp(`<ExternalLink\\b[^>]*href=\\{${hrefVar}\\}`));
    }
  });
});

describe("Beauty Connection 360 and the default profile: external actions are inline anchors, each individually safe", () => {
  it("BeautyConnection360Profile.tsx: every external href carries target=_blank + rel=noopener noreferrer on the same tag", async () => {
    const source = await read("components/BeautyConnection360Profile.tsx");
    for (const hrefVar of ["bookHref", "mapsHref", "websiteHref", "instagramHref", "facebookHref", "whatsappHref"]) {
      if (!source.includes(`={${hrefVar}}`)) continue;
      const safeTag = new RegExp(`<a\\b[^>]*href=\\{${hrefVar}\\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"`);
      expect(source).toMatch(safeTag);
    }
  });

  it("BusinessProfile.tsx (default/editorial layout): the Website/Maps/social info rows open externally-safe", async () => {
    const source = await read("components/BusinessProfile.tsx");
    // InformationRow's `external` prop is what applies target=_blank —
    // confirm it still does, and that Website/Maps rows still pass it.
    expect(source).toMatch(/external\s*\?\s*\{\s*target:\s*"_blank",\s*rel:\s*"noopener noreferrer"\s*\}/);
    expect(source).toMatch(/label="Website"\s+href=\{links\.website\}\s+external/);
    expect(source).toMatch(/label="Morada"\s+href=\{links\.maps\}\s+external/);
  });
});

describe("sticky action bars: the non-tel/non-internal action is also externally-safe", () => {
  it("AutoformigalStickyBar's WhatsApp fab is target=_blank + rel=noopener noreferrer", async () => {
    const source = await read("components/AutoformigalStickyBar.tsx");
    expect(source).toMatch(/href=\{whatsappHref\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });

  it("StickyProfileActions' secondary (WhatsApp/maps) action is target=_blank + rel=noopener noreferrer", async () => {
    const source = await read("components/StickyProfileActions.tsx");
    expect(source).toMatch(/href=\{secondaryHref\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });
});

describe("no in-repo legacy Autoformigal route can serve a second profile experience", () => {
  it("there is exactly one public profile route, and it reads from Supabase, not the legacy static data", async () => {
    const source = await read("app/[slug]/page.tsx");
    expect(source).toMatch(/getPublicBusinessBySlug/);
    expect(source).not.toMatch(/from ["']@\/lib\/businesses["']/);
  });

  it("no app/ route directory is named after a specific business slug (which would shadow the [slug] route)", async () => {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(path.join(ROOT, "app"), { withFileTypes: true });
    const businessSlugDirs = entries.filter(
      (entry) => entry.isDirectory() && ["autoformigal", "beauty-connection-360", "boi-na-brasa", "oft-racing"].includes(entry.name),
    );
    expect(businessSlugDirs).toEqual([]);
  });
});

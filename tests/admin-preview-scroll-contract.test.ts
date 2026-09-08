import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 4H.5 — Issue 1 regression guard: the admin preview must stay a real
 * scrollable mini-viewport, and any bespoke `position: fixed` sticky/dock
 * bar rendered inside it must stay visually pinned to that mini-viewport,
 * never escape to the real Admin page.
 *
 * This repo's Vitest config runs a plain "node" environment (no jsdom), so a
 * real layout/paint assertion isn't possible here — this was verified live
 * in a browser during Phase 4H.5 (see the phase report). What IS practical
 * in this infra, and worth pinning down as a regression guard, is the CSS
 * *contract* two earlier, live-verified findings depend on:
 *
 *   1. `.admin-preview-viewport` must NOT stretch its child frame to its own
 *      (capped) height — that silently discards the frame's real content
 *      height and leaves nothing to scroll. `align-items: flex-start`
 *      (overriding flex's default `stretch`) is what lets the frame grow to
 *      its natural, full content height.
 *   2. The `position: fixed` containing block (`contain: layout`) for
 *      bespoke sticky bars must sit on `.admin-preview-pane` — the STATIC
 *      outer card — not on `.admin-preview-viewport` — the element that
 *      itself scrolls. Verified live: when the containing-block ancestor is
 *      also the one whose content scrolls, a `position: fixed` descendant
 *      scrolls away WITH that content instead of staying pinned in view,
 *      the opposite of real device "fixed" behaviour.
 */

const ROOT = path.resolve(__dirname, "..");

async function readAdminCss(): Promise<string> {
  return readFile(path.join(ROOT, "app/admin/admin.css"), "utf8");
}

function ruleBodyFor(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Rule not found for selector: ${selector}`);
  return match[1];
}

describe("admin preview: scroll + fixed-position containment CSS contract", () => {
  it(".admin-preview-viewport owns the scroll (max-height + overflow auto)", async () => {
    const body = ruleBodyFor(await readAdminCss(), ".admin-preview-viewport");
    expect(body).toMatch(/overflow:\s*auto/);
    expect(body).toMatch(/max-height:\s*80vh/);
  });

  it(".admin-preview-viewport does not stretch the frame to its own capped height", async () => {
    const body = ruleBodyFor(await readAdminCss(), ".admin-preview-viewport");
    // The bug: default flex `align-items: stretch` forced the frame (no
    // explicit height) to shrink to the viewport's own height instead of
    // its natural content height, leaving nothing to scroll.
    expect(body).toMatch(/align-items:\s*flex-start/);
  });

  it("the position:fixed containing block lives on the static outer pane, not the scrolling viewport", async () => {
    const css = await readAdminCss();
    const paneBody = ruleBodyFor(css, ".admin-preview-pane");
    const viewportBody = ruleBodyFor(css, ".admin-preview-viewport");
    expect(paneBody).toMatch(/contain:\s*layout/);
    expect(viewportBody).not.toMatch(/contain:\s*layout/);
  });

  it("scroll-chaining out of the preview into the real Admin page is contained", async () => {
    const body = ruleBodyFor(await readAdminCss(), ".admin-preview-viewport");
    expect(body).toMatch(/overscroll-behavior:\s*contain/);
  });
});

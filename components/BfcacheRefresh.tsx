"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Phase 4H.5 follow-up — Autoformigal "Deixar avaliação -> Google -> Back"
 * investigation.
 *
 * Root cause was NOT this app's routing, redirects, or data (see the phase
 * report): a real device's browser/webview can restore a public profile
 * page from its own back-forward cache (bfcache) — a full, frozen snapshot
 * of a PREVIOUS visit, served on Back without any network request — rather
 * than re-fetching. This is standard browser behavior, independent of this
 * app's `Cache-Control` headers (which already correctly say
 * `max-age=0, must-revalidate`: bfcache restoration bypasses HTTP cache
 * validation entirely, it isn't governed by cache-control) and independent
 * of Next.js's own `cacheComponents`/`<Activity>` route cache (this project
 * doesn't enable `cacheComponents`, so that mechanism plays no part here —
 * see next.config.ts). Autoformigal is the one business whose PUBLIC URL
 * has ever served two visibly different designs over its lifetime (a
 * generic fallback layout, then later the bespoke redesign), so it is the
 * one profile for which a returning visitor's device could plausibly still
 * be holding an old snapshot to restore.
 *
 * This component cannot un-cache an ALREADY-stale snapshot sitting on a
 * real device from before this fix ever shipped (that snapshot's own JS
 * has no way to know about code written after it was captured) — only
 * clearing site data / a hard reload on that specific device fixes an
 * already-affected visit. What this DOES fix, going forward: it detects
 * the moment a page is shown via bfcache restore (the standard `pageshow`
 * event with `event.persisted === true`) and asks Next.js to re-fetch the
 * current route's data (`router.refresh()` — re-renders Server Components
 * with fresh data without a full page reload, preserving scroll position)
 * instead of leaving a frozen, possibly-outdated snapshot on screen. Mount
 * once per public profile route; renders nothing.
 */
export function BfcacheRefresh() {
  const router = useRouter();

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) router.refresh();
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  return null;
}

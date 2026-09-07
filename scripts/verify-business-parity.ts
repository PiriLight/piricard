/**
 * Phase 4C pre-migration parity check — LOCAL Supabase only.
 *
 * Compares each of the four production businesses as currently hardcoded in
 * lib/businesses.ts against the same business fetched through the new
 * public data layer (lib/public/business.ts -> getPublicSupabaseClient ->
 * mapBusinessFromDatabase), field by field, and prints an A/B/C-classified
 * report.
 *
 * Deliberately NOT wired into `npm test` — it needs a live database
 * (`npx supabase start` + `npx supabase db reset` first) and is a one-off
 * migration-validation tool, matching the existing scripts/generate-*.ts
 * convention (manual, tsx-run, not part of CI's default suite).
 *
 * SAFETY: this script must be run with NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY pointed at the LOCAL stack explicitly
 * on the command line — it does NOT read .env.local (which currently points
 * at the remote project) and does not fall back to any default. If those
 * two env vars are missing, it refuses to run rather than silently doing
 * nothing or guessing an endpoint.
 *
 * Usage (values from `npx supabase status` after `npx supabase start`):
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<api-port> \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
 *   npx tsx scripts/verify-business-parity.ts
 */

import { getBusinessBySlug, type Business } from "../lib/businesses";
import { getPublicBusinessBySlug, getPublicDirectoryBusinesses } from "../lib/public/business";

const SLUGS = ["autoformigal", "beauty-connection-360", "boi-na-brasa", "oft-racing"] as const;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "Refusing to run: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set " +
      "explicitly to the LOCAL Supabase stack (see `npx supabase status`). This script never reads " +
      ".env.local, which points at the remote project.",
  );
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL.includes("127.0.0.1") && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("localhost")) {
  console.error(
    `Refusing to run against a non-local URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}. ` +
      "This script only ever targets a local `supabase start` instance.",
  );
  process.exit(1);
}

/** Deep-equal treating an own property explicitly set to `undefined` as equivalent to that property being absent — matches how every consumer of `Business` actually reads these fields (`business.about?.heading`). */
function deepEqualIgnoringUndefined(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqualIgnoringUndefined(item, b[i]));
  }

  const aKeys = Object.keys(a as Record<string, unknown>).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const bKeys = Object.keys(b as Record<string, unknown>).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  const allKeys = new Set([...aKeys, ...bKeys]);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of allKeys) {
    if (!deepEqualIgnoringUndefined((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

const FIELDS: Array<keyof Business> = [
  "slug",
  "name",
  "organization",
  "category",
  "published",
  "featured",
  "indexable",
  "directoryDescription",
  "profileDescription",
  "positioning",
  "about",
  "contact",
  "location",
  "reviewUrl",
  "reviewWriteUrl",
  "externalLinks",
  "reviewSnapshot",
  "googlePlaceId",
  "socialLinks",
  "services",
  "hours",
  "assets",
  "gallery",
  "menu",
  "restaurantInfo",
  "treatmentGroups",
  "representedBrands",
  "productCategories",
  "digitalCard",
  "theme",
  "layoutVariant",
];

interface FieldDiff {
  field: string;
  static: unknown;
  db: unknown;
}

async function main() {
  let totalDiffs = 0;
  const report: string[] = ["# Phase 4C — Local Parity Report\n"];

  for (const slug of SLUGS) {
    const staticBusiness = getBusinessBySlug(slug);
    const dbBusiness = await getPublicBusinessBySlug(slug);

    report.push(`## ${slug}\n`);

    if (!staticBusiness) {
      report.push(`- **C — BLOCKER**: no static business found for slug "${slug}" (script bug).\n`);
      totalDiffs++;
      continue;
    }
    if (!dbBusiness) {
      report.push(`- **C — BLOCKER**: getPublicBusinessBySlug("${slug}") returned undefined — not seeded, not published, or RLS misconfigured.\n`);
      totalDiffs++;
      continue;
    }

    const diffs: FieldDiff[] = [];
    for (const field of FIELDS) {
      if (!deepEqualIgnoringUndefined(staticBusiness[field], dbBusiness[field])) {
        diffs.push({ field, static: staticBusiness[field], db: dbBusiness[field] });
      }
    }

    if (diffs.length === 0) {
      report.push("- **A** — every compared field matches exactly.\n");
    } else {
      totalDiffs += diffs.length;
      for (const diff of diffs) {
        report.push(`- **C — DIFFERS**: \`${diff.field}\`\n  - static: \`${JSON.stringify(diff.static)}\`\n  - db: \`${JSON.stringify(diff.db)}\`\n`);
      }
    }
  }

  report.push("## Directory ordering\n");
  const directory = await getPublicDirectoryBusinesses();
  report.push(`- DB directory order: ${directory.map((b) => b.slug).join(", ")}\n`);

  console.log(report.join("\n"));
  console.log(totalDiffs === 0 ? "\nRESULT: zero unresolved differences." : `\nRESULT: ${totalDiffs} difference(s) found — see C entries above.`);

  process.stdout.write("\n");
  await import("node:fs/promises").then((fs) => fs.writeFile("PARITY_REPORT.md", report.join("\n"), "utf-8"));

  process.exit(totalDiffs === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

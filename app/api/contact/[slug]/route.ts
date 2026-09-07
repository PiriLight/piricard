import { getPublicBusinessBySlug } from "@/lib/public/business";
import { getCanonicalProfileUrl, getSiteUrl } from "@/lib/site";
import { createVCard, getVCardFilename } from "@/lib/vcard";

/**
 * Phase 4E.1 — public vCard download, cut over to the same canonical
 * anonymous Supabase public data layer as the profile route
 * (lib/public/business.ts). Same guarantees as app/[slug]/page.tsx: anon
 * client only, no cookies, no service role, and missing/unpublished/
 * archived businesses are indistinguishable (Postgres RLS never returns the
 * row) — matching the profile route's own not-found behavior instead of
 * the previous static-source lookup, which could silently drift from it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getPublicBusinessBySlug(slug);
  if (!business) return Response.json({ error: "Perfil não encontrado." }, { status: 404 });

  const filename = getVCardFilename(business);
  const logoUrl = business.assets.logo ? new URL(business.assets.logo, `${getSiteUrl()}/`).toString() : undefined;
  const vCard = createVCard(business, {
    profileUrl: getCanonicalProfileUrl(business.slug),
    logoUrl,
  });
  return new Response(`\uFEFF${vCard}`, {
    headers: {
      "Content-Type": "text/vcard;charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

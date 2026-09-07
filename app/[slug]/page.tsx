import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BusinessProfile } from "@/components/BusinessProfile";
import { getBusinessWithLiveReviews } from "@/lib/google-reviews";
import { getPublicBusinessBySlug, getPublicDirectoryBusinesses } from "@/lib/public/business";
import { getCanonicalProfileUrl } from "@/lib/site";

interface ProfilePageProps { params: Promise<{ slug: string }> }

/**
 * Phase 4E — public route cutover: profiles now read from the canonical
 * anonymous Supabase public data layer (lib/public/business.ts) instead of
 * the static lib/businesses.ts source. `getPublicBusinessBySlug` already
 * guards malformed slugs before issuing any query and already returns
 * `undefined` for missing/unpublished/archived businesses (Postgres RLS
 * enforces that — see supabase/migrations/20260906210142_piricard_v1_schema.sql
 * section 8), so those three cases stay indistinguishable here exactly as
 * before.
 *
 * Caching decision: `generateStaticParams` still pre-renders the businesses
 * published in Supabase at build/deploy time (cheap, good for the common
 * case), but `dynamicParams` is intentionally left at its Next.js default
 * (`true`, i.e. no override) rather than the previous `false`. The old
 * `dynamicParams = false` hard-404'd any slug not in that build-time list —
 * fine for a static source, but it would make a business published in
 * Supabase *after* the last deploy permanently unreachable until the next
 * one. Leaving it `true` means such a slug renders (and gets cached) on its
 * first visit instead. `revalidate` below then keeps already-rendered
 * profiles from caching an admin's edits forever: each is eligible for a
 * background refresh at most this often. This is the smallest fix that
 * satisfies "admin edits become visible without a source change" —
 * no realtime subscription, no webhook, no new infra.
 */
export const revalidate = 300; // 5 minutes — must be a literal, not an imported constant (Next.js requires this to be statically analyzable)

export async function generateStaticParams() {
  const businesses = await getPublicDirectoryBusinesses();
  return businesses.map(({ slug }) => ({ slug }));
}

// Request-scoped memoization: generateMetadata and the page body below both
// need the same business. Without this, each would issue its own full round
// trip of Supabase queries (business + content + hours + socials + module
// content) for the same request — wasteful, and not how the old static
// lookup behaved (that was free either way). React's `cache()` dedupes
// same-argument calls within a single render pass.
const loadPublicBusiness = cache(getPublicBusinessBySlug);

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await loadPublicBusiness(slug);
  if (!business) return { title: "Perfil não encontrado", robots: { index: false, follow: false } };
  const canonical = getCanonicalProfileUrl(business.slug);
  const description = business.profileDescription || business.directoryDescription;
  return {
    title: business.name,
    description,
    alternates: { canonical },
    robots: { index: business.indexable, follow: business.indexable },
    openGraph: {
      title: business.name,
      description,
      url: canonical,
      type: "profile",
      ...(business.assets.socialImage ? { images: [{ url: business.assets.socialImage }] } : {}),
    },
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params;
  const business = await loadPublicBusiness(slug);
  if (!business) notFound();
  // Only the actual rendered page fetches the live Google review snapshot —
  // generateMetadata above stays cheap/side-effect-free.
  const withLiveReviews = await getBusinessWithLiveReviews(business);
  return <BusinessProfile business={withLiveReviews} />;
}

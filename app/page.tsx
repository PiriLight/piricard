import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BusinessDirectory } from "@/components/BusinessDirectory";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import { PlatformFooter } from "@/components/PlatformFooter";
import { getPiriCardShowcaseCards } from "@/lib/piricard-cards";
import { getPublicDirectoryBusinesses } from "@/lib/public/business";
import "./directory.css";

export const metadata: Metadata = {
  title: { absolute: "PiriCard — Negócios a um toque" },
};

// Phase 4E — public route cutover: same canonical Supabase public data
// layer and the same revalidation window as app/[slug]/page.tsx (see that
// file's comment for the full rationale). Kept as a literal here too — the
// route segment `revalidate` value must be statically analyzable, so it
// can't be imported from a shared constant.
export const revalidate = 300; // 5 minutes

export default async function HomePage() {
  const businesses = await getPublicDirectoryBusinesses();
  const showcaseCards = getPiriCardShowcaseCards();
  return (
    <main className="directory-page directory-home">
      <header className="platform-header">
        <Link className="platform-wordmark" href="/" aria-label="PiriCard — página inicial">
          <PiriCardBrandMark wordmark={<span>Piri<span>Card</span></span>} />
        </Link>
        <a href="https://pirilight.pt" target="_blank" rel="noopener noreferrer">PiriLight Studio</a>
      </header>
      <BusinessDirectory businesses={businesses} showcaseCards={showcaseCards} />
      <aside className="directory-owner-cta" aria-labelledby="owner-cta-heading">
        <div>
          <p className="eyebrow">Para negócios</p>
          <h2 id="owner-cta-heading">O teu negócio num só toque.</h2>
          <p>Cartão NFC personalizado, perfil digital e QR Code. Tudo ligado ao teu negócio.</p>
          <div className="owner-cta-price">
            <span className="owner-cta-price-label">Preço de lançamento</span>
            <span className="owner-cta-price-value">100 €</span>
            <span className="owner-cta-price-regular">Preço regular previsto: 150 €</span>
          </div>
          <p className="owner-cta-microline">Primeiro ano da plataforma incluído.</p>
        </div>
        <Link href="/piricard">Ver PiriCard e preços <ArrowRight aria-hidden="true" size={18} /></Link>
      </aside>
      <PlatformFooter />
    </main>
  );
}

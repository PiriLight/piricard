import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDirectory } from "@/components/BusinessDirectory";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import { PlatformFooter } from "@/components/PlatformFooter";
import { getPublishedDirectoryBusinesses } from "@/lib/businesses";
import { getPiriCardShowcaseCards } from "@/lib/piricard-cards";

export const metadata: Metadata = {
  title: { absolute: "PiriCard — Negócios a um toque" },
};

export default function HomePage() {
  const businesses = getPublishedDirectoryBusinesses();
  const showcaseCards = getPiriCardShowcaseCards();
  return (
    <main className="directory-page">
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
        <Link href="/piricard">Ver PiriCard e preços</Link>
      </aside>
      <PlatformFooter />
    </main>
  );
}

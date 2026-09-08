import Image from "next/image";
import Link from "next/link";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import {
  ArrowUpRight,
  Facebook,
  Instagram,
  MapPin,
  Navigation,
  Phone,
  Star,
} from "lucide-react";
import type { ReactNode } from "react";
import { BusinessHoursSchedule, OpeningStatus, TodayHours } from "@/components/OpeningStatus";
import { BusinessPhotoGallery } from "@/components/BusinessPhotoGallery";
import { ContactDownloadButton } from "@/components/ContactDownloadButton";
import { OFTStickyBar } from "@/components/OFTStickyBar";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import type { Business } from "@/lib/businesses";
import { getEmailHref, getMapsHref, getPhoneHref, getSafeExternalUrl, getWhatsAppHref } from "@/lib/links";
import { getPiriCardPdfFilename, getPiriCardPdfPath } from "@/lib/site";
import styles from "./OFTRacingProfile.module.css";

// Self-hosted via next/font (no external request at runtime) — these are the
// typefaces already named throughout OFTRacingProfile.module.css. Scoped to
// this component only, so no other PiriCard profile is affected.
const oftBody = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--oft-nf-body", display: "swap" });
const oftDisplay = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--oft-nf-display", display: "swap" });
const oftMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--oft-nf-mono", display: "swap" });

const whatsappMessage = "Olá! Vi a OFT Racing no PiriCard e gostaria de mais informações.";

// Verified 28–29 August 2026 directly from OFT Racing Shop's live Google Business
// profile (google.com/maps — place id 0xd1f25711195cad1:0x2a9d02e1163b0a05, matching
// the confirmed address and phone number). Do not adjust without re-verifying source.
const reviewDistribution = [
  { stars: 5, count: 31 },
  { stars: 4, count: 2 },
  { stars: 3, count: 1 },
  { stars: 2, count: 1 },
  { stars: 1, count: 0 },
] as const;

// Themes genuinely repeated across multiple independent Google reviews (and Google's
// own highlighted review excerpts) for OFT Racing Shop — not invented.
const reviewPraise = ["Atendimento", "Profissionalismo", "Serviço pós-venda", "Organização e limpeza"] as const;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("351") ? digits.slice(3) : digits;
  const formatted = local.length === 9 ? local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : value;
  return digits.startsWith("351") ? `+351 ${formatted}` : formatted;
}

function ExternalLink({ href, children, className, ariaLabel }: { href: string; children: ReactNode; className?: string; ariaLabel?: string }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>{children}</a>;
}

export function OFTRacingProfile({ business }: { business: Business }) {
  const phoneHref = getPhoneHref(business.contact.phone);
  const mapsHref = getMapsHref(business.location?.mapsUrl, business.location?.address);
  const reviewHref = getSafeExternalUrl(business.reviewUrl);
  const reviewWriteHref = getSafeExternalUrl(business.reviewWriteUrl);
  const whatsappBaseHref = getWhatsAppHref(business.contact.whatsapp);
  const whatsappHref = whatsappBaseHref ? `${whatsappBaseHref}?text=${encodeURIComponent(whatsappMessage)}` : undefined;
  const instagramHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "instagram")?.url);
  const facebookHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "facebook")?.url);
  const contactFilename = getPiriCardPdfFilename(business.slug);
  const phone = business.contact.phone ? formatPhone(business.contact.phone) : undefined;
  const localPhone = phone?.replace(/^\+351\s/, "");
  const emailHref = getEmailHref(business.contact.email);
  const reviewSnapshot = business.reviewSnapshot;
  const locationName = business.location?.city;
  const address = business.location?.address;
  const mapEmbedHref = address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`
    : undefined;

  return (
    <main className={`profile-layout ${styles.page} ${oftBody.variable} ${oftDisplay.variable} ${oftMono.variable}`}>
      <article className={`profile-layout-shell ${styles.shell}`}>
        <nav className={styles.platformBar} aria-label="Navegação PiriCard">
          <Link className={styles.platformBrand} href="/" aria-label="PiriCard — ir para o diretório">
            <PiriCardBrandMark wordmark={<strong>Piri<span>Card</span></strong>} />
          </Link>
          <Link className={styles.directoryLink} href="/">
            Diretório <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        </nav>

        <header>
          <div className={styles.heroImage}>
            {business.assets.cover ? (
              <Image
                src={business.assets.cover}
                alt={business.assets.coverAlt ?? `Fachada de ${business.name}`}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 1180px"
              />
            ) : null}
            <div className={styles.heroFade} aria-hidden="true" />
            {locationName ? <span className={styles.locationPill}><MapPin aria-hidden="true" size={12} />{locationName}</span> : null}
          </div>

          <div className={styles.identity}>
            <div className={styles.identityTopline}>
              {business.assets.logo ? (
                <div className={styles.logo}>
                  <Image src={business.assets.logo} alt={`Logótipo oficial de ${business.name}`} width={480} height={176} sizes="104px" />
                </div>
              ) : null}
              {business.reviewSnapshot ? (
                reviewHref ? (
                  <ExternalLink className={styles.ratingBadge} href={reviewHref} ariaLabel={`Ver avaliações de ${business.name}`}>
                    <strong>{business.reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                    <span aria-label={`${business.reviewSnapshot.rating} em 5 estrelas`}>★★★★★</span>
                    <small>{business.reviewSnapshot.count}</small>
                  </ExternalLink>
                ) : (
                  <div className={styles.ratingBadge} aria-label={`${business.reviewSnapshot.rating} em 5 estrelas, ${business.reviewSnapshot.count} avaliações no ${business.reviewSnapshot.source}`}>
                    <strong>{business.reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                    <span aria-hidden="true">★★★★★</span>
                    <small>{business.reviewSnapshot.count}</small>
                  </div>
                )
              ) : null}
            </div>

            <h1>{business.name}</h1>
            <p className={styles.subtitle}>{business.category}{locationName ? ` · ${locationName}` : ""}</p>
            {address ? <p className={styles.address}>{address}</p> : null}
            {business.hours?.length ? (
              <div className={styles.liveStatus}>
                <OpeningStatus hours={business.hours} />
                <TodayHours hours={business.hours} />
              </div>
            ) : null}
          </div>
        </header>

        <nav className={styles.quickActions} aria-label="Ações principais">
          {phoneHref ? (
            <a className={styles.actionDark} href={phoneHref} aria-label={`Ligar para ${business.name}`}>
              <span className={styles.actionIcon}><Phone aria-hidden="true" /></span>
              <span><strong>Ligar</strong><small>{localPhone}</small></span>
            </a>
          ) : null}
          {mapsHref ? (
            <ExternalLink className={styles.actionAccent} href={mapsHref} ariaLabel={`Obter direções para ${business.name}`}>
              <span className={styles.actionIcon}><Navigation aria-hidden="true" /></span>
              <span><strong>Como chegar</strong><small>Google Maps</small></span>
            </ExternalLink>
          ) : null}
          {reviewWriteHref ? (
            <ExternalLink href={reviewWriteHref} ariaLabel={`Escrever uma avaliação da ${business.name} no Google`}>
              <span className={styles.actionIcon}><Star aria-hidden="true" /></span>
              <span><strong>Deixar avaliação</strong><small>Google</small></span>
            </ExternalLink>
          ) : null}
          <ContactDownloadButton
            businessName={business.name}
            endpoint={getPiriCardPdfPath(business.slug)}
            filename={contactFilename}
            className={styles.saveContact}
            label="Guardar contacto"
          />
        </nav>

        <section className={styles.essentials} aria-labelledby="oft-essentials-heading">
          <p className={styles.kicker} id="oft-essentials-heading">Informação essencial</p>
          <dl className={styles.essentialGrid}>
            <div>
              <dt>Categoria</dt>
              <dd><strong>{business.category}</strong><small>{locationName}</small></dd>
            </div>
            {phoneHref && phone ? (
              <div>
                <dt>Telefone</dt>
                <dd><a href={phoneHref}>{phone}</a><small>Toque para ligar</small></dd>
              </div>
            ) : null}
            {mapsHref && address ? (
              <div>
                <dt>Morada</dt>
                <dd><ExternalLink href={mapsHref}>{business.location?.streetAddress ?? address}</ExternalLink><small>{locationName}</small></dd>
              </div>
            ) : null}
            {emailHref && business.contact.email ? (
              <div>
                <dt>Email</dt>
                <dd><a href={emailHref}>{business.contact.email}</a><small>Toque para enviar email</small></dd>
              </div>
            ) : null}
            {business.hours?.length ? (
              <div>
                <dt>Horário de hoje</dt>
                <dd><TodayHours hours={business.hours} /><small>Hora de Lisboa</small></dd>
              </div>
            ) : null}
          </dl>
        </section>

        {(facebookHref || instagramHref) ? (
          <section className={styles.social} aria-labelledby="oft-social-heading">
            <div>
              <p className={styles.kicker}>Redes sociais</p>
              <h2 id="oft-social-heading">Acompanha a OFT</h2>
            </div>
            <nav className={styles.socialLinks} aria-label={`Redes sociais da ${business.name}`}>
              {instagramHref ? (
                <ExternalLink className={styles.instagramCard} href={instagramHref} ariaLabel={`${business.name} no Instagram`}>
                  <span className={styles.platformIcon}><Instagram aria-hidden="true" /></span>
                  <span><strong>Instagram</strong><small>@oftracing153</small></span>
                  <ArrowUpRight aria-hidden="true" />
                </ExternalLink>
              ) : null}
              {facebookHref ? (
                <ExternalLink className={styles.facebookCard} href={facebookHref} ariaLabel={`${business.name} no Facebook`}>
                  <span className={styles.platformIcon}><Facebook aria-hidden="true" /></span>
                  <span><strong>Facebook</strong><small>OFT Racing</small></span>
                  <ArrowUpRight aria-hidden="true" />
                </ExternalLink>
              ) : null}
            </nav>
          </section>
        ) : null}

        <section className={styles.about} aria-labelledby="oft-about-heading">
          <p className={styles.kicker}>Sobre a OFT</p>
          <h2 id="oft-about-heading">{business.about?.heading}</h2>
          {business.about?.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <div className={styles.aboutGrid}>
            <div>
              <p className={styles.kicker}>Representante · Marcas</p>
              <ul className={styles.brandList}>
                {(business.representedBrands ?? []).map((brand) => <li key={brand}>{brand}</li>)}
              </ul>
            </div>
            <div>
              <p className={styles.kicker}>Encontra na OFT</p>
              <ul className={styles.categoryList}>
                {(business.productCategories ?? []).map((category) => <li key={category}>{category}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {reviewSnapshot ? (
          <section className={styles.reviews} aria-labelledby="oft-reviews-heading">
            <div className={styles.sectionIntro}>
              <p className={styles.kicker}>Reputação</p>
              <h2 id="oft-reviews-heading">Avaliações</h2>
            </div>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewScore}>
                <div className={styles.reviewScoreHead}>
                  <strong className={styles.reviewRating}>{reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                  <span className={styles.stars} aria-label={`${reviewSnapshot.rating} em 5 estrelas`}>
                    {Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden="true" />)}
                  </span>
                  <small>{reviewSnapshot.count} avaliações no {reviewSnapshot.source}</small>
                </div>
                <ul className={styles.distribution} aria-label="Distribuição das avaliações por número de estrelas">
                  {reviewDistribution.map((row) => (
                    <li key={row.stars}>
                      <span>{row.stars}</span>
                      <i><b style={{ width: `${Math.round((row.count / reviewSnapshot.count) * 100)}%` }} /></i>
                      <span>{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.praise}>
                <p className={styles.kicker}>Mais elogiado</p>
                <ul>{reviewPraise.map((item) => <li key={item}>{item}</li>)}</ul>
                <small className={styles.caveat}>Dados consultados em {reviewSnapshot.asOf} · Google.</small>
              </div>
            </div>
            {(reviewWriteHref || reviewHref) ? (
              <div className={styles.reviewActions}>
                {reviewWriteHref ? (
                  <ExternalLink className={styles.reviewWriteCta} href={reviewWriteHref} ariaLabel={`Escrever uma avaliação da ${business.name} no Google`}>
                    <Star aria-hidden="true" size={16} /> Deixar uma avaliação
                  </ExternalLink>
                ) : null}
                {reviewHref ? <ExternalLink className={styles.reviewLink} href={reviewHref}>Ler as avaliações no Google <ArrowUpRight aria-hidden="true" /></ExternalLink> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className={styles.visit} aria-label="Horário e localização">
          {business.hours?.length ? (
            <div className={styles.hours}>
              <div className={styles.sectionIntro}>
                <p className={styles.kicker}>Planeia a visita</p>
                <h2>Horário</h2>
              </div>
              <BusinessHoursSchedule hours={business.hours} />
              <p className={styles.caveat}>Hora de Lisboa. Feriados e horários especiais podem diferir.</p>
            </div>
          ) : null}

          {address ? (
            <div className={styles.location}>
              <div className={styles.sectionIntro}>
                <p className={styles.kicker}>Onde estamos</p>
                <h2>Localização</h2>
              </div>
              <address>
                <strong>{business.location?.streetAddress ?? address}</strong>
                {locationName ? <span>{locationName}</span> : null}
              </address>
              <div className={styles.mapCard}>
                {mapEmbedHref ? (
                  <iframe
                    title={`Mapa da ${business.name} em ${locationName ?? "Portugal"}`}
                    src={mapEmbedHref}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : null}
                {mapsHref ? (
                  <ExternalLink className={styles.directionsButton} href={mapsHref} ariaLabel={`Obter direções para ${business.name}`}>
                    <span>Como chegar</span><Navigation aria-hidden="true" />
                  </ExternalLink>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {business.gallery?.length ? (
          <section className={styles.gallery} aria-labelledby="oft-gallery-heading">
            <p className={styles.kicker} id="oft-gallery-heading">Galeria</p>
            <BusinessPhotoGallery businessName={business.name} images={business.gallery} />
          </section>
        ) : null}

        <section className={styles.contacts} aria-labelledby="oft-contacts-heading">
          <p className={styles.kicker}>Fala connosco</p>
          <h2 id="oft-contacts-heading">Contactos</h2>
          <div>
            {phoneHref && phone ? <a href={phoneHref}><small>Telefone</small><strong>{phone}</strong></a> : null}
            {emailHref && business.contact.email ? <a href={emailHref}><small>Email</small><strong>{business.contact.email}</strong></a> : null}
            {instagramHref ? <ExternalLink href={instagramHref}><small>Instagram</small><strong>@oftracing153</strong></ExternalLink> : null}
            {facebookHref ? <ExternalLink href={facebookHref}><small>Facebook</small><strong>OFT Racing</strong></ExternalLink> : null}
            {mapsHref && address ? <ExternalLink href={mapsHref}><small>Morada</small><strong>{business.location?.streetAddress ?? address}</strong></ExternalLink> : null}
          </div>
        </section>

        <footer className={`profile-layout-footer ${styles.footer}`}>
          <div><strong>{business.name}</strong><p>{address}{phone ? ` · ${phone}` : ""}</p></div>
          <PiriCardBrandMark wordmark={<span>Perfil criado com Piri<span>Card</span></span>} />
        </footer>
      </article>

      <OFTStickyBar
        className={styles.stickyBar}
        whatsappClassName={styles.whatsappFab}
        qrClassName={styles.stickyQr}
        phoneClassName={styles.stickyPhone}
        businessName={business.name}
        phoneHref={phoneHref}
        whatsappHref={whatsappHref}
        qrCodeSrc={business.assets.qrCode}
      />
    </main>
  );
}

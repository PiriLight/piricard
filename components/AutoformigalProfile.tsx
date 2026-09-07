import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Facebook,
  Gauge,
  Instagram,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { AutoformigalStickyBar } from "@/components/AutoformigalStickyBar";
import { BusinessPhotoGallery } from "@/components/BusinessPhotoGallery";
import { ContactDownloadButton } from "@/components/ContactDownloadButton";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import { BusinessHoursSchedule, OpeningStatus, TodayHours } from "@/components/OpeningStatus";
import type { Business } from "@/lib/businesses";
import { getEmailHref, getMapsHref, getPhoneHref, getSafeExternalUrl, getWhatsAppHref } from "@/lib/links";
import { getPiriCardPdfFilename, getPiriCardPdfPath } from "@/lib/site";
import styles from "./AutoformigalProfile.module.css";

// Icons paired 1:1 with business.services (Reparação multimarca, Diagnóstico
// avançado, Manutenção automóvel), in that order — chosen to illustrate the
// verified service list, not to introduce new claims.
const serviceIcons = [Wrench, Gauge, ShieldCheck] as const;

// Themes repeated across Auto Formigal's real Google reviews (client-provided
// review evidence, 04.09.2026) — not invented, and deliberately a short list
// rather than every adjective mentioned once.
const reviewPraise = ["Profissionalismo", "Atendimento", "Honestidade", "Qualidade técnica"] as const;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("351") ? digits.slice(3) : digits;
  const formatted = local.length === 9 ? local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : value;
  return digits.startsWith("351") ? `+351 ${formatted}` : formatted;
}

function ExternalLink({ href, children, className, ariaLabel }: { href: string; children: ReactNode; className?: string; ariaLabel?: string }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>{children}</a>;
}

export function AutoformigalProfile({ business }: { business: Business }) {
  const phoneHref = getPhoneHref(business.contact.phone);
  const mapsHref = getMapsHref(business.location?.mapsUrl, business.location?.address);
  // No confirmed direct Google Reviews URL exists yet for Auto Formigal (see
  // the TODO on business.reviewUrl in lib/businesses.ts) — falling back to
  // the verified Maps address search rather than inventing a review link.
  // Google's own place page from that search is where a visitor reads and
  // writes reviews, so this stays honest and functional either way.
  const reviewHref = getSafeExternalUrl(business.reviewUrl) ?? getSafeExternalUrl(business.reviewWriteUrl) ?? mapsHref;
  const reviewWriteHref = getSafeExternalUrl(business.reviewWriteUrl) ?? reviewHref;
  const whatsappHref = getWhatsAppHref(business.contact.whatsapp);
  const instagramHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "instagram")?.url);
  const facebookHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "facebook")?.url);
  const contactFilename = getPiriCardPdfFilename(business.slug);
  const phone = business.contact.phone ? formatPhone(business.contact.phone) : undefined;
  const localPhone = phone?.replace(/^\+351\s/, "");
  const emailHref = getEmailHref(business.contact.email);
  const websiteHref = getSafeExternalUrl(business.contact.website);
  const reviewSnapshot = business.reviewSnapshot;
  const locationName = business.location?.city;
  const address = business.location?.address;
  const mapEmbedHref = address ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed` : undefined;

  return (
    <main className={`profile-layout ${styles.page}`}>
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
                  <Image src={business.assets.logo} alt={`Logótipo oficial de ${business.name}`} width={512} height={512} sizes="104px" />
                </div>
              ) : null}
              {reviewSnapshot ? (
                reviewHref ? (
                  <ExternalLink className={styles.ratingBadge} href={reviewHref} ariaLabel={`Ver avaliações de ${business.name}`}>
                    <strong>{reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                    <span aria-label={`${reviewSnapshot.rating} em 5 estrelas`}>★★★★★</span>
                    <small>{reviewSnapshot.count}</small>
                  </ExternalLink>
                ) : (
                  <div className={styles.ratingBadge} aria-label={`${reviewSnapshot.rating} em 5 estrelas, ${reviewSnapshot.count} avaliações no ${reviewSnapshot.source}`}>
                    <strong>{reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                    <span aria-hidden="true">★★★★★</span>
                    <small>{reviewSnapshot.count}</small>
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
            <a className={styles.actionPrimary} href={phoneHref} aria-label={`Ligar para ${business.name}`}>
              <span className={styles.actionIcon}><Phone aria-hidden="true" /></span>
              <span><strong>Ligar</strong>{localPhone ? <small>{localPhone}</small> : null}</span>
            </a>
          ) : null}
          {mapsHref ? (
            <ExternalLink className={styles.actionAccent} href={mapsHref} ariaLabel={`Obter direções para ${business.name}`}>
              <span className={styles.actionIcon}><Navigation aria-hidden="true" /></span>
              <span><strong>Como chegar</strong><small>Google Maps</small></span>
            </ExternalLink>
          ) : null}
          {reviewWriteHref ? (
            <ExternalLink href={reviewWriteHref} ariaLabel={`Deixar uma avaliação da ${business.name} no Google`}>
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

        <section className={styles.essentials} aria-labelledby="af-essentials-heading">
          <p className={styles.kicker} id="af-essentials-heading">Informação essencial</p>
          <dl className={styles.essentialGrid}>
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
            {websiteHref && business.contact.website ? (
              <div>
                <dt>Website</dt>
                <dd><ExternalLink href={websiteHref}>{business.contact.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</ExternalLink></dd>
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

        {business.services?.length ? (
          <section className={styles.services} aria-labelledby="af-services-heading">
            <div className={styles.sectionIntro}>
              <p className={styles.kicker}>O que fazemos</p>
              <h2 id="af-services-heading">Serviços</h2>
            </div>
            <ul className={styles.serviceGrid}>
              {business.services.map((service, index) => {
                const Icon = serviceIcons[index % serviceIcons.length];
                return (
                  <li key={service}>
                    <span className={styles.serviceIcon}><Icon aria-hidden="true" /></span>
                    <span>{service}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {(facebookHref || instagramHref) ? (
          <section className={styles.social} aria-labelledby="af-social-heading">
            <div>
              <p className={styles.kicker}>Redes sociais</p>
              <h2 id="af-social-heading">Acompanha a Auto Formigal</h2>
            </div>
            <nav className={styles.socialLinks} aria-label="Redes sociais da Auto Formigal">
              {instagramHref ? (
                <ExternalLink className={styles.instagramCard} href={instagramHref} ariaLabel={`${business.name} no Instagram`}>
                  <span className={styles.platformIcon}><Instagram aria-hidden="true" /></span>
                  <span><strong>Instagram</strong><small>@auto_formigal</small></span>
                  <ArrowUpRight aria-hidden="true" />
                </ExternalLink>
              ) : null}
              {facebookHref ? (
                <ExternalLink className={styles.facebookCard} href={facebookHref} ariaLabel={`${business.name} no Facebook`}>
                  <span className={styles.platformIcon}><Facebook aria-hidden="true" /></span>
                  <span><strong>Facebook</strong><small>Auto Formigal</small></span>
                  <ArrowUpRight aria-hidden="true" />
                </ExternalLink>
              ) : null}
            </nav>
          </section>
        ) : null}

        <section className={styles.about} aria-labelledby="af-about-heading">
          <p className={styles.kicker}>Sobre a Auto Formigal</p>
          <h2 id="af-about-heading">{business.positioning ?? business.profileDescription ?? business.name}</h2>
          {business.about?.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>

        <section className={styles.reviews} aria-labelledby="af-reviews-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>Reputação</p>
            <h2 id="af-reviews-heading">Avaliações</h2>
          </div>
          {reviewSnapshot ? (
            <div className={styles.reviewGrid}>
              <div className={styles.reviewScore}>
                <div className={styles.reviewScoreHead}>
                  <strong className={styles.reviewRating}>{reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                  <span className={styles.stars} aria-label={`${reviewSnapshot.rating} em 5 estrelas`}>
                    {Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden="true" />)}
                  </span>
                  <small>{reviewSnapshot.count} avaliações no {reviewSnapshot.source}</small>
                </div>
                <small className={styles.caveat}>Dados consultados em {reviewSnapshot.asOf}.</small>
                {/* Google does not publicly expose the exact per-star breakdown for
                    this listing, so this stays a truthful note rather than an
                    invented 5-star bar chart — accuracy over a fabricated graph. */}
                <p className={styles.distributionNote}>
                  A Google não disponibiliza publicamente a distribuição exata por número de estrelas para esta ficha —
                  por isso mostramos aqui apenas a pontuação e o total de avaliações verificados.
                </p>
              </div>
              <div className={styles.praise}>
                <p className={styles.kicker}>Mais elogiado</p>
                <ul>{reviewPraise.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          ) : (
            <p className={styles.reviewsCopy}>Consulta e deixa a tua avaliação da Auto Formigal no Google — ainda não temos aqui uma pontuação verificada para mostrar.</p>
          )}
          {(reviewWriteHref || reviewHref) ? (
            <div className={styles.reviewActions}>
              {reviewWriteHref ? (
                <ExternalLink className={styles.reviewWriteCta} href={reviewWriteHref} ariaLabel={`Deixar uma avaliação da ${business.name} no Google`}>
                  <Star aria-hidden="true" size={16} /> Deixar uma avaliação
                </ExternalLink>
              ) : null}
              {reviewHref ? <ExternalLink className={styles.reviewLink} href={reviewHref}>Ler as avaliações no Google <ArrowUpRight aria-hidden="true" /></ExternalLink> : null}
            </div>
          ) : null}
        </section>

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
          <section className={styles.gallery} aria-labelledby="af-gallery-heading">
            <p className={styles.kicker} id="af-gallery-heading">Galeria</p>
            <BusinessPhotoGallery businessName={business.name} images={business.gallery} />
          </section>
        ) : null}

        <section className={styles.contacts} aria-labelledby="af-contacts-heading">
          <p className={styles.kicker}>Fala connosco</p>
          <h2 id="af-contacts-heading">Contactos</h2>
          <div>
            {phoneHref && phone ? <a href={phoneHref}><small>Telefone</small><strong>{phone}</strong></a> : null}
            {emailHref && business.contact.email ? <a href={emailHref}><small>Email</small><strong>{business.contact.email}</strong></a> : null}
            {instagramHref ? <ExternalLink href={instagramHref}><small>Instagram</small><strong>@auto_formigal</strong></ExternalLink> : null}
            {facebookHref ? <ExternalLink href={facebookHref}><small>Facebook</small><strong>Auto Formigal</strong></ExternalLink> : null}
            {mapsHref && address ? <ExternalLink href={mapsHref}><small>Morada</small><strong>{business.location?.streetAddress ?? address}</strong></ExternalLink> : null}
          </div>
        </section>

        <footer className={`profile-layout-footer ${styles.footer}`}>
          <div><strong>{business.name}</strong><p>{address}{phone ? ` · ${phone}` : ""}</p></div>
          <PiriCardBrandMark wordmark={<span>Perfil criado com Piri<span>Card</span></span>} />
        </footer>
      </article>

      <AutoformigalStickyBar
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

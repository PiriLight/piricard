import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ArrowUpRight, Calendar, Facebook, Instagram, MapPin, Navigation, Phone } from "lucide-react";
import { ContactDownloadButton } from "@/components/ContactDownloadButton";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import { BusinessPhotoGallery } from "@/components/BusinessPhotoGallery";
import { BeautyTreatmentGroups } from "@/components/BeautyTreatmentGroups";
import { BeautyStickyBar } from "@/components/BeautyStickyBar";
import type { Business } from "@/lib/businesses";
import { getEmailHref, getMapsHref, getPhoneHref, getSafeExternalUrl, getWhatsAppHref } from "@/lib/links";
import { getPiriCardPdfFilename, getPiriCardPdfPath } from "@/lib/site";
import styles from "./BeautyConnection360Profile.module.css";

// Self-hosted via next/font, scoped to this component only — matches the
// Google Fonts pair used in the Claude Design reference (Cormorant Garamond
// for display/headings, Manrope for body copy) without affecting any other
// PiriCard profile.
const bcDisplay = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--bc-nf-display", display: "swap" });
const bcBody = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--bc-nf-body", display: "swap" });

// Prefilled WhatsApp opening message — used only once a verified WhatsApp
// number exists (see the contact note below); the message text itself is
// static UI copy, not business data.
const whatsappMessage = "Olá! Vi a Beauty Connection 360 no PiriCard e gostaria de mais informações.";

// Same helper (and +351-prefixed display format) already used by
// BusinessProfile/OFTRacingProfile — kept as a local copy rather than a
// shared import since each profile owns its own display formatting.
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("351") ? digits.slice(3) : digits;
  const formatted = local.length === 9 ? local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : value;
  return digits.startsWith("351") ? `+351 ${formatted}` : formatted;
}

export function BeautyConnection360Profile({ business }: { business: Business }) {
  const websiteHref = getSafeExternalUrl(business.contact.website);
  const instagramHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "instagram")?.url);
  const facebookHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "facebook")?.url);
  const phoneHref = getPhoneHref(business.contact.phone);
  const phoneDisplay = business.contact.phone ? formatPhone(business.contact.phone) : undefined;
  const emailHref = getEmailHref(business.contact.email);
  const whatsappBaseHref = getWhatsAppHref(business.contact.whatsapp);
  const whatsappHref = whatsappBaseHref ? `${whatsappBaseHref}?text=${encodeURIComponent(whatsappMessage)}` : undefined;
  const mapsHref = getMapsHref(business.location?.mapsUrl, business.location?.address);
  // Same no-API-key embed technique already used by OFTRacingProfile — a
  // Maps *search* keyed to the confirmed address, not a fabricated place ID.
  const mapEmbedHref = business.location?.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(business.location.address)}&z=16&output=embed`
    : undefined;
  // "Marcar consulta" has no confirmed booking link — Instagram is the closest
  // safe, single-sourced channel for a first contact.
  const bookHref = instagramHref;
  const contactFilename = getPiriCardPdfFilename(business.slug);
  const city = business.location?.city;
  const streetAddress = business.location?.streetAddress;

  return (
    <main className={`profile-layout ${styles.page} ${bcDisplay.variable} ${bcBody.variable}`}>
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
          {/* .heroImage is now just a positioning wrapper (overflow: visible)
              — the actual photo/fade/pill live in .heroImageFrame, which
              carries the aspect-ratio + overflow: hidden clip. The avatar is
              a direct child of the wrapper, absolutely positioned against
              its bottom edge with transform: translateY(50%) — anchored to
              the hero's own bottom edge instead of pulled up from the
              content below, so it's mathematically impossible for it to
              drift with unrelated spacing changes in .identity. */}
          <div className={styles.heroImage}>
            <div className={styles.heroImageFrame}>
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
              {city ? <span className={styles.locationPill}><MapPin aria-hidden="true" size={12} />{city}</span> : null}
            </div>
            {business.assets.logo ? (
              <div className={styles.logo}>
                <Image src={business.assets.logo} alt={`Logótipo de ${business.name}`} width={480} height={480} sizes="88px" />
              </div>
            ) : null}
          </div>

          <div className={styles.identity}>
            <div className={styles.identityTopline}>
              <span className={styles.categoryBadge}>{business.category}</span>
            </div>
            <h1>{business.name}</h1>
            {business.positioning ? <p className={styles.tagline}>{business.positioning}</p> : null}
            {streetAddress ? (
              <p className={styles.address}>
                {streetAddress}
                {city ? <span>2560-288 {city}</span> : null}
              </p>
            ) : city ? <p className={styles.address}>{city}</p> : null}
          </div>
        </header>

        <nav className={styles.quickActions} aria-label="Ações principais">
          {bookHref ? (
            <a className={styles.actionGold} href={bookHref} target="_blank" rel="noopener noreferrer" aria-label={`Marcar consulta com ${business.name} via Instagram`}>
              <span className={styles.actionIcon}><Calendar aria-hidden="true" /></span>
              <span><strong>Marcar consulta</strong><small>Via Instagram</small></span>
            </a>
          ) : null}
          {phoneHref && phoneDisplay ? (
            <a href={phoneHref} aria-label={`Ligar para ${business.name}`}>
              <span className={styles.actionIcon}><Phone aria-hidden="true" /></span>
              <span><strong>Ligar</strong><small>{phoneDisplay}</small></span>
            </a>
          ) : null}
          {mapsHref ? (
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" aria-label={`Obter direções para ${business.name}`}>
              <span className={styles.actionIcon}><Navigation aria-hidden="true" /></span>
              <span><strong>Como chegar</strong><small>Google Maps</small></span>
            </a>
          ) : null}
          <ContactDownloadButton
            businessName={business.name}
            endpoint={getPiriCardPdfPath(business.slug)}
            filename={contactFilename}
            className={styles.saveContact}
            label="Guardar contacto"
          />
        </nav>

        <section className={styles.essentials} aria-labelledby="bc-essentials-heading">
          <p className={styles.kicker} id="bc-essentials-heading">Informação essencial</p>
          <dl className={styles.essentialGrid}>
            <div>
              <dt>Categoria</dt>
              <dd>{business.category}</dd>
            </div>
            {streetAddress ? (
              <div>
                <dt>Morada</dt>
                <dd>
                  {mapsHref ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{streetAddress}</a> : streetAddress}
                  {city ? <small>2560-288 {city}</small> : null}
                </dd>
              </div>
            ) : null}
            {phoneHref && phoneDisplay ? (
              <div>
                <dt>Telefone</dt>
                <dd><a href={phoneHref}>{phoneDisplay}</a></dd>
              </div>
            ) : null}
            {emailHref ? (
              <div>
                <dt>Email</dt>
                <dd><a href={emailHref}>{business.contact.email}</a></dd>
              </div>
            ) : null}
            {/* Instagram intentionally omitted here — it already has its own
                dedicated Redes Sociais section below, so listing it twice
                was redundant. */}
            {websiteHref ? (
              <div>
                <dt>Website</dt>
                <dd><a href={websiteHref} target="_blank" rel="noopener noreferrer">beautyconnection360.com</a></dd>
              </div>
            ) : null}
          </dl>
        </section>

        {(instagramHref || facebookHref) ? (
          <section className={styles.social} aria-labelledby="bc-social-heading">
            <p className={styles.kicker} id="bc-social-heading">Redes sociais</p>
            <div className={styles.socialGrid}>
              {instagramHref ? (
                <a className={styles.socialInstagram} href={instagramHref} target="_blank" rel="noopener noreferrer" aria-label={`${business.name} no Instagram`}>
                  <span className={styles.socialIcon}><Instagram aria-hidden="true" /></span>
                  <span><strong>Instagram</strong><small>@beauty_connection360</small></span>
                  <ArrowUpRight aria-hidden="true" size={16} className={styles.socialArrow} />
                </a>
              ) : null}
              {facebookHref ? (
                <a className={styles.socialFacebook} href={facebookHref} target="_blank" rel="noopener noreferrer" aria-label={`${business.name} no Facebook`}>
                  <span className={styles.socialIcon}><Facebook aria-hidden="true" /></span>
                  <span><strong>Facebook</strong><small>Beautyconnection360</small></span>
                  <ArrowUpRight aria-hidden="true" size={16} className={styles.socialArrow} />
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={styles.aboutDark} aria-labelledby="bc-about-heading">
          <p className={styles.kicker} id="bc-about-heading">Sobre</p>
          {business.about?.heading ? <h2 className={styles.aboutQuote}>{business.about.heading}</h2> : null}
          {business.about?.paragraphs?.map((paragraph, index) => <p className={styles.aboutCopy} key={index}>{paragraph}</p>)}
          <div className={styles.pillars}>
            <span>Personalização</span>
            <span>Inovação</span>
            <span>Bem-Estar</span>
          </div>

          <div className={styles.diagnosisCard}>
            <p className={styles.kicker}>A sua experiência começa aqui</p>
            <h3 id="bc-diagnosis-heading">Diagnóstico &amp; Conexão Inicial</h3>
            <p>Uma avaliação profunda de corpo, rosto, energia e estilo de vida — o ponto de partida para um Plano de Transformação Personalizado.</p>
            {/* Reuses the exact same whatsappHref the floating WhatsApp button
                uses (same number, same prefilled whatsappMessage, same
                encoding) — this CTA just opens that same conversation
                instead of Instagram; only the click target changed, not the
                visible "Pedir avaliação personalizada" copy or gold styling. */}
            {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer">Pedir avaliação personalizada</a> : null}
          </div>
        </section>

        <section className={styles.treatments} aria-labelledby="bc-treatments-heading">
          <p className={styles.kicker} id="bc-treatments-heading">Tratamentos &amp; Serviços</p>
          <BeautyTreatmentGroups groups={business.treatmentGroups ?? []} className={styles.treatmentGroups} itemClassName={styles.treatmentGroup} />
        </section>

        <section className={styles.gallery} aria-labelledby="bc-gallery-heading">
          <p className={styles.kicker} id="bc-gallery-heading">O nosso espaço</p>
          <BusinessPhotoGallery businessName={business.name} images={business.gallery ?? []} />
        </section>

        <section className={styles.location} aria-labelledby="bc-location-heading">
          <p className={styles.kicker} id="bc-location-heading">Localização</p>
          <h2 className={styles.locationHeading}>Visite o nosso espaço</h2>
          {streetAddress ? (
            <div className={styles.locationAddress}>
              <strong>{streetAddress}</strong>
              {city ? <span>2560-288 {city}</span> : null}
            </div>
          ) : null}
          <div className={styles.mapCard}>
            {mapEmbedHref ? (
              <iframe
                title={`Mapa da ${business.name} em ${city ?? "Portugal"}`}
                src={mapEmbedHref}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : null}
            {mapsHref ? (
              <a className={styles.directionsButton} href={mapsHref} target="_blank" rel="noopener noreferrer" aria-label={`Obter direções para ${business.name}`}>
                <span>Como chegar</span><Navigation aria-hidden="true" size={17} />
              </a>
            ) : null}
          </div>
        </section>

        <section className={styles.closing}>
          <h3>“Não é apenas um serviço. É uma experiência de transformação.”</h3>
          <p>{business.positioning}</p>
          {bookHref ? <a href={bookHref} target="_blank" rel="noopener noreferrer">Marcar consulta</a> : null}
        </section>

        <footer className={`profile-layout-footer ${styles.footer}`}>
          <div><strong>{business.name}</strong><p>{business.category}</p></div>
          <PiriCardBrandMark wordmark={<span>Perfil criado com Piri<span>Card</span></span>} />
        </footer>
      </article>

      <BeautyStickyBar
        className={styles.stickyBar}
        whatsappClassName={styles.stickyWhatsapp}
        phoneClassName={styles.stickyGold}
        qrClassName={styles.stickyCall}
        businessName={business.name}
        phoneHref={phoneHref}
        whatsappHref={whatsappHref}
        qrCodeSrc={business.assets.qrCode}
      />
    </main>
  );
}

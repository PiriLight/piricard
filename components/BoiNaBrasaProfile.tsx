import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowUpRight, Bike, ChevronRight, Facebook, Instagram, Leaf, MapPin, Navigation, Phone, Star } from "lucide-react";
import { BusinessPhotoGallery } from "@/components/BusinessPhotoGallery";
import { ContactDownloadButton } from "@/components/ContactDownloadButton";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import { BoiNaBrasaStickyBar } from "@/components/BoiNaBrasaStickyBar";
import { TripAdvisorMark } from "@/components/icons/TripAdvisorMark";
import { BusinessHoursSchedule, OpeningStatus, TodayHours } from "@/components/OpeningStatus";
import type { Business } from "@/lib/businesses";
import { getMapsHref, getPhoneHref, getSafeExternalUrl, getWhatsAppHref } from "@/lib/links";
import { getPiriCardPdfFilename, getPiriCardPdfPath } from "@/lib/site";
import styles from "./BoiNaBrasaProfile.module.css";

const directionsUrl = "https://www.google.com/maps/dir/?api=1&destination=39.0916177,-9.2583152&destination_place_id=ChIJ7z4J8GDQ8Q0RzV0PksFzKaI";

const praise = [
  "Carne macia e no ponto",
  "Batata frita caseira",
  "Sobremesas caseiras",
  "Relação preço/refeição",
  "Atendimento próximo",
  "Espaço limpo e tranquilo",
] as const;

const ratingDistribution = [
  { stars: 5, count: 77 },
  { stars: 4, count: 13 },
  { stars: 3, count: 1 },
  { stars: 2, count: 1 },
  { stars: 1, count: 3 },
] as const;

function ExternalLink({ href, children, className, ariaLabel }: { href: string; children: React.ReactNode; className?: string; ariaLabel?: string }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>{children}</a>;
}

// Same helper (and +351-prefixed display format) already used by
// BusinessProfile/AutoformigalProfile/OFTRacingProfile — kept as a local
// copy rather than a shared import since each profile owns its own display
// formatting (see Phase 1 data-hygiene notes; consolidating this is Phase 2).
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("351") ? digits.slice(3) : digits;
  const formatted = local.length === 9 ? local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : value;
  return digits.startsWith("351") ? `+351 ${formatted}` : formatted;
}

export function BoiNaBrasaProfile({ business }: { business: Business }) {
  const phoneHref = getPhoneHref(business.contact.phone) ?? "tel:+351261063480";
  const mapsHref = getMapsHref(business.location?.mapsUrl, business.location?.address) ?? directionsUrl;
  const reviewSnapshot = business.reviewSnapshot;
  const reviewHref = business.reviewUrl ?? mapsHref;
  // Direct Google review composer (1–5 stars + text field) — distinct from
  // reviewHref above, which stays the "read existing reviews" destination.
  const reviewWriteHref = getSafeExternalUrl(business.reviewWriteUrl) ?? reviewHref;
  const whatsappHref = getWhatsAppHref(business.contact.whatsapp ?? business.contact.phone);
  const tripAdvisorHref = getSafeExternalUrl(business.externalLinks?.tripAdvisor);
  const deliveryUrl = getSafeExternalUrl(business.externalLinks?.delivery);
  const collectionUrl = getSafeExternalUrl(business.externalLinks?.collection);
  const facebookHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "facebook")?.url);
  const instagramHref = getSafeExternalUrl(business.socialLinks?.find((link) => link.platform === "instagram")?.url);
  const contactFilename = getPiriCardPdfFilename(business.slug);
  const phone = business.contact.phone ? formatPhone(business.contact.phone) : undefined;
  const localPhone = phone?.replace(/^\+351\s/, "");
  const city = business.location?.city;
  const streetAddress = business.location?.streetAddress;
  const address = business.location?.address;
  const restaurantInfo = business.restaurantInfo;

  // Same shape as before (label/value/note/href) — phone and street address
  // derive from business.* (Phase 1); average spend/cuisine now derive from
  // business.restaurantInfo (Phase 2) instead of being hardcoded here.
  const essentialInformation: Array<{ label: string; value: string; note?: string; href?: string }> = [
    { label: "Telefone e reservas", value: phone ?? "+351 261 063 480", note: "reservas por telefone · grupos bem-vindos", href: phoneHref },
    { label: "Morada", value: streetAddress ?? "Rua 1.º de Dezembro 5", note: "2560-300 Torres Vedras · centro da cidade" },
    ...(restaurantInfo?.averageSpend ? [{ label: "Preço médio", value: restaurantInfo.averageSpend, note: restaurantInfo.averageSpendNote }] : []),
    ...(restaurantInfo?.cuisine ? [{ label: "Cozinha", value: restaurantInfo.cuisine, note: restaurantInfo.cuisineNote }] : []),
  ];

  return (
    <main className={`profile-layout ${styles.page}`}>
      <article className={`profile-layout-shell ${styles.shell}`}>
        <nav className={styles.platformBar} aria-label="Navegação PiriCard">
          <Link className={styles.platformBrand} href="/" aria-label="PiriCard — ir para o diretório">
            <PiriCardBrandMark wordmark={<strong>Piri<em>Card</em></strong>} />
          </Link>
          <div className={styles.platformActions}>
            <Link href="/">Diretório <ArrowUpRight aria-hidden="true" size={14} /></Link>
            <ContactDownloadButton
              businessName={business.name}
              endpoint={getPiriCardPdfPath(business.slug)}
              filename={contactFilename}
              className={styles.saveContact}
              label="Guardar contacto"
            />
          </div>
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
            <span className={styles.locationPill}><MapPin aria-hidden="true" size={12} />{city} · Centro</span>
          </div>

          <div className={styles.identity}>
            <div className={styles.identityTopline}>
              {business.assets.logo ? (
                <div className={styles.logo}>
                  <Image src={business.assets.logo} alt={`Logótipo do ${business.name}`} width={1242} height={1242} sizes="104px" />
                </div>
              ) : null}
              {reviewSnapshot ? (
                <ExternalLink className={styles.ratingBadge} href={reviewHref} ariaLabel={`Ver avaliações de ${business.name}`}>
                  <strong>{reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                  <span aria-label={`${reviewSnapshot.rating} em 5 estrelas`}>★★★★★</span>
                  <small>{reviewSnapshot.count}</small>
                </ExternalLink>
              ) : null}
            </div>
            <h1>{business.name}</h1>
            <p className={styles.subtitle}>{business.category} · Grelhados luso-brasileiros</p>
            <p className={styles.address}>{streetAddress}{city ? `, ${city}` : ""}</p>
            {business.hours?.length ? (
              <div className={styles.liveStatus}>
                <OpeningStatus hours={business.hours} />
                <TodayHours hours={business.hours} />
              </div>
            ) : null}
          </div>
        </header>

        <nav className={styles.quickActions} aria-label="Ações rápidas">
          <a className={styles.actionDark} href={phoneHref}><strong>Ligar</strong><small>{localPhone}</small><Phone aria-hidden="true" /></a>
          <ExternalLink className={styles.actionDirections} href={directionsUrl}><strong>Como chegar</strong><small>Google Maps</small><Navigation aria-hidden="true" /></ExternalLink>
          <ExternalLink className={styles.actionReview} href={reviewWriteHref} ariaLabel={`Deixar uma avaliação da ${business.name} no Google`}>
            <strong>Deixar avaliação</strong><small>Google</small><Star aria-hidden="true" />
          </ExternalLink>
          {tripAdvisorHref ? (
            <ExternalLink className={styles.actionTripAdvisor} href={tripAdvisorHref}><strong>TripAdvisor</strong><small>Deixar avaliação</small><TripAdvisorMark aria-hidden="true" /></ExternalLink>
          ) : (
            <span className={`${styles.actionTripAdvisor} ${styles.actionUnavailable}`} aria-disabled="true"><strong>TripAdvisor</strong><small>Perfil a confirmar</small><TripAdvisorMark aria-hidden="true" /></span>
          )}
        </nav>

        <section className={styles.essentials} aria-labelledby="essentials-heading">
          <p className={styles.kicker} id="essentials-heading">Informação essencial</p>
          <dl className={styles.essentialGrid}>
            {essentialInformation.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{"href" in item ? <a href={item.href}>{item.value}</a> : item.value}<small>{item.note}</small></dd>
              </div>
            ))}
          </dl>
          {business.services?.length ? <ul className={styles.serviceTags}>{business.services.map((service) => <li key={service}>{service}</li>)}</ul> : null}
        </section>

        <section className={styles.social} aria-labelledby="social-heading">
          <h2 id="social-heading">Segue-nos nas redes sociais</h2>
          <div className={styles.socialLinks}>
            {facebookHref ? (
              <ExternalLink className={styles.facebookButton} href={facebookHref}>
                <Facebook aria-hidden="true" />
                <span>Seguir no Facebook</span>
              </ExternalLink>
            ) : null}
            {instagramHref ? (
              <ExternalLink className={styles.instagramButton} href={instagramHref}>
                <Instagram aria-hidden="true" />
                <span>Seguir no Instagram</span>
              </ExternalLink>
            ) : null}
          </div>
        </section>

        <section className={styles.about} aria-labelledby="about-heading">
          <h2 id="about-heading">{business.about?.heading}</h2>
          {business.about?.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>

        <section className={styles.menu} id="ementa" aria-labelledby="menu-heading">
          <div className={styles.sectionIntro}>
            <h2 id="menu-heading">Da brasa e da casa</h2>
            <span>menu atualizado pelo restaurante</span>
          </div>
          {business.menu?.map((section) => (
            <Fragment key={section.title}>
              <h3>{section.title}</h3>
              <ul className={styles.menuList}>
                {section.items.map((item) => <li key={item.name}><strong>{item.name}</strong>{item.price ? <b>{item.price}</b> : null}</li>)}
              </ul>
            </Fragment>
          ))}
          <div className={styles.menuLinks}>
            {deliveryUrl ? <ExternalLink className={styles.glovoButton} href={deliveryUrl}><span>Pedir online na Glovo</span><Bike aria-hidden="true" /></ExternalLink> : null}
            {collectionUrl ? <ExternalLink className={styles.tooGoodToGoButton} href={collectionUrl}><span>Recolha na Too Good To Go</span><Leaf aria-hidden="true" /></ExternalLink> : null}
          </div>
          <p className={styles.menuDisclaimer}>Os preços de entrega podem diferir dos preços praticados no restaurante.</p>
        </section>

        <section className={styles.reviews} aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">Avaliações</h2>
          <div className={styles.reviewGrid}>
            <div className={styles.reviewScore}>
              {reviewSnapshot ? (
                <div>
                  <strong>{reviewSnapshot.rating.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}</strong>
                  <span aria-label={`${reviewSnapshot.rating} em 5 estrelas`}>★★★★★</span>
                  <small>{reviewSnapshot.count} críticas<br />{reviewSnapshot.source} · {reviewSnapshot.asOf}</small>
                </div>
              ) : (
                <p className={styles.kicker}>Ainda não temos aqui uma pontuação verificada para mostrar.</p>
              )}
              {reviewSnapshot ? (
                <ul>
                  {ratingDistribution.map((row) => <li key={row.stars}><span>{row.stars}</span><i><b style={{ width: `${Math.round((row.count / reviewSnapshot.count) * 100)}%` }} /></i><span>{row.count}</span></li>)}
                </ul>
              ) : null}
            </div>
            <div className={styles.praise}>
              <p className={styles.kicker}>Mais elogiado</p>
              <ul>{praise.map((item) => <li key={item}>{item}</li>)}</ul>
              <div className={styles.secondaryRatings}><span><strong>100 %</strong><small>recomendam na Glovo · 16</small></span><span><strong>4,8</strong><small>Too Good To Go</small></span></div>
              <div className={styles.reviewActions}>
                <ExternalLink className={styles.reviewWriteCta} href={reviewWriteHref} ariaLabel={`Deixar uma avaliação do ${business.name} no Google`}>
                  <Star aria-hidden="true" size={16} /> Deixar uma avaliação no Google
                </ExternalLink>
                <ExternalLink className={styles.reviewLink} href={reviewHref}>Ler as avaliações no Google <ChevronRight aria-hidden="true" size={15} /></ExternalLink>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.visit} aria-label="Horário e localização">
          <div>
            <h2>Horário</h2>
            {business.hours?.length ? <BusinessHoursSchedule hours={business.hours} /> : null}
            <p className={styles.caveat}>Consulte o horário atualizado antes da visita. Horários especiais e feriados podem variar.</p>
          </div>
          <div>
            <h2>Localização</h2>
            <div className={styles.mapCard}>
              <iframe title={`Mapa do ${business.name} em ${city ?? "Torres Vedras"}`} src="https://maps.google.com/maps?q=39.0916177,-9.2583152&z=17&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <div><p>{address}</p><small>Plus Code 3PRR+JM · estacionamento público pago nas proximidades</small><ExternalLink href={directionsUrl}>Como chegar</ExternalLink></div>
            </div>
          </div>
        </section>

        {business.gallery?.length ? (
          <section className={styles.gallery} aria-labelledby="bnb-gallery-heading">
            <p className={styles.kicker} id="bnb-gallery-heading">Galeria</p>
            <BusinessPhotoGallery businessName={business.name} images={business.gallery} />
          </section>
        ) : null}

        <section className={styles.contacts} aria-labelledby="contacts-heading">
          <h2 id="contacts-heading">Contactos</h2>
          <div>
            <a href={phoneHref}><small>Telefone e reservas</small><strong>{phone}</strong></a>
            {deliveryUrl ? <ExternalLink href={deliveryUrl}><small>Entrega</small><strong>Glovo</strong></ExternalLink> : null}
            {collectionUrl ? <ExternalLink href={collectionUrl}><small>Recolha</small><strong>Too Good To Go</strong></ExternalLink> : null}
            <ExternalLink href={mapsHref}><small>Ficha e mapa</small><strong>Google Maps</strong></ExternalLink>
          </div>
        </section>

        <footer className={`profile-layout-footer ${styles.footer}`}>
          <div><strong>{business.name} · {business.category}</strong><p>{address}{phone ? ` · ${phone}` : ""}</p></div>
          <p>Perfil PiriCard criado por PiriLight Studio</p>
        </footer>
      </article>

      <BoiNaBrasaStickyBar
        className={styles.stickyBar}
        whatsappClassName={styles.stickyWhatsapp}
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

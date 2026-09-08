import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  ExternalLink,
  Facebook,
  Globe2,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { ContactDownloadButton } from "@/components/ContactDownloadButton";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import { AutoformigalProfile } from "@/components/AutoformigalProfile";
import { BoiNaBrasaProfile } from "@/components/BoiNaBrasaProfile";
import { OFTRacingProfile } from "@/components/OFTRacingProfile";
import { BeautyConnection360Profile } from "@/components/BeautyConnection360Profile";
import { BusinessPhotoGallery } from "@/components/BusinessPhotoGallery";
import { BusinessHoursSchedule, OpeningStatus, TodayHours } from "@/components/OpeningStatus";
import { ProfileActions } from "@/components/ProfileActions";
import { StickyProfileActions } from "@/components/StickyProfileActions";
import type { Business } from "@/lib/businesses";
import { getEmailHref, getMapsHref, getPhoneHref, getSafeExternalUrl, getWhatsAppHref } from "@/lib/links";
import { getCanonicalProfileUrl, getPiriCardPdfFilename, getPiriCardPdfPath } from "@/lib/site";

interface ProfileStyle extends CSSProperties {
  "--profile-primary": string;
  "--profile-secondary": string;
  "--profile-accent": string;
  "--profile-bg": string;
  "--profile-surface": string;
  "--profile-text": string;
  "--profile-muted": string;
  "--profile-border": string;
}

interface ProfileLinks {
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  maps?: string;
}

const socialIcons = { instagram: Instagram, facebook: Facebook };

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("351") ? digits.slice(3) : digits;
  const formatted = local.length === 9 ? local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : value;
  return digits.startsWith("351") ? `+351 ${formatted}` : formatted;
}

function displayUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value;
  }
}

function PiriCardTopBar() {
  return (
    <header className="profile-topbar">
      <Link className="profile-platform" href="/" aria-label="PiriCard — ir para o diretório">
        <PiriCardBrandMark wordmark={<span>Piri<span>Card</span></span>} />
      </Link>
      <Link className="profile-directory-link" href="/"><span>Diretório</span><ArrowUpRight aria-hidden="true" size={16} /></Link>
    </header>
  );
}

function BusinessIdentity({ business }: { business: Business }) {
  return (
    <section className="profile-identity" aria-labelledby="profile-name">
      {business.assets.cover ? (
        <div className="profile-cover">
          <Image
            src={business.assets.cover}
            alt={business.assets.coverAlt ?? `Exterior de ${business.name}`}
            fill
            loading="eager"
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 720px, 660px"
          />
        </div>
      ) : <div className="profile-brand-lines" aria-hidden="true" />}
      <div className="profile-identity-body">
        {business.assets.logo ? (
          <div className="profile-logo">
            <Image src={business.assets.logo} alt={`Logótipo oficial de ${business.name}`} width={1024} height={1024} sizes="100px" />
          </div>
        ) : null}
        <div className="profile-identity-copy">
          <h1 id="profile-name">{business.name}</h1>
          <p className="profile-category">{business.category}</p>
          <div className="profile-location-status">
            {business.location?.city ? <span className="profile-location"><MapPin aria-hidden="true" size={18} />{business.location.city}</span> : null}
            {business.hours?.length ? <OpeningStatus hours={business.hours} /> : null}
          </div>
          {business.profileDescription ? <p className="profile-description">{business.profileDescription}</p> : null}
        </div>
      </div>
    </section>
  );
}

function BusinessDetails({ business, links }: { business: Business; links: ProfileLinks }) {
  return (
    <div className="profile-direct-details" aria-label="Contactos diretos">
      {links.phone && business.contact.phone ? (
        <a href={links.phone} aria-label={`Ligar para ${formatPhone(business.contact.phone)}`}>
          <span className="profile-detail-icon"><Phone aria-hidden="true" size={20} /></span>
          <span><small>Telefone</small><strong>{formatPhone(business.contact.phone)}</strong></span>
          <ChevronRight aria-hidden="true" size={18} />
        </a>
      ) : null}
      {links.email && business.contact.email ? (
        <a href={links.email} aria-label={`Enviar email para ${business.contact.email}`}>
          <span className="profile-detail-icon"><Mail aria-hidden="true" size={20} /></span>
          <span><small>Email</small><strong>{business.contact.email}</strong></span>
          <ChevronRight aria-hidden="true" size={18} />
        </a>
      ) : null}
    </div>
  );
}

function BusinessActions({ business, links, contactFilename }: { business: Business; links: ProfileLinks; contactFilename: string }) {
  return (
    <nav id="profile-main-actions" className="profile-main-actions" aria-label="Ações essenciais">
      {links.phone ? <a className="is-primary" href={links.phone} aria-label={`Ligar para ${business.name}`}><Phone aria-hidden="true" size={22} /><span>Ligar</span></a> : null}
      <div className="profile-secondary-actions">
        {links.maps ? <a href={links.maps} target="_blank" rel="noopener noreferrer" aria-label={`Obter direções para ${business.name}`}><Navigation aria-hidden="true" size={21} /><span>Como chegar</span></a> : null}
        <ContactDownloadButton businessName={business.name} endpoint={getPiriCardPdfPath(business.slug)} filename={contactFilename} />
        {links.whatsapp ? <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`Contactar ${business.name} por WhatsApp`}><MessageCircle aria-hidden="true" size={21} /><span>WhatsApp</span></a> : null}
      </div>
    </nav>
  );
}

function InformationRow({ icon, label, children, href, external = false }: { icon: ReactNode; label: string; children: ReactNode; href?: string; external?: boolean }) {
  const content = <><span className="profile-info-icon">{icon}</span><span className="profile-info-copy"><small>{label}</small><strong>{children}</strong></span>{href ? <ChevronRight className="profile-info-arrow" aria-hidden="true" size={18} /> : null}</>;
  return href ? <a className="profile-info-row" href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{content}</a> : <div className="profile-info-row">{content}</div>;
}

function BusinessInformation({ business, links, canonicalUrl, contactFilename }: { business: Business; links: ProfileLinks; canonicalUrl: string; contactFilename: string }) {
  return (
    <section className="profile-information" aria-labelledby="information-heading">
      <div className="profile-section-heading"><h2 id="information-heading">Informação útil</h2><span aria-hidden="true" /></div>
      <div className="profile-info-list">
        {links.website ? <InformationRow icon={<Globe2 aria-hidden="true" size={21} />} label="Website" href={links.website} external>{displayUrl(links.website)}</InformationRow> : null}
        {links.maps && business.location?.address ? <InformationRow icon={<MapPin aria-hidden="true" size={21} />} label="Morada" href={links.maps} external>{business.location.address}</InformationRow> : null}
        {business.hours?.length ? <InformationRow icon={<Clock3 aria-hidden="true" size={21} />} label="Horário de hoje" href="#horario"><TodayHours hours={business.hours} /></InformationRow> : null}
      </div>

      {business.services?.length ? <section className="profile-information-block" aria-labelledby="services-heading"><h3 id="services-heading">Serviços</h3><ul className="profile-services">{business.services.map((service) => <li key={service}>{service}</li>)}</ul></section> : null}
      {business.hours?.length ? <section className="profile-information-block" id="horario" aria-labelledby="hours-heading"><h3 id="hours-heading">Horário</h3><BusinessHoursSchedule hours={business.hours} /></section> : null}
      {business.socialLinks?.length ? (
        <section className="profile-information-block" aria-labelledby="social-heading">
          <h3 id="social-heading">Redes sociais</h3>
          <nav className="profile-socials" aria-label="Redes sociais">
            {business.socialLinks.map((social) => {
              const href = getSafeExternalUrl(social.url);
              if (!href) return null;
              const Icon = socialIcons[social.platform as keyof typeof socialIcons] ?? ExternalLink;
              return <a href={href} key={social.platform} target="_blank" rel="noopener noreferrer"><Icon aria-hidden="true" size={20} /><span>{social.label}</span><ArrowUpRight aria-hidden="true" size={16} /></a>;
            })}
          </nav>
        </section>
      ) : null}

      {business.gallery?.length ? (
        <section className="profile-information-block profile-gallery-section" aria-labelledby="gallery-heading">
          <h3 id="gallery-heading">Galeria</h3>
          <BusinessPhotoGallery businessName={business.name} images={business.gallery} />
        </section>
      ) : null}

      {/* Phase 4H.5: this used to also render an obsolete duplicate-contact
          flip-card widget — a redundant restatement of the phone/email/
          website/address already shown above, no longer part of the
          product; its component file was deleted. The class name below
          stays as the existing CSS hook (grid placement + spacing at
          various breakpoints) for this actions row, not a UI label. */}
      <section className="profile-digital-tools" aria-label="Ações do perfil">
        <ProfileActions businessName={business.name} canonicalUrl={canonicalUrl} slug={business.slug} contactFilename={contactFilename} digitalCard={business.digitalCard} showContact={false} />
      </section>
    </section>
  );
}

function PiriCardFooter() {
  return (
    <footer className="profile-footer profile-layout-footer">
      <span>Perfil criado com <strong>Piri</strong><b>Card</b></span>
      <a href="https://piricard.pt" target="_blank" rel="noopener noreferrer">piricard.pt</a>
    </footer>
  );
}

export function BusinessProfile({ business }: { business: Business }) {
  if (business.layoutVariant === "restaurant") {
    return <BoiNaBrasaProfile business={business} />;
  }

  if (business.layoutVariant === "racing") {
    return <OFTRacingProfile business={business} />;
  }

  if (business.layoutVariant === "beauty") {
    return <BeautyConnection360Profile business={business} />;
  }

  if (business.layoutVariant === "workshop") {
    return <AutoformigalProfile business={business} />;
  }

  const canonicalUrl = getCanonicalProfileUrl(business.slug);
  const contactFilename = getPiriCardPdfFilename(business.slug);
  const links: ProfileLinks = {
    phone: getPhoneHref(business.contact.phone),
    whatsapp: getWhatsAppHref(business.contact.whatsapp),
    email: getEmailHref(business.contact.email),
    website: getSafeExternalUrl(business.contact.website),
    maps: getMapsHref(business.location?.mapsUrl, business.location?.address),
  };
  const style: ProfileStyle = {
    "--profile-primary": business.theme.primary,
    "--profile-secondary": business.theme.secondary,
    "--profile-accent": business.theme.accent,
    "--profile-bg": business.theme.background,
    "--profile-surface": business.theme.surface,
    "--profile-text": business.theme.text,
    "--profile-muted": business.theme.mutedText,
    "--profile-border": business.theme.border,
  };

  return (
    <main className={`profile-layout profile-page profile-font-${business.theme.fontFamily}`} style={style}>
      <article className="profile-shell profile-layout-shell">
        <PiriCardTopBar />
        <BusinessIdentity business={business} />
        <BusinessDetails business={business} links={links} />
        <BusinessActions business={business} links={links} contactFilename={contactFilename} />
        <BusinessInformation business={business} links={links} canonicalUrl={canonicalUrl} contactFilename={contactFilename} />
        <PiriCardFooter />
      </article>
      <StickyProfileActions businessName={business.name} phone={links.phone} whatsapp={links.whatsapp} maps={links.maps} />
    </main>
  );
}

import { getSafeExternalUrl } from "@/lib/links";
import type { Business } from "@/lib/businesses";
import type { BusinessConfigPayload, BusinessCoreSavePayload, ModuleContentSavePayload } from "@/lib/admin/business-mapping";
import { isReservedSlug, toModuleContentSavePayload } from "@/lib/admin/business-mapping";
import { isAvailableLayout } from "@/lib/admin/layout-registry";

/**
 * Isomorphic validation for the core editor's save payload — imported by
 * both the client editor (instant feedback) and the save server action
 * (defense-in-depth; the action must never trust client-side validation
 * alone, per the Server Actions security model).
 */

export interface BusinessCoreFieldErrors {
  name?: string;
  category?: string;
  directoryDescription?: string;
  email?: string;
  website?: string;
  hours?: Record<number, string>;
  socialLinks?: Record<number, string>;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateBusinessCore(payload: BusinessCoreSavePayload): BusinessCoreFieldErrors | null {
  const errors: BusinessCoreFieldErrors = {};

  if (!payload.content.name) errors.name = "O nome é obrigatório.";
  if (!payload.content.category) errors.category = "A categoria é obrigatória.";
  if (!payload.content.directoryDescription) {
    errors.directoryDescription = "A descrição do diretório é obrigatória.";
  }
  if (payload.content.email && !EMAIL_PATTERN.test(payload.content.email)) {
    errors.email = "Email inválido.";
  }
  if (payload.content.website && !getSafeExternalUrl(payload.content.website)) {
    errors.website = "Website inválido (usa http:// ou https://).";
  }

  const hourErrors: Record<number, string> = {};
  payload.hours.forEach((entry, index) => {
    for (const period of entry.periods) {
      if (!TIME_PATTERN.test(period.open) || !TIME_PATTERN.test(period.close)) {
        hourErrors[index] = "Hora inválida (usa HH:MM).";
      }
    }
  });
  if (Object.keys(hourErrors).length) errors.hours = hourErrors;

  const socialErrors: Record<number, string> = {};
  payload.socialLinks.forEach((link, index) => {
    if (!link.url || !getSafeExternalUrl(link.url)) {
      socialErrors[index] = "URL inválido (usa http:// ou https://).";
    }
  });
  if (Object.keys(socialErrors).length) errors.socialLinks = socialErrors;

  return Object.keys(errors).length ? errors : null;
}

export const GALLERY_MAX_ITEMS = 5;

export interface ModuleContentFieldErrors {
  gallery?: string;
  galleryItems?: Record<number, string>;
  menuSections?: Record<number, string>;
  menuItems?: Record<string, string>;
  treatmentGroups?: Record<number, string>;
  treatmentItems?: Record<string, string>;
}

/**
 * Validates module CONTENT only (not activation, not membership/module-gate
 * checks — those live server-side in the RPCs themselves, the actual
 * enforcement boundary). This is the same "existing domain fields only, no
 * freeform JSON" shape check on both the client (instant feedback) and the
 * save action (defense-in-depth).
 */
export function validateModuleContent(payload: ModuleContentSavePayload): ModuleContentFieldErrors | null {
  const errors: ModuleContentFieldErrors = {};

  if (payload.gallery.length > GALLERY_MAX_ITEMS) {
    errors.gallery = `A galeria permite no máximo ${GALLERY_MAX_ITEMS} imagens.`;
  }
  const galleryItemErrors: Record<number, string> = {};
  payload.gallery.forEach((item, index) => {
    if (!item.alt) galleryItemErrors[index] = "Texto alternativo obrigatório.";
  });
  if (Object.keys(galleryItemErrors).length) errors.galleryItems = galleryItemErrors;

  const menuSectionErrors: Record<number, string> = {};
  const menuItemErrors: Record<string, string> = {};
  payload.menu.forEach((section, sectionIndex) => {
    if (!section.title) menuSectionErrors[sectionIndex] = "Título da secção obrigatório.";
    section.items.forEach((item, itemIndex) => {
      if (!item.name) menuItemErrors[`${sectionIndex}.${itemIndex}`] = "Nome do prato obrigatório.";
    });
  });
  if (Object.keys(menuSectionErrors).length) errors.menuSections = menuSectionErrors;
  if (Object.keys(menuItemErrors).length) errors.menuItems = menuItemErrors;

  const treatmentGroupErrors: Record<number, string> = {};
  const treatmentItemErrors: Record<string, string> = {};
  payload.treatmentGroups.forEach((group, groupIndex) => {
    if (!group.title) treatmentGroupErrors[groupIndex] = "Título do grupo obrigatório.";
    group.items.forEach((item, itemIndex) => {
      if (!item) treatmentItemErrors[`${groupIndex}.${itemIndex}`] = "Item vazio.";
    });
  });
  if (Object.keys(treatmentGroupErrors).length) errors.treatmentGroups = treatmentGroupErrors;
  if (Object.keys(treatmentItemErrors).length) errors.treatmentItems = treatmentItemErrors;

  return Object.keys(errors).length ? errors : null;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function validateSlug(slug: string): string | null {
  if (!slug) return "O slug é obrigatório.";
  if (slug !== slug.toLowerCase()) return "O slug deve estar em minúsculas.";
  if (!SLUG_PATTERN.test(slug)) return "Usa apenas letras minúsculas, números e hífens (sem espaços, sem hífens no início/fim).";
  if (isReservedSlug(slug)) return "Este slug está reservado para uso interno.";
  return null;
}

export interface BusinessConfigFieldErrors {
  slug?: string;
  layoutVariant?: string;
  theme?: Record<string, string>;
  mapsUrl?: string;
  reviewUrl?: string;
  reviewWriteUrl?: string;
  externalLinks?: Record<string, string>;
}

export function validateBusinessConfig(payload: BusinessConfigPayload): BusinessConfigFieldErrors | null {
  const errors: BusinessConfigFieldErrors = {};

  const slugError = validateSlug(payload.slug);
  if (slugError) errors.slug = slugError;

  if (!isAvailableLayout(payload.layoutVariant)) {
    errors.layoutVariant = "Este modelo não está disponível para novos negócios.";
  }

  const themeErrors: Record<string, string> = {};
  (["primary", "secondary", "accent", "background", "surface", "text", "mutedText", "border"] as const).forEach((key) => {
    const value = payload.theme[key];
    if (value && !HEX_COLOR_PATTERN.test(value)) themeErrors[key] = "Cor inválida (usa #rrggbb).";
  });
  if (Object.keys(themeErrors).length) errors.theme = themeErrors;

  if (payload.mapsUrl && !getSafeExternalUrl(payload.mapsUrl)) errors.mapsUrl = "URL inválido (usa http:// ou https://).";
  if (payload.reviewUrl && !getSafeExternalUrl(payload.reviewUrl)) errors.reviewUrl = "URL inválido (usa http:// ou https://).";
  if (payload.reviewWriteUrl && !getSafeExternalUrl(payload.reviewWriteUrl)) {
    errors.reviewWriteUrl = "URL inválido (usa http:// ou https://).";
  }

  const externalLinkErrors: Record<string, string> = {};
  (["tripAdvisor", "delivery", "collection"] as const).forEach((key) => {
    const value = payload.externalLinks[key];
    if (value && !getSafeExternalUrl(value)) externalLinkErrors[key] = "URL inválido (usa http:// ou https://).";
  });
  if (Object.keys(externalLinkErrors).length) errors.externalLinks = externalLinkErrors;

  return Object.keys(errors).length ? errors : null;
}

export interface CreateBusinessFormErrors {
  name?: string;
  category?: string;
  slug?: string;
  layoutVariant?: string;
}

export interface CreateBusinessFormValues {
  name: string;
  category: string;
  slug: string;
  layoutVariant: string;
}

export function validateCreateBusinessForm(values: CreateBusinessFormValues): CreateBusinessFormErrors | null {
  const errors: CreateBusinessFormErrors = {};
  if (!values.name.trim()) errors.name = "O nome é obrigatório.";
  if (!values.category.trim()) errors.category = "A categoria é obrigatória.";
  const slugError = validateSlug(values.slug);
  if (slugError) errors.slug = slugError;
  if (!isAvailableLayout(values.layoutVariant)) errors.layoutVariant = "Escolhe um modelo disponível.";
  return Object.keys(errors).length ? errors : null;
}

export interface PublishChecklistItem {
  key: string;
  label: string;
  passed: boolean;
}

/**
 * The pre-publish checklist (app-layer business rule, not a DB constraint —
 * the RPC itself only flips the boolean, trusting this gate). Deliberately
 * only what's genuinely meaningful today; nothing invented.
 */
export function evaluatePublishChecklist(draft: Business): PublishChecklistItem[] {
  const website = draft.contact.website;
  const contactUrlsValid = !website || Boolean(getSafeExternalUrl(website));
  const themeValid = validateBusinessConfig({
    slug: draft.slug,
    organization: draft.organization,
    layoutVariant: draft.layoutVariant,
    theme: draft.theme,
    assets: draft.assets,
    mapsUrl: draft.location?.mapsUrl ?? "",
    googlePlaceId: draft.googlePlaceId ?? "",
    reviewUrl: draft.reviewUrl ?? "",
    reviewWriteUrl: draft.reviewWriteUrl ?? "",
    reviewFallback: draft.reviewSnapshot ?? null,
    externalLinks: {
      tripAdvisor: draft.externalLinks?.tripAdvisor ?? "",
      delivery: draft.externalLinks?.delivery ?? "",
      collection: draft.externalLinks?.collection ?? "",
    },
    digitalCard: draft.digitalCard ?? null,
    featured: draft.featured,
    indexable: draft.indexable,
  });

  return [
    { key: "name", label: "Nome preenchido", passed: Boolean(draft.name.trim()) },
    { key: "slug", label: "Slug válido", passed: !validateSlug(draft.slug) },
    { key: "layout", label: "Modelo disponível escolhido", passed: isAvailableLayout(draft.layoutVariant) },
    { key: "category", label: "Categoria preenchida", passed: Boolean(draft.category.trim()) },
    { key: "directoryDescription", label: "Descrição do diretório preenchida", passed: Boolean(draft.directoryDescription.trim()) },
    { key: "theme", label: "Configuração de aparência válida", passed: !themeValid?.theme && !themeValid?.mapsUrl && !themeValid?.reviewUrl && !themeValid?.reviewWriteUrl },
    { key: "contactUrls", label: "Contactos sem URLs inválidos", passed: contactUrlsValid },
    { key: "moduleContent", label: "Conteúdo dos módulos válido", passed: !validateModuleContent(toModuleContentSavePayload(draft)) },
  ];
}

import type {
  Business,
  BusinessGalleryImage,
  BusinessHoursEntry,
  BusinessTheme,
  MenuItem,
  RestaurantInfo,
  SocialPlatform,
  TreatmentGroup,
} from "@/lib/businesses";

export type SocialLinkDraft = { platform: SocialPlatform; url: string; label: string };
export type SimpleListField = "services" | "representedBrands" | "productCategories";

export const WEEKDAYS: ReadonlyArray<{ label: string; day: number }> = [
  { label: "Segunda", day: 1 },
  { label: "Terça", day: 2 },
  { label: "Quarta", day: 3 },
  { label: "Quinta", day: 4 },
  { label: "Sexta", day: 5 },
  { label: "Sábado", day: 6 },
  { label: "Domingo", day: 0 },
];

const DEFAULT_OPEN_PERIOD = { open: "09:00", close: "18:00" };
export const GALLERY_MAX_ITEMS = 5;

/**
 * Normalizes any stored hours into exactly one row per weekday, Monday to
 * Sunday, each with at most one open/close period — matching the shape every
 * seeded production business already uses (see lib/businesses.ts). The admin
 * editor deliberately keeps this simplification rather than a multi-period
 * schedule builder (out of scope for Phase 4B.3's core editor).
 */
export function ensureWeekHours(hours: BusinessHoursEntry[] | undefined): BusinessHoursEntry[] {
  return WEEKDAYS.map(({ label, day }) => {
    const existing = hours?.find((entry) => entry.days.includes(day));
    if (existing) {
      return { label: existing.label || label, days: [day], periods: existing.periods.length ? [existing.periods[0]] : [] };
    }
    return { label, days: [day], periods: [] };
  });
}

export function createInitialDraft(business: Business): Business {
  return { ...business, hours: ensureWeekHours(business.hours), socialLinks: business.socialLinks ?? [] };
}

function moveItem<T>(list: T[], index: number, direction: "up" | "down"): T[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= list.length) return list;
  const next = [...list];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export type DraftAction =
  | { type: "SET_CONTENT_FIELD"; field: "name" | "category" | "directoryDescription" | "profileDescription" | "positioning"; value: string }
  | { type: "SET_ABOUT_HEADING"; value: string }
  | { type: "SET_ABOUT_PARAGRAPH"; index: number; value: string }
  | { type: "ADD_ABOUT_PARAGRAPH" }
  | { type: "REMOVE_ABOUT_PARAGRAPH"; index: number }
  | { type: "SET_CONTACT_FIELD"; field: "phone" | "whatsapp" | "email" | "website"; value: string }
  | { type: "SET_LOCATION_FIELD"; field: "address" | "streetAddress" | "city" | "country" | "mapsUrl"; value: string }
  | { type: "SET_HOUR_CLOSED"; index: number; closed: boolean }
  | { type: "SET_HOUR_TIME"; index: number; field: "open" | "close"; value: string }
  | { type: "ADD_SOCIAL_LINK" }
  | { type: "REMOVE_SOCIAL_LINK"; index: number }
  | { type: "UPDATE_SOCIAL_LINK"; index: number; patch: Partial<SocialLinkDraft> }
  | { type: "MOVE_SOCIAL_LINK"; index: number; direction: "up" | "down" }
  // Simple ordered string lists: services, representedBrands, productCategories.
  | { type: "ADD_LIST_ITEM"; list: SimpleListField }
  | { type: "REMOVE_LIST_ITEM"; list: SimpleListField; index: number }
  | { type: "UPDATE_LIST_ITEM"; list: SimpleListField; index: number; value: string }
  | { type: "MOVE_LIST_ITEM"; list: SimpleListField; index: number; direction: "up" | "down" }
  // Gallery (max GALLERY_MAX_ITEMS, enforced here for immediate UI feedback —
  // and again server-side in admin_replace_gallery, the real boundary).
  | { type: "ADD_GALLERY_ITEM" }
  | { type: "REMOVE_GALLERY_ITEM"; index: number }
  | { type: "UPDATE_GALLERY_ITEM"; index: number; patch: Partial<BusinessGalleryImage> }
  | { type: "MOVE_GALLERY_ITEM"; index: number; direction: "up" | "down" }
  // Restaurant info (1:1, existing domain fields only).
  | { type: "SET_RESTAURANT_INFO_FIELD"; field: keyof RestaurantInfo; value: string }
  // Menu: sections -> items.
  | { type: "ADD_MENU_SECTION" }
  | { type: "REMOVE_MENU_SECTION"; index: number }
  | { type: "UPDATE_MENU_SECTION_TITLE"; index: number; value: string }
  | { type: "MOVE_MENU_SECTION"; index: number; direction: "up" | "down" }
  | { type: "ADD_MENU_ITEM"; sectionIndex: number }
  | { type: "REMOVE_MENU_ITEM"; sectionIndex: number; itemIndex: number }
  | { type: "UPDATE_MENU_ITEM"; sectionIndex: number; itemIndex: number; patch: Partial<MenuItem> }
  | { type: "MOVE_MENU_ITEM"; sectionIndex: number; itemIndex: number; direction: "up" | "down" }
  // Treatments: groups -> items.
  | { type: "ADD_TREATMENT_GROUP" }
  | { type: "REMOVE_TREATMENT_GROUP"; index: number }
  | { type: "UPDATE_TREATMENT_GROUP"; index: number; patch: Partial<Pick<TreatmentGroup, "id" | "title" | "description">> }
  | { type: "MOVE_TREATMENT_GROUP"; index: number; direction: "up" | "down" }
  | { type: "ADD_TREATMENT_ITEM"; groupIndex: number }
  | { type: "REMOVE_TREATMENT_ITEM"; groupIndex: number; itemIndex: number }
  | { type: "UPDATE_TREATMENT_ITEM"; groupIndex: number; itemIndex: number; value: string }
  | { type: "MOVE_TREATMENT_ITEM"; groupIndex: number; itemIndex: number; direction: "up" | "down" }
  // Protected business config (Phase 4B.5/4B.6) — identity, layout, theme,
  // assets, technical/Google fields, featured/indexable.
  | { type: "SET_LAYOUT_VARIANT"; value: Business["layoutVariant"] }
  | { type: "SET_TECHNICAL_FIELD"; field: "slug" | "organization" | "googlePlaceId" | "reviewUrl" | "reviewWriteUrl"; value: string }
  | { type: "SET_FEATURED"; value: boolean }
  | { type: "SET_INDEXABLE"; value: boolean }
  | { type: "SET_THEME_FIELD"; field: keyof BusinessTheme; value: string }
  | { type: "SET_ASSET_FIELD"; field: keyof Business["assets"]; value: string | boolean | undefined }
  | { type: "SET_REVIEW_SNAPSHOT"; value: Business["reviewSnapshot"] }
  | { type: "SET_EXTERNAL_LINKS"; value: Business["externalLinks"] }
  | { type: "SET_DIGITAL_CARD"; value: Business["digitalCard"] }
  | { type: "RESET"; business: Business };

export function businessDraftReducer(state: Business, action: DraftAction): Business {
  switch (action.type) {
    case "SET_CONTENT_FIELD":
      return { ...state, [action.field]: action.value };

    case "SET_ABOUT_HEADING":
      return { ...state, about: { ...state.about, heading: action.value } };

    case "SET_ABOUT_PARAGRAPH": {
      const paragraphs = [...(state.about?.paragraphs ?? [])];
      paragraphs[action.index] = action.value;
      return { ...state, about: { ...state.about, paragraphs } };
    }

    case "ADD_ABOUT_PARAGRAPH":
      return { ...state, about: { ...state.about, paragraphs: [...(state.about?.paragraphs ?? []), ""] } };

    case "REMOVE_ABOUT_PARAGRAPH": {
      const paragraphs = (state.about?.paragraphs ?? []).filter((_, index) => index !== action.index);
      return { ...state, about: { ...state.about, paragraphs } };
    }

    case "SET_CONTACT_FIELD":
      return { ...state, contact: { ...state.contact, [action.field]: action.value } };

    case "SET_LOCATION_FIELD":
      return { ...state, location: { ...state.location, [action.field]: action.value } };

    case "SET_HOUR_CLOSED": {
      const hours = [...(state.hours ?? [])];
      const entry = hours[action.index];
      if (!entry) return state;
      hours[action.index] = { ...entry, periods: action.closed ? [] : [DEFAULT_OPEN_PERIOD] };
      return { ...state, hours };
    }

    case "SET_HOUR_TIME": {
      const hours = [...(state.hours ?? [])];
      const entry = hours[action.index];
      if (!entry) return state;
      const period = entry.periods[0] ?? { ...DEFAULT_OPEN_PERIOD };
      hours[action.index] = { ...entry, periods: [{ ...period, [action.field]: action.value }] };
      return { ...state, hours };
    }

    case "ADD_SOCIAL_LINK":
      return { ...state, socialLinks: [...(state.socialLinks ?? []), { platform: "instagram", url: "", label: "Instagram" }] };

    case "REMOVE_SOCIAL_LINK":
      return { ...state, socialLinks: (state.socialLinks ?? []).filter((_, index) => index !== action.index) };

    case "UPDATE_SOCIAL_LINK": {
      const socialLinks = [...(state.socialLinks ?? [])];
      const link = socialLinks[action.index];
      if (!link) return state;
      socialLinks[action.index] = { ...link, ...action.patch };
      return { ...state, socialLinks };
    }

    case "MOVE_SOCIAL_LINK":
      return { ...state, socialLinks: moveItem(state.socialLinks ?? [], action.index, action.direction) };

    case "ADD_LIST_ITEM":
      return { ...state, [action.list]: [...(state[action.list] ?? []), ""] };

    case "REMOVE_LIST_ITEM":
      return { ...state, [action.list]: (state[action.list] ?? []).filter((_, index) => index !== action.index) };

    case "UPDATE_LIST_ITEM": {
      const list = [...(state[action.list] ?? [])];
      list[action.index] = action.value;
      return { ...state, [action.list]: list };
    }

    case "MOVE_LIST_ITEM":
      return { ...state, [action.list]: moveItem(state[action.list] ?? [], action.index, action.direction) };

    case "ADD_GALLERY_ITEM": {
      const gallery = state.gallery ?? [];
      if (gallery.length >= GALLERY_MAX_ITEMS) return state;
      return { ...state, gallery: [...gallery, { alt: "" }] };
    }

    case "REMOVE_GALLERY_ITEM":
      return { ...state, gallery: (state.gallery ?? []).filter((_, index) => index !== action.index) };

    case "UPDATE_GALLERY_ITEM": {
      const gallery = [...(state.gallery ?? [])];
      const item = gallery[action.index];
      if (!item) return state;
      gallery[action.index] = { ...item, ...action.patch };
      return { ...state, gallery };
    }

    case "MOVE_GALLERY_ITEM":
      return { ...state, gallery: moveItem(state.gallery ?? [], action.index, action.direction) };

    case "SET_RESTAURANT_INFO_FIELD":
      return { ...state, restaurantInfo: { ...state.restaurantInfo, [action.field]: action.value } };

    case "ADD_MENU_SECTION":
      return { ...state, menu: [...(state.menu ?? []), { title: "", items: [] }] };

    case "REMOVE_MENU_SECTION":
      return { ...state, menu: (state.menu ?? []).filter((_, index) => index !== action.index) };

    case "UPDATE_MENU_SECTION_TITLE": {
      const menu = [...(state.menu ?? [])];
      const section = menu[action.index];
      if (!section) return state;
      menu[action.index] = { ...section, title: action.value };
      return { ...state, menu };
    }

    case "MOVE_MENU_SECTION":
      return { ...state, menu: moveItem(state.menu ?? [], action.index, action.direction) };

    case "ADD_MENU_ITEM": {
      const menu = [...(state.menu ?? [])];
      const section = menu[action.sectionIndex];
      if (!section) return state;
      menu[action.sectionIndex] = { ...section, items: [...section.items, { name: "" }] };
      return { ...state, menu };
    }

    case "REMOVE_MENU_ITEM": {
      const menu = [...(state.menu ?? [])];
      const section = menu[action.sectionIndex];
      if (!section) return state;
      menu[action.sectionIndex] = { ...section, items: section.items.filter((_, index) => index !== action.itemIndex) };
      return { ...state, menu };
    }

    case "UPDATE_MENU_ITEM": {
      const menu = [...(state.menu ?? [])];
      const section = menu[action.sectionIndex];
      const item = section?.items[action.itemIndex];
      if (!section || !item) return state;
      const items = [...section.items];
      items[action.itemIndex] = { ...item, ...action.patch };
      menu[action.sectionIndex] = { ...section, items };
      return { ...state, menu };
    }

    case "MOVE_MENU_ITEM": {
      const menu = [...(state.menu ?? [])];
      const section = menu[action.sectionIndex];
      if (!section) return state;
      menu[action.sectionIndex] = { ...section, items: moveItem(section.items, action.itemIndex, action.direction) };
      return { ...state, menu };
    }

    case "ADD_TREATMENT_GROUP":
      return {
        ...state,
        treatmentGroups: [...(state.treatmentGroups ?? []), { id: "", title: "", description: "", items: [] }],
      };

    case "REMOVE_TREATMENT_GROUP":
      return { ...state, treatmentGroups: (state.treatmentGroups ?? []).filter((_, index) => index !== action.index) };

    case "UPDATE_TREATMENT_GROUP": {
      const treatmentGroups = [...(state.treatmentGroups ?? [])];
      const group = treatmentGroups[action.index];
      if (!group) return state;
      treatmentGroups[action.index] = { ...group, ...action.patch };
      return { ...state, treatmentGroups };
    }

    case "MOVE_TREATMENT_GROUP":
      return { ...state, treatmentGroups: moveItem(state.treatmentGroups ?? [], action.index, action.direction) };

    case "ADD_TREATMENT_ITEM": {
      const treatmentGroups = [...(state.treatmentGroups ?? [])];
      const group = treatmentGroups[action.groupIndex];
      if (!group) return state;
      treatmentGroups[action.groupIndex] = { ...group, items: [...group.items, ""] };
      return { ...state, treatmentGroups };
    }

    case "REMOVE_TREATMENT_ITEM": {
      const treatmentGroups = [...(state.treatmentGroups ?? [])];
      const group = treatmentGroups[action.groupIndex];
      if (!group) return state;
      treatmentGroups[action.groupIndex] = { ...group, items: group.items.filter((_, index) => index !== action.itemIndex) };
      return { ...state, treatmentGroups };
    }

    case "UPDATE_TREATMENT_ITEM": {
      const treatmentGroups = [...(state.treatmentGroups ?? [])];
      const group = treatmentGroups[action.groupIndex];
      if (!group) return state;
      const items = [...group.items];
      items[action.itemIndex] = action.value;
      treatmentGroups[action.groupIndex] = { ...group, items };
      return { ...state, treatmentGroups };
    }

    case "MOVE_TREATMENT_ITEM": {
      const treatmentGroups = [...(state.treatmentGroups ?? [])];
      const group = treatmentGroups[action.groupIndex];
      if (!group) return state;
      treatmentGroups[action.groupIndex] = { ...group, items: moveItem(group.items, action.itemIndex, action.direction) };
      return { ...state, treatmentGroups };
    }

    case "SET_LAYOUT_VARIANT":
      return { ...state, layoutVariant: action.value };

    case "SET_TECHNICAL_FIELD":
      return { ...state, [action.field]: action.value };

    case "SET_FEATURED":
      return { ...state, featured: action.value };

    case "SET_INDEXABLE":
      return { ...state, indexable: action.value };

    case "SET_THEME_FIELD":
      return { ...state, theme: { ...state.theme, [action.field]: action.value } };

    case "SET_ASSET_FIELD":
      return { ...state, assets: { ...state.assets, [action.field]: action.value } };

    case "SET_REVIEW_SNAPSHOT":
      return { ...state, reviewSnapshot: action.value };

    case "SET_EXTERNAL_LINKS":
      return { ...state, externalLinks: action.value };

    case "SET_DIGITAL_CARD":
      return { ...state, digitalCard: action.value };

    case "RESET":
      return createInitialDraft(action.business);

    default:
      return state;
  }
}

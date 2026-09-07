import type { Business } from "@/lib/businesses";

export interface LayoutOption {
  value: Business["layoutVariant"];
  label: string;
  description: string;
  templateName: string;
  available: boolean;
  unavailableReason?: string;
}

/**
 * Controlled layout registry for the admin — the ONLY source of truth for
 * which `layoutVariant` values a new PiriCard may select. Never let the
 * admin type an arbitrary string here.
 *
 * Why only "editorial" is available (Phase 4B.5/4B.6 finding, verified by
 * reading the actual components, not assumed): AutoformigalProfile,
 * BoiNaBrasaProfile, OFTRacingProfile and BeautyConnection360Profile are
 * one-off components hand-built for ONE specific real business each —
 * BoiNaBrasaProfile hardcodes Boi na Brasa's exact GPS coordinates for both
 * its "Como chegar" button and its map embed (not derived from
 * business.location at all), and all four hardcode literal Instagram
 * handles / business names / WhatsApp message text in JSX rather than
 * reading them from the `business` prop. Selecting one of these for a new,
 * different business would leak the ORIGINAL business's real phone/GPS/
 * handle onto the new one — a correctness bug, not a style limitation.
 * Fixing that is a real refactor of those components, explicitly out of
 * scope for this phase.
 *
 * The only rendering path in BusinessProfile.tsx that is 100%
 * `business.*`-driven with zero hardcoded business-specific content is the
 * generic fallback branch, reached by both "editorial" and "compact" (there
 * is no separate "compact" implementation). "compact" is listed here for
 * transparency about what the database accepts, but left unavailable —
 * it's conceptually reserved for the minimal PiriLight profile, and
 * offering it alongside an identical "editorial" option would just be
 * confusing.
 */
export const LAYOUT_REGISTRY: readonly LayoutOption[] = [
  {
    value: "editorial",
    label: "Editorial",
    description: "Modelo genérico e completo — informação, contactos, horário, redes sociais e módulos, adaptado à cor e ao conteúdo de cada negócio.",
    templateName: "Editorial (genérico)",
    available: true,
  },
  {
    value: "compact",
    label: "Compacto",
    description: "Reservado ao perfil mínimo da PiriLight — não disponível para novos negócios.",
    templateName: "Compacto",
    available: false,
    unavailableReason: "Reservado internamente.",
  },
  {
    value: "workshop",
    label: "Oficina (Auto Formigal)",
    description: "Modelo construído especificamente para a Auto Formigal, com dados dessa oficina escritos diretamente no código.",
    templateName: "Oficina",
    available: false,
    unavailableReason: "Específico de um negócio existente — ainda não é um modelo reutilizável.",
  },
  {
    value: "beauty",
    label: "Estética (Beauty Connection 360)",
    description: "Modelo construído especificamente para a Beauty Connection 360, com dados desse negócio escritos diretamente no código.",
    templateName: "Estética",
    available: false,
    unavailableReason: "Específico de um negócio existente — ainda não é um modelo reutilizável.",
  },
  {
    value: "restaurant",
    label: "Restaurante (Boi na Brasa)",
    description: "Modelo construído especificamente para o Boi na Brasa — inclui até a localização exata desse restaurante fixa no código.",
    templateName: "Restaurante",
    available: false,
    unavailableReason: "Específico de um negócio existente (localização incluída) — não reutilizável.",
  },
  {
    value: "racing",
    label: "Motas (OFT Racing)",
    description: "Modelo construído especificamente para a OFT Racing Shop, com dados desse negócio escritos diretamente no código.",
    templateName: "Motas",
    available: false,
    unavailableReason: "Específico de um negócio existente — ainda não é um modelo reutilizável.",
  },
] as const;

export const AVAILABLE_LAYOUTS: readonly LayoutOption[] = LAYOUT_REGISTRY.filter((layout) => layout.available);

export function isAvailableLayout(value: string): value is Business["layoutVariant"] {
  return AVAILABLE_LAYOUTS.some((layout) => layout.value === value);
}

export function getLayoutOption(value: string): LayoutOption | undefined {
  return LAYOUT_REGISTRY.find((layout) => layout.value === value);
}

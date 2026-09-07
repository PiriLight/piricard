"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  validateBusinessConfig,
  validateBusinessCore,
  validateModuleContent,
  type BusinessCoreFieldErrors,
  type BusinessConfigFieldErrors,
  type ModuleContentFieldErrors,
} from "@/lib/admin/validation";
import type { BusinessConfigPayload, BusinessCoreSavePayload, ModuleActivation, ModuleContentSavePayload } from "@/lib/admin/business-mapping";
import type { ModuleKey } from "@/lib/supabase/types";

export type SaveBusinessConfigState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: BusinessConfigFieldErrors }
  | { status: "error"; message: string }
  | { status: "success" };

export type PublishState = { status: "idle" } | { status: "error"; message: string } | { status: "success" };

export type SaveBusinessCoreState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: BusinessCoreFieldErrors }
  | { status: "error"; message: string }
  | { status: "success" };

export type SaveModuleContentState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: ModuleContentFieldErrors }
  | { status: "error"; message: string }
  | { status: "success" };

export type SetModuleEnabledState = { status: "idle" } | { status: "error"; message: string } | { status: "success" };

const GENERIC_ERROR = "Não foi possível guardar. Tenta novamente.";

/**
 * Saves ONLY the core fields covered by Phase 4B.3: business_profile_content,
 * business_hours, social_links. Never touches `businesses` (slug, theme,
 * layout_variant, assets, publish state, Google/QR config all stay
 * untouched here — those are out of scope for this phase).
 *
 * Uses the caller's own authenticated Supabase session (createClient() from
 * lib/supabase/server, cookie-based) — every write still goes through the
 * same RLS policies as any other authenticated request (is_business_member()
 * or security.is_platform_admin()). No service-role/secret key involved.
 *
 * business_hours/social_links are replaced atomically via the
 * admin_replace_business_hours/admin_replace_social_links RPCs (Phase 4B.4,
 * supabase/migrations/20260907120000_admin_module_write_rpcs.sql) — a single
 * function call is one transaction, replacing the Phase 4B.3 app-level
 * insert-then-delete workaround (noted then as not fully atomic).
 */
export async function saveBusinessCoreAction(
  businessId: string,
  payload: BusinessCoreSavePayload,
): Promise<SaveBusinessCoreState> {
  const fieldErrors = validateBusinessCore(payload);
  if (fieldErrors) {
    return { status: "invalid", fieldErrors };
  }

  const supabase = await createClient();

  const { error: contentError } = await supabase
    .from("business_profile_content")
    .update({
      name: payload.content.name,
      category: payload.content.category,
      directory_description: payload.content.directoryDescription,
      profile_description: payload.content.profileDescription || null,
      positioning: payload.content.positioning || null,
      about:
        payload.content.aboutHeading || payload.content.aboutParagraphs.length
          ? {
              ...(payload.content.aboutHeading ? { heading: payload.content.aboutHeading } : {}),
              ...(payload.content.aboutParagraphs.length ? { paragraphs: payload.content.aboutParagraphs } : {}),
            }
          : null,
      phone: payload.content.phone || null,
      whatsapp: payload.content.whatsapp || null,
      email: payload.content.email || null,
      website: payload.content.website || null,
      address: payload.content.address || null,
      street_address: payload.content.streetAddress || null,
      city: payload.content.city || null,
      country: payload.content.country || null,
    })
    .eq("business_id", businessId);

  if (contentError) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const { error: hoursError } = await supabase.rpc("admin_replace_business_hours", {
    p_business_id: businessId,
    p_hours: payload.hours,
  });
  if (hoursError) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const { error: socialError } = await supabase.rpc("admin_replace_social_links", {
    p_business_id: businessId,
    p_links: payload.socialLinks,
  });
  if (socialError) {
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath(`/admin/businesses/${businessId}/edit`);
  revalidatePath("/admin");

  return { status: "success" };
}

/**
 * Saves module CONTENT (Phase 4B.4) for whichever of the 7 modules are
 * currently enabled — a disabled module's content is never sent, since the
 * underlying RPC would reject it anyway (module_enabled() check, no admin
 * bypass — see the migration). This mirrors the approved rule: a disabled
 * module can still be READ by the admin, never WRITTEN, regardless of role.
 *
 * Each module's RPC call is its own atomic transaction; a failure in one
 * module's call does not corrupt that module's data (nothing partially
 * written), but this action does not wrap ALL modules in one outer
 * transaction — a reasonable, documented scope boundary for a
 * platform-admin-only V1 tool (see phase report).
 */
export async function saveModuleContentAction(
  businessId: string,
  activation: ModuleActivation,
  payload: ModuleContentSavePayload,
): Promise<SaveModuleContentState> {
  const fieldErrors = validateModuleContent(payload);
  if (fieldErrors) {
    return { status: "invalid", fieldErrors };
  }

  const supabase = await createClient();

  if (activation.services) {
    const { error } = await supabase.rpc("admin_replace_labeled_list", {
      p_business_id: businessId,
      p_table: "services",
      p_labels: payload.services,
    });
    if (error) return { status: "error", message: GENERIC_ERROR };
  }

  if (activation.brands) {
    const { error } = await supabase.rpc("admin_replace_labeled_list", {
      p_business_id: businessId,
      p_table: "represented_brands",
      p_labels: payload.representedBrands,
    });
    if (error) return { status: "error", message: GENERIC_ERROR };
  }

  if (activation.product_categories) {
    const { error } = await supabase.rpc("admin_replace_labeled_list", {
      p_business_id: businessId,
      p_table: "product_categories",
      p_labels: payload.productCategories,
    });
    if (error) return { status: "error", message: GENERIC_ERROR };
  }

  if (activation.gallery) {
    const { error } = await supabase.rpc("admin_replace_gallery", {
      p_business_id: businessId,
      p_items: payload.gallery,
    });
    if (error) return { status: "error", message: GENERIC_ERROR };
  }

  if (activation.restaurant_info) {
    const { error } = await supabase.rpc("admin_upsert_restaurant_info", {
      p_business_id: businessId,
      p_average_spend: payload.restaurantInfo.averageSpend || null,
      p_average_spend_note: payload.restaurantInfo.averageSpendNote || null,
      p_cuisine: payload.restaurantInfo.cuisine || null,
      p_cuisine_note: payload.restaurantInfo.cuisineNote || null,
    });
    if (error) return { status: "error", message: GENERIC_ERROR };
  }

  if (activation.menu) {
    const { error } = await supabase.rpc("admin_replace_menu", {
      p_business_id: businessId,
      p_sections: payload.menu,
    });
    if (error) return { status: "error", message: GENERIC_ERROR };
  }

  if (activation.treatments) {
    const { error } = await supabase.rpc("admin_replace_treatments", {
      p_business_id: businessId,
      p_groups: payload.treatmentGroups,
    });
    if (error) return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath(`/admin/businesses/${businessId}/edit`);

  return { status: "success" };
}

/**
 * Toggles one module's entitlement (business_modules), the ONLY source of
 * truth for enabled/disabled — never inferred from content. Calls the
 * admin_set_business_module RPC, which is platform-admin-gated internally
 * (business_modules itself has zero write grant to any application role).
 * Disabling never deletes content; enabling never fabricates it.
 */
export async function setModuleEnabledAction(
  businessId: string,
  moduleKey: ModuleKey,
  enabled: boolean,
): Promise<SetModuleEnabledState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_business_module", {
    p_business_id: businessId,
    p_module_key: moduleKey,
    p_enabled: enabled,
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível alterar o módulo. Confirma que a tua conta tem acesso de administrador PiriLight.",
    };
  }

  revalidatePath(`/admin/businesses/${businessId}/edit`);

  return { status: "success" };
}

const CONFIG_GENERIC_ERROR = "Não foi possível guardar a configuração. Tenta novamente.";

/**
 * Saves protected business config (identity, layout, theme, assets,
 * technical/Google fields, featured/indexable) via admin_update_business_config
 * — platform-admin-only, deliberately separate from the content save above.
 * The RPC itself rejects a slug change while published (physical QR/NFC
 * cards may already carry the old slug); that failure surfaces here as a
 * generic error rather than a silent no-op.
 */
export async function saveBusinessConfigAction(
  businessId: string,
  payload: BusinessConfigPayload,
): Promise<SaveBusinessConfigState> {
  const fieldErrors = validateBusinessConfig(payload);
  if (fieldErrors) {
    return { status: "invalid", fieldErrors };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_update_business_config", {
    p_business_id: businessId,
    p_slug: payload.slug,
    p_organization: payload.organization,
    p_layout_variant: payload.layoutVariant,
    p_theme: payload.theme,
    p_assets: payload.assets,
    p_maps_url: payload.mapsUrl || null,
    p_google_place_id: payload.googlePlaceId || null,
    p_review_url: payload.reviewUrl || null,
    p_review_write_url: payload.reviewWriteUrl || null,
    p_review_fallback: payload.reviewFallback,
    p_external_links: payload.externalLinks,
    p_digital_card: payload.digitalCard,
    p_featured: payload.featured,
    p_indexable: payload.indexable,
  });

  if (error) {
    return { status: "error", message: CONFIG_GENERIC_ERROR };
  }

  revalidatePath(`/admin/businesses/${businessId}/edit`);
  revalidatePath("/admin");

  return { status: "success" };
}

export async function setPublishStateAction(businessId: string, published: boolean): Promise<PublishState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_business_publish_state", {
    p_business_id: businessId,
    p_published: published,
  });

  if (error) {
    return { status: "error", message: "Não foi possível alterar o estado de publicação. Tenta novamente." };
  }

  revalidatePath(`/admin/businesses/${businessId}/edit`);
  revalidatePath("/admin");

  return { status: "success" };
}

export async function archiveBusinessAction(businessId: string): Promise<PublishState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_archive_business", { p_business_id: businessId });

  if (error) {
    return { status: "error", message: "Não foi possível arquivar o negócio. Tenta novamente." };
  }

  revalidatePath(`/admin/businesses/${businessId}/edit`);
  revalidatePath("/admin");

  return { status: "success" };
}

export async function unarchiveBusinessAction(businessId: string): Promise<PublishState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_unarchive_business", { p_business_id: businessId });

  if (error) {
    return { status: "error", message: "Não foi possível reativar o negócio. Tenta novamente." };
  }

  revalidatePath(`/admin/businesses/${businessId}/edit`);
  revalidatePath("/admin");

  return { status: "success" };
}

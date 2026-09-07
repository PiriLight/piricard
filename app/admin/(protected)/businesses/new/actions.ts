"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { defaultDirectoryDescription } from "@/lib/admin/business-mapping";
import { validateCreateBusinessForm, type CreateBusinessFormErrors, type CreateBusinessFormValues } from "@/lib/admin/validation";
import type { ModuleKey } from "@/lib/supabase/types";
import { finalizeDraftAssetsAction } from "@/app/admin/(protected)/businesses/storage-actions";

export interface CreateBusinessPayload extends CreateBusinessFormValues {
  enabledModules: ModuleKey[];
  initialPrimaryColor: string;
  initialAccentColor: string;
  initialLogo: string;
  initialCover: string;
  // Phase 4H: the same key ImageUploadField uploaded logo/cover under
  // (businesses/draft-{draftKey}/...) before this business existed.
  draftKey: string;
}

/**
 * Rewrites a public Storage URL after finalizeDraftAssetsAction has moved
 * the underlying object — `movedPaths` maps the old relative path to the
 * new one, and the relative path is always a literal suffix of the public
 * URL returned by getPublicUrl(), so a plain substring replace is exact and
 * safe (never guesses/reconstructs a URL from scratch). A URL that isn't a
 * draft upload at all (a manually-typed legacy path/external URL) matches
 * no entry and is returned unchanged.
 */
function rewriteFinalizedUrl(url: string, movedPaths: Record<string, string>): string {
  for (const [oldPath, newPath] of Object.entries(movedPaths)) {
    if (url.includes(oldPath)) return url.replace(oldPath, newPath);
  }
  return url;
}

export type CreateBusinessState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: CreateBusinessFormErrors }
  | { status: "error"; message: string }
  | { status: "success"; businessId: string };

const GENERIC_ERROR = "Não foi possível criar o negócio. Tenta novamente.";

/**
 * Creates the minimal valid business skeleton via the atomic
 * admin_create_business RPC (businesses + business_profile_content + only
 * the chosen business_modules rows, published=false). Directory description
 * isn't collected in this minimal Step 1 (per "don't require every possible
 * field during creation") — a short honest default is generated instead,
 * editable immediately afterward in the Content tab.
 *
 * Initial appearance (color/logo/cover) is a best-effort FOLLOW-UP call to
 * admin_update_business_config, not part of the atomic create — theme/assets
 * are refinements, not required for a valid business row. If this second
 * call fails, the created business still exists validly (default theme);
 * the editor's own Aparência/Ativos tabs let staff fix it up.
 */
export async function createBusinessAction(payload: CreateBusinessPayload): Promise<CreateBusinessState> {
  const fieldErrors = validateCreateBusinessForm(payload);
  if (fieldErrors) {
    return { status: "invalid", fieldErrors };
  }

  const supabase = await createClient();
  const name = payload.name.trim();
  const category = payload.category.trim();
  const slug = payload.slug.trim();
  const directoryDescription = defaultDirectoryDescription(name, category);

  const { data: businessId, error } = await supabase.rpc("admin_create_business", {
    p_slug: slug,
    p_organization: name,
    p_layout_variant: payload.layoutVariant,
    p_name: name,
    p_category: category,
    p_directory_description: directoryDescription,
    p_enabled_modules: payload.enabledModules,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "invalid", fieldErrors: { slug: "Este slug já está a ser usado." } };
    }
    return { status: "error", message: GENERIC_ERROR };
  }

  const hasInitialAppearance =
    payload.initialPrimaryColor || payload.initialAccentColor || payload.initialLogo || payload.initialCover;

  if (hasInitialAppearance && businessId) {
    // Phase 4H: re-parent any Storage objects uploaded under the wizard's
    // temporary draft key to this business's real id BEFORE persisting the
    // asset URLs — so `businesses` never ends up referencing a "draft-*"
    // path. Best-effort: a failure here still leaves the objects readable
    // at their draft path (never deleted), so nothing is lost — the
    // editor's Ativos tab lets staff re-upload if needed.
    const finalizeResult = await finalizeDraftAssetsAction(payload.draftKey, businessId);
    const movedPaths = finalizeResult.status === "success" ? finalizeResult.movedPaths : {};

    await supabase.rpc("admin_update_business_config", {
      p_business_id: businessId,
      p_slug: slug,
      p_organization: name,
      p_layout_variant: payload.layoutVariant,
      p_theme: {
        ...(payload.initialPrimaryColor ? { primary: payload.initialPrimaryColor } : {}),
        ...(payload.initialAccentColor ? { accent: payload.initialAccentColor } : {}),
      },
      p_assets: {
        ...(payload.initialLogo ? { logo: rewriteFinalizedUrl(payload.initialLogo, movedPaths) } : {}),
        ...(payload.initialCover ? { cover: rewriteFinalizedUrl(payload.initialCover, movedPaths) } : {}),
      },
      p_maps_url: null,
      p_google_place_id: null,
      p_review_url: null,
      p_review_write_url: null,
      p_review_fallback: null,
      p_external_links: {},
      p_digital_card: null,
      p_featured: false,
      p_indexable: true,
    });
    // Best-effort: a failure here doesn't block creation — the business
    // exists validly either way, just with default appearance.
  }

  revalidatePath("/admin");

  return { status: "success", businessId: businessId as string };
}

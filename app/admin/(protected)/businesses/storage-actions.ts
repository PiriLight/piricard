"use server";

import { createClient } from "@/lib/supabase/server";
import {
  businessAssetsPrefix,
  buildAssetPath,
  extractAssetPath,
  isBusinessOwnedAssetPath,
  PIRICARD_ASSETS_BUCKET,
  validateImageFile,
  type ImageKind,
} from "@/lib/admin/storage";

const BUSINESS_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_KINDS: ImageKind[] = ["logo", "cover", "gallery"];

/**
 * Phase 4H — shared Storage server actions for business image assets (logo,
 * cover, gallery), used by BOTH the Create wizard (components/admin/
 * CreateBusinessWizard.tsx, before a business row exists) and the existing-
 * business editor (components/admin/business-editor/AssetsSection.tsx,
 * GallerySection.tsx). One module, reused by both flows, rather than two
 * parallel upload implementations.
 *
 * Every write here goes through the caller's own authenticated Supabase
 * session (createClient() from lib/supabase/server, cookie-based) — the
 * exact same non-privileged path every other admin write in this app
 * already uses. Authorization is enforced by the Storage RLS policies added
 * in supabase/migrations/20260907150000_piricard_assets_storage.sql
 * (security.is_platform_admin(), scoped to this ONE bucket only). No
 * service-role key is used or exposed here.
 *
 * Every export below is an async function on purpose — a "use server" file
 * only allows async function exports (they become callable Server
 * Functions); pure helpers (path building, validation, path extraction)
 * live in lib/admin/storage.ts instead, imported here.
 */

export type { ImageKind };

export type UploadImageState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; path: string; publicUrl: string };

export type StorageOpState = { status: "success" } | { status: "error"; message: string };

/**
 * Uploads one image under businesses/{businessKey}/{kind}/ and returns its
 * durable public URL (the bucket is public — see the migration — so this
 * URL never expires and needs no signing/refresh, matching what public
 * profile pages require). Never touches the `businesses` table — a logo/
 * cover/gallery upload for an EXISTING business can never create or
 * duplicate a business row, and for a not-yet-created business it only
 * ever writes under a "draft-*" key.
 */
export async function uploadBusinessImageAction(businessKey: string, kind: ImageKind, formData: FormData): Promise<UploadImageState> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { status: "error", message: "Nenhum ficheiro recebido." };
  }

  const validationError = validateImageFile(file);
  if (validationError) {
    return { status: "error", message: validationError };
  }

  const path = buildAssetPath(businessKey, kind, file.type);

  const supabase = await createClient();
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { status: "error", message: "Não foi possível ler o ficheiro." };
  }

  const { error } = await supabase.storage.from(PIRICARD_ASSETS_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível enviar a imagem. Confirma que a tua conta tem acesso de administrador PiriLight.",
    };
  }

  const { data: publicUrlData } = supabase.storage.from(PIRICARD_ASSETS_BUCKET).getPublicUrl(path);
  return { status: "success", path, publicUrl: publicUrlData.publicUrl };
}

/**
 * Deletes ONE Storage object — but only if it matches our own path
 * convention (extractAssetPath); anything else (legacy static path,
 * external URL) is silently treated as "nothing to delete" rather than
 * risking a delete call against something we didn't create. Called only
 * AFTER a replacement value has already been successfully persisted (see
 * saveBusinessConfigAction/saveModuleContentAction) — never speculatively,
 * so a saved business's currently-referenced image is never removed.
 */
export async function deleteBusinessImageAction(pathOrUrl: string | undefined | null): Promise<StorageOpState> {
  const path = extractAssetPath(pathOrUrl);
  if (!path) {
    return { status: "success" };
  }
  const supabase = await createClient();
  const { error } = await supabase.storage.from(PIRICARD_ASSETS_BUCKET).remove([path]);
  if (error) {
    // Non-critical: the DB/form reference has already moved on. An orphaned
    // Storage object is a cheap, bounded cost; leaving the editor in an
    // error state over a cleanup failure would not be.
    return { status: "error", message: "Não foi possível remover a imagem anterior (não crítico)." };
  }
  return { status: "success" };
}

/**
 * Moves every object under businesses/draft-{draftKey}/** to
 * businesses/{businessId}/** in one call, right after admin_create_business
 * returns a real id — the deliberate "temporary upload strategy" for Create
 * mode (Phase 4H Step 2): images can be selected/uploaded before the
 * business exists, scoped under a client-generated draft key, then
 * re-parented to the real id the moment it's known. Storage `move` is a
 * metadata rename within the same bucket, not a re-upload. Returns the
 * old->new path map so the caller can rewrite its own already-known asset
 * fields (logo/cover) before the follow-up admin_update_business_config
 * call — never re-derives or guesses those fields itself.
 */
export async function finalizeDraftAssetsAction(
  draftKey: string,
  businessId: string,
): Promise<{ status: "success"; movedPaths: Record<string, string> } | { status: "error"; message: string }> {
  const supabase = await createClient();
  const prefix = `businesses/draft-${draftKey}`;
  const kinds: ImageKind[] = ["logo", "cover", "gallery"];
  const movedPaths: Record<string, string> = {};

  for (const kind of kinds) {
    const { data: files } = await supabase.storage.from(PIRICARD_ASSETS_BUCKET).list(`${prefix}/${kind}`);
    for (const file of files ?? []) {
      const oldPath = `${prefix}/${kind}/${file.name}`;
      const newPath = `businesses/${businessId}/${kind}/${file.name}`;
      const { error: moveError } = await supabase.storage.from(PIRICARD_ASSETS_BUCKET).move(oldPath, newPath);
      if (moveError) {
        return { status: "error", message: "Não foi possível finalizar as imagens enviadas." };
      }
      movedPaths[oldPath] = newPath;
    }
  }

  return { status: "success", movedPaths };
}

export type DeleteBusinessAssetsResult = { removed: string[]; failed: string[] };

/**
 * Pre-deployment addition — permanent business deletion (Step 6): removes
 * every Storage object under businesses/{businessId}/{logo,cover,gallery}/
 * for ONE specific, already-deleted business. Called only AFTER the
 * `businesses` row (and its cascaded child rows) is already gone from the
 * database — this is best-effort cleanup of now-orphaned files, never a
 * precondition for or a way to undo the database deletion.
 *
 * Safety: `businessId` must be a well-formed UUID (rejects anything else
 * outright — a "draft-*" key, a malformed string — before touching Storage
 * at all). `.list()` can only ever enumerate objects that are already
 * inside that one exact business's own folder (Storage lists by exact
 * directory segment, not substring/prefix search), and every path it
 * returns is re-checked with `isBusinessOwnedAssetPath` before being added
 * to the delete batch — so this can never remove another business's asset,
 * a legacy `/clients/...` path, an external URL, or an unrelated
 * in-progress Create-wizard draft folder.
 *
 * A Storage failure here is reported back, never thrown — per the phase's
 * explicit failure strategy, database integrity always wins: a leftover
 * orphaned file is a harmless, boundedly-sized cost; leaving the Admin in
 * an error state (or worse, trying to "undo" an already-successful database
 * deletion) over a cleanup failure would not be.
 */
export async function deleteBusinessAssetsAction(businessId: string): Promise<DeleteBusinessAssetsResult> {
  if (!BUSINESS_ID_PATTERN.test(businessId)) {
    return { removed: [], failed: [] };
  }

  const supabase = await createClient();
  const prefix = businessAssetsPrefix(businessId);
  const candidatePaths: string[] = [];

  for (const kind of ASSET_KINDS) {
    const { data: files } = await supabase.storage.from(PIRICARD_ASSETS_BUCKET).list(`${prefix}/${kind}`);
    for (const file of files ?? []) {
      const path = `${prefix}/${kind}/${file.name}`;
      if (isBusinessOwnedAssetPath(path, businessId)) candidatePaths.push(path);
    }
  }

  if (candidatePaths.length === 0) {
    return { removed: [], failed: [] };
  }

  const { error } = await supabase.storage.from(PIRICARD_ASSETS_BUCKET).remove(candidatePaths);
  if (error) {
    return { removed: [], failed: candidatePaths };
  }

  return { removed: candidatePaths, failed: [] };
}

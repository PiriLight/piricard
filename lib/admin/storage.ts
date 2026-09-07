import { randomUUID } from "node:crypto";

/**
 * Phase 4H — pure, synchronous Storage helpers shared by the admin upload
 * server actions (app/admin/(protected)/businesses/storage-actions.ts) and
 * by tests. Deliberately NOT in that "use server" file: every export of a
 * "use server" module must be an async function (it becomes a callable
 * Server Function/Action), so pure helpers like these live here instead —
 * also makes them trivially unit-testable with no server/network context.
 */

export const PIRICARD_ASSETS_BUCKET = "piricard-assets";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB — mirrors the bucket's own file_size_limit (defense-in-depth)
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type ImageKind = "logo" | "cover" | "gallery";

/**
 * Business-scoped, collision-safe Storage path. `businessKey` is either a
 * real business UUID (editing an existing business) or a client-generated
 * "draft-<uuid>" key (the Create wizard, before the row exists — see
 * finalizeDraftAssetsAction). The filename is always a fresh random id,
 * never the original filename or a timestamp alone, so two uploads of
 * "logo.png" — even for the same business — never collide, and nothing is
 * ever written at the bucket root.
 */
export function buildAssetPath(businessKey: string, kind: ImageKind, mimeType: string): string {
  const extension = MIME_EXTENSION[mimeType] ?? "bin";
  return `businesses/${businessKey}/${kind}/${randomUUID()}.${extension}`;
}

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Formato de imagem não suportado. Usa JPEG, PNG, WebP ou GIF.";
  }
  if (file.size <= 0) {
    return "Ficheiro vazio.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Imagem demasiado grande (máximo 5 MB).";
  }
  return null;
}

const ASSET_PATH_PATTERN = /^businesses\/[a-zA-Z0-9-]+\/(logo|cover|gallery)\/[0-9a-f-]+\.[a-z0-9]+$/;
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${PIRICARD_ASSETS_BUCKET}/`;

/**
 * Extracts the bare relative Storage path (e.g.
 * "businesses/<id>/logo/<uuid>.webp") from either that same bare path OR
 * the full public URL stored in Business.assets/gallery (getPublicUrl()
 * always returns `<origin>/storage/v1/object/public/<bucket>/<path>`, so
 * the relative path is a literal, extractable suffix). Returns null for
 * anything else — a legacy static path (e.g. "/clients/.../logo.jpg") or
 * an arbitrary external URL a staff member typed into the plain-text
 * field — so we never mistake those for our own bucket's objects.
 */
export function extractAssetPath(value: string | undefined | null): string | null {
  if (!value) return null;
  if (ASSET_PATH_PATTERN.test(value)) return value;
  const markerIndex = value.indexOf(PUBLIC_URL_MARKER);
  if (markerIndex === -1) return null;
  const candidate = value.slice(markerIndex + PUBLIC_URL_MARKER.length);
  return ASSET_PATH_PATTERN.test(candidate) ? candidate : null;
}

/** True only for a value (bare path or full public URL) this app itself generated via buildAssetPath. */
export function isPiricardAssetPath(value: string | undefined | null): boolean {
  return extractAssetPath(value) !== null;
}

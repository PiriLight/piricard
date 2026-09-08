"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadBusinessImageAction, type ImageKind } from "@/app/admin/(protected)/businesses/storage-actions";
import { validateImageFile } from "@/lib/admin/storage";

const MAX_DIMENSION = 6000; // sanity ceiling, not a real product constraint — guards against decompression-bomb-style images
const WEBP_QUALITY = 0.82;

// V1.1 — an upload must never hang forever (see handleFileChange's catch
// block for the full explanation). 30s is generous for a real mobile
// connection uploading a normal photo, but guarantees the Admin always gets
// a concrete state back instead of an indefinite "A enviar…".
const UPLOAD_TIMEOUT_MS = 30_000;

/**
 * Best-effort browser-side normalization: re-encodes the chosen image as
 * WebP via <canvas> before upload, so the Storage object itself is already
 * a reasonably-sized web asset rather than a raw camera-resolution JPEG/PNG.
 * Uses only native browser APIs (createImageBitmap + canvas.toBlob) — no
 * new dependency, no server-side image-processing pipeline. Falls back to
 * the ORIGINAL file untouched on any failure (unsupported format, browser
 * without WebP encode support, decode error) — a conversion problem must
 * never block an otherwise-valid upload. On iOS Safari, this also
 * transparently re-encodes a HEIC/HEIC photo (WebKit's createImageBitmap
 * decodes HEIC natively) into a WebP every browser can display — as long
 * as the *original* File already arrived as HEIC, which iOS Safari itself
 * avoids by auto-transcoding to JPEG for an <input accept> list that
 * doesn't include image/heic (see the accept attribute below).
 */
async function normalizeToWebP(file: File): Promise<{ file: File; error?: string }> {
  if (file.type === "image/gif") return { file }; // keep animated GIFs as-is; canvas would flatten them to one frame

  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
      return { file, error: `Imagem muito grande (máx. ${MAX_DIMENSION}px por lado).` };
    }

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file };
    ctx.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob || blob.type !== "image/webp") return { file }; // browser can't encode webp — keep the original

    const webpName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return { file: new File([blob], webpName, { type: "image/webp" }) };
  } catch {
    return { file }; // never block upload on a conversion failure
  }
}

/** Rejects after `ms` — races against the upload so the UI can never be stuck on "uploading" forever, regardless of what actually goes wrong on the network/server. */
function uploadTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("upload-timeout")), ms);
  });
}

interface ImageUploadFieldProps {
  businessKey: string;
  kind: ImageKind;
  currentValue?: string;
  label: string;
  onUploaded: (publicUrl: string, path: string) => void;
  /**
   * Optional — lets a parent (GallerySection, Step 10 of V1.1) know whether
   * THIS field is actively uploading, so it can e.g. keep the "Guardar"
   * button disabled until every in-flight upload has settled. Purely a
   * notification; this component's own status remains the only source of
   * truth for its own UI. Omitted entirely by callers (AssetsSection's
   * logo/cover fields) that don't need it — zero behavior change for them.
   */
  onUploadingChange?: (uploading: boolean) => void;
}

type UploadStatus = "idle" | "uploading" | "error";

/**
 * Shared upload control for logo/cover/gallery images — used by both the
 * Create wizard (businessKey is a "draft-<uuid>" key) and the existing-
 * business editor (businessKey is the real business id). Purely a client-
 * side picker + the shared uploadBusinessImageAction; it never touches the
 * `businesses` table and never auto-saves anything — the caller decides
 * what to do with the returned URL (typically: dispatch a reducer action
 * updating local draft/form state, exactly like the existing plain-text
 * path fields already do).
 *
 * V1.1 fix (root cause of the real-device "A enviar…" hang that never
 * resolved): `handleFileChange` previously had no try/catch around the
 * `await uploadBusinessImageAction(...)` call. A real phone photo,
 * comfortably inside this app's own advertised 5 MB limit, routinely
 * exceeded Next.js's separate, framework-level 1 MB default cap on Server
 * Action request bodies (see next.config.ts, now raised to 8mb) — that
 * request rejection surfaced as a THROWN error from the Server Action call,
 * which nothing here ever caught, so `status` stayed "uploading" forever
 * with no error and no way to recover. Every await below is now inside a
 * try/catch, and a hard timeout races the upload itself so a stalled
 * network request can't leave the UI stuck either, no matter the cause.
 */
export default function ImageUploadField({ businessKey, kind, currentValue, label, onUploaded, onUploadingChange }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setStatus("uploading");
    setError(null);
    onUploadingChange?.(true);

    // Fast, immediate, no-network rejection for an unsupported format or an
    // already-oversized file — matches the server's own rules (same
    // validateImageFile), just without waiting for a round trip first.
    const clientValidationError = validateImageFile(file);
    if (clientValidationError) {
      setStatus("error");
      setError(clientValidationError);
      onUploadingChange?.(false);
      return;
    }

    try {
      const { file: normalized, error: normalizeError } = await normalizeToWebP(file);
      if (normalizeError) {
        setStatus("error");
        setError(normalizeError);
        return;
      }

      const formData = new FormData();
      formData.set("file", normalized);

      const result = await Promise.race([
        uploadBusinessImageAction(businessKey, kind, formData),
        uploadTimeout(UPLOAD_TIMEOUT_MS),
      ]);

      if (result.status !== "success") {
        setStatus("error");
        setError(result.status === "error" ? result.message : "Não foi possível enviar a imagem.");
        return;
      }

      setStatus("idle");
      onUploaded(result.publicUrl, result.path);
    } catch {
      // Anything unexpected — the request-size rejection above, a dropped
      // connection, the 30s timeout, or any other thrown error — lands
      // here. The Admin always gets a concrete, actionable state instead of
      // an indefinite spinner. Raw error details are never shown; the
      // existing, already-saved image/reference (`currentValue`) is
      // untouched either way, since `onUploaded` is only ever called after
      // a confirmed success.
      setStatus("error");
      setError("Não foi possível enviar a imagem. Tenta novamente.");
    } finally {
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="admin-image-upload">
      {currentValue ? (
        <div className="admin-image-upload-preview">
          <Image src={currentValue} alt="" width={160} height={100} unoptimized style={{ objectFit: "cover", width: "100%", height: "100%" }} />
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        disabled={status === "uploading"}
        className="admin-image-upload-input"
      />
      <button type="button" className="admin-add-button" disabled={status === "uploading"} onClick={() => inputRef.current?.click()}>
        {status === "uploading" ? "A enviar…" : `Carregar ${label}`}
      </button>
      {/* Same button, re-enabled the moment status leaves "uploading" (idle
          or error) — that IS the retry: no separate button needed, the
          admin just picks a file again. */}
      {status === "error" && error ? <p className="admin-field-error">{error}</p> : null}
    </div>
  );
}

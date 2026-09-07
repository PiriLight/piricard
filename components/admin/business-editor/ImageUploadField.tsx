"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadBusinessImageAction, type ImageKind } from "@/app/admin/(protected)/businesses/storage-actions";

const MAX_DIMENSION = 6000; // sanity ceiling, not a real product constraint — guards against decompression-bomb-style images
const WEBP_QUALITY = 0.82;

/**
 * Best-effort browser-side normalization: re-encodes the chosen image as
 * WebP via <canvas> before upload, so the Storage object itself is already
 * a reasonably-sized web asset rather than a raw camera-resolution JPEG/PNG.
 * Uses only native browser APIs (createImageBitmap + canvas.toBlob) — no
 * new dependency, no server-side image-processing pipeline. Falls back to
 * the ORIGINAL file untouched on any failure (unsupported format, browser
 * without WebP encode support, decode error) — a conversion problem must
 * never block an otherwise-valid upload.
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

interface ImageUploadFieldProps {
  businessKey: string;
  kind: ImageKind;
  currentValue?: string;
  label: string;
  onUploaded: (publicUrl: string, path: string) => void;
}

/**
 * Shared upload control for logo/cover/gallery images — used by both the
 * Create wizard (businessKey is a "draft-<uuid>" key) and the existing-
 * business editor (businessKey is the real business id). Purely a client-
 * side picker + the shared uploadBusinessImageAction; it never touches the
 * `businesses` table and never auto-saves anything — the caller decides
 * what to do with the returned URL (typically: dispatch a reducer action
 * updating local draft/form state, exactly like the existing plain-text
 * path fields already do).
 */
export default function ImageUploadField({ businessKey, kind, currentValue, label, onUploaded }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setStatus("uploading");
    setError(null);

    const { file: normalized, error: normalizeError } = await normalizeToWebP(file);
    if (normalizeError) {
      setStatus("error");
      setError(normalizeError);
      return;
    }

    const formData = new FormData();
    formData.set("file", normalized);
    const result = await uploadBusinessImageAction(businessKey, kind, formData);

    if (result.status !== "success") {
      setStatus("error");
      setError(result.status === "error" ? result.message : "Não foi possível enviar a imagem.");
      return;
    }

    setStatus("idle");
    onUploaded(result.publicUrl, result.path);
  }

  return (
    <div className="admin-image-upload">
      {currentValue ? (
        <div className="admin-image-upload-preview">
          <Image src={currentValue} alt="" width={160} height={100} unoptimized style={{ objectFit: "cover", width: "100%", height: "100%" }} />
        </div>
      ) : null}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={status === "uploading"} className="admin-image-upload-input" />
      <button type="button" className="admin-add-button" disabled={status === "uploading"} onClick={() => inputRef.current?.click()}>
        {status === "uploading" ? "A enviar…" : `Carregar ${label}`}
      </button>
      {status === "error" && error ? <p className="admin-field-error">{error}</p> : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Business, BusinessGalleryImage } from "@/lib/businesses";
import ImageUploadField from "./ImageUploadField";
import type { DraftAction } from "./reducer";
import { GALLERY_MAX_ITEMS } from "./reducer";

const ASPECT_OPTIONS = ["wide", "landscape", "square"] as const;

/**
 * V1.1 — full rework of the Gallery editor's default workflow (previous
 * version: reported stuck-forever "A enviar…" uploads, a placeholder-
 * looking legacy path field as the PRIMARY control, and a count that
 * treated an empty just-added row as "1 valid image"). See the phase
 * report for the full investigation.
 *
 * `item.src` unset is a REAL, pre-existing, deliberate product state — not
 * a bug to eliminate: BusinessPhotoGallery (the shared public renderer)
 * already shows a "Fotografia em breve" placeholder for a gallery entry
 * with no `src`, letting a business reserve a captioned slot for a photo
 * that isn't ready yet. This rework does not remove that — it only stops
 * the EDITOR from making a freshly-added, undecided row look like it
 * already has a real image typed into it, and stops counting it as one.
 */

function isValidImage(item: BusinessGalleryImage): boolean {
  return Boolean(item.src);
}

interface GalleryItemCardProps {
  businessId: string;
  item: BusinessGalleryImage;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  disabled?: boolean;
  dispatch: React.Dispatch<DraftAction>;
  onUploadingChange: (index: number, uploading: boolean) => void;
  /** Step 10/14: concise validation inline, next to the affected image — not just a generic message under the Save button. */
  error?: string;
}

function GalleryItemCard({ businessId, item, index, isFirst, isLast, disabled, dispatch, onUploadingChange, error }: GalleryItemCardProps) {
  // Manual URL editing is preserved in full (Step 6/13: never break an
  // existing legacy `/clients/...` path or external URL) but collapsed
  // behind a secondary disclosure by default — the thumbnail above already
  // renders whatever `item.src` currently is (a fresh upload, an existing
  // legacy path, or an external URL) regardless of whether this is open;
  // opening it only lets the admin see/edit the raw value when they
  // deliberately choose to, instead of it being the default, front-and-
  // center control.
  const [showUrlField, setShowUrlField] = useState(false);

  return (
    <div className="admin-gallery-card">
      {item.src ? (
        <div className="admin-gallery-thumb-row">
          <div className="admin-gallery-thumb">
            {/* `unoptimized`, same as ImageUploadField's own logo/cover
                preview: gallery src can be a bare Storage path, a legacy
                /clients/... path, or an arbitrary external URL a staff
                member typed in — next/image's optimizer only allows the
                Supabase Storage host (next.config.ts remotePatterns) plus
                same-origin paths, so an external URL would 400 through it.
                `unoptimized` renders the URL directly, exactly like a plain
                <img>, without that restriction. A controlled fallback
                (Step 7) replaces a broken image with a clear, contained
                placeholder instead of a raw browser broken-image icon. */}
            <Image
              src={item.src}
              alt=""
              fill
              unoptimized
              sizes="96px"
              style={{ objectFit: "cover" }}
              onError={(event) => {
                event.currentTarget.style.display = "none";
                event.currentTarget.nextElementSibling?.classList.remove("admin-gallery-thumb-error-hidden");
              }}
            />
            <span className="admin-gallery-thumb-error admin-gallery-thumb-error-hidden">Imagem indisponível</span>
          </div>
          <div className="admin-gallery-thumb-actions">
            {!disabled ? (
              <ImageUploadField
                businessKey={businessId}
                kind="gallery"
                label="nova imagem (substituir)"
                onUploaded={(publicUrl) => dispatch({ type: "UPDATE_GALLERY_ITEM", index, patch: { src: publicUrl } })}
                onUploadingChange={(uploading) => onUploadingChange(index, uploading)}
              />
            ) : null}
            <button
              type="button"
              className="admin-icon-button admin-gallery-url-toggle"
              disabled={disabled}
              onClick={() => setShowUrlField((current) => !current)}
            >
              {showUrlField ? "Ocultar URL externa" : "Usar URL externa"}
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-gallery-empty-card">
          <p className="admin-gallery-empty-hint">Ainda sem imagem — carrega uma foto ou deixa este espaço reservado.</p>
          <div className="admin-gallery-empty-actions">
            {!disabled ? (
              <ImageUploadField
                businessKey={businessId}
                kind="gallery"
                label="imagem"
                onUploaded={(publicUrl) => dispatch({ type: "UPDATE_GALLERY_ITEM", index, patch: { src: publicUrl } })}
                onUploadingChange={(uploading) => onUploadingChange(index, uploading)}
              />
            ) : null}
            <button
              type="button"
              className="admin-icon-button admin-gallery-url-toggle"
              disabled={disabled}
              onClick={() => setShowUrlField((current) => !current)}
            >
              {showUrlField ? "Ocultar URL externa" : "Usar URL externa"}
            </button>
          </div>
        </div>
      )}

      {showUrlField ? (
        <div className="admin-field admin-gallery-url-field">
          <label htmlFor={`gallery-src-${index}`}>URL externa (opcional)</label>
          <input
            id={`gallery-src-${index}`}
            type="text"
            placeholder="https://… ou /clients/…"
            value={item.src ?? ""}
            disabled={disabled}
            onChange={(event) => dispatch({ type: "UPDATE_GALLERY_ITEM", index, patch: { src: event.target.value || undefined } })}
          />
          <p className="admin-field-hint">Para uma imagem já publicada noutro sítio, ou um caminho existente do site.</p>
        </div>
      ) : null}

      <div className="admin-field">
        <label htmlFor={`gallery-alt-${index}`}>Texto alternativo</label>
        <input
          id={`gallery-alt-${index}`}
          type="text"
          value={item.alt}
          disabled={disabled}
          onChange={(event) => dispatch({ type: "UPDATE_GALLERY_ITEM", index, patch: { alt: event.target.value } })}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`gallery-aspect-${index}`}>Proporção</label>
        <select
          id={`gallery-aspect-${index}`}
          value={item.aspectRatio ?? ""}
          disabled={disabled}
          onChange={(event) =>
            dispatch({
              type: "UPDATE_GALLERY_ITEM",
              index,
              patch: { aspectRatio: (event.target.value || undefined) as BusinessGalleryImage["aspectRatio"] },
            })
          }
        >
          <option value="">(automático)</option>
          {ASPECT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="admin-field-error">{error}</p> : null}
      <div className="admin-gallery-card-actions">
        <button
          type="button"
          className="admin-icon-button"
          disabled={disabled || isFirst}
          onClick={() => dispatch({ type: "MOVE_GALLERY_ITEM", index, direction: "up" })}
          aria-label="Mover para cima"
        >
          ↑
        </button>
        <button
          type="button"
          className="admin-icon-button"
          disabled={disabled || isLast}
          onClick={() => dispatch({ type: "MOVE_GALLERY_ITEM", index, direction: "down" })}
          aria-label="Mover para baixo"
        >
          ↓
        </button>
        <button type="button" className="admin-gallery-remove-button" disabled={disabled} onClick={() => dispatch({ type: "REMOVE_GALLERY_ITEM", index })}>
          Remover
        </button>
      </div>
    </div>
  );
}

export default function GallerySection({
  businessId,
  draft,
  dispatch,
  disabled,
  moduleEnabled,
  onToggleModule,
  onUploadingChange,
  itemErrors,
}: {
  businessId: string;
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  disabled?: boolean;
  /** Current business_modules.gallery value — the single source of truth for activation (never inferred from `draft.gallery`'s content). */
  moduleEnabled: boolean;
  /** Step 11: a small, optional shortcut that reuses the SAME setModuleEnabledAction path as the Módulos tab — no second source of truth. Omit to hide the shortcut entirely. */
  onToggleModule?: (enabled: boolean) => Promise<boolean>;
  /** Step 10: reports whether ANY gallery image is currently mid-upload, so BusinessEditor can keep "Guardar" disabled until uploads settle. */
  onUploadingChange?: (uploading: boolean) => void;
  /** Per-item validation messages from the last save attempt (lib/admin/validation.ts), keyed by index — shown inline on the affected card instead of only as one generic message under Save. */
  itemErrors?: Record<number, string>;
}) {
  const items = draft.gallery ?? [];
  const validCount = items.filter(isValidImage).length;
  const atLimit = items.length >= GALLERY_MAX_ITEMS;
  // A ref, not state: this set's MEMBERSHIP drives a callback to the parent
  // (onUploadingChange) but its contents are never read during render —
  // GallerySection itself doesn't need to re-render when it changes.
  const uploadingIndexes = useRef<Set<number>>(new Set());
  const [isTogglingModule, setIsTogglingModule] = useState(false);

  function handleItemUploadingChange(index: number, uploading: boolean) {
    if (uploading) uploadingIndexes.current.add(index);
    else uploadingIndexes.current.delete(index);
    onUploadingChange?.(uploadingIndexes.current.size > 0);
  }

  function handleToggleModule() {
    if (!onToggleModule || isTogglingModule) return;
    setIsTogglingModule(true);
    onToggleModule(!moduleEnabled).finally(() => setIsTogglingModule(false));
  }

  return (
    <div className="admin-form-section">
      <div className="admin-gallery-header">
        <span className={`admin-gallery-status-badge ${moduleEnabled ? "is-active" : "is-inactive"}`}>
          Galeria — {moduleEnabled ? "Ativa" : "Desativada"}
        </span>
        {onToggleModule ? (
          <button type="button" className="admin-icon-button" onClick={handleToggleModule} disabled={isTogglingModule}>
            {isTogglingModule ? "…" : moduleEnabled ? "Desativar" : "Ativar"}
          </button>
        ) : null}
      </div>

      {disabled ? <p className="admin-field-hint admin-module-disabled-notice">Módulo desativado — os dados abaixo continuam guardados, mas não aparecem no perfil público.</p> : null}

      <p className="admin-field-hint">
        {validCount}/{GALLERY_MAX_ITEMS} imagens. Usa as setas para definir a ordem.
      </p>

      {items.map((item, index) => (
        <GalleryItemCard
          key={index}
          businessId={businessId}
          item={item}
          index={index}
          isFirst={index === 0}
          isLast={index === items.length - 1}
          disabled={disabled}
          dispatch={dispatch}
          onUploadingChange={handleItemUploadingChange}
          error={itemErrors?.[index]}
        />
      ))}

      <button
        type="button"
        className="admin-add-button"
        disabled={disabled || atLimit}
        onClick={() => dispatch({ type: "ADD_GALLERY_ITEM" })}
        title={atLimit ? `Máximo de ${GALLERY_MAX_ITEMS} imagens` : undefined}
      >
        + Adicionar imagem
      </button>
    </div>
  );
}

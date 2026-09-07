"use client";

import type { Business, BusinessGalleryImage } from "@/lib/businesses";
import type { DraftAction } from "./reducer";
import { GALLERY_MAX_ITEMS } from "./reducer";

const ASPECT_OPTIONS = ["wide", "landscape", "square"] as const;

/**
 * Metadata/content editing only (Phase 4B.4 scope) — `src` is a plain text
 * field (a path/URL), not an uploader; no compression/Storage pipeline yet.
 * Max 5 items is enforced here for immediate feedback and again, as the real
 * boundary, server-side in admin_replace_gallery.
 */
export default function GallerySection({
  draft,
  dispatch,
  disabled,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  disabled?: boolean;
}) {
  const items = draft.gallery ?? [];
  const atLimit = items.length >= GALLERY_MAX_ITEMS;

  return (
    <div className="admin-form-section">
      {disabled ? <p className="admin-field-hint admin-module-disabled-notice">Módulo desativado — só leitura.</p> : null}
      <p className="admin-field-hint">
        {items.length}/{GALLERY_MAX_ITEMS} imagens. Sem upload nesta fase — indica o caminho/URL de cada imagem.
      </p>

      {items.map((item, index) => (
        <div className="admin-gallery-card" key={index}>
          <div className="admin-field">
            <label htmlFor={`gallery-src-${index}`}>Caminho/URL da imagem</label>
            <input
              id={`gallery-src-${index}`}
              type="text"
              placeholder="/clients/exemplo/gallery/foto.webp"
              value={item.src ?? ""}
              disabled={disabled}
              onChange={(event) => dispatch({ type: "UPDATE_GALLERY_ITEM", index, patch: { src: event.target.value } })}
            />
          </div>
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
          <div className="admin-gallery-card-actions">
            <button
              type="button"
              className="admin-icon-button"
              disabled={disabled || index === 0}
              onClick={() => dispatch({ type: "MOVE_GALLERY_ITEM", index, direction: "up" })}
              aria-label="Mover para cima"
            >
              ↑
            </button>
            <button
              type="button"
              className="admin-icon-button"
              disabled={disabled || index === items.length - 1}
              onClick={() => dispatch({ type: "MOVE_GALLERY_ITEM", index, direction: "down" })}
              aria-label="Mover para baixo"
            >
              ↓
            </button>
            <button type="button" className="admin-remove-button" disabled={disabled} onClick={() => dispatch({ type: "REMOVE_GALLERY_ITEM", index })}>
              Remover
            </button>
          </div>
        </div>
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

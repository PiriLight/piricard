"use client";

import type { Business, SocialPlatform } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

const PLATFORM_OPTIONS: ReadonlyArray<{ value: SocialPlatform; label: string }> = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
];

export default function SocialLinksSection({
  draft,
  dispatch,
  errors,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  errors?: Record<number, string>;
}) {
  const socialLinks = draft.socialLinks ?? [];

  return (
    <div className="admin-form-section">
      {socialLinks.length === 0 ? <p className="admin-field-hint">Ainda não há redes sociais adicionadas.</p> : null}

      {socialLinks.map((link, index) => (
        <div className="admin-social-row" key={index}>
          <div className="admin-social-row-fields">
            <select
              aria-label="Plataforma"
              value={link.platform}
              onChange={(event) =>
                dispatch({
                  type: "UPDATE_SOCIAL_LINK",
                  index,
                  patch: { platform: event.target.value as SocialPlatform },
                })
              }
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              aria-label="Etiqueta"
              placeholder="Etiqueta"
              value={link.label}
              onChange={(event) => dispatch({ type: "UPDATE_SOCIAL_LINK", index, patch: { label: event.target.value } })}
            />
            <input
              type="url"
              aria-label="URL"
              placeholder="https://…"
              value={link.url}
              onChange={(event) => dispatch({ type: "UPDATE_SOCIAL_LINK", index, patch: { url: event.target.value } })}
            />
          </div>
          <div className="admin-social-row-actions">
            <button
              type="button"
              className="admin-icon-button"
              disabled={index === 0}
              onClick={() => dispatch({ type: "MOVE_SOCIAL_LINK", index, direction: "up" })}
              aria-label="Mover para cima"
            >
              ↑
            </button>
            <button
              type="button"
              className="admin-icon-button"
              disabled={index === socialLinks.length - 1}
              onClick={() => dispatch({ type: "MOVE_SOCIAL_LINK", index, direction: "down" })}
              aria-label="Mover para baixo"
            >
              ↓
            </button>
            <button
              type="button"
              className="admin-remove-button"
              onClick={() => dispatch({ type: "REMOVE_SOCIAL_LINK", index })}
            >
              Remover
            </button>
          </div>
          {errors?.[index] ? <p className="admin-field-error">{errors[index]}</p> : null}
        </div>
      ))}

      <button type="button" className="admin-add-button" onClick={() => dispatch({ type: "ADD_SOCIAL_LINK" })}>
        + Adicionar rede social
      </button>
    </div>
  );
}

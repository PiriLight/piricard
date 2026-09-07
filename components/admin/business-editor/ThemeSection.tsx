"use client";

import type { Business, BusinessTheme } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

const COLOR_FIELDS: ReadonlyArray<{ key: keyof BusinessTheme; label: string }> = [
  { key: "primary", label: "Primária" },
  { key: "secondary", label: "Secundária" },
  { key: "accent", label: "Destaque" },
  { key: "background", label: "Fundo" },
  { key: "surface", label: "Superfície" },
  { key: "text", label: "Texto" },
  { key: "mutedText", label: "Texto esbatido" },
  { key: "border", label: "Contorno" },
];

/**
 * A controlled set of design tokens — NOT a CSS editor. Only the fields
 * BusinessTheme already defines (lib/businesses.ts) are exposed; no
 * arbitrary CSS/classes/selectors/font imports are possible here. Every
 * change updates the live preview immediately (it's just the in-memory
 * draft), nothing is sent to Supabase until Save.
 */
export default function ThemeSection({
  draft,
  dispatch,
  errors,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  errors?: Record<string, string>;
}) {
  const theme = draft.theme;

  return (
    <div className="admin-form-section">
      <p className="admin-field-hint">
        Nem todos os modelos usam todas as cores da mesma forma — o modelo Editorial usa-as todas diretamente.
      </p>
      <div className="admin-theme-color-grid">
        {COLOR_FIELDS.map(({ key, label }) => (
          <div className="admin-field admin-theme-color-field" key={key}>
            <label htmlFor={`theme-${key}`}>{label}</label>
            <div className="admin-theme-color-row">
              <input
                type="color"
                aria-label={`${label} (seletor)`}
                value={/^#[0-9a-f]{6}$/i.test(theme[key]) ? theme[key] : "#000000"}
                onChange={(event) => dispatch({ type: "SET_THEME_FIELD", field: key, value: event.target.value })}
              />
              <input
                id={`theme-${key}`}
                type="text"
                placeholder="#rrggbb"
                value={theme[key] ?? ""}
                onChange={(event) => dispatch({ type: "SET_THEME_FIELD", field: key, value: event.target.value })}
              />
            </div>
            {errors?.[key] ? <p className="admin-field-error">{errors[key]}</p> : null}
          </div>
        ))}
      </div>

      <div className="admin-field">
        <label htmlFor="theme-appearance">Aparência</label>
        <select
          id="theme-appearance"
          value={theme.appearance}
          onChange={(event) => dispatch({ type: "SET_THEME_FIELD", field: "appearance", value: event.target.value })}
        >
          <option value="light">Clara</option>
          <option value="dark">Escura</option>
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="theme-font">Família tipográfica</label>
        <select
          id="theme-font"
          value={theme.fontFamily}
          onChange={(event) => dispatch({ type: "SET_THEME_FIELD", field: "fontFamily", value: event.target.value })}
        >
          <option value="modern">Moderna</option>
          <option value="editorial">Editorial</option>
        </select>
      </div>
    </div>
  );
}

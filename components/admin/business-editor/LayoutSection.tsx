"use client";

import type { Business } from "@/lib/businesses";
import { LAYOUT_REGISTRY } from "@/lib/admin/layout-registry";
import type { DraftAction } from "./reducer";

/**
 * Controlled layout registry only — never a free-text field. Unavailable
 * layouts (the four bespoke, one-off components) are shown for transparency
 * but cannot be selected; see lib/admin/layout-registry.ts for why.
 */
export default function LayoutSection({
  draft,
  dispatch,
  errors,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  errors?: { layoutVariant?: string };
}) {
  return (
    <div className="admin-form-section">
      <p className="admin-field-hint">
        Apenas modelos genéricos e reutilizáveis podem ser escolhidos aqui. Os modelos específicos de um negócio já
        existente ficam indisponíveis até serem generalizados.
      </p>
      <div className="admin-layout-options">
        {LAYOUT_REGISTRY.map((layout) => (
          <label
            key={layout.value}
            className={`admin-layout-option${draft.layoutVariant === layout.value ? " is-selected" : ""}${
              layout.available ? "" : " is-unavailable"
            }`}
          >
            <input
              type="radio"
              name="layoutVariant"
              value={layout.value}
              checked={draft.layoutVariant === layout.value}
              disabled={!layout.available}
              onChange={() => dispatch({ type: "SET_LAYOUT_VARIANT", value: layout.value })}
            />
            <div className="admin-layout-option-body">
              <div className="admin-layout-option-title">
                <strong>{layout.label}</strong>
                {!layout.available ? <span className="admin-layout-option-badge">Indisponível</span> : null}
              </div>
              <p>{layout.description}</p>
              {!layout.available && layout.unavailableReason ? (
                <p className="admin-layout-option-reason">{layout.unavailableReason}</p>
              ) : null}
            </div>
          </label>
        ))}
      </div>
      {errors?.layoutVariant ? <p className="admin-field-error">{errors.layoutVariant}</p> : null}
    </div>
  );
}

"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

/**
 * Exactly the approved RestaurantInfo fields (lib/businesses.ts) — no
 * freeform JSON editing.
 */
export default function RestaurantInfoSection({
  draft,
  dispatch,
  disabled,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  disabled?: boolean;
}) {
  const info = draft.restaurantInfo;

  return (
    <div className="admin-form-section">
      {disabled ? <p className="admin-field-hint admin-module-disabled-notice">Módulo desativado — só leitura.</p> : null}

      <div className="admin-field">
        <label htmlFor="field-average-spend">Preço médio</label>
        <input
          id="field-average-spend"
          type="text"
          placeholder="10–15 € por pessoa"
          value={info?.averageSpend ?? ""}
          disabled={disabled}
          onChange={(event) => dispatch({ type: "SET_RESTAURANT_INFO_FIELD", field: "averageSpend", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-average-spend-note">Nota sobre o preço médio</label>
        <input
          id="field-average-spend-note"
          type="text"
          placeholder="indicado no Google por 47 pessoas"
          value={info?.averageSpendNote ?? ""}
          disabled={disabled}
          onChange={(event) =>
            dispatch({ type: "SET_RESTAURANT_INFO_FIELD", field: "averageSpendNote", value: event.target.value })
          }
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-cuisine">Tipo de cozinha</label>
        <input
          id="field-cuisine"
          type="text"
          value={info?.cuisine ?? ""}
          disabled={disabled}
          onChange={(event) => dispatch({ type: "SET_RESTAURANT_INFO_FIELD", field: "cuisine", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-cuisine-note">Nota sobre a cozinha</label>
        <input
          id="field-cuisine-note"
          type="text"
          value={info?.cuisineNote ?? ""}
          disabled={disabled}
          onChange={(event) => dispatch({ type: "SET_RESTAURANT_INFO_FIELD", field: "cuisineNote", value: event.target.value })}
        />
      </div>
    </div>
  );
}

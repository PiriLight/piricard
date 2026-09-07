"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

export default function LocationSection({ draft, dispatch }: { draft: Business; dispatch: React.Dispatch<DraftAction> }) {
  return (
    <div className="admin-form-section">
      <div className="admin-field">
        <label htmlFor="field-address">Morada (completa)</label>
        <input
          id="field-address"
          type="text"
          value={draft.location?.address ?? ""}
          onChange={(event) => dispatch({ type: "SET_LOCATION_FIELD", field: "address", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-street-address">Rua</label>
        <input
          id="field-street-address"
          type="text"
          value={draft.location?.streetAddress ?? ""}
          onChange={(event) => dispatch({ type: "SET_LOCATION_FIELD", field: "streetAddress", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-city">Cidade</label>
        <input
          id="field-city"
          type="text"
          value={draft.location?.city ?? ""}
          onChange={(event) => dispatch({ type: "SET_LOCATION_FIELD", field: "city", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-country">País</label>
        <input
          id="field-country"
          type="text"
          value={draft.location?.country ?? ""}
          onChange={(event) => dispatch({ type: "SET_LOCATION_FIELD", field: "country", value: event.target.value })}
        />
      </div>
    </div>
  );
}

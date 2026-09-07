"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

export default function HoursSection({
  draft,
  dispatch,
  errors,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  errors?: Record<number, string>;
}) {
  const hours = draft.hours ?? [];

  return (
    <div className="admin-form-section">
      <p className="admin-field-hint">Um período de abertura por dia. Marca &quot;Fechado&quot; para os dias sem horário.</p>
      <div className="admin-hours-grid">
        {hours.map((entry, index) => {
          const closed = entry.periods.length === 0;
          const period = entry.periods[0];
          return (
            <div className="admin-hours-row" key={entry.label}>
              <span className="admin-hours-label">{entry.label}</span>
              <label className="admin-hours-closed-toggle">
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(event) => dispatch({ type: "SET_HOUR_CLOSED", index, closed: event.target.checked })}
                />
                Fechado
              </label>
              <div className="admin-hours-times">
                <input
                  type="time"
                  disabled={closed}
                  value={period?.open ?? ""}
                  onChange={(event) => dispatch({ type: "SET_HOUR_TIME", index, field: "open", value: event.target.value })}
                  aria-label={`Hora de abertura — ${entry.label}`}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  disabled={closed}
                  value={period?.close ?? ""}
                  onChange={(event) => dispatch({ type: "SET_HOUR_TIME", index, field: "close", value: event.target.value })}
                  aria-label={`Hora de fecho — ${entry.label}`}
                />
              </div>
              {errors?.[index] ? <p className="admin-field-error">{errors[index]}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

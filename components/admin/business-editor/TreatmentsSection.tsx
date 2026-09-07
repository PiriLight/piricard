"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

/**
 * Nested editor: treatment_groups -> treatment_items. Same card/stack shape
 * as the menu editor, existing domain fields only (id, title, description,
 * items).
 */
export default function TreatmentsSection({
  draft,
  dispatch,
  disabled,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  disabled?: boolean;
}) {
  const groups = draft.treatmentGroups ?? [];

  return (
    <div className="admin-form-section">
      {disabled ? <p className="admin-field-hint admin-module-disabled-notice">Módulo desativado — só leitura.</p> : null}
      {groups.length === 0 ? <p className="admin-field-hint">Ainda não há grupos de tratamentos.</p> : null}

      {groups.map((group, groupIndex) => (
        <div className="admin-nested-card" key={groupIndex}>
          <div className="admin-nested-card-header">
            <input
              type="text"
              className="admin-nested-card-title-input"
              placeholder="Título do grupo"
              value={group.title}
              disabled={disabled}
              onChange={(event) => dispatch({ type: "UPDATE_TREATMENT_GROUP", index: groupIndex, patch: { title: event.target.value } })}
            />
            <div className="admin-nested-card-header-actions">
              <button
                type="button"
                className="admin-icon-button"
                disabled={disabled || groupIndex === 0}
                onClick={() => dispatch({ type: "MOVE_TREATMENT_GROUP", index: groupIndex, direction: "up" })}
                aria-label="Mover grupo para cima"
              >
                ↑
              </button>
              <button
                type="button"
                className="admin-icon-button"
                disabled={disabled || groupIndex === groups.length - 1}
                onClick={() => dispatch({ type: "MOVE_TREATMENT_GROUP", index: groupIndex, direction: "down" })}
                aria-label="Mover grupo para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                className="admin-remove-button"
                disabled={disabled}
                onClick={() => dispatch({ type: "REMOVE_TREATMENT_GROUP", index: groupIndex })}
              >
                Remover grupo
              </button>
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor={`treatment-desc-${groupIndex}`}>Descrição</label>
            <input
              id={`treatment-desc-${groupIndex}`}
              type="text"
              value={group.description}
              disabled={disabled}
              onChange={(event) =>
                dispatch({ type: "UPDATE_TREATMENT_GROUP", index: groupIndex, patch: { description: event.target.value } })
              }
            />
          </div>

          <div className="admin-nested-card-items">
            {group.items.map((item, itemIndex) => (
              <div className="admin-nested-item-row" key={itemIndex}>
                <input
                  type="text"
                  placeholder="Tratamento"
                  aria-label="Tratamento"
                  value={item}
                  disabled={disabled}
                  onChange={(event) => dispatch({ type: "UPDATE_TREATMENT_ITEM", groupIndex, itemIndex, value: event.target.value })}
                />
                <div className="admin-nested-item-actions">
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={disabled || itemIndex === 0}
                    onClick={() => dispatch({ type: "MOVE_TREATMENT_ITEM", groupIndex, itemIndex, direction: "up" })}
                    aria-label="Mover item para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={disabled || itemIndex === group.items.length - 1}
                    onClick={() => dispatch({ type: "MOVE_TREATMENT_ITEM", groupIndex, itemIndex, direction: "down" })}
                    aria-label="Mover item para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-remove-button"
                    disabled={disabled}
                    onClick={() => dispatch({ type: "REMOVE_TREATMENT_ITEM", groupIndex, itemIndex })}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="admin-add-button"
              disabled={disabled}
              onClick={() => dispatch({ type: "ADD_TREATMENT_ITEM", groupIndex })}
            >
              + Adicionar item
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="admin-add-button" disabled={disabled} onClick={() => dispatch({ type: "ADD_TREATMENT_GROUP" })}>
        + Adicionar grupo
      </button>
    </div>
  );
}

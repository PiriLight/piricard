"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction, SimpleListField } from "./reducer";

/**
 * Shared editor for the three ordered string lists that share an identical
 * shape: services, representedBrands, productCategories. No description
 * field — the current domain model doesn't have one for these (see
 * lib/businesses.ts), so this deliberately doesn't invent one.
 */
export default function SimpleListSection({
  draft,
  dispatch,
  list,
  itemLabel,
  addLabel,
  disabled,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  list: SimpleListField;
  itemLabel: string;
  addLabel: string;
  disabled?: boolean;
}) {
  const items = draft[list] ?? [];

  return (
    <div className="admin-form-section">
      {disabled ? <p className="admin-field-hint admin-module-disabled-notice">Módulo desativado — só leitura.</p> : null}
      {items.length === 0 ? <p className="admin-field-hint">Ainda não há itens.</p> : null}

      {items.map((value, index) => (
        <div className="admin-simple-list-row" key={index}>
          <input
            type="text"
            aria-label={`${itemLabel} ${index + 1}`}
            value={value}
            disabled={disabled}
            onChange={(event) => dispatch({ type: "UPDATE_LIST_ITEM", list, index, value: event.target.value })}
          />
          <div className="admin-simple-list-actions">
            <button
              type="button"
              className="admin-icon-button"
              disabled={disabled || index === 0}
              onClick={() => dispatch({ type: "MOVE_LIST_ITEM", list, index, direction: "up" })}
              aria-label="Mover para cima"
            >
              ↑
            </button>
            <button
              type="button"
              className="admin-icon-button"
              disabled={disabled || index === items.length - 1}
              onClick={() => dispatch({ type: "MOVE_LIST_ITEM", list, index, direction: "down" })}
              aria-label="Mover para baixo"
            >
              ↓
            </button>
            <button
              type="button"
              className="admin-remove-button"
              disabled={disabled}
              onClick={() => dispatch({ type: "REMOVE_LIST_ITEM", list, index })}
            >
              Remover
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="admin-add-button" disabled={disabled} onClick={() => dispatch({ type: "ADD_LIST_ITEM", list })}>
        + {addLabel}
      </button>
    </div>
  );
}

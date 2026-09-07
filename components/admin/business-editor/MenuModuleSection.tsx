"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

/**
 * Nested editor: menu_sections -> menu_items. Cards stack vertically (no
 * table), so this stays usable at ~390px — up/down buttons instead of
 * drag-and-drop, per the phase's explicit "no drag-and-drop" rule.
 */
export default function MenuModuleSection({
  draft,
  dispatch,
  disabled,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  disabled?: boolean;
}) {
  const sections = draft.menu ?? [];

  return (
    <div className="admin-form-section">
      {disabled ? <p className="admin-field-hint admin-module-disabled-notice">Módulo desativado — só leitura.</p> : null}
      {sections.length === 0 ? <p className="admin-field-hint">Ainda não há secções de menu.</p> : null}

      {sections.map((section, sectionIndex) => (
        <div className="admin-nested-card" key={sectionIndex}>
          <div className="admin-nested-card-header">
            <input
              type="text"
              className="admin-nested-card-title-input"
              placeholder="Título da secção"
              value={section.title}
              disabled={disabled}
              onChange={(event) => dispatch({ type: "UPDATE_MENU_SECTION_TITLE", index: sectionIndex, value: event.target.value })}
            />
            <div className="admin-nested-card-header-actions">
              <button
                type="button"
                className="admin-icon-button"
                disabled={disabled || sectionIndex === 0}
                onClick={() => dispatch({ type: "MOVE_MENU_SECTION", index: sectionIndex, direction: "up" })}
                aria-label="Mover secção para cima"
              >
                ↑
              </button>
              <button
                type="button"
                className="admin-icon-button"
                disabled={disabled || sectionIndex === sections.length - 1}
                onClick={() => dispatch({ type: "MOVE_MENU_SECTION", index: sectionIndex, direction: "down" })}
                aria-label="Mover secção para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                className="admin-remove-button"
                disabled={disabled}
                onClick={() => dispatch({ type: "REMOVE_MENU_SECTION", index: sectionIndex })}
              >
                Remover secção
              </button>
            </div>
          </div>

          <div className="admin-nested-card-items">
            {section.items.map((item, itemIndex) => (
              <div className="admin-nested-item-row" key={itemIndex}>
                <input
                  type="text"
                  placeholder="Nome do prato"
                  aria-label="Nome do prato"
                  value={item.name}
                  disabled={disabled}
                  onChange={(event) =>
                    dispatch({ type: "UPDATE_MENU_ITEM", sectionIndex, itemIndex, patch: { name: event.target.value } })
                  }
                />
                <input
                  type="text"
                  placeholder="Preço (opcional)"
                  aria-label="Preço"
                  value={item.price ?? ""}
                  disabled={disabled}
                  onChange={(event) =>
                    dispatch({ type: "UPDATE_MENU_ITEM", sectionIndex, itemIndex, patch: { price: event.target.value } })
                  }
                />
                <div className="admin-nested-item-actions">
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={disabled || itemIndex === 0}
                    onClick={() => dispatch({ type: "MOVE_MENU_ITEM", sectionIndex, itemIndex, direction: "up" })}
                    aria-label="Mover prato para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={disabled || itemIndex === section.items.length - 1}
                    onClick={() => dispatch({ type: "MOVE_MENU_ITEM", sectionIndex, itemIndex, direction: "down" })}
                    aria-label="Mover prato para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-remove-button"
                    disabled={disabled}
                    onClick={() => dispatch({ type: "REMOVE_MENU_ITEM", sectionIndex, itemIndex })}
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
              onClick={() => dispatch({ type: "ADD_MENU_ITEM", sectionIndex })}
            >
              + Adicionar prato
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="admin-add-button" disabled={disabled} onClick={() => dispatch({ type: "ADD_MENU_SECTION" })}>
        + Adicionar secção
      </button>
    </div>
  );
}

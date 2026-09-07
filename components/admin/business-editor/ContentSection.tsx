"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

export default function ContentSection({
  draft,
  dispatch,
  errors,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  errors: { name?: string; category?: string; directoryDescription?: string };
}) {
  const paragraphs = draft.about?.paragraphs ?? [];

  return (
    <div className="admin-form-section">
      <div className="admin-field">
        <label htmlFor="field-name">Nome</label>
        <input
          id="field-name"
          type="text"
          value={draft.name}
          onChange={(event) => dispatch({ type: "SET_CONTENT_FIELD", field: "name", value: event.target.value })}
        />
        {errors.name ? <p className="admin-field-error">{errors.name}</p> : null}
      </div>

      <div className="admin-field">
        <label htmlFor="field-category">Categoria</label>
        <input
          id="field-category"
          type="text"
          value={draft.category}
          onChange={(event) => dispatch({ type: "SET_CONTENT_FIELD", field: "category", value: event.target.value })}
        />
        {errors.category ? <p className="admin-field-error">{errors.category}</p> : null}
      </div>

      <div className="admin-field">
        <label htmlFor="field-directory-description">Descrição do diretório</label>
        <textarea
          id="field-directory-description"
          rows={2}
          value={draft.directoryDescription}
          onChange={(event) => dispatch({ type: "SET_CONTENT_FIELD", field: "directoryDescription", value: event.target.value })}
        />
        <p className="admin-field-hint">Mostrada nos cartões do diretório público.</p>
        {errors.directoryDescription ? <p className="admin-field-error">{errors.directoryDescription}</p> : null}
      </div>

      <div className="admin-field">
        <label htmlFor="field-profile-description">Descrição do perfil</label>
        <textarea
          id="field-profile-description"
          rows={2}
          value={draft.profileDescription ?? ""}
          onChange={(event) => dispatch({ type: "SET_CONTENT_FIELD", field: "profileDescription", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-positioning">Positioning</label>
        <input
          id="field-positioning"
          type="text"
          value={draft.positioning ?? ""}
          onChange={(event) => dispatch({ type: "SET_CONTENT_FIELD", field: "positioning", value: event.target.value })}
        />
      </div>

      <fieldset className="admin-fieldset">
        <legend>Sobre</legend>
        <div className="admin-field">
          <label htmlFor="field-about-heading">Título</label>
          <input
            id="field-about-heading"
            type="text"
            value={draft.about?.heading ?? ""}
            onChange={(event) => dispatch({ type: "SET_ABOUT_HEADING", value: event.target.value })}
          />
        </div>

        {paragraphs.map((paragraph, index) => (
          <div className="admin-field admin-field-with-remove" key={index}>
            <label htmlFor={`field-about-paragraph-${index}`}>Parágrafo {index + 1}</label>
            <div className="admin-field-row">
              <textarea
                id={`field-about-paragraph-${index}`}
                rows={3}
                value={paragraph}
                onChange={(event) => dispatch({ type: "SET_ABOUT_PARAGRAPH", index, value: event.target.value })}
              />
              <button
                type="button"
                className="admin-remove-button"
                onClick={() => dispatch({ type: "REMOVE_ABOUT_PARAGRAPH", index })}
                aria-label={`Remover parágrafo ${index + 1}`}
              >
                Remover
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="admin-add-button" onClick={() => dispatch({ type: "ADD_ABOUT_PARAGRAPH" })}>
          + Adicionar parágrafo
        </button>
      </fieldset>
    </div>
  );
}

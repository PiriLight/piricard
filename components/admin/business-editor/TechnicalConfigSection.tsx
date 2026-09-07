"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

type ReviewSnapshot = NonNullable<Business["reviewSnapshot"]>;
type ExternalLinks = NonNullable<Business["externalLinks"]>;
type DigitalCard = NonNullable<Business["digitalCard"]>;

const EMPTY_REVIEW_SNAPSHOT: ReviewSnapshot = { rating: 0, count: 0, source: "", asOf: "" };
const EMPTY_EXTERNAL_LINKS: ExternalLinks = { tripAdvisor: "", delivery: "", collection: "" };

/**
 * "Configuração técnica" — platform-admin-only fields: slug, technical/
 * Google fields, review fallback, external delivery/review links, digital
 * card config, featured/indexable. Structured controls only, no raw JSON
 * editor. Slug rule: freely editable while unpublished; the save action
 * (admin_update_business_config) itself rejects a slug change once
 * published — see the RPC's own comment for why.
 */
export default function TechnicalConfigSection({
  draft,
  dispatch,
  published,
  errors,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  published: boolean;
  errors?: {
    slug?: string;
    mapsUrl?: string;
    reviewUrl?: string;
    reviewWriteUrl?: string;
    externalLinks?: Record<string, string>;
  };
}) {
  const reviewSnapshot = draft.reviewSnapshot ?? EMPTY_REVIEW_SNAPSHOT;
  const externalLinks = draft.externalLinks ?? EMPTY_EXTERNAL_LINKS;
  const digitalCard: DigitalCard = draft.digitalCard ?? { path: "", format: "PNG" };

  function updateReviewSnapshot(patch: Partial<ReviewSnapshot>) {
    dispatch({ type: "SET_REVIEW_SNAPSHOT", value: { ...reviewSnapshot, ...patch } });
  }

  function updateExternalLinks(patch: Partial<ExternalLinks>) {
    dispatch({ type: "SET_EXTERNAL_LINKS", value: { ...externalLinks, ...patch } });
  }

  function updateDigitalCard(patch: Partial<DigitalCard>) {
    dispatch({ type: "SET_DIGITAL_CARD", value: { ...digitalCard, ...patch } });
  }

  return (
    <div className="admin-form-section">
      {published ? (
        <p className="admin-field-hint admin-module-disabled-notice">
          Negócio publicado — o slug fica bloqueado. Para o alterar, é necessário despublicar primeiro.
        </p>
      ) : null}

      <fieldset className="admin-fieldset">
        <legend>Identidade</legend>
        <div className="admin-field">
          <label htmlFor="tech-slug">Slug</label>
          <input
            id="tech-slug"
            type="text"
            disabled={published}
            value={draft.slug}
            onChange={(event) => dispatch({ type: "SET_TECHNICAL_FIELD", field: "slug", value: event.target.value })}
          />
          <p className="admin-field-hint">Minúsculas, números e hífens. Nunca é reutilizado depois de um negócio ser arquivado.</p>
          {errors?.slug ? <p className="admin-field-error">{errors.slug}</p> : null}
        </div>
        <div className="admin-field">
          <label htmlFor="tech-organization">Nome legal da organização</label>
          <input
            id="tech-organization"
            type="text"
            value={draft.organization}
            onChange={(event) => dispatch({ type: "SET_TECHNICAL_FIELD", field: "organization", value: event.target.value })}
          />
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Google / Maps</legend>
        <div className="admin-field">
          <label htmlFor="tech-maps-url">URL do Google Maps</label>
          <input
            id="tech-maps-url"
            type="url"
            placeholder="https://…"
            value={draft.location?.mapsUrl ?? ""}
            onChange={(event) => dispatch({ type: "SET_LOCATION_FIELD", field: "mapsUrl", value: event.target.value })}
          />
          {errors?.mapsUrl ? <p className="admin-field-error">{errors.mapsUrl}</p> : null}
        </div>
        <div className="admin-field">
          <label htmlFor="tech-place-id">Google Place ID</label>
          <input
            id="tech-place-id"
            type="text"
            value={draft.googlePlaceId ?? ""}
            onChange={(event) => dispatch({ type: "SET_TECHNICAL_FIELD", field: "googlePlaceId", value: event.target.value })}
          />
          <p className="admin-field-hint">Só a partir de uma fonte verificada (o próprio Google Place ID Finder).</p>
        </div>
        <div className="admin-field">
          <label htmlFor="tech-review-url">URL de avaliações</label>
          <input
            id="tech-review-url"
            type="url"
            placeholder="https://…"
            value={draft.reviewUrl ?? ""}
            onChange={(event) => dispatch({ type: "SET_TECHNICAL_FIELD", field: "reviewUrl", value: event.target.value })}
          />
          {errors?.reviewUrl ? <p className="admin-field-error">{errors.reviewUrl}</p> : null}
        </div>
        <div className="admin-field">
          <label htmlFor="tech-review-write-url">URL para deixar avaliação</label>
          <input
            id="tech-review-write-url"
            type="url"
            placeholder="https://…"
            value={draft.reviewWriteUrl ?? ""}
            onChange={(event) => dispatch({ type: "SET_TECHNICAL_FIELD", field: "reviewWriteUrl", value: event.target.value })}
          />
          {errors?.reviewWriteUrl ? <p className="admin-field-error">{errors.reviewWriteUrl}</p> : null}
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Avaliação de reserva (fallback)</legend>
        <p className="admin-field-hint">Mostrada apenas se a consulta em direto ao Google não estiver disponível.</p>
        <div className="admin-field">
          <label htmlFor="review-rating">Pontuação (0–5)</label>
          <input
            id="review-rating"
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={reviewSnapshot.rating || ""}
            onChange={(event) => updateReviewSnapshot({ rating: Number(event.target.value) || 0 })}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="review-count">Número de avaliações</label>
          <input
            id="review-count"
            type="number"
            min={0}
            value={reviewSnapshot.count || ""}
            onChange={(event) => updateReviewSnapshot({ count: Number(event.target.value) || 0 })}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="review-source">Fonte</label>
          <input id="review-source" type="text" placeholder="Google" value={reviewSnapshot.source} onChange={(event) => updateReviewSnapshot({ source: event.target.value })} />
        </div>
        <div className="admin-field">
          <label htmlFor="review-as-of">Consultado em</label>
          <input
            id="review-as-of"
            type="text"
            placeholder="07.09.2026"
            value={reviewSnapshot.asOf}
            onChange={(event) => updateReviewSnapshot({ asOf: event.target.value })}
          />
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Ligações externas</legend>
        <div className="admin-field">
          <label htmlFor="ext-tripadvisor">TripAdvisor</label>
          <input id="ext-tripadvisor" type="url" placeholder="https://…" value={externalLinks.tripAdvisor ?? ""} onChange={(event) => updateExternalLinks({ tripAdvisor: event.target.value })} />
          {errors?.externalLinks?.tripAdvisor ? <p className="admin-field-error">{errors.externalLinks.tripAdvisor}</p> : null}
        </div>
        <div className="admin-field">
          <label htmlFor="ext-delivery">Entrega (Glovo, Uber Eats, …)</label>
          <input id="ext-delivery" type="url" placeholder="https://…" value={externalLinks.delivery ?? ""} onChange={(event) => updateExternalLinks({ delivery: event.target.value })} />
          {errors?.externalLinks?.delivery ? <p className="admin-field-error">{errors.externalLinks.delivery}</p> : null}
        </div>
        <div className="admin-field">
          <label htmlFor="ext-collection">Recolha (Too Good To Go, …)</label>
          <input id="ext-collection" type="url" placeholder="https://…" value={externalLinks.collection ?? ""} onChange={(event) => updateExternalLinks({ collection: event.target.value })} />
          {errors?.externalLinks?.collection ? <p className="admin-field-error">{errors.externalLinks.collection}</p> : null}
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Cartão digital</legend>
        <div className="admin-field">
          <label htmlFor="digital-card-path">Caminho do ficheiro</label>
          <input id="digital-card-path" type="text" placeholder="/pdfs/piricard-exemplo.pdf" value={digitalCard.path} onChange={(event) => updateDigitalCard({ path: event.target.value })} />
        </div>
        <div className="admin-field">
          <label htmlFor="digital-card-format">Formato</label>
          <select id="digital-card-format" value={digitalCard.format} onChange={(event) => updateDigitalCard({ format: event.target.value as DigitalCard["format"] })}>
            <option value="PNG">PNG</option>
            <option value="PDF">PDF</option>
          </select>
        </div>
      </fieldset>

      <fieldset className="admin-fieldset admin-platform-controls">
        <legend>Controlos da plataforma PiriLight</legend>
        <p className="admin-field-hint">
          Estes valores já podem ser editados aqui, mas só passam a afetar o diretório público quando a Fase 4C ligar
          a renderização pública à base de dados.
        </p>
        <label className="admin-checkbox-field">
          <input type="checkbox" checked={draft.featured} onChange={(event) => dispatch({ type: "SET_FEATURED", value: event.target.checked })} />
          Destacado no diretório
        </label>
        <label className="admin-checkbox-field">
          <input type="checkbox" checked={draft.indexable} onChange={(event) => dispatch({ type: "SET_INDEXABLE", value: event.target.checked })} />
          Indexável pelos motores de busca
        </label>
      </fieldset>
    </div>
  );
}

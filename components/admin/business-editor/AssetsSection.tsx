"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

/**
 * Metadata/path editing only — no uploader, no Storage, no image processing
 * (Phase 4B.5/4B.6 explicit non-goals). Logo/cover stay PiriLight-controlled:
 * staff type the path/URL of an already-published asset. `qrCode` is
 * deliberately NOT editable here — it's tied to a business's real, already
 * generated/printed QR asset (scripts/generate-piricard-qrs.ts) and editing
 * it here would risk desyncing it from the physical product.
 */
export default function AssetsSection({ draft, dispatch }: { draft: Business; dispatch: React.Dispatch<DraftAction> }) {
  const assets = draft.assets;

  return (
    <div className="admin-form-section">
      <p className="admin-field-hint">
        Caminho ou URL de imagens já publicadas — sem upload nesta fase. O QR Code não é editável aqui.
      </p>

      <div className="admin-field">
        <label htmlFor="asset-logo">Logótipo</label>
        <input
          id="asset-logo"
          type="text"
          placeholder="/clients/exemplo/logo.png"
          value={assets.logo ?? ""}
          onChange={(event) => dispatch({ type: "SET_ASSET_FIELD", field: "logo", value: event.target.value })}
        />
      </div>

      <label className="admin-checkbox-field">
        <input
          type="checkbox"
          checked={assets.logoOnLight ?? false}
          onChange={(event) => dispatch({ type: "SET_ASSET_FIELD", field: "logoOnLight", value: event.target.checked })}
        />
        O logótipo precisa de fundo claro (é transparente)
      </label>

      <div className="admin-field">
        <label htmlFor="asset-cover">Imagem de capa</label>
        <input
          id="asset-cover"
          type="text"
          placeholder="/clients/exemplo/cover/fachada.webp"
          value={assets.cover ?? ""}
          onChange={(event) => dispatch({ type: "SET_ASSET_FIELD", field: "cover", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="asset-cover-alt">Texto alternativo da capa</label>
        <input
          id="asset-cover-alt"
          type="text"
          value={assets.coverAlt ?? ""}
          onChange={(event) => dispatch({ type: "SET_ASSET_FIELD", field: "coverAlt", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="asset-social-image">Imagem para partilha (redes sociais)</label>
        <input
          id="asset-social-image"
          type="text"
          placeholder="/clients/exemplo/cover/fachada.webp"
          value={assets.socialImage ?? ""}
          onChange={(event) => dispatch({ type: "SET_ASSET_FIELD", field: "socialImage", value: event.target.value })}
        />
      </div>

      <fieldset className="admin-fieldset">
        <legend>Avançado (impressão)</legend>
        <div className="admin-field">
          <label htmlFor="asset-print-logo">Logótipo vetorial de impressão</label>
          <input
            id="asset-print-logo"
            type="text"
            placeholder="/brand/exemplo-symbol.svg"
            value={assets.printLogo ?? ""}
            onChange={(event) => dispatch({ type: "SET_ASSET_FIELD", field: "printLogo", value: event.target.value })}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="asset-print-logo-color">Cor do logótipo de impressão</label>
          <input
            id="asset-print-logo-color"
            type="text"
            placeholder="#4f8ffb"
            value={assets.printLogoColor ?? ""}
            onChange={(event) => dispatch({ type: "SET_ASSET_FIELD", field: "printLogoColor", value: event.target.value })}
          />
        </div>
      </fieldset>
    </div>
  );
}

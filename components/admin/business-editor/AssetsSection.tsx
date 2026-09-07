"use client";

import type { Business } from "@/lib/businesses";
import ImageUploadField from "./ImageUploadField";
import type { DraftAction } from "./reducer";

/**
 * Phase 4H: logo/cover can now be uploaded directly to Supabase Storage
 * (see ImageUploadField + app/admin/(protected)/businesses/storage-actions.ts)
 * as well as typed/pasted as a plain path or URL — the text field is kept
 * for backward compatibility with the 4 real businesses' existing legacy
 * `/clients/...` paths and for anyone who wants to reference an
 * already-published external asset directly, matching the pre-4H contract.
 * A successful upload just dispatches the SAME SET_ASSET_FIELD action the
 * text field already used — no new draft/state shape. `qrCode` is
 * deliberately NOT editable here — it's tied to a business's real, already
 * generated/printed QR asset (scripts/generate-piricard-qrs.ts) and editing
 * it here would risk desyncing it from the physical product.
 */
export default function AssetsSection({ businessId, draft, dispatch }: { businessId: string; draft: Business; dispatch: React.Dispatch<DraftAction> }) {
  const assets = draft.assets;

  return (
    <div className="admin-form-section">
      <p className="admin-field-hint">
        Carrega uma imagem ou indica o caminho/URL de uma imagem já publicada. O QR Code não é editável aqui.
      </p>

      <div className="admin-field">
        <label htmlFor="asset-logo">Logótipo</label>
        <ImageUploadField
          businessKey={businessId}
          kind="logo"
          label="logótipo"
          currentValue={assets.logo}
          onUploaded={(publicUrl) => dispatch({ type: "SET_ASSET_FIELD", field: "logo", value: publicUrl })}
        />
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
        <ImageUploadField
          businessKey={businessId}
          kind="cover"
          label="capa"
          currentValue={assets.cover}
          onUploaded={(publicUrl) => dispatch({ type: "SET_ASSET_FIELD", field: "cover", value: publicUrl })}
        />
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

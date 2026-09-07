"use client";

import type { Business } from "@/lib/businesses";
import type { DraftAction } from "./reducer";

export default function ContactsSection({
  draft,
  dispatch,
  errors,
}: {
  draft: Business;
  dispatch: React.Dispatch<DraftAction>;
  errors: { email?: string; website?: string };
}) {
  return (
    <div className="admin-form-section">
      <div className="admin-field">
        <label htmlFor="field-phone">Telefone</label>
        <input
          id="field-phone"
          type="tel"
          value={draft.contact.phone ?? ""}
          onChange={(event) => dispatch({ type: "SET_CONTACT_FIELD", field: "phone", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-whatsapp">WhatsApp</label>
        <input
          id="field-whatsapp"
          type="tel"
          value={draft.contact.whatsapp ?? ""}
          onChange={(event) => dispatch({ type: "SET_CONTACT_FIELD", field: "whatsapp", value: event.target.value })}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="field-email">Email</label>
        <input
          id="field-email"
          type="email"
          value={draft.contact.email ?? ""}
          onChange={(event) => dispatch({ type: "SET_CONTACT_FIELD", field: "email", value: event.target.value })}
        />
        {errors.email ? <p className="admin-field-error">{errors.email}</p> : null}
      </div>

      <div className="admin-field">
        <label htmlFor="field-website">Website</label>
        <input
          id="field-website"
          type="url"
          placeholder="https://…"
          value={draft.contact.website ?? ""}
          onChange={(event) => dispatch({ type: "SET_CONTACT_FIELD", field: "website", value: event.target.value })}
        />
        {errors.website ? <p className="admin-field-error">{errors.website}</p> : null}
      </div>
    </div>
  );
}

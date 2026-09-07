"use client";

import { useState } from "react";
import type { Business } from "@/lib/businesses";
import { BusinessProfile } from "@/components/BusinessProfile";

/**
 * Renders the REAL public profile component tree from local draft state —
 * no fork, no second rendering system. `business` here is always the
 * in-memory draft, never fetched again, so edits show up immediately without
 * saving and never touch Supabase.
 */
export default function PreviewPane({ business }: { business: Business }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");

  return (
    <div className="admin-preview-pane">
      <div className="admin-preview-toolbar">
        <span className="admin-preview-label">Pré-visualização</span>
        <div className="admin-preview-device-toggle" role="group" aria-label="Largura da pré-visualização">
          <button type="button" className={device === "mobile" ? "is-active" : ""} onClick={() => setDevice("mobile")}>
            Telemóvel
          </button>
          <button type="button" className={device === "desktop" ? "is-active" : ""} onClick={() => setDevice("desktop")}>
            Desktop
          </button>
        </div>
      </div>
      <div className="admin-preview-viewport">
        <div className={`admin-preview-frame admin-preview-frame-${device}`}>
          <BusinessProfile business={business} />
        </div>
      </div>
    </div>
  );
}

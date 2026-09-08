"use client";

import type { Business } from "@/lib/businesses";
import { BusinessProfile } from "@/components/BusinessProfile";

/**
 * Renders the REAL public profile component tree from local draft state —
 * no fork, no second rendering system. `business` here is always the
 * in-memory draft, never fetched again, so edits show up immediately without
 * saving and never touch Supabase.
 *
 * Single-layout change: individual PiriCard pages now have exactly one
 * visual layout (the mobile one) at every viewport size — see
 * app/profile-layout.css. There is no longer a distinct "desktop" version
 * of a card to preview, so the old Mobile/Desktop device-toggle here is
 * gone; there is just one Preview, and it renders at the same canonical
 * width the public page itself now uses everywhere (see
 * .admin-preview-frame in app/admin/admin.css).
 */
export default function PreviewPane({ business }: { business: Business }) {
  return (
    <div className="admin-preview-pane">
      <div className="admin-preview-toolbar">
        <span className="admin-preview-label">Pré-visualização</span>
      </div>
      <div className="admin-preview-viewport">
        <div className="admin-preview-frame">
          <BusinessProfile business={business} />
        </div>
      </div>
    </div>
  );
}

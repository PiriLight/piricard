import Link from "next/link";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";

const PIRILIGHT_HREF = "https://pirilight.pt";

/**
 * Shared platform-level footer — PiriLight branding + copyright, used
 * identically by the directory homepage (app/page.tsx) and the PiriCard
 * marketing page (components/PiriCardCommercialPage.tsx). Kept as one
 * component so the two footers never drift, and so the discreet internal
 * "Acesso" link below only needs to exist once rather than being duplicated
 * per page.
 *
 * "Acesso" links to the existing internal admin login (`/admin/login` —
 * see app/admin/login/page.tsx) — not a customer/client login, which this
 * project doesn't have. Deliberately unstyled beyond `.platform-footer-admin-link`
 * (see app/globals.css): no icon, no button chrome, just a small muted line
 * under the normal footer content.
 */
export function PlatformFooter() {
  return (
    <footer className="platform-footer">
      <a href={PIRILIGHT_HREF} target="_blank" rel="noopener noreferrer">
        <PiriCardBrandMark wordmark={<span>Piri<span>Light</span> Studio</span>} />
      </a>
      <p>© 2026 PiriLight Studio. Todos os direitos reservados.</p>
      <Link className="platform-footer-admin-link" href="/admin/login">
        Acesso
      </Link>
    </footer>
  );
}

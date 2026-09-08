import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BusinessListTable, { type AdminBusinessListItem } from "@/components/admin/BusinessListTable";

export const metadata: Metadata = {
  title: "Negócios",
  robots: { index: false, follow: false },
};

type BusinessRow = {
  id: string;
  slug: string;
  layout_variant: string;
  published: boolean;
  archived_at: string | null;
};

type ProfileContentRow = {
  business_id: string;
  name: string;
  category: string;
};

export default async function AdminBusinessListPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; storageWarning?: string }>;
}) {
  const { deleted, storageWarning } = await searchParams;
  const supabase = await createClient();

  // The platform-admin RLS branch (security.is_platform_admin(), tested in
  // Phase 4B.1/4B.2A) is what makes this return every business — published,
  // unpublished, and archived alike — not just the public-readable ones.
  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id, slug, layout_variant, published, archived_at")
    .order("created_at", { ascending: false })
    .returns<BusinessRow[]>();

  if (businessesError) {
    return (
      <section className="admin-list-error">
        <h1>Negócios</h1>
        <p>Não foi possível carregar a lista de negócios. Tenta novamente.</p>
      </section>
    );
  }

  const businessIds = (businesses ?? []).map((business) => business.id);
  const contentByBusinessId = new Map<string, { name: string; category: string }>();

  if (businessIds.length > 0) {
    const { data: profileContent } = await supabase
      .from("business_profile_content")
      .select("business_id, name, category")
      .in("business_id", businessIds)
      .returns<ProfileContentRow[]>();

    for (const row of profileContent ?? []) {
      contentByBusinessId.set(row.business_id, { name: row.name, category: row.category });
    }
  }

  const listItems: AdminBusinessListItem[] = (businesses ?? []).map((business) => ({
    id: business.id,
    slug: business.slug,
    name: contentByBusinessId.get(business.id)?.name ?? "",
    category: contentByBusinessId.get(business.id)?.category ?? "",
    layoutVariant: business.layout_variant,
    published: business.published,
    archived: business.archived_at !== null,
  }));

  return (
    <section className="admin-list">
      {deleted ? (
        <p className="admin-save-success">
          PiriCard &ldquo;{deleted}&rdquo; eliminado permanentemente.
          {storageWarning ? ` ${storageWarning}` : ""}
        </p>
      ) : null}
      <div className="admin-list-header">
        <div>
          <h1>Negócios</h1>
          <p className="admin-list-count">
            {listItems.length > 0 ? `${listItems.length} negócio${listItems.length === 1 ? "" : "s"}` : null}
          </p>
        </div>
        <Link href="/admin/businesses/new" className="admin-save-button admin-create-business-link">
          + Criar PiriCard
        </Link>
      </div>

      {listItems.length === 0 ? (
        <div className="admin-list-empty">
          <p>Ainda não existem PiriCards na base de dados.</p>
          <p className="admin-list-empty-note">
            A criação de novos PiriCards a partir deste painel chega numa fase seguinte.
          </p>
        </div>
      ) : (
        <BusinessListTable businesses={listItems} />
      )}
    </section>
  );
}

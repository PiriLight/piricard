import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mapBusinessFromDatabase, mapModuleActivation } from "@/lib/admin/business-mapping";
import type {
  BusinessHoursRow,
  BusinessModuleRow,
  BusinessProfileContentRow,
  BusinessRow,
  GalleryRow,
  MenuItemRow,
  MenuSectionRow,
  ProductCategoryRow,
  RepresentedBrandRow,
  RestaurantInfoRow,
  ServiceRow,
  SocialLinkRow,
  TreatmentGroupRow,
  TreatmentItemRow,
} from "@/lib/supabase/types";
import BusinessEditor from "@/components/admin/business-editor/BusinessEditor";

export const metadata: Metadata = {
  title: "Editar negócio",
  robots: { index: false, follow: false },
};

interface EditBusinessPageProps {
  params: Promise<{ id: string }>;
}

function NotFoundState() {
  return (
    <section className="admin-list-error">
      <h1>Negócio não encontrado</h1>
      <p>Este PiriCard não existe ou já não está disponível.</p>
      <Link href="/admin" className="admin-back-link">
        ← Voltar à lista
      </Link>
    </section>
  );
}

export default async function EditBusinessPage({ params }: EditBusinessPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // A malformed id (not a UUID) makes Postgres raise an error rather than
  // returning zero rows — treated identically to "not found" so a bad id in
  // the URL never leaks a database error to the admin UI.
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, slug, organization, layout_variant, theme, assets, maps_url, google_place_id, review_url, review_write_url, review_fallback, external_links, digital_card, published, featured, indexable, archived_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<BusinessRow | null>();

  if (businessError || !business) {
    return <NotFoundState />;
  }

  const [
    { data: content },
    { data: hours },
    { data: socialLinks },
    { data: modules },
    { data: services },
    { data: gallery },
    { data: restaurantInfo },
    { data: representedBrands },
    { data: productCategories },
    { data: menuSections },
    { data: menuItems },
    { data: treatmentGroups },
    { data: treatmentItems },
  ] = await Promise.all([
    supabase
      .from("business_profile_content")
      .select(
        "business_id, name, category, directory_description, profile_description, positioning, about, phone, whatsapp, email, website, address, street_address, city, country, updated_at, updated_by",
      )
      .eq("business_id", business.id)
      .maybeSingle()
      .returns<BusinessProfileContentRow | null>(),
    supabase
      .from("business_hours")
      .select("id, business_id, label, days, periods, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<BusinessHoursRow[]>(),
    supabase
      .from("social_links")
      .select("id, business_id, platform, url, label, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<SocialLinkRow[]>(),
    supabase
      .from("business_modules")
      .select("business_id, module_key, enabled, updated_at")
      .eq("business_id", business.id)
      .returns<BusinessModuleRow[]>(),
    supabase
      .from("services")
      .select("id, business_id, label, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<ServiceRow[]>(),
    supabase
      .from("gallery")
      .select("id, business_id, src, alt, aspect_ratio, placeholder_label, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<GalleryRow[]>(),
    supabase
      .from("restaurant_info")
      .select("business_id, average_spend, average_spend_note, cuisine, cuisine_note, updated_at, updated_by")
      .eq("business_id", business.id)
      .maybeSingle()
      .returns<RestaurantInfoRow | null>(),
    supabase
      .from("represented_brands")
      .select("id, business_id, label, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<RepresentedBrandRow[]>(),
    supabase
      .from("product_categories")
      .select("id, business_id, label, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<ProductCategoryRow[]>(),
    supabase
      .from("menu_sections")
      .select("id, business_id, title, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<MenuSectionRow[]>(),
    supabase
      .from("menu_items")
      .select("id, menu_section_id, business_id, name, price, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<MenuItemRow[]>(),
    supabase
      .from("treatment_groups")
      .select("id, business_id, slug_key, title, description, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<TreatmentGroupRow[]>(),
    supabase
      .from("treatment_items")
      .select("id, treatment_group_id, business_id, label, sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .returns<TreatmentItemRow[]>(),
  ]);

  const initialBusiness = mapBusinessFromDatabase({
    business,
    content: content ?? null,
    hours: hours ?? [],
    socialLinks: socialLinks ?? [],
    services: services ?? [],
    gallery: gallery ?? [],
    restaurantInfo: restaurantInfo ?? null,
    representedBrands: representedBrands ?? [],
    productCategories: productCategories ?? [],
    menuSections: menuSections ?? [],
    menuItems: menuItems ?? [],
    treatmentGroups: treatmentGroups ?? [],
    treatmentItems: treatmentItems ?? [],
  });

  const initialModuleActivation = mapModuleActivation(modules ?? []);

  return (
    <section className="admin-editor-page">
      <div className="admin-editor-page-header">
        <Link href="/admin" className="admin-back-link">
          ← Voltar à lista
        </Link>
        <h1>{initialBusiness.name || "Negócio sem nome"}</h1>
      </div>
      <BusinessEditor
        businessId={business.id}
        initialBusiness={initialBusiness}
        initialModuleActivation={initialModuleActivation}
        initialArchivedAt={business.archived_at}
      />
    </section>
  );
}

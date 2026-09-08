"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import type { Business } from "@/lib/businesses";
import {
  buildPreviewBusiness,
  toBusinessConfigPayload,
  toBusinessCoreSavePayload,
  toModuleContentSavePayload,
  type ModuleActivation,
} from "@/lib/admin/business-mapping";
import type { BusinessConfigFieldErrors, BusinessCoreFieldErrors, ModuleContentFieldErrors } from "@/lib/admin/validation";
import {
  saveBusinessConfigAction,
  saveBusinessCoreAction,
  saveModuleContentAction,
  setModuleEnabledAction,
} from "@/app/admin/(protected)/businesses/[id]/edit/actions";
import type { ModuleKey } from "@/lib/supabase/types";
import { businessDraftReducer, createInitialDraft } from "./reducer";
import ContentSection from "./ContentSection";
import ContactsSection from "./ContactsSection";
import LocationSection from "./LocationSection";
import HoursSection from "./HoursSection";
import SocialLinksSection from "./SocialLinksSection";
import ModulesActivationSection from "./ModulesActivationSection";
import SimpleListSection from "./SimpleListSection";
import GallerySection from "./GallerySection";
import RestaurantInfoSection from "./RestaurantInfoSection";
import MenuModuleSection from "./MenuModuleSection";
import TreatmentsSection from "./TreatmentsSection";
import LayoutSection from "./LayoutSection";
import ThemeSection from "./ThemeSection";
import AssetsSection from "./AssetsSection";
import TechnicalConfigSection from "./TechnicalConfigSection";
import PublishSection from "./PublishSection";
import DeleteBusinessSection from "./DeleteBusinessSection";
import PreviewPane from "./PreviewPane";

type SectionKey =
  | "content"
  | "contacts"
  | "location"
  | "hours"
  | "social"
  | "modules"
  | "services"
  | "gallery"
  | "restaurantInfo"
  | "menu"
  | "treatments"
  | "brands"
  | "productCategories"
  | "layout"
  | "theme"
  | "assets"
  | "technical"
  | "publish";

type SectionGroup = "content" | "modules" | "config";

const SECTIONS: ReadonlyArray<{ key: SectionKey; label: string; group: SectionGroup }> = [
  { key: "content", label: "Conteúdo", group: "content" },
  { key: "contacts", label: "Contactos", group: "content" },
  { key: "location", label: "Localização", group: "content" },
  { key: "hours", label: "Horário", group: "content" },
  { key: "social", label: "Redes sociais", group: "content" },
  { key: "modules", label: "Módulos", group: "modules" },
  { key: "services", label: "Serviços", group: "modules" },
  { key: "gallery", label: "Galeria", group: "modules" },
  { key: "restaurantInfo", label: "Restaurante", group: "modules" },
  { key: "menu", label: "Menu", group: "modules" },
  { key: "treatments", label: "Tratamentos", group: "modules" },
  { key: "brands", label: "Marcas", group: "modules" },
  { key: "productCategories", label: "Categorias", group: "modules" },
  { key: "layout", label: "Layout", group: "config" },
  { key: "theme", label: "Aparência", group: "config" },
  { key: "assets", label: "Ativos", group: "config" },
  { key: "technical", label: "Config. técnica", group: "config" },
  { key: "publish", label: "Publicar", group: "config" },
];

type SaveStatus = "idle" | "success" | "error";

/**
 * V1.1, Step 10 — names the specific module tab(s) a failed content save
 * actually flagged, instead of a single generic "revê os módulos" message
 * for every possible cause. Falls back to the old generic wording only if,
 * somehow, the error object carries none of the known keys (defensive —
 * should not happen given validateModuleContent's own return shape).
 */
function describeModuleSaveError(errors: ModuleContentFieldErrors): string {
  const flagged: string[] = [];
  if (errors.gallery || errors.galleryItems) flagged.push("Galeria");
  if (errors.menuSections || errors.menuItems) flagged.push("Menu");
  if (errors.treatmentGroups || errors.treatmentItems) flagged.push("Tratamentos");

  if (flagged.length === 0) return "Conteúdo principal guardado — revê os campos dos módulos assinalados.";
  return `Conteúdo principal guardado — revê ${flagged.join(" e ")} (${flagged.length > 1 ? "campos assinalados" : "campo assinalado"} abaixo).`;
}

/**
 * Orchestrates the full editor: content (business_profile_content/hours/
 * social/modules — Phases 4B.3/4B.4) and protected config (businesses table:
 * layout/theme/assets/technical/publish/archive — Phase 4B.5/4B.6). These
 * are two independent save boundaries with their own dirty tracking and
 * server actions, on purpose — a content edit never risks a protected-config
 * mutation and vice versa. Module ENTITLEMENT and publish/archive lifecycle
 * are each their own third and fourth pieces of state, saved immediately by
 * their own dedicated actions (not part of either "Guardar" button).
 */
export default function BusinessEditor({
  businessId,
  initialBusiness,
  initialModuleActivation,
  initialArchivedAt,
}: {
  businessId: string;
  initialBusiness: Business;
  initialModuleActivation: ModuleActivation;
  initialArchivedAt: string | null;
}) {
  const [draft, dispatch] = useReducer(businessDraftReducer, initialBusiness, createInitialDraft);
  const [contentBaseline, setContentBaseline] = useState<Business>(() => createInitialDraft(initialBusiness));
  const [configBaseline, setConfigBaseline] = useState<Business>(() => createInitialDraft(initialBusiness));
  const [moduleActivation, setModuleActivation] = useState<ModuleActivation>(initialModuleActivation);
  const [published, setPublished] = useState(initialBusiness.published);
  const [archivedAt, setArchivedAt] = useState<string | null>(initialArchivedAt);
  const [activeSection, setActiveSection] = useState<SectionKey>("content");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  // V1.1, Step 10: at least one gallery image is actively uploading right
  // now — Save must wait, since saving mid-upload would persist whatever
  // `draft.gallery` looked like a moment ago and silently drop the result
  // once the upload finishes after the save already happened.
  const [isGalleryUploading, setIsGalleryUploading] = useState(false);

  const [contentSaveStatus, setContentSaveStatus] = useState<SaveStatus>("idle");
  const [contentSaveMessage, setContentSaveMessage] = useState<string | null>(null);
  const [coreFieldErrors, setCoreFieldErrors] = useState<BusinessCoreFieldErrors>({});
  const [moduleFieldErrors, setModuleFieldErrors] = useState<ModuleContentFieldErrors>({});
  const [isSavingContent, startSavingContent] = useTransition();

  const [configSaveStatus, setConfigSaveStatus] = useState<SaveStatus>("idle");
  const [configSaveMessage, setConfigSaveMessage] = useState<string | null>(null);
  const [configFieldErrors, setConfigFieldErrors] = useState<BusinessConfigFieldErrors>({});
  const [isSavingConfig, startSavingConfig] = useTransition();

  const isContentDirty = useMemo(() => {
    const corePayload = JSON.stringify(toBusinessCoreSavePayload(draft));
    const modulePayload = JSON.stringify(toModuleContentSavePayload(draft));
    return corePayload !== JSON.stringify(toBusinessCoreSavePayload(contentBaseline)) || modulePayload !== JSON.stringify(toModuleContentSavePayload(contentBaseline));
  }, [draft, contentBaseline]);

  const isConfigDirty = useMemo(
    () => JSON.stringify(toBusinessConfigPayload(draft)) !== JSON.stringify(toBusinessConfigPayload(configBaseline)),
    [draft, configBaseline],
  );

  const previewBusiness = useMemo(() => buildPreviewBusiness(draft, moduleActivation), [draft, moduleActivation]);
  const activeGroup = SECTIONS.find((section) => section.key === activeSection)?.group ?? "content";

  function handleModuleActivationChange(key: ModuleKey, enabled: boolean) {
    setModuleActivation((current) => ({ ...current, [key]: enabled }));
  }

  // V1.1, Step 11: the Gallery tab's own small activation shortcut reuses
  // this exact same RPC + state-update path — never a second, parallel way
  // to flip business_modules.
  async function handleToggleGalleryModule(enabled: boolean): Promise<boolean> {
    const result = await setModuleEnabledAction(businessId, "gallery", enabled);
    if (result.status === "success") {
      handleModuleActivationChange("gallery", enabled);
      return true;
    }
    return false;
  }

  function handleSaveContent() {
    const corePayload = toBusinessCoreSavePayload(draft);
    const modulePayload = toModuleContentSavePayload(draft);
    const savedSnapshot = draft;

    startSavingContent(async () => {
      setCoreFieldErrors({});
      setModuleFieldErrors({});

      const coreResult = await saveBusinessCoreAction(businessId, corePayload);
      if (coreResult.status === "invalid") {
        setCoreFieldErrors(coreResult.fieldErrors);
        setContentSaveStatus("error");
        setContentSaveMessage("Revê os campos assinalados.");
        return;
      }
      if (coreResult.status === "error") {
        setContentSaveStatus("error");
        setContentSaveMessage(coreResult.message);
        return;
      }

      const moduleResult = await saveModuleContentAction(businessId, moduleActivation, modulePayload);
      if (moduleResult.status === "invalid") {
        setModuleFieldErrors(moduleResult.fieldErrors);
        setContentSaveStatus("error");
        // V1.1, Step 10: name which module tab actually has the problem
        // instead of a one-size-fits-all "revê os módulos" — the admin
        // shouldn't have to click through every tab to find it.
        setContentSaveMessage(describeModuleSaveError(moduleResult.fieldErrors));
        setContentBaseline(savedSnapshot);
        return;
      }
      if (moduleResult.status === "error") {
        setContentSaveStatus("error");
        setContentSaveMessage(moduleResult.message);
        setContentBaseline(savedSnapshot);
        return;
      }

      setContentSaveStatus("success");
      setContentSaveMessage(null);
      setContentBaseline(savedSnapshot);
    });
  }

  function handleSaveConfig() {
    const payload = toBusinessConfigPayload(draft);
    const savedSnapshot = draft;

    startSavingConfig(async () => {
      setConfigFieldErrors({});
      const result = await saveBusinessConfigAction(businessId, payload);
      if (result.status === "invalid") {
        setConfigFieldErrors(result.fieldErrors);
        setConfigSaveStatus("error");
        setConfigSaveMessage("Revê os campos assinalados.");
        return;
      }
      if (result.status === "error") {
        setConfigSaveStatus("error");
        setConfigSaveMessage(result.message);
        return;
      }
      setConfigSaveStatus("success");
      setConfigSaveMessage(null);
      setConfigBaseline(savedSnapshot);
    });
  }

  const isSaving = isSavingContent || isSavingConfig;

  return (
    <div className="admin-editor">
      <div className="admin-editor-toolbar">
        <div className="admin-mobile-view-toggle" role="group" aria-label="Modo de edição">
          <button type="button" className={mobileView === "edit" ? "is-active" : ""} onClick={() => setMobileView("edit")}>
            Editar
          </button>
          <button type="button" className={mobileView === "preview" ? "is-active" : ""} onClick={() => setMobileView("preview")}>
            Pré-visualização
          </button>
        </div>

        <div className="admin-save-bar">
          {activeGroup === "config" && activeSection !== "publish" ? (
            <>
              {configSaveStatus === "error" && configSaveMessage ? <span className="admin-save-error">{configSaveMessage}</span> : null}
              {configSaveStatus === "success" && !isConfigDirty ? <span className="admin-save-success">Configuração guardada</span> : null}
              {isConfigDirty ? <span className="admin-dirty-indicator">Configuração por guardar</span> : null}
              <button type="button" className="admin-save-button" onClick={handleSaveConfig} disabled={isSaving || !isConfigDirty}>
                {isSavingConfig ? "A guardar…" : "Guardar configuração"}
              </button>
            </>
          ) : activeSection !== "publish" ? (
            <>
              {contentSaveStatus === "error" && contentSaveMessage ? <span className="admin-save-error">{contentSaveMessage}</span> : null}
              {contentSaveStatus === "success" && !isContentDirty ? <span className="admin-save-success">Guardado</span> : null}
              {isGalleryUploading ? (
                <span className="admin-dirty-indicator">A enviar imagem da galeria…</span>
              ) : isContentDirty ? (
                <span className="admin-dirty-indicator">Alterações por guardar</span>
              ) : null}
              <button
                type="button"
                className="admin-save-button"
                onClick={handleSaveContent}
                disabled={isSaving || !isContentDirty || isGalleryUploading}
                title={isGalleryUploading ? "Aguarda o fim do envio da imagem antes de guardar." : undefined}
              >
                {isSavingContent ? "A guardar…" : "Guardar"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="admin-editor-body">
        <div className={`admin-editor-form-pane${mobileView === "edit" ? " is-active-mobile" : ""}`}>
          <nav className="admin-section-tabs" aria-label="Secções do editor">
            {SECTIONS.map((section, index) => (
              <button
                key={section.key}
                type="button"
                className={`${activeSection === section.key ? "is-active" : ""}${
                  index > 0 && SECTIONS[index - 1].group !== section.group ? " admin-section-tab-group-start" : ""
                }`}
                onClick={() => setActiveSection(section.key)}
              >
                {section.label}
              </button>
            ))}
          </nav>

          {activeSection === "content" ? <ContentSection draft={draft} dispatch={dispatch} errors={coreFieldErrors} /> : null}
          {activeSection === "contacts" ? <ContactsSection draft={draft} dispatch={dispatch} errors={coreFieldErrors} /> : null}
          {activeSection === "location" ? <LocationSection draft={draft} dispatch={dispatch} /> : null}
          {activeSection === "hours" ? <HoursSection draft={draft} dispatch={dispatch} errors={coreFieldErrors.hours} /> : null}
          {activeSection === "social" ? (
            <SocialLinksSection draft={draft} dispatch={dispatch} errors={coreFieldErrors.socialLinks} />
          ) : null}
          {activeSection === "modules" ? (
            <ModulesActivationSection
              businessId={businessId}
              activation={moduleActivation}
              onChange={handleModuleActivationChange}
            />
          ) : null}
          {activeSection === "services" ? (
            <SimpleListSection
              draft={draft}
              dispatch={dispatch}
              list="services"
              itemLabel="Serviço"
              addLabel="Adicionar serviço"
              disabled={!moduleActivation.services}
            />
          ) : null}
          {activeSection === "gallery" ? (
            <GallerySection
              businessId={businessId}
              draft={draft}
              dispatch={dispatch}
              disabled={!moduleActivation.gallery}
              moduleEnabled={moduleActivation.gallery}
              onToggleModule={handleToggleGalleryModule}
              onUploadingChange={setIsGalleryUploading}
              itemErrors={moduleFieldErrors.galleryItems}
            />
          ) : null}
          {activeSection === "restaurantInfo" ? (
            <RestaurantInfoSection draft={draft} dispatch={dispatch} disabled={!moduleActivation.restaurant_info} />
          ) : null}
          {activeSection === "menu" ? (
            <MenuModuleSection draft={draft} dispatch={dispatch} disabled={!moduleActivation.menu} />
          ) : null}
          {activeSection === "treatments" ? (
            <TreatmentsSection draft={draft} dispatch={dispatch} disabled={!moduleActivation.treatments} />
          ) : null}
          {activeSection === "brands" ? (
            <SimpleListSection
              draft={draft}
              dispatch={dispatch}
              list="representedBrands"
              itemLabel="Marca"
              addLabel="Adicionar marca"
              disabled={!moduleActivation.brands}
            />
          ) : null}
          {activeSection === "productCategories" ? (
            <SimpleListSection
              draft={draft}
              dispatch={dispatch}
              list="productCategories"
              itemLabel="Categoria"
              addLabel="Adicionar categoria"
              disabled={!moduleActivation.product_categories}
            />
          ) : null}
          {/* V1.1: per-item gallery errors (moduleFieldErrors.galleryItems)
              now render inline on the affected card inside GallerySection
              itself (Step 10/14 — "close to the affected image"), so this
              only needs to surface the one TOP-LEVEL gallery message (e.g.
              "too many images") that isn't tied to any single item. */}
          {activeSection === "gallery" && moduleFieldErrors.gallery ? (
            <p className="admin-field-error">{moduleFieldErrors.gallery}</p>
          ) : null}

          {activeSection === "layout" ? <LayoutSection draft={draft} dispatch={dispatch} errors={configFieldErrors} /> : null}
          {activeSection === "theme" ? <ThemeSection draft={draft} dispatch={dispatch} errors={configFieldErrors.theme} /> : null}
          {activeSection === "assets" ? <AssetsSection businessId={businessId} draft={draft} dispatch={dispatch} /> : null}
          {activeSection === "technical" ? (
            <TechnicalConfigSection draft={draft} dispatch={dispatch} published={published} errors={configFieldErrors} />
          ) : null}
          {activeSection === "publish" ? (
            <>
              <PublishSection
                businessId={businessId}
                draft={draft}
                published={published}
                isDirty={isContentDirty || isConfigDirty}
                archivedAt={archivedAt}
                onPublishedChange={setPublished}
                onArchivedChange={setArchivedAt}
              />
              {/* configBaseline/contentBaseline (the last known-persisted
                  snapshot), not `draft` — the confirmation must check
                  against what's actually saved in the database, never an
                  unsaved in-progress slug/name edit. The server re-verifies
                  independently regardless (see deleteBusinessAction). */}
              <DeleteBusinessSection businessId={businessId} slug={configBaseline.slug} name={contentBaseline.name} />
            </>
          ) : null}
        </div>

        <div className={`admin-editor-preview-pane${mobileView === "preview" ? " is-active-mobile" : ""}`}>
          <PreviewPane business={previewBusiness} />
        </div>
      </div>
    </div>
  );
}

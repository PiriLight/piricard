"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LAYOUT_REGISTRY, type LayoutOption } from "@/lib/admin/layout-registry";
import { MODULE_KEYS } from "@/lib/admin/business-mapping";
import type { ModuleKey } from "@/lib/supabase/types";
import { createBusinessAction, type CreateBusinessState } from "@/app/admin/(protected)/businesses/new/actions";
import type { CreateBusinessFormErrors } from "@/lib/admin/validation";

const MODULE_LABELS: Record<ModuleKey, string> = {
  services: "Serviços",
  gallery: "Galeria",
  restaurant_info: "Informação do restaurante",
  menu: "Menu",
  treatments: "Tratamentos",
  brands: "Marcas representadas",
  product_categories: "Categorias de produtos",
};

const COMBINING_DIACRITICS_PATTERN = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_PATTERN, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const defaultLayout: LayoutOption = LAYOUT_REGISTRY.find((layout) => layout.available) ?? LAYOUT_REGISTRY[0];

export default function CreateBusinessWizard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [layoutVariant, setLayoutVariant] = useState(defaultLayout.value);
  const [primaryColor, setPrimaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [logo, setLogo] = useState("");
  const [cover, setCover] = useState("");
  const [enabledModules, setEnabledModules] = useState<Set<ModuleKey>>(new Set());

  const [state, setState] = useState<CreateBusinessState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  const fieldErrors: CreateBusinessFormErrors = state.status === "invalid" ? state.fieldErrors : {};

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function toggleModule(key: ModuleKey) {
    setEnabledModules((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createBusinessAction({
        name,
        category,
        slug,
        layoutVariant,
        enabledModules: Array.from(enabledModules),
        initialPrimaryColor: primaryColor,
        initialAccentColor: accentColor,
        initialLogo: logo,
        initialCover: cover,
      });
      setState(result);
      if (result.status === "success") {
        router.push(`/admin/businesses/${result.businessId}/edit`);
      }
    });
  }

  return (
    <form className="admin-create-wizard" onSubmit={handleSubmit}>
      <fieldset className="admin-fieldset">
        <legend>Passo 1 — Identidade</legend>
        <div className="admin-field">
          <label htmlFor="new-name">Nome</label>
          <input id="new-name" type="text" value={name} onChange={(event) => handleNameChange(event.target.value)} required />
          {fieldErrors.name ? <p className="admin-field-error">{fieldErrors.name}</p> : null}
        </div>
        <div className="admin-field">
          <label htmlFor="new-category">Categoria</label>
          <input id="new-category" type="text" value={category} onChange={(event) => setCategory(event.target.value)} required />
          {fieldErrors.category ? <p className="admin-field-error">{fieldErrors.category}</p> : null}
        </div>
        <div className="admin-field">
          <label htmlFor="new-slug">Slug</label>
          <input
            id="new-slug"
            type="text"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            required
          />
          <p className="admin-field-hint">Gerado a partir do nome — pode ser ajustado agora; fica bloqueado depois de publicado.</p>
          {fieldErrors.slug ? <p className="admin-field-error">{fieldErrors.slug}</p> : null}
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Passo 2 — Layout</legend>
        <div className="admin-layout-options">
          {LAYOUT_REGISTRY.map((layout) => (
            <label
              key={layout.value}
              className={`admin-layout-option${layoutVariant === layout.value ? " is-selected" : ""}${layout.available ? "" : " is-unavailable"}`}
            >
              <input
                type="radio"
                name="new-layout"
                value={layout.value}
                checked={layoutVariant === layout.value}
                disabled={!layout.available}
                onChange={() => setLayoutVariant(layout.value)}
              />
              <div className="admin-layout-option-body">
                <div className="admin-layout-option-title">
                  <strong>{layout.label}</strong>
                  {!layout.available ? <span className="admin-layout-option-badge">Indisponível</span> : null}
                </div>
                <p>{layout.description}</p>
              </div>
            </label>
          ))}
        </div>
        {fieldErrors.layoutVariant ? <p className="admin-field-error">{fieldErrors.layoutVariant}</p> : null}
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Passo 3 — Aparência inicial (opcional)</legend>
        <p className="admin-field-hint">Pode ser completada e ajustada depois no editor.</p>
        <div className="admin-field">
          <label htmlFor="new-primary">Cor primária</label>
          <input id="new-primary" type="text" placeholder="#223196" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} />
        </div>
        <div className="admin-field">
          <label htmlFor="new-accent">Cor de destaque</label>
          <input id="new-accent" type="text" placeholder="#31b009" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
        </div>
        <div className="admin-field">
          <label htmlFor="new-logo">Logótipo (caminho/URL)</label>
          <input id="new-logo" type="text" placeholder="/clients/exemplo/logo.png" value={logo} onChange={(event) => setLogo(event.target.value)} />
        </div>
        <div className="admin-field">
          <label htmlFor="new-cover">Imagem de capa (caminho/URL)</label>
          <input id="new-cover" type="text" placeholder="/clients/exemplo/cover.webp" value={cover} onChange={(event) => setCover(event.target.value)} />
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Passo 4 — Módulos iniciais (opcional)</legend>
        <p className="admin-field-hint">Sem conteúdo criado automaticamente — só a ativação. O conteúdo completa-se depois no editor.</p>
        <div className="admin-module-toggle-grid">
          {MODULE_KEYS.map((key) => (
            <label className="admin-checkbox-field" key={key}>
              <input type="checkbox" checked={enabledModules.has(key)} onChange={() => toggleModule(key)} />
              {MODULE_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="admin-form-section">
        {state.status === "error" ? <p className="admin-save-error">{state.message}</p> : null}
        <button type="submit" className="admin-save-button" disabled={isPending}>
          {isPending ? "A criar…" : "Passo 5 — Criar PiriCard"}
        </button>
        <p className="admin-field-hint">Cria como não publicado. O editor completo abre a seguir.</p>
      </div>
    </form>
  );
}

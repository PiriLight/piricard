"use client";

import { useState, useTransition } from "react";
import { setModuleEnabledAction } from "@/app/admin/(protected)/businesses/[id]/edit/actions";
import { MODULE_KEYS, type ModuleActivation } from "@/lib/admin/business-mapping";
import type { ModuleKey } from "@/lib/supabase/types";

const MODULE_LABELS: Record<ModuleKey, string> = {
  services: "Serviços",
  gallery: "Galeria",
  restaurant_info: "Informação do restaurante",
  menu: "Menu",
  treatments: "Tratamentos",
  brands: "Marcas representadas",
  product_categories: "Categorias de produtos",
};

/**
 * business_modules is the ONLY source of truth for activation — never
 * inferred from content presence. Each toggle saves immediately (its own
 * small, safe mutation) rather than being bundled into the main content
 * Save, since flipping a feature flag is conceptually a different action
 * from editing a section's text. Disabling never deletes existing content;
 * enabling never fabricates any.
 */
export default function ModulesActivationSection({
  businessId,
  activation,
  onChange,
}: {
  businessId: string;
  activation: ModuleActivation;
  onChange: (key: ModuleKey, enabled: boolean) => void;
}) {
  const [pendingKey, setPendingKey] = useState<ModuleKey | null>(null);
  const [errorKey, setErrorKey] = useState<ModuleKey | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: ModuleKey, next: boolean) {
    setErrorKey(null);
    setPendingKey(key);
    startTransition(async () => {
      const result = await setModuleEnabledAction(businessId, key, next);
      setPendingKey(null);
      if (result.status === "success") {
        onChange(key, next);
      } else {
        setErrorKey(key);
      }
    });
  }

  return (
    <div className="admin-form-section">
      <p className="admin-field-hint">
        Ativar/desativar aqui não apaga nem cria conteúdo — apenas controla se a secção existe.
      </p>
      <div className="admin-module-toggle-grid">
        {MODULE_KEYS.map((key) => (
          <div className="admin-module-toggle-row" key={key}>
            <span className="admin-module-toggle-label">{MODULE_LABELS[key]}</span>
            <label className="admin-switch">
              <input
                type="checkbox"
                checked={activation[key]}
                disabled={isPending && pendingKey === key}
                onChange={(event) => toggle(key, event.target.checked)}
                aria-label={`${activation[key] ? "Desativar" : "Ativar"} ${MODULE_LABELS[key]}`}
              />
              <span className="admin-switch-track" aria-hidden="true" />
            </label>
            {errorKey === key ? <p className="admin-field-error">Não foi possível alterar este módulo.</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { Business } from "@/lib/businesses";
import { evaluatePublishChecklist } from "@/lib/admin/validation";
import {
  archiveBusinessAction,
  setPublishStateAction,
  unarchiveBusinessAction,
} from "@/app/admin/(protected)/businesses/[id]/edit/actions";

export default function PublishSection({
  businessId,
  draft,
  published,
  isDirty,
  archivedAt,
  onPublishedChange,
  onArchivedChange,
}: {
  businessId: string;
  published: boolean;
  draft: Business;
  isDirty: boolean;
  archivedAt: string | null;
  onPublishedChange: (published: boolean) => void;
  onArchivedChange: (archivedAt: string | null) => void;
}) {
  const checklist = evaluatePublishChecklist(draft);
  const checklistPassed = checklist.every((item) => item.passed);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  function handlePublishToggle(next: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await setPublishStateAction(businessId, next);
      if (result.status === "success") {
        onPublishedChange(next);
        setMessage({ tone: "success", text: next ? "Estado guardado como publicado." : "Negócio despublicado." });
      } else if (result.status === "error") {
        setMessage({ tone: "error", text: result.message });
      }
    });
  }

  function handleArchive() {
    if (!confirmingArchive) {
      setConfirmingArchive(true);
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await archiveBusinessAction(businessId);
      setConfirmingArchive(false);
      if (result.status === "success") {
        onPublishedChange(false);
        onArchivedChange(new Date().toISOString());
        setMessage({ tone: "success", text: "Negócio arquivado. O slug fica reservado permanentemente." });
      } else if (result.status === "error") {
        setMessage({ tone: "error", text: result.message });
      }
    });
  }

  function handleUnarchive() {
    setMessage(null);
    startTransition(async () => {
      const result = await unarchiveBusinessAction(businessId);
      if (result.status === "success") {
        onArchivedChange(null);
        setMessage({ tone: "success", text: "Negócio reativado (continua não publicado)." });
      } else if (result.status === "error") {
        setMessage({ tone: "error", text: result.message });
      }
    });
  }

  if (archivedAt) {
    return (
      <div className="admin-form-section">
        <div className="admin-archived-banner">
          <p>
            <strong>Este negócio está arquivado</strong> desde {new Date(archivedAt).toLocaleDateString("pt-PT")}. O slug
            continua reservado e nunca será reutilizado. Todo o conteúdo foi preservado.
          </p>
          <button type="button" className="admin-save-button" onClick={handleUnarchive} disabled={isPending}>
            {isPending ? "A reativar…" : "Reativar negócio"}
          </button>
        </div>
        {message ? <p className={message.tone === "error" ? "admin-save-error" : "admin-save-success"}>{message.text}</p> : null}
      </div>
    );
  }

  return (
    <div className="admin-form-section">
      <div className="admin-publish-checklist">
        <p className="admin-field-hint">Lista de verificação antes de publicar:</p>
        <ul>
          {checklist.map((item) => (
            <li key={item.key} className={item.passed ? "is-passed" : "is-failed"}>
              <span aria-hidden="true">{item.passed ? "✓" : "✕"}</span> {item.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="admin-field-hint admin-module-disabled-notice">
        Estado guardado na base de dados. A publicação automática no endereço público será ativada numa fase seguinte
        da migração — publicar aqui não torna o PiriCard visível em card.pirilight.pt/&lt;slug&gt; ainda.
      </p>

      {isDirty ? <p className="admin-field-error">Guarda as alterações antes de publicar ou despublicar.</p> : null}

      <div className="admin-publish-actions">
        {published ? (
          <button type="button" className="admin-save-button" onClick={() => handlePublishToggle(false)} disabled={isPending || isDirty}>
            {isPending ? "A processar…" : "Despublicar"}
          </button>
        ) : (
          <button
            type="button"
            className="admin-save-button"
            onClick={() => handlePublishToggle(true)}
            disabled={isPending || isDirty || !checklistPassed}
          >
            {isPending ? "A processar…" : "Publicar"}
          </button>
        )}

        <button type="button" className="admin-remove-button" onClick={handleArchive} disabled={isPending}>
          {confirmingArchive ? "Confirmar arquivo?" : "Arquivar negócio"}
        </button>
        {confirmingArchive ? (
          <button type="button" className="admin-icon-button" onClick={() => setConfirmingArchive(false)} disabled={isPending}>
            Cancelar
          </button>
        ) : null}
      </div>

      {message ? <p className={message.tone === "error" ? "admin-save-error" : "admin-save-success"}>{message.text}</p> : null}
    </div>
  );
}

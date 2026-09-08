"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBusinessAction } from "@/app/admin/(protected)/businesses/[id]/edit/actions";

/**
 * Pre-deployment addition — permanent business deletion. Deliberately its
 * own small component, not folded into PublishSection: publish/archive are
 * reversible state changes, this is not, and the phase explicitly wants a
 * "clearly separated danger area" ("Zona de perigo"), not a button living
 * alongside routine actions.
 *
 * Safety model (all four required by the phase spec):
 *   1. The button itself never deletes anything — it only opens a native
 *      `<dialog>` (never a one-line browser confirm popup).
 *   2. The dialog states the business name, slug, and that the action is
 *      permanent and removes the public PiriCard + all associated content.
 *   3. The destructive button inside stays disabled until the admin types
 *      the EXACT current slug into a confirmation field.
 *   4. The actual authorization/identity check happens server-side twice
 *      (see deleteBusinessAction + the admin_delete_business RPC) — this
 *      component's own checks are a UX gate, never the security boundary.
 */
export default function DeleteBusinessSection({
  businessId,
  slug,
  name,
}: {
  businessId: string;
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canDelete = confirmText.trim() === slug;

  function openDialog() {
    setConfirmText("");
    setError(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    if (isPending) return;
    dialogRef.current?.close();
  }

  function handleDelete() {
    if (!canDelete || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBusinessAction(businessId, slug);
      if (result.status === "success") {
        const params = new URLSearchParams({ deleted: result.slug });
        if (result.storageWarning) params.set("storageWarning", result.storageWarning);
        router.push(`/admin?${params.toString()}`);
        return;
      }
      if (result.status === "error") setError(result.message);
    });
  }

  return (
    <div className="admin-danger-zone">
      <p className="admin-danger-zone-title">Zona de perigo</p>
      <p className="admin-field-hint">
        Eliminar esta ficha remove permanentemente o PiriCard público de <strong>{name}</strong> (<code>{slug}</code>) e todo
        o conteúdo associado — horário, contactos, redes sociais, módulos e respetivo conteúdo (galeria, serviços, menu,
        tratamentos, marcas, categorias). Esta ação não pode ser desfeita a partir deste painel.
      </p>
      <button type="button" className="admin-danger-button" onClick={openDialog}>
        Eliminar ficha
      </button>

      <dialog ref={dialogRef} className="admin-delete-dialog" onCancel={closeDialog} onClose={() => setConfirmText("")}>
        <h2>Eliminar &ldquo;{name}&rdquo;?</h2>
        <p>
          Vais eliminar permanentemente o PiriCard <strong>{name}</strong> (slug <code>{slug}</code>). O perfil público, o
          vCard e todo o conteúdo associado na base de dados deixam de existir. <strong>Esta ação não pode ser desfeita</strong>{" "}
          a partir deste painel.
        </p>
        <label htmlFor="delete-confirm-input" className="admin-delete-dialog-label">
          Para confirmar, escreve exatamente o slug <code>{slug}</code>:
        </label>
        <input
          id="delete-confirm-input"
          type="text"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={isPending}
        />
        {error ? <p className="admin-save-error">{error}</p> : null}
        <div className="admin-delete-dialog-actions">
          <button type="button" className="admin-icon-button" onClick={closeDialog} disabled={isPending}>
            Cancelar
          </button>
          <button type="button" className="admin-danger-button" onClick={handleDelete} disabled={!canDelete || isPending}>
            {isPending ? "A eliminar…" : "Eliminar permanentemente"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

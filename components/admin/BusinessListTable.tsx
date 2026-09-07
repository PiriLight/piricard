"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface AdminBusinessListItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  layoutVariant: string;
  published: boolean;
  archived: boolean;
}

export default function BusinessListTable({ businesses }: { businesses: AdminBusinessListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return businesses;
    return businesses.filter((business) =>
      [business.name, business.slug, business.category].some((value) => value.toLowerCase().includes(term)),
    );
  }, [businesses, query]);

  return (
    <>
      <div className="admin-list-search">
        <input
          type="search"
          placeholder="Pesquisar por nome, slug ou categoria…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Pesquisar negócios"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="admin-list-empty">
          <p>Nenhum negócio corresponde a &quot;{query}&quot;.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Layout</th>
                <th>Estado</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((business) => (
                <tr key={business.id}>
                  <td data-label="Nome">{business.name || "—"}</td>
                  <td data-label="Slug">
                    <code>{business.slug}</code>
                  </td>
                  <td data-label="Layout">{business.layoutVariant}</td>
                  <td data-label="Estado">
                    {business.archived ? (
                      <span className="admin-status admin-status-archived">Arquivado</span>
                    ) : business.published ? (
                      <span className="admin-status admin-status-published">Publicado</span>
                    ) : (
                      <span className="admin-status admin-status-draft">Não publicado</span>
                    )}
                  </td>
                  <td data-label="Ações">
                    <Link href={`/admin/businesses/${business.id}/edit`} className="admin-edit-link">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

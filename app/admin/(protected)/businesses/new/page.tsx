import type { Metadata } from "next";
import Link from "next/link";
import CreateBusinessWizard from "@/components/admin/CreateBusinessWizard";

export const metadata: Metadata = {
  title: "Criar PiriCard",
  robots: { index: false, follow: false },
};

export default function NewBusinessPage() {
  return (
    <section className="admin-editor-page">
      <div className="admin-editor-page-header">
        <Link href="/admin" className="admin-back-link">
          ← Voltar à lista
        </Link>
        <h1>Criar PiriCard</h1>
        <p className="admin-field-hint">
          Cria o esqueleto mínimo do negócio. Conteúdo, módulos, aparência e configuração técnica completam-se depois
          no editor.
        </p>
      </div>
      <CreateBusinessWizard />
    </section>
  );
}

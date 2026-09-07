import Link from "next/link";
import { InteractivePiriCard } from "@/components/InteractivePiriCard";
import { PiriCardBrandMark } from "@/components/PiriCardBrandMark";
import { PlatformFooter } from "@/components/PlatformFooter";

// Single external contact channel already used for every "quero um PiriCard"
// entry point on the directory (app/page.tsx) — reused here rather than
// inventing a WhatsApp number or email address for this page.
const CONTACT_HREF = "https://pirilight.pt";

const includes = [
  "Cartão NFC físico personalizado",
  "Design adaptado à identidade do negócio",
  "NFC configurado e pronto a utilizar",
  "Perfil digital PiriCard personalizado",
  "QR Code próprio",
  "Ficheiro do QR Code em SVG",
  "QR utilizável em flyers, menus, montras, cartões de visita e outros materiais",
  "Configuração e publicação inicial",
  "Primeiro ano da plataforma PiriCard incluído",
];

const howItWorks = [
  { title: "Encosta", copy: "O cliente aproxima o telemóvel do cartão NFC." },
  { title: "Abre", copy: "O perfil PiriCard abre diretamente no telemóvel." },
  { title: "Conecta", copy: "Telefone, WhatsApp, localização, redes, avaliações e restantes informações ficam a um toque." },
];

const qrExamples = ["Flyers", "Menus", "Montras", "Balcões", "Cartões", "Materiais impressos", "Eventos"];

const renewalIncludes = [
  "Alojamento do perfil",
  "Infraestrutura PiriCard",
  "Manutenção técnica",
  "Atualizações gerais da plataforma",
  "Segurança",
  "Compatibilidade",
  "Continuidade do link NFC e QR",
  "Acesso à gestão das informações do negócio",
  "Suporte técnico relacionado com a plataforma",
];

const editableFields = ["Telefone", "WhatsApp", "Email", "Morada", "Horários", "Descrição", "Serviços", "Redes sociais", "Website", "Determinadas fotografias/conteúdo permitido"];

const lockedItems = ["Estrutura", "Layout", "Design", "Componentes", "Animações", "Categorias estruturais", "Funcionalidades da plataforma", "Código"];

const faq = [
  {
    q: "Tenho de pagar 100 € todos os anos?",
    a: "O primeiro ano da plataforma está incluído no preço inicial. A renovação de 100 €/ano começa a partir do segundo ano.",
  },
  {
    q: "O cartão deixa de funcionar se eu não renovar?",
    a: "O NFC e o QR apontam sempre para o teu perfil PiriCard, por isso a continuidade do serviço online depende da renovação da plataforma.",
  },
  {
    q: "Posso mudar as informações do meu negócio?",
    a: "Sim, dentro das informações permitidas pelo sistema/painel, quando essa funcionalidade estiver disponível.",
  },
  {
    q: "Posso alterar o design?",
    a: "O design e a estrutura pertencem ao sistema PiriCard. Alterações estruturais ou personalizadas são avaliadas separadamente.",
  },
  {
    q: "Posso usar o QR nos meus próprios flyers?",
    a: "Sim. Recebes o QR Code em SVG para o aplicares nos teus próprios materiais.",
  },
  {
    q: "Preciso de instalar uma aplicação?",
    a: "Não. O cliente final acede através do navegador do telemóvel.",
  },
];

export function PiriCardCommercialPage() {
  return (
    <main className="directory-page piricard-page">
      <header className="platform-header">
        <Link className="platform-wordmark" href="/" aria-label="PiriCard — página inicial">
          <PiriCardBrandMark wordmark={<span>Piri<span>Card</span></span>} />
        </Link>
        <Link href="/">Ver diretório</Link>
      </header>

      <div className="piricard-page-inner">
        <section className="pc-hero">
          <p className="eyebrow">PiriCard para negócios</p>
          <h1>O teu negócio. Num só toque.</h1>
          <p className="pc-hero-sub">Um cartão NFC personalizado que liga os teus clientes à informação essencial do teu negócio.</p>
          <p className="pc-hero-sub-line">NFC, perfil digital e QR Code numa única solução.</p>
          <div className="pc-hero-actions">
            <a className="pc-hero-cta-primary" href={CONTACT_HREF} target="_blank" rel="noopener noreferrer">Quero o meu PiriCard</a>
            <a className="pc-hero-cta-secondary" href="#pc-includes">Ver o que inclui</a>
          </div>
          <div className="pc-hero-card">
            <InteractivePiriCard />
          </div>
        </section>

        <section className="pc-section pc-price" aria-labelledby="pc-price-heading">
          <h2 id="pc-price-heading">Preço principal</h2>
          <div className="pc-price-card">
            <p className="pc-price-label">Preço de lançamento</p>
            <p className="pc-price-value">100 €</p>
            <p className="pc-price-regular">Preço regular previsto: 150 €</p>
            <div className="pc-price-notes">
              <span>Pagamento inicial.</span>
              <span>Primeiro ano da plataforma incluído.</span>
            </div>
            <a className="pc-price-cta" href={CONTACT_HREF} target="_blank" rel="noopener noreferrer">Quero o meu PiriCard — 100 €</a>
          </div>
        </section>

        <section className="pc-section pc-includes" id="pc-includes" aria-labelledby="pc-includes-heading">
          <h2 id="pc-includes-heading">O que recebes</h2>
          <p className="pc-section-intro">O teu PiriCard inclui:</p>
          <ul className="pc-includes-list">
            {includes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="pc-section pc-how" aria-labelledby="pc-how-heading">
          <h2 id="pc-how-heading">Como funciona</h2>
          <ol className="pc-how-list">
            {howItWorks.map((step, index) => (
              <li key={step.title}>
                <span className="pc-how-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div className="pc-how-copy">
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="pc-section pc-qr" aria-labelledby="pc-qr-heading">
          <h2 id="pc-qr-heading">O mesmo acesso. Onde quiseres.</h2>
          <p className="pc-section-intro">Além do cartão NFC, recebes o QR Code do teu PiriCard em SVG para poderes aplicá-lo nos teus próprios materiais.</p>
          <ul className="pc-qr-examples" aria-label="Exemplos de utilização do QR Code">
            {qrExamples.map((example) => <li key={example}>{example}</li>)}
          </ul>
        </section>

        <section className="pc-section pc-renewal" aria-labelledby="pc-renewal-heading">
          <p className="eyebrow">A partir do segundo ano</p>
          <h2 id="pc-renewal-heading">Renovação PiriCard</h2>
          <div className="pc-renewal-card">
            <div className="pc-renewal-price">
              <span className="pc-renewal-value">100 €/ano</span>
            </div>
            <p>Mantém o teu PiriCard online, seguro e atualizado, com acesso contínuo à infraestrutura PiriCard.</p>
            <ul className="pc-renewal-list">
              {renewalIncludes.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="pc-section pc-manage" aria-labelledby="pc-manage-heading">
          <h2 id="pc-manage-heading">O teu perfil. Sob o teu controlo.</h2>
          <p className="pc-section-intro">Estamos a desenvolver o painel PiriCard para que possas gerir diretamente as informações essenciais do teu perfil.</p>
          <div className="pc-manage-grid">
            <div className="pc-manage-card is-allowed">
              <h3>Pode alterar</h3>
              <ul>
                {editableFields.map((field) => <li key={field}>{field}</li>)}
              </ul>
            </div>
            <div className="pc-manage-card is-locked">
              <h3>Não altera</h3>
              <ul>
                {lockedItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
          <p className="pc-manage-concept">O negócio controla o conteúdo. A PiriLight mantém a estrutura, o design e a tecnologia.</p>
        </section>

        <section className="pc-section pc-custom-note" aria-labelledby="pc-custom-note-heading">
          <h2 id="pc-custom-note-heading" className="sr-only">Alterações personalizadas</h2>
          <div className="pc-custom-note-box">
            <p>Atualizações de conteúdo permitidas através do painel fazem parte da utilização normal da plataforma.</p>
            <p>Alterações como <strong>novo layout, redesign, novas secções, funcionalidades exclusivas ou alterações estruturais</strong> não fazem parte da renovação standard e podem ser orçamentadas separadamente.</p>
          </div>
        </section>

        <section className="pc-section pc-faq" aria-labelledby="pc-faq-heading">
          <h2 id="pc-faq-heading">Perguntas frequentes</h2>
          <div className="pc-faq-list">
            {faq.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pc-section pc-final-cta" aria-labelledby="pc-final-cta-heading">
          <p className="eyebrow">Pronto para começar?</p>
          <h2 id="pc-final-cta-heading">Leva o teu negócio contigo.</h2>
          <div className="pc-final-price">
            <p className="pc-final-price-name">PiriCard</p>
            <p className="pc-final-price-label">Preço de lançamento</p>
            <p className="pc-final-price-value">100 €</p>
            <p className="pc-final-price-note">Primeiro ano incluído.</p>
          </div>
          <a className="pc-final-cta-link" href={CONTACT_HREF} target="_blank" rel="noopener noreferrer">Quero o meu PiriCard</a>
        </section>
      </div>

      <PlatformFooter />
    </main>
  );
}

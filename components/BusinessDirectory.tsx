"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PiriCardShowcaseCarousel } from "@/components/PiriCardShowcaseCarousel";
import type { DirectoryBusiness } from "@/lib/businesses";
import type { PiriCardShowcaseItem } from "@/lib/piricard-cards";

const piricardBenefits = ["Contactos", "Horários", "Localização", "Avaliações", "Serviços", "Redes sociais"] as const;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-PT");
}

export function filterBusinesses(businesses: DirectoryBusiness[], query: string): DirectoryBusiness[] {
  const needle = normalize(query.trim());
  if (!needle) return businesses;
  return businesses.filter((business) => normalize([
    business.name,
    business.category,
    business.city,
    business.directoryDescription,
  ].filter(Boolean).join(" ")).includes(needle));
}

interface BusinessDirectoryProps {
  businesses: DirectoryBusiness[];
  showcaseCards: PiriCardShowcaseItem[];
}

export function BusinessDirectory({ businesses, showcaseCards }: BusinessDirectoryProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterBusinesses(businesses, query), [businesses, query]);

  return (
    <div className="directory">
      <div className="directory-intro">
        <p className="eyebrow">Diretório PiriCard</p>
        <h1 id="directory-heading">Negócios à distância de um toque.</h1>
        <p>Encontre negócios locais de confiança e aceda rapidamente aos contactos de que precisa.</p>
        <div className="hero-actions">
          <a className="hero-cta-primary" href="#business-list-heading">Explorar negócios <ArrowRight aria-hidden="true" size={18} /></a>
          <a className="hero-cta-secondary" href="#piricard-explainer-heading">O que é um PiriCard? <ArrowRight aria-hidden="true" size={16} /></a>
        </div>
      </div>

      <section className="piricard-explainer" aria-labelledby="piricard-explainer-heading">
        <div className="piricard-explainer-copy">
          <p className="eyebrow">O que é um PiriCard?</p>
          <h2 id="piricard-explainer-heading">Um cartão. Um toque. Tudo o que importa.</h2>
          <p>Um cartão físico com NFC e QR liga diretamente ao perfil digital do negócio — rápido, simples e sempre acessível.</p>
          <ul aria-label="Informação disponível num PiriCard">
            {piricardBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
          </ul>
        </div>
        <PiriCardShowcaseCarousel cards={showcaseCards} />
      </section>

      <section className="how-it-works" aria-labelledby="how-it-works-heading">
        <h2 id="how-it-works-heading" className="eyebrow">Como funciona</h2>
        <ol className="how-it-works-steps">
          <li><span className="step-number" aria-hidden="true">01</span>Encosta</li>
          <li><span className="step-number" aria-hidden="true">02</span>Abre</li>
          <li><span className="step-number" aria-hidden="true">03</span>Conecta</li>
        </ol>
      </section>

      <section className="directory-discovery" aria-labelledby="business-list-heading">
        <div className="directory-discovery-heading">
          <div>
            <p className="eyebrow">Diretório local</p>
            <h2 id="business-list-heading">Explorar negócios</h2>
          </div>
          <div className="result-summary" aria-live="polite">
            <span>{filtered.length === 1 ? "1 negócio" : `${filtered.length} negócios`}</span>
            {query && <span>para “{query}”</span>}
          </div>
        </div>

        <div className="search-wrap">
          <label className="sr-only" htmlFor="business-search">Pesquisar por nome, categoria ou localidade</label>
          <Search aria-hidden="true" size={23} />
          <input id="business-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, categoria ou localidade" autoComplete="off" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar pesquisa"><X aria-hidden="true" size={18} /><span>Limpar</span></button>}
        </div>

        {filtered.length > 0 ? (
        <div className="business-list">
          {filtered.map((business, index) => (
            <article className="business-row" key={business.slug}>
              <div className="business-identifier">
                <span className="logo-plate">
                  {business.logo ? (
                    <Image
                      src={business.logo}
                      alt=""
                      width={190}
                      height={115}
                      loading={index === 0 ? "eager" : "lazy"}
                      sizes="(max-width: 767px) 104px, (max-width: 1099px) 42vw, (max-width: 1599px) 27vw, 300px"
                    />
                  ) : (
                    <span aria-hidden="true">{business.name.slice(0, 1)}</span>
                  )}
                </span>
              </div>
              <div className="business-row-content">
                <h3>{business.name}</h3>
                <div className="business-meta">
                  <span>{business.category}</span>
                  {business.city && <span><MapPin aria-hidden="true" size={16} />{business.city}</span>}
                </div>
                <p>{business.directoryDescription}</p>
              </div>
              <Link className="directory-link" href={`/${business.slug}`} aria-label={`Ver perfil de ${business.name}`}>
                <span>Ver perfil</span><ArrowRight aria-hidden="true" size={21} />
              </Link>
            </article>
          ))}
        </div>
        ) : (
        <div className="empty-state">
          <Search aria-hidden="true" size={26} />
          <h2>Nenhum negócio encontrado.</h2>
          <p>Experimente pesquisar por outro nome, categoria ou localidade.</p>
          <button type="button" onClick={() => setQuery("")}>Limpar pesquisa</button>
        </div>
        )}
      </section>
    </div>
  );
}

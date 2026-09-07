-- =============================================================================
-- PiriCard — Phase 4C production-data seed (LOCAL VALIDATION ONLY)
--
-- Migrates the four real, currently-published PiriCards from
-- lib/businesses.ts into Supabase: autoformigal, beauty-connection-360,
-- boi-na-brasa, oft-racing. Deliberately does NOT migrate `pirilight` (an
-- incomplete internal profile, not a production PiriCard — see AGENTS/Phase
-- 4C spec).
--
-- Loaded by `supabase db reset` (see supabase/config.toml [db.seed]) against
-- the LOCAL database only. This file is never applied to the remote project
-- by any command in this repo — remote seeding is a separate, explicitly
-- approved step (Phase 4C "REMOTE DATA GATE").
--
-- Runs as the `postgres` superuser/table-owner during `db reset`, so it
-- bypasses RLS by construction (the same way the schema migration itself
-- does) — this is "trusted SQL", the intended write path for `businesses`
-- content per the schema's own comments (`businesses` has zero INSERT grant
-- to any application role). It does NOT go through the admin RPCs
-- (admin_create_business etc.) on purpose: those are platform-admin-gated
-- and require an authenticated session, which a seed script run by the
-- table owner has no need for and should not pretend to have.
--
-- IDEMPOTENCY: each business is wrapped in `if not exists (... where slug =
-- ...)` — re-running this file (e.g. a second `supabase db seed`) against an
-- already-seeded database skips every business that's already present
-- instead of erroring or duplicating rows. Safe to run multiple times.
--
-- DATA SOURCE OF TRUTH: every literal value below is copied verbatim from
-- lib/businesses.ts (read in full for this migration) — nothing here is
-- invented. Field-by-field parity against the static objects is verified by
-- scripts/verify-business-parity.ts (see PARITY_REPORT.md).
--
-- JSON KEY CASING: `theme`, `assets`, `review_fallback`, `external_links`,
-- and `business_profile_content.about` are stored as camelCase JSON —
-- matching the `Business`/`BusinessTheme` TypeScript field names exactly,
-- since lib/admin/business-mapping.ts's mapBusinessFromDatabase() casts
-- these JSON blobs straight through (`toTheme`, `(business.assets ?? {}) as
-- Business["assets"]`) rather than translating snake_case columns.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Auto Formigal — layout: workshop
-- -----------------------------------------------------------------------------
do $$
declare
  v_business_id uuid;
begin
  if exists (select 1 from public.businesses where slug = 'autoformigal') then
    raise notice 'autoformigal already seeded — skipping';
    return;
  end if;

  insert into public.businesses (
    slug, organization, layout_variant, theme, assets,
    maps_url, google_place_id, review_url, review_write_url, review_fallback,
    external_links, digital_card, published, featured, indexable, archived_at
  ) values (
    'autoformigal', 'Auto Formigal', 'workshop',
    '{"primary":"#223196","secondary":"#1b2a80","accent":"#31b009","background":"#eef1f8","surface":"#ffffff","text":"#141f52","mutedText":"#525c80","border":"#dce3f2","appearance":"light","fontFamily":"modern"}'::jsonb,
    '{"logo":"/clients/autoformigal/logo/autoformigal-approved.jpg","cover":"/clients/autoformigal/cover/exterior-2026.png","coverAlt":"Exterior da oficina Auto Formigal em São Pedro da Cadeira","socialImage":"/clients/autoformigal/cover/exterior-2026.png","qrCode":"/piricard-qrs/autoformigal.png"}'::jsonb,
    null, null, null, null,
    '{"rating":4.9,"count":77,"source":"Google","asOf":"04.09.2026"}'::jsonb,
    '{}'::jsonb, null, true, true, true, null
  ) returning id into v_business_id;

  insert into public.business_profile_content (
    business_id, name, category, directory_description, profile_description, positioning, about,
    phone, whatsapp, email, website, address, street_address, city, country
  ) values (
    v_business_id, 'Auto Formigal', 'Oficina automóvel',
    'Oficina multimarca com mais de duas décadas de experiência em reparação e diagnóstico automóvel.',
    'Reparação, diagnóstico e manutenção automóvel multimarca.',
    '25 anos de confiança na reparação automóvel.',
    '{"paragraphs":["A Auto Formigal é uma oficina automóvel multimarca em São Pedro da Cadeira, com foco em reparação, diagnóstico e manutenção automóvel. A equipa acompanha veículos de várias marcas, do dia a dia às intervenções mais técnicas."]}'::jsonb,
    '+351261858239', null, 'geral@autoformigal.pt', 'https://autoformigal.vercel.app',
    'Rua do Aranha 19, São Pedro da Cadeira', 'Rua do Aranha 19', 'São Pedro da Cadeira', 'Portugal'
  );

  insert into public.business_hours (business_id, label, days, periods, sort_order) values
    (v_business_id, 'Segunda', array[1]::smallint[], '[{"open":"09:00","close":"18:00"}]'::jsonb, 0),
    (v_business_id, 'Terça',   array[2]::smallint[], '[{"open":"09:00","close":"18:00"}]'::jsonb, 1),
    (v_business_id, 'Quarta',  array[3]::smallint[], '[{"open":"09:00","close":"18:00"}]'::jsonb, 2),
    (v_business_id, 'Quinta',  array[4]::smallint[], '[{"open":"09:00","close":"18:00"}]'::jsonb, 3),
    (v_business_id, 'Sexta',   array[5]::smallint[], '[{"open":"09:00","close":"18:00"}]'::jsonb, 4),
    (v_business_id, 'Sábado',  array[6]::smallint[], '[{"open":"09:00","close":"13:00"}]'::jsonb, 5),
    (v_business_id, 'Domingo', array[0]::smallint[], '[]'::jsonb, 6);

  insert into public.social_links (business_id, platform, url, label, sort_order) values
    (v_business_id, 'instagram', 'https://www.instagram.com/auto_formigal/', 'Instagram', 0),
    (v_business_id, 'facebook', 'https://www.facebook.com/autoformigal', 'Facebook', 1);

  insert into public.business_modules (business_id, module_key, enabled) values
    (v_business_id, 'services', true),
    (v_business_id, 'gallery', true);

  insert into public.services (business_id, label, sort_order) values
    (v_business_id, 'Reparação multimarca', 0),
    (v_business_id, 'Diagnóstico avançado', 1),
    (v_business_id, 'Manutenção automóvel', 2);

  insert into public.gallery (business_id, src, alt, aspect_ratio, placeholder_label, sort_order) values
    (v_business_id, '/clients/autoformigal/cover/exterior-2026.png', 'Exterior da oficina Auto Formigal em São Pedro da Cadeira', 'wide', null, 0),
    (v_business_id, '/clients/autoformigal/gallery/interior-recepcao.png', 'Interior da oficina Auto Formigal', 'square', 'Interior', 1),
    (v_business_id, '/clients/autoformigal/gallery/diagnostico-oficina.png', 'Área de diagnóstico automóvel da Auto Formigal', 'square', 'Diagnóstico', 2),
    (v_business_id, '/clients/autoformigal/gallery/manutencao-autoformigal.png', 'Zona de manutenção automóvel da Auto Formigal', 'square', 'Manutenção', 3),
    (v_business_id, '/clients/autoformigal/gallery/equipa-autoformigal.png', 'Equipa da oficina Auto Formigal', 'landscape', 'Equipa', 4);
end $$;

-- -----------------------------------------------------------------------------
-- 2. Beauty Connection 360 — layout: beauty
-- -----------------------------------------------------------------------------
do $$
declare
  v_business_id uuid;
begin
  if exists (select 1 from public.businesses where slug = 'beauty-connection-360') then
    raise notice 'beauty-connection-360 already seeded — skipping';
    return;
  end if;

  insert into public.businesses (
    slug, organization, layout_variant, theme, assets,
    maps_url, google_place_id, review_url, review_write_url, review_fallback,
    external_links, digital_card, published, featured, indexable, archived_at
  ) values (
    'beauty-connection-360', 'Beauty Connection 360', 'beauty',
    '{"primary":"#1c1815","secondary":"#0f0c0a","accent":"#b3873f","background":"#e9e4d9","surface":"#f8f4ec","text":"#211c17","mutedText":"#6b6259","border":"rgba(28,24,21,0.12)","appearance":"light","fontFamily":"editorial"}'::jsonb,
    '{"logo":"/clients/beauty-connection-360/logo.webp","cover":"/clients/beauty-connection-360/fachada.webp","coverAlt":"Fachada da Beauty Connection 360 em Torres Vedras","socialImage":"/clients/beauty-connection-360/fachada.webp","qrCode":"/piricard-qrs/beauty-connection-360.png"}'::jsonb,
    null, null, null, null, null,
    '{}'::jsonb, null, true, false, true, null
  ) returning id into v_business_id;

  insert into public.business_profile_content (
    business_id, name, category, directory_description, profile_description, positioning, about,
    phone, whatsapp, email, website, address, street_address, city, country
  ) values (
    v_business_id, 'Beauty Connection 360', 'Estética • Beleza • Bem-estar',
    'Estética, beleza e bem-estar personalizados, unindo tratamentos, tecnologia e cosmética premium.',
    'Conexão Total com a Beleza — tratamentos personalizados de estética, corpo e bem-estar.',
    'Elevando a sua beleza com exclusividade.',
    '{"heading":"“A verdadeira beleza nasce da conexão entre corpo, mente e energia.”","paragraphs":["Não seguimos protocolos padronizados. Cada pessoa é única — por isso cada plano parte do corpo, da pele e do momento de vida de quem o procura, unindo estética, tecnologia avançada e bem-estar numa só experiência de transformação."]}'::jsonb,
    '+351916754795', '+351916754795', 'geral@beautyconnection360.com', 'https://www.beautyconnection360.com/',
    'Rua Serpa Pinto 9A, 2560-288 Torres Vedras', 'Rua Serpa Pinto 9A', 'Torres Vedras', 'Portugal'
  );

  -- No opening hours confirmed for this business (matches lib/businesses.ts — no `hours` field).

  insert into public.social_links (business_id, platform, url, label, sort_order) values
    (v_business_id, 'instagram', 'https://www.instagram.com/beauty_connection360', 'Instagram', 0),
    (v_business_id, 'facebook', 'https://www.facebook.com/groups/736440344810780/user/61570809329586/?locale=pt_PT', 'Facebook', 1);

  insert into public.business_modules (business_id, module_key, enabled) values
    (v_business_id, 'gallery', true),
    (v_business_id, 'treatments', true);

  insert into public.gallery (business_id, src, alt, aspect_ratio, placeholder_label, sort_order) values
    (v_business_id, '/clients/beauty-connection-360/00.webp', 'Placa de receção com o logótipo Beauty Connection 360', 'wide', null, 0),
    (v_business_id, '/clients/beauty-connection-360/0.webp', 'Balcão de receção e vitrine de produtos da Beauty Connection 360', 'square', null, 1),
    (v_business_id, '/clients/beauty-connection-360/1.webp', 'Expositor de perfumes e cosmética da Beauty Connection 360', 'square', null, 2),
    (v_business_id, '/clients/beauty-connection-360/2.webp', 'Sala de tratamentos da Beauty Connection 360', 'square', null, 3),
    (v_business_id, '/clients/beauty-connection-360/3.webp', 'Equipamento de spa de pés da Beauty Connection 360', 'square', null, 4);

  declare
    v_rosto uuid;
    v_corpo uuid;
    v_rituals uuid;
    v_bemestar uuid;
  begin
    insert into public.treatment_groups (business_id, slug_key, title, description, sort_order)
      values (v_business_id, 'rosto', 'Rosto', 'Cuidados faciais personalizados', 0) returning id into v_rosto;
    insert into public.treatment_items (treatment_group_id, business_id, label, sort_order) values
      (v_rosto, v_business_id, 'Limpeza de Pele Básica', 0),
      (v_rosto, v_business_id, 'Limpeza de Pele Profunda', 1),
      (v_rosto, v_business_id, 'Rejuvenescimento / Anti-idade', 2),
      (v_rosto, v_business_id, 'Tratamento de Acne', 3),
      (v_rosto, v_business_id, 'Dermapen', 4),
      (v_rosto, v_business_id, 'Beauty Gold Facial', 5);

    insert into public.treatment_groups (business_id, slug_key, title, description, sort_order)
      values (v_business_id, 'corpo', 'Corpo', 'Tratamentos corporais direcionados', 1) returning id into v_corpo;
    insert into public.treatment_items (treatment_group_id, business_id, label, sort_order) values
      (v_corpo, v_business_id, 'Tonificação', 0),
      (v_corpo, v_business_id, 'Flacidez', 1),
      (v_corpo, v_business_id, 'Hidratação Profunda', 2),
      (v_corpo, v_business_id, 'Lama do Mar Morto', 3),
      (v_corpo, v_business_id, 'Tratamento de Pés com Reflexologia', 4);

    insert into public.treatment_groups (business_id, slug_key, title, description, sort_order)
      values (v_business_id, 'rituals', 'Beauty & Rituals', 'Mãos, pés e rituais de beleza', 2) returning id into v_rituals;
    insert into public.treatment_items (treatment_group_id, business_id, label, sort_order) values
      (v_rituals, v_business_id, 'SPA das Mãos', 0),
      (v_rituals, v_business_id, 'Manicure (Normal • Gel • Gelinho)', 1),
      (v_rituals, v_business_id, 'SPA dos Pés', 2),
      (v_rituals, v_business_id, 'Pedicure (Normal • Gel • Gelinho)', 3),
      (v_rituals, v_business_id, 'Sobrancelhas', 4),
      (v_rituals, v_business_id, 'Buço', 5),
      (v_rituals, v_business_id, 'Lifting de Pestanas', 6),
      (v_rituals, v_business_id, 'Head SPA', 7);

    insert into public.treatment_groups (business_id, slug_key, title, description, sort_order)
      values (v_business_id, 'bemestar', 'Bem-estar Integrado', 'Terapias, fitness e nutrição', 3) returning id into v_bemestar;
    insert into public.treatment_items (treatment_group_id, business_id, label, sort_order) values
      (v_bemestar, v_business_id, 'Reiki', 0),
      (v_bemestar, v_business_id, 'Reflexologia', 1),
      (v_bemestar, v_business_id, 'Aromaterapia', 2),
      (v_bemestar, v_business_id, 'Mentorias', 3),
      (v_bemestar, v_business_id, 'Planos de Fitness Personalizados', 4),
      (v_bemestar, v_business_id, 'Planos Alimentares Personalizados', 5);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Boi na Brasa — layout: restaurant
-- -----------------------------------------------------------------------------
do $$
declare
  v_business_id uuid;
  v_menu_1 uuid;
  v_menu_2 uuid;
begin
  if exists (select 1 from public.businesses where slug = 'boi-na-brasa') then
    raise notice 'boi-na-brasa already seeded — skipping';
    return;
  end if;

  insert into public.businesses (
    slug, organization, layout_variant, theme, assets,
    maps_url, google_place_id, review_url, review_write_url, review_fallback,
    external_links, digital_card, published, featured, indexable, archived_at
  ) values (
    'boi-na-brasa', 'Restaurante Boi na Brasa', 'restaurant',
    '{"primary":"#191411","secondary":"#0f0c0a","accent":"#c2501f","background":"#ded4c4","surface":"#f4ede1","text":"#191411","mutedText":"#7a6a5c","border":"#ded4c4","appearance":"light","fontFamily":"modern"}'::jsonb,
    '{"logo":"/clients/boi-na-brasa/logo.jpg","cover":"/clients/boi-na-brasa/boi-na-brasa-header.webp","coverAlt":"Fachada do Boi na Brasa na Rua 1.º de Dezembro, em Torres Vedras, com esplanada","socialImage":"/clients/boi-na-brasa/fachada.jpg","qrCode":"/piricard-qrs/boi-na-brasa.png"}'::jsonb,
    'https://www.google.com/maps/place/Restaurante+boi+na+brasa/@39.0916177,-9.2583152,17z/data=!3m1!4b1!4m6!3m5!1s0xd1f2d060f0093ef:0xa22973c1920f5dcd!8m2!3d39.0916177!4d-9.2583152!16s%2Fg%2F11vwxw92vx',
    'ChIJ75MADwYtHw0RzV0PksFzKaI',
    'https://www.google.com/maps/place/Restaurante+boi+na+brasa/@39.0916177,-9.2583152,17z/data=!3m1!4b1!4m6!3m5!1s0xd1f2d060f0093ef:0xa22973c1920f5dcd!8m2!3d39.0916177!4d-9.2583152!16s%2Fg%2F11vwxw92vx',
    'https://search.google.com/local/writereview?placeid=ChIJ75MADwYtHw0RzV0PksFzKaI',
    '{"rating":4.7,"count":95,"source":"Google","asOf":"24.08.2026"}'::jsonb,
    '{"delivery":"https://glovoapp.com/pt/pt/torres-vedras/stores/boi-na-brasa-trv","collection":"https://www.toogoodtogo.com/pt/find/torresvedras/restauranteboinabrasa/cookedmeal/refeicao-253056996762700480","tripAdvisor":"https://www.tripadvisor.pt/UserReviewEdit-g656858-d34606735-Restaurante_Boi_na_Brasa-Torres_Vedras_Lisbon_District_Central_Portugal.html"}'::jsonb,
    null, true, false, true, null
  ) returning id into v_business_id;

  insert into public.business_profile_content (
    business_id, name, category, directory_description, profile_description, positioning, about,
    phone, whatsapp, email, website, address, street_address, city, country
  ) values (
    v_business_id, 'Boi na Brasa', 'Restaurante & Café',
    'Grelhados, pratos reconfortantes e sabores luso-brasileiros no centro de Torres Vedras.',
    'Picanha, maminha, bitoque e petiscos, com esplanada, takeaway e pedidos online.',
    'Carne na brasa e comida reconfortante, sem formalidades.',
    '{"heading":"O restaurante","paragraphs":["O Boi na Brasa é um restaurante e café de ambiente casual, na Rua 1.º de Dezembro, em pleno centro de Torres Vedras. A ementa cruza grelhados como picanha, maminha, bitoque e febras com acompanhamentos de inspiração brasileira, sandes e salgados.","Para comer no local, levar ou pedir online, a proposta é simples: comida reconfortante, esplanada no centro da cidade e serviço próximo, sem formalidades."]}'::jsonb,
    '+351261063480', '+351962874230', null, null,
    'Rua 1.º de Dezembro 5, 2560-300 Torres Vedras', 'Rua 1.º de Dezembro 5', 'Torres Vedras', 'Portugal'
  );

  insert into public.business_hours (business_id, label, days, periods, sort_order) values
    (v_business_id, 'Segunda', array[1]::smallint[], '[{"open":"09:30","close":"22:00"}]'::jsonb, 0),
    (v_business_id, 'Terça',   array[2]::smallint[], '[{"open":"09:30","close":"22:00"}]'::jsonb, 1),
    (v_business_id, 'Quarta',  array[3]::smallint[], '[{"open":"09:30","close":"22:00"}]'::jsonb, 2),
    (v_business_id, 'Quinta',  array[4]::smallint[], '[{"open":"09:30","close":"22:00"}]'::jsonb, 3),
    (v_business_id, 'Sexta',   array[5]::smallint[], '[{"open":"09:30","close":"16:30"}]'::jsonb, 4),
    (v_business_id, 'Sábado',  array[6]::smallint[], '[{"open":"09:30","close":"22:00"}]'::jsonb, 5),
    (v_business_id, 'Domingo', array[0]::smallint[], '[]'::jsonb, 6);

  insert into public.social_links (business_id, platform, url, label, sort_order) values
    (v_business_id, 'facebook', 'https://facebook.com/p/Restaurante-Boi-na-Brasa-61590189674905/', 'Facebook', 0),
    (v_business_id, 'instagram', 'https://www.instagram.com/restauranteboinabrasa2026?igsi=eTJ3ZHBvMmx3dWRj', 'Instagram', 1);

  insert into public.business_modules (business_id, module_key, enabled) values
    (v_business_id, 'services', true),
    (v_business_id, 'menu', true),
    (v_business_id, 'restaurant_info', true);

  insert into public.services (business_id, label, sort_order) values
    (v_business_id, 'Comer no local', 0),
    (v_business_id, 'Takeaway', 1),
    (v_business_id, 'Entrega e recolha', 2),
    (v_business_id, 'Esplanada', 3),
    (v_business_id, 'Aceita reservas', 4),
    (v_business_id, 'Adequado a grupos', 5),
    (v_business_id, 'Indicado para crianças', 6),
    (v_business_id, 'Wi-Fi gratuito', 7),
    (v_business_id, 'Pequeno-almoço', 8),
    (v_business_id, 'WC', 9);

  insert into public.menu_sections (business_id, title, sort_order) values (v_business_id, 'Menu', 0) returning id into v_menu_1;
  insert into public.menu_items (menu_section_id, business_id, name, price, sort_order) values
    (v_menu_1, v_business_id, 'Maminha Grelhada', '12,90 €', 0),
    (v_menu_1, v_business_id, 'Bitoque de Vaca', '12,90 €', 1),
    (v_menu_1, v_business_id, 'Picanha Grelhada', '13,90 €', 2),
    (v_menu_1, v_business_id, 'Bife da Vazia', '14,90 €', 3);

  insert into public.menu_sections (business_id, title, sort_order) values (v_business_id, 'Incluído em todos os menus', 1) returning id into v_menu_2;
  insert into public.menu_items (menu_section_id, business_id, name, price, sort_order) values
    (v_menu_2, v_business_id, 'Entrada + prato + bebida + sobremesa ou café', null, 0);

  insert into public.restaurant_info (business_id, average_spend, average_spend_note, cuisine, cuisine_note) values
    (v_business_id, '10–15 € por pessoa', 'indicado no Google por 47 pessoas', 'Grelhados luso-brasileiros', 'petiscos, sandes e salgados');
end $$;

-- -----------------------------------------------------------------------------
-- 4. OFT Racing Shop — layout: racing
-- -----------------------------------------------------------------------------
do $$
declare
  v_business_id uuid;
begin
  if exists (select 1 from public.businesses where slug = 'oft-racing') then
    raise notice 'oft-racing already seeded — skipping';
    return;
  end if;

  insert into public.businesses (
    slug, organization, layout_variant, theme, assets,
    maps_url, google_place_id, review_url, review_write_url, review_fallback,
    external_links, digital_card, published, featured, indexable, archived_at
  ) values (
    'oft-racing', 'OFT Racing Shop', 'racing',
    '{"primary":"#0c0c0d","secondary":"#08080a","accent":"#c2301a","background":"#dedbd5","surface":"#f4f2ee","text":"#0c0c0d","mutedText":"#5e5c56","border":"#d8d4cc","appearance":"dark","fontFamily":"modern"}'::jsonb,
    '{"logo":"/clients/oft-racing/logo.png","logoOnLight":true,"cover":"/clients/oft-racing/fachada.webp","coverAlt":"Fachada da OFT Racing Shop em São Pedro da Cadeira","socialImage":"/clients/oft-racing/fachada.webp","qrCode":"/piricard-qrs/oft-racing.png"}'::jsonb,
    'https://www.google.com/maps/place/Oft+Racing+Shop/@39.0739556,-9.3821492,17z/data=!3m1!4b1!4m6!3m5!1s0xd1f25711195cad1:0x2a9d02e1163b0a05!8m2!3d39.0739556!4d-9.3821492!16s%2Fg%2F11hhzfgsvn',
    'ChIJ0cqVEXElHw0RBQo7FuECnSo',
    'https://www.google.com/maps/place/Oft+Racing+Shop/@39.0739556,-9.3821492,17z/data=!3m1!4b1!4m6!3m5!1s0xd1f25711195cad1:0x2a9d02e1163b0a05!8m2!3d39.0739556!4d-9.3821492!16s%2Fg%2F11hhzfgsvn',
    'https://search.google.com/local/writereview?placeid=ChIJ0cqVEXElHw0RBQo7FuECnSo',
    '{"rating":4.8,"count":35,"source":"Google","asOf":"29.08.2026"}'::jsonb,
    '{}'::jsonb, null, true, false, true, null
  ) returning id into v_business_id;

  insert into public.business_profile_content (
    business_id, name, category, directory_description, profile_description, positioning, about,
    phone, whatsapp, email, website, address, street_address, city, country
  ) values (
    v_business_id, 'OFT Racing Shop', 'Loja de motos',
    'Loja de motos em São Pedro da Cadeira, representante oficial de KTM, Husqvarna, CFMOTO e GASGAS.',
    'Loja de motos em São Pedro da Cadeira, representante oficial de KTM, Husqvarna, CFMOTO e GASGAS.',
    null,
    '{"heading":"Paixão por motos, dentro e fora da estrada","paragraphs":["A OFT Racing Shop é uma loja e oficina especializada no mundo das duas rodas, em São Pedro da Cadeira. Representante oficial de marcas como KTM, Husqvarna, CFMOTO e GASGAS, reúne motos, equipamento e acessórios para quem vive o motociclismo dentro e fora da estrada."]}'::jsonb,
    '+351913321091', '+351913321091', 'oftracingshop.geral@gmail.com', null,
    'R. Gonçalo Velho Cabral 2, São Pedro da Cadeira, Portugal', 'R. Gonçalo Velho Cabral 2', 'São Pedro da Cadeira', 'Portugal'
  );

  insert into public.business_hours (business_id, label, days, periods, sort_order) values
    (v_business_id, 'Segunda', array[1]::smallint[], '[]'::jsonb, 0),
    (v_business_id, 'Terça',   array[2]::smallint[], '[{"open":"10:00","close":"19:00"}]'::jsonb, 1),
    (v_business_id, 'Quarta',  array[3]::smallint[], '[{"open":"10:00","close":"19:00"}]'::jsonb, 2),
    (v_business_id, 'Quinta',  array[4]::smallint[], '[{"open":"10:00","close":"19:00"}]'::jsonb, 3),
    (v_business_id, 'Sexta',   array[5]::smallint[], '[{"open":"10:00","close":"19:00"}]'::jsonb, 4),
    (v_business_id, 'Sábado',  array[6]::smallint[], '[{"open":"10:00","close":"13:00"}]'::jsonb, 5),
    (v_business_id, 'Domingo', array[0]::smallint[], '[]'::jsonb, 6);

  insert into public.social_links (business_id, platform, url, label, sort_order) values
    (v_business_id, 'instagram', 'https://www.instagram.com/oftracing153/', 'Instagram', 0),
    (v_business_id, 'facebook', 'https://www.facebook.com/p/OFT-Racing-100057400693321/', 'Facebook', 1);

  insert into public.business_modules (business_id, module_key, enabled) values
    (v_business_id, 'brands', true),
    (v_business_id, 'product_categories', true);

  insert into public.represented_brands (business_id, label, sort_order) values
    (v_business_id, 'KTM', 0),
    (v_business_id, 'Husqvarna', 1),
    (v_business_id, 'CFMOTO', 2),
    (v_business_id, 'GASGAS', 3);

  insert into public.product_categories (business_id, label, sort_order) values
    (v_business_id, 'Motos', 0),
    (v_business_id, 'Equipamento', 1),
    (v_business_id, 'Acessórios', 2);
end $$;

commit;

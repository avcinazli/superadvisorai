-- AI Engineer Supervisor — Veritabanı Şeması
-- Bu dosya otomatik çalışır, manuel çalıştırmaya gerek yok.

SET client_encoding = 'UTF8';

-- ─── TABLOLAR ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
    is_active   BOOLEAN DEFAULT true,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    company     VARCHAR(255),
    phone       VARCHAR(50),
    status      VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
    notes       TEXT,
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    stack       TEXT,
    process     TEXT,
    category    VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    status      VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning','in_progress','review','completed','paused','cancelled')),
    priority    VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    url         VARCHAR(500),
    description TEXT,
    budget      DECIMAL(12,2),
    deadline    DATE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name     VARCHAR(255),
    action        VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id   INTEGER,
    resource_name VARCHAR(255),
    details       JSONB,
    ip_address    VARCHAR(45),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── İNDEKSLER ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_status    ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_email     ON clients(email);
CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client   ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_template ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource    ON audit_logs(resource_type);

-- ─── ŞABLONLAR (md dosyalarından) ─────────────────────────────────────────────

INSERT INTO templates (slug, name, description, stack, process, category) VALUES
(
  'landing-page',
  'Landing Page',
  'Ürün/hizmet için satış odaklı tek sayfa. Müşteri adaylarını aksiyona yönlendiren yüksek conversion marketing sayfası.',
  'Next.js + Tailwind + shadcn + Framer Motion',
  '1. Hero (açık değer önerisi + CTA)' || chr(10) ||
  '2. Sosyal kanıt (logolar / testimonial''lar)' || chr(10) ||
  '3. Özellikler (3-6, dönüşümlü görsel+metin)' || chr(10) ||
  '4. Nasıl çalışır (3 adımda)' || chr(10) ||
  '5. Fiyatlandırma (3 plan)' || chr(10) ||
  '6. SSS (8 soru)' || chr(10) ||
  '7. Son CTA + Footer',
  'marketing'
),
(
  'saas-mvp',
  'SaaS MVP',
  'Sıfırdan 7 günde MVP SaaS uygulaması — auth + ödeme + dashboard ile satılabilir prototip.',
  'Next.js 14 + Supabase (Auth+DB) + Stripe + Resend + Vercel',
  'Gün 1: Kurulum + Auth (Supabase Auth, login/signup)' || chr(10) ||
  'Gün 2: Veritabanı şeması + RLS politikaları' || chr(10) ||
  'Gün 3: Temel özellik CRUD' || chr(10) ||
  'Gün 4: Stripe checkout + webhook''lar' || chr(10) ||
  'Gün 5: Dashboard UI + ayarlar' || chr(10) ||
  'Gün 6: E-posta dizileri (Resend)' || chr(10) ||
  'Gün 7: Yayın + özel domain + Stripe canlı mod',
  'saas'
),
(
  'admin-paneli',
  'Admin Panel',
  'Müşteri/iç kullanım için yönetim paneli — CRUD, role tabanlı erişim, raporlama.',
  'Next.js + shadcn/ui (Data Tables) + Supabase + tRPC',
  '1. Rol tablosu kur (admin / editor / viewer)' || chr(10) ||
  '2. Login + rol middleware' || chr(10) ||
  '3. Sidebar navigasyon (her role özel)' || chr(10) ||
  '4. Data table''lar (sıralanabilir, filtrelenebilir, sayfalandırmalı)' || chr(10) ||
  '5. CRUD modallar' || chr(10) ||
  '6. Denetim kaydı (kim ne yaptı)' || chr(10) ||
  '7. Dışa aktarım (CSV, Excel)',
  'tooling'
),
(
  'dashboard-analytics',
  'Analytics Dashboard',
  'SaaS ya da müşteri için gerçek zamanlı kullanım/satış analitik panosu — KPI''lar, grafikler, filtreler.',
  'Next.js + Recharts/Tremor + Supabase + TanStack Query',
  '1. KPI kartları (toplam, değişim, trend)' || chr(10) ||
  '2. Grafikler (çizgi, çubuk, pasta, alan)' || chr(10) ||
  '3. Tarih aralığı seçici' || chr(10) ||
  '4. Filtre paneli' || chr(10) ||
  '5. Dışa aktarım (PDF/PNG/CSV)' || chr(10) ||
  '6. Gerçek zamanlı abonelik (Supabase Realtime)',
  'saas'
),
(
  'cms-builder',
  'CMS Builder',
  'Müşterinin kendi içeriğini yönetmesi gereken site — blog, sayfa, medya yönetimi.',
  'Next.js + Sanity / Payload CMS / Strapi (headless)',
  '1. İçerik tiplerini tanımla (post, sayfa, yazar, kategori)' || chr(10) ||
  '2. Admin UI (Sanity Studio embed ya da özel)' || chr(10) ||
  '3. Frontend: dinamik rotalar ([slug])' || chr(10) ||
  '4. Görsel optimizasyonu (next/image)' || chr(10) ||
  '5. Zengin metin render' || chr(10) ||
  '6. Önizleme modu' || chr(10) ||
  '7. Webhook → yeniden doğrula (ISR)',
  'content'
),
(
  'marketplace',
  'Marketplace',
  'İki taraflı marketplace (alıcı/satıcı) — Etsy/Fiverr tarzı listeleme + arama + ödeme sistemi.',
  'Next.js + Supabase + Stripe Connect + Algolia',
  '1. Kullanıcı tipleri: alıcı / satıcı / admin' || chr(10) ||
  '2. Listeleme CRUD (satıcıya özel)' || chr(10) ||
  '3. Arama + filtre (Algolia)' || chr(10) ||
  '4. Listeleme detayı + iletişim' || chr(10) ||
  '5. Stripe Connect ile satıcı onboarding' || chr(10) ||
  '6. Sipariş akışı (sepet → ödeme → teslimat)' || chr(10) ||
  '7. Değerlendirme/puan sistemi',
  'ecommerce'
),
(
  'membership-site',
  'Membership Site',
  'İçerik kilitli üyelik sitesi — Skool/Patreon/Substack tarzı kurs ve topluluk platformu.',
  'Next.js + Supabase + Stripe Subscriptions + Mux (video)',
  '1. Auth + abonelik katmanı (ücretsiz/ücretli/premium)' || chr(10) ||
  '2. İçerik tipleri: video, makale, indirilebilir' || chr(10) ||
  '3. İçerik kilitleme (aboneliğe göre)' || chr(10) ||
  '4. Üye akışı/topluluk' || chr(10) ||
  '5. Yorum + tepki sistemi' || chr(10) ||
  '6. E-posta bildirimleri' || chr(10) ||
  '7. Üye dizini',
  'content'
),
(
  'multi-tenant',
  'Multi-Tenant SaaS',
  'Çoklu organizasyon B2B SaaS — workspace/ekip yapısı, izole veri, per-org faturalandırma.',
  'Next.js + Supabase (RLS) + Stripe (per-org billing)',
  '1. Organizasyon modeli (id, ad, slug, plan)' || chr(10) ||
  '2. Üyeler tablosu (user_id, org_id, rol)' || chr(10) ||
  '3. URL yönlendirme: /org/[slug]/dashboard' || chr(10) ||
  '4. RLS: tüm sorgular org_id ile filtreli' || chr(10) ||
  '5. Davet akışı (e-posta + kabul linki)' || chr(10) ||
  '6. Org başına Stripe aboneliği' || chr(10) ||
  '7. Org değiştirici UI',
  'saas'
),
(
  'onboarding-flow',
  'Onboarding Flow',
  'Yeni kullanıcı onboarding wizard — çok adımlı form, ilerleme takibi, kayıt & devam et.',
  'React Hook Form + Framer Motion + Supabase',
  '1. Adım sayısını planla (3-5 ideal)' || chr(10) ||
  '2. Her adım: bir karar / bir bilgi' || chr(10) ||
  '3. Üstte ilerleme çubuğu' || chr(10) ||
  '4. Geç butonu (isteğe bağlı adımlarda)' || chr(10) ||
  '5. Kaydet & devam et (kapatınca kaybolmasın)' || chr(10) ||
  '6. Son: "Hadi başla" CTA → ana dashboard',
  'ux'
),
(
  'pricing-page',
  'Pricing Page',
  'Yüksek conversion fiyatlandırma sayfası — 3 katman, SSS, özellik karşılaştırma tablosu.',
  'Next.js + Tailwind + shadcn',
  '1. 3 katman (Ücretsiz / Pro / İş)' || chr(10) ||
  '2. Aylık/yıllık geçiş (%20 indirim göster)' || chr(10) ||
  '3. Ortadakine "En Popüler" rozeti' || chr(10) ||
  '4. Özellik karşılaştırma tablosu' || chr(10) ||
  '5. SSS (10 soru)' || chr(10) ||
  '6. Para iade garantisi' || chr(10) ||
  '7. Footer''da "büyük şirket misin? satış ile konuş"',
  'marketing'
)
ON CONFLICT (slug) DO NOTHING;

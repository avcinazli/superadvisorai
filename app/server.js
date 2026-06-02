const express      = require('express');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const bcrypt       = require('bcryptjs');
const pool         = require('./db/pool');

const authRoutes      = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientRoutes    = require('./routes/clients');
const projectRoutes   = require('./routes/projects');
const templateRoutes  = require('./routes/templates');
const userRoutes      = require('./routes/users');
const auditRoutes     = require('./routes/audit');
const proposalRoutes  = require('./routes/proposals');
const paymentRoutes   = require('./routes/payments');
const noteRoutes      = require('./routes/notes');
const taskRoutes      = require('./routes/tasks');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Güvenlik & Middleware ────────────────────────────────────────────────────
// trust proxy sadece gerçek reverse proxy arkasındayken (Railway, Render vb.)
if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY !== 'false') {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      scriptSrcAttr:  ["'unsafe-inline'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      imgSrc:         ["'self'", "data:", "https://images.unsplash.com"],
      connectSrc:     ["'self'"],
    },
  },
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit SADECE API rotalarına uygulanır — statik dosyalar sayılmaz
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek, lütfen bekleyin' },
});
// Login endpoint için daha sıkı limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi, 15 dakika bekleyin' },
});

// ─── API Rotaları ────────────────────────────────────────────────────────────
app.use('/api/auth/login', loginLimiter);
app.use('/api',            apiLimiter);
app.use('/api/auth',      authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients',   clientRoutes);
app.use('/api/projects',  projectRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/audit',     auditRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/notes',     noteRoutes);
app.use('/api/tasks',     taskRoutes);

// /admin → admin panel SPA
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// / → marketing landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Catch-all: landing page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// ─── Veritabanı Schema & Seed ─────────────────────────────────────────────────
async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      name          VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
      is_active     BOOLEAN DEFAULT true,
      last_login    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS clients (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      email       VARCHAR(255) NOT NULL,
      company     VARCHAR(255),
      phone       VARCHAR(50),
      status      VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','inactive','prospect')),
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
    CREATE TABLE IF NOT EXISTS proposals (
      id          SERIAL PRIMARY KEY,
      client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      amount      DECIMAL(12,2),
      status      VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','rejected')),
      sent_at     TIMESTAMPTZ,
      valid_until DATE,
      notes       TEXT,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payments (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      title       VARCHAR(255) NOT NULL,
      amount      DECIMAL(12,2) NOT NULL,
      status      VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
      due_date    DATE,
      paid_at     TIMESTAMPTZ,
      invoice_no  VARCHAR(100),
      notes       TEXT,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notes (
      id          SERIAL PRIMARY KEY,
      client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      status      VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
      priority    VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date    DATE,
      sort_order  INTEGER DEFAULT 0,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clients_status    ON clients(status);
    CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_client   ON projects(client_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_proposals_client  ON proposals(client_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_status  ON proposals(status);
    CREATE INDEX IF NOT EXISTS idx_payments_project  ON payments(project_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_notes_client      ON notes(client_id);
    CREATE INDEX IF NOT EXISTS idx_notes_project     ON notes(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project     ON tasks(project_id);
  `);

  // Şablon seed — sadece ilk seferde eklenir
  await pool.query(`
    INSERT INTO templates (slug, name, description, stack, process, category) VALUES
    ('landing-page','Landing Page','Ürün/hizmet için satış odaklı tek sayfa.','Next.js + Tailwind + shadcn + Framer Motion','1. Hero (değer önerisi + CTA)\n2. Sosyal kanıt\n3. Özellikler\n4. Nasıl çalışır\n5. Fiyatlandırma\n6. SSS\n7. Son CTA + Footer','marketing'),
    ('saas-mvp','SaaS MVP','Sıfırdan 7 günde MVP SaaS uygulaması.','Next.js 14 + Supabase + Stripe + Resend + Vercel','Gün 1: Kurulum + Auth\nGün 2: DB şeması + RLS\nGün 3: Core CRUD\nGün 4: Stripe + Webhooks\nGün 5: Dashboard UI\nGün 6: E-posta\nGün 7: Deploy + Canlı mod','saas'),
    ('admin-paneli','Admin Panel','Role tabanlı iç kullanım yönetim paneli.','Next.js + shadcn/ui + Supabase + tRPC','1. Rol tablosu\n2. Login + middleware\n3. Sidebar nav\n4. Data tablolar\n5. CRUD modallar\n6. Audit log\n7. CSV export','tooling'),
    ('dashboard-analytics','Analytics Dashboard','Gerçek zamanlı KPI ve grafik panosu.','Next.js + Recharts + Supabase + TanStack Query','1. KPI kartları\n2. Grafikler\n3. Tarih seçici\n4. Filtre paneli\n5. PDF/CSV export\n6. Realtime','saas'),
    ('cms-builder','CMS Builder','Müşterinin içeriğini yönettiği headless CMS.','Next.js + Sanity / Payload / Strapi','1. İçerik tipleri\n2. Admin UI\n3. Dynamic routes\n4. Görsel optimize\n5. Rich text\n6. Preview\n7. Webhook ISR','content'),
    ('marketplace','Marketplace','İki taraflı alıcı/satıcı marketplace.','Next.js + Supabase + Stripe Connect + Algolia','1. Kullanıcı tipleri\n2. Listeleme CRUD\n3. Arama\n4. Listeleme detay\n5. Stripe Connect\n6. Sipariş akışı\n7. Değerlendirme','ecommerce'),
    ('membership-site','Membership Site','İçerik kilitli üyelik ve kurs platformu.','Next.js + Supabase + Stripe Subscriptions + Mux','1. Auth + tier\n2. İçerik tipleri\n3. İçerik kilitleme\n4. Üye feed\n5. Yorum + tepki\n6. E-posta\n7. Üye dizini','content'),
    ('multi-tenant','Multi-Tenant SaaS','Çoklu organizasyon B2B SaaS.','Next.js + Supabase RLS + Stripe per-org','1. Org modeli\n2. Üyeler tablosu\n3. URL routing\n4. RLS\n5. Davet akışı\n6. Per-org Stripe\n7. Org switcher','saas'),
    ('onboarding-flow','Onboarding Flow','Yeni kullanıcı çok adımlı onboarding wizard.','React Hook Form + Framer Motion + Supabase','1. Adım planı (3-5)\n2. Her adım: bir karar\n3. Progress bar\n4. Skip butonu\n5. Kaydet & devam\n6. Son CTA → dashboard','ux'),
    ('pricing-page','Pricing Page','Yüksek conversion 3 katmanlı fiyatlandırma sayfası.','Next.js + Tailwind + shadcn','1. 3 tier\n2. Aylık/yıllık toggle\n3. Popüler rozeti\n4. Karşılaştırma tablosu\n5. SSS\n6. Para iade garantisi\n7. Enterprise footer','marketing')
    ON CONFLICT (slug) DO NOTHING;
  `);

  console.log('✅ Veritabanı şeması ve şablonlar hazır');
}

// ─── İlk Admin Kullanıcısını Oluştur ─────────────────────────────────────────
async function ensureAdmin() {
  const email    = process.env.ADMIN_EMAIL    || 'admin@supervisor.io';
  const password = process.env.ADMIN_PASSWORD || 'Admin1234!';
  const name     = process.env.ADMIN_NAME     || 'Admin';

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4)',
        [email, name, hash, 'admin']
      );
      console.log(`✅ Admin hesabı oluşturuldu: ${email}`);
    } else {
      console.log(`ℹ️  Admin hesabı zaten mevcut: ${email}`);
    }
  } catch (err) {
    console.error('Admin oluşturma hatası:', err.message);
  }
}

// ─── Başlat ───────────────────────────────────────────────────────────────────
async function start() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? `SET (${process.env.DATABASE_URL.split('@')[1] || 'parsed'})` : 'NOT SET');
  console.log('PGHOST:', process.env.PGHOST || 'NOT SET');

  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Veritabanı bağlantısı kuruldu');
      break;
    } catch (err) {
      retries--;
      console.error(`⏳ Veritabanı bekleniyor... (${retries} deneme kaldı) — Hata: ${err.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (retries === 0) {
    console.error('❌ Veritabanına bağlanılamadı. Çıkılıyor.');
    process.exit(1);
  }

  await runMigrations();
  await ensureAdmin();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Supervisor Admin Panel: http://0.0.0.0:${PORT}`);
    console.log(`   Landing page : http://0.0.0.0:${PORT}/`);
    console.log(`   Admin panel  : http://0.0.0.0:${PORT}/admin`);
  });
}

start();

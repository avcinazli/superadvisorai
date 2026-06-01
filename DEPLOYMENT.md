# Supervisor Admin Panel — Yerel Test & Railway Deploy Rehberi

> Bu rehberi baştan sona takip ederek uygulamayı önce bilgisayarınızda test edin,  
> ardından Railway'e GitHub üzerinden deploy edin.

---

## İÇİNDEKİLER

1. [Yerel Test (Docker)](#1-yerel-test-docker)
2. [GitHub'a Yükleme](#2-githuba-yükleme)
3. [Railway Hesabı & Proje Kurulumu](#3-railway-hesabı--proje-kurulumu)
4. [PostgreSQL Ekleme](#4-postgresql-ekleme)
5. [Ortam Değişkenleri (Env Vars)](#5-ortam-değişkenleri-env-vars)
6. [Deploy & Canlıya Alma](#6-deploy--canlıya-alma)
7. [İlk Giriş & Şifre Değiştirme](#7-ilk-giriş--şifre-değiştirme)
8. [Özel Domain (İsteğe Bağlı)](#8-özel-domain-isteğe-bağlı)
9. [Sorun Giderme](#9-sorun-giderme)

---

## 1. Yerel Test (Docker)

### 1.1 Gereksinimler

- **Docker Desktop** kurulu ve çalışıyor olmalı  
  İndir: https://www.docker.com/products/docker-desktop  
  (Windows için "WSL 2 backend" seçeneğini etkinleştirin)

- **Git** kurulu olmalı  
  İndir: https://git-scm.com/downloads

### 1.2 Projeyi Çalıştırma

Terminali açın ve şu komutları sırasıyla çalıştırın:

```bash
# panel klasörüne girin
cd "C:\Users\User\Desktop\my-site\aiengineer\supervisor\panel"

# Container'ları başlatın (ilk seferde image build edilir, 1-2 dk sürer)
docker compose up -d

# Log'ları izleyin (isteğe bağlı)
docker compose logs -f app
```

### 1.3 Tarayıcıdan Erişim

| Adres | Ne gösterir |
|-------|-------------|
| http://localhost:3000 | Supervisor.ai marketing sitesi |
| http://localhost:3000/admin | Admin panel giriş ekranı |

### 1.4 İlk Giriş Bilgileri

```
E-posta  : admin@supervisor.io
Şifre    : Admin1234!
```

> ⚠️ Giriş yaptıktan sonra hemen şifrenizi değiştirin (Kullanıcılar menüsünden).

### 1.5 Durdurma & Sıfırlama

```bash
# Container'ları durdur (veri kaybolmaz)
docker compose down

# Her şeyi sıfırla (VERİTABANI SİLİNİR!)
docker compose down -v
```

---

## 2. GitHub'a Yükleme

### 2.1 GitHub Hesabı

Henüz hesabınız yoksa: https://github.com/signup adresinden ücretsiz hesap açın.

### 2.2 Yeni Repository Oluşturun

1. https://github.com/new adresine gidin
2. Repository adı: `supervisor-admin` (ya da istediğiniz bir isim)
3. **Private** seçin (şifreleriniz .env dosyasında)
4. **Create repository** butonuna tıklayın

### 2.3 Projeyi GitHub'a Yükleyin

Terminalde `panel/` klasöründeyken:

```bash
# Git başlat
git init

# .gitignore oluştur (node_modules ve .env upload edilmesin)
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore

# Dosyaları ekle
git add .

# İlk commit
git commit -m "feat: supervisor admin panel - initial setup"

# GitHub'daki repo ile bağla (URL'yi kendi repo URL'nizle değiştirin)
git remote add origin https://github.com/KULLANICI_ADINIZ/supervisor-admin.git

# Upload et
git branch -M main
git push -u origin main
```

> 💡 GitHub sizden kullanıcı adı ve şifre isterse:  
> Şifre yerine **Personal Access Token** kullanın.  
> GitHub → Settings → Developer Settings → Personal access tokens → Generate new token (classic)  
> Scope: `repo` seçin.

---

## 3. Railway Hesabı & Proje Kurulumu

### 3.1 Hesap Oluşturma

1. https://railway.app adresine gidin
2. **"Start a New Project"** butonuna tıklayın
3. **"Login with GitHub"** seçin → GitHub hesabınızla giriş yapın
4. Railway'e GitHub erişim izni verin

### 3.2 Yeni Proje Oluşturma

1. Railway dashboard'unda **"New Project"** butonuna tıklayın
2. **"Deploy from GitHub repo"** seçin
3. Az önce oluşturduğunuz `supervisor-admin` reposunu listeden seçin
4. Railway otomatik deploy başlatacak — **henüz tamamlanmasını beklemeyin**, ayarları önce yapacağız

### 3.3 Root Directory Ayarı

Railway'in Dockerfile'ı bulabilmesi için:

1. Oluşturulan servisin üzerine tıklayın
2. **Settings** sekmesine gidin
3. **"Source"** bölümünde **"Root Directory"** alanını bulun
4. `app` yazın ve kaydedin

> Bu ayar Railway'e "Dockerfile, `app/` klasöründe" der.

---

## 4. PostgreSQL Ekleme

### 4.1 Database Plugin Ekleyin

1. Railway proje sayfasında sağ üstteki **"+ New"** butonuna tıklayın
2. **"Database"** → **"Add PostgreSQL"** seçin
3. Railway otomatik bir PostgreSQL instance oluşturur

### 4.2 Bağlantı Bilgisini Kopyalayın

1. Yeni oluşturulan PostgreSQL servisine tıklayın
2. **"Connect"** sekmesine gidin
3. **`DATABASE_URL`** değerini kopyalayın (bir sonraki adımda kullanacaksınız)

> Railway bu URL'yi otomatik olarak uygulamanızla paylaşabilir — bir sonraki adımda bunu yapılandıracağız.

---

## 5. Ortam Değişkenleri (Env Vars)

### 5.1 App Servisine Değişken Ekleyin

1. App servisinize (supervisor-admin) tıklayın
2. **"Variables"** sekmesine gidin
3. Aşağıdaki değişkenleri tek tek ekleyin:

| Değişken Adı | Değer | Açıklama |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway PostgreSQL'den otomatik alır |
| `JWT_SECRET` | `uzun-rastgele-bir-sifre-123!@#` | En az 32 karakter, güçlü seçin |
| `ADMIN_EMAIL` | `sizin@email.com` | İlk admin hesabı e-postası |
| `ADMIN_PASSWORD` | `GucluBirSifre123!` | İlk admin şifresi |
| `ADMIN_NAME` | `Admin` | Admin kullanıcı adı |
| `NODE_ENV` | `production` | Üretim modu |

> ⚡ **`DATABASE_URL` için önemli not:**  
> Değer olarak `${{Postgres.DATABASE_URL}}` yazarsanız Railway otomatik bağlar.  
> Yoksa PostgreSQL servisinden kopyaladığınız URL'yi yapıştırın.

### 5.2 JWT_SECRET Nasıl Oluşturulur?

Güçlü bir JWT secret üretmek için terminal'de:

```bash
# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Mac/Linux
openssl rand -base64 32
```

Çıktıyı JWT_SECRET olarak kullanın.

---

## 6. Deploy & Canlıya Alma

### 6.1 Deploy Tetikleyin

Değişkenleri ekledikten sonra Railway otomatik yeni bir deploy başlatır.  
Yoksa **"Deploy"** butonuna manuel tıklayın.

### 6.2 Build Log'larını İzleyin

1. **"Deployments"** sekmesine gidin
2. En son deployment'a tıklayın
3. Build log'larını izleyin — şu satırları görmelisiniz:
   ```
   ✅ Veritabanı bağlantısı kuruldu
   ✅ Veritabanı şeması ve şablonlar hazır
   ✅ Admin hesabı oluşturuldu: sizin@email.com
   🚀 Supervisor Admin Panel: http://0.0.0.0:PORT
   ```

### 6.3 Public URL Alın

1. Deployment tamamlandıktan sonra servis sayfasında **"Settings"** → **"Networking"** bölümüne gidin
2. **"Generate Domain"** butonuna tıklayın
3. Railway size `*.up.railway.app` formatında bir URL verir

Örnek URL'ler:
```
https://supervisor-admin-production.up.railway.app/        ← Landing page
https://supervisor-admin-production.up.railway.app/admin   ← Admin panel
```

---

## 7. İlk Giriş & Şifre Değiştirme

### 7.1 Admin Panel'e Giriş

1. `https://SIZIN-URL.up.railway.app/admin` adresine gidin
2. Env var'larda belirlediğiniz e-posta ve şifreyle giriş yapın

### 7.2 Şifre Değiştirme (ÖNEMLİ!)

1. Sol menüden **"Kullanıcılar"** sayfasına gidin
2. Admin kullanıcısının yanındaki **düzenle (kalem)** ikonuna tıklayın
3. **Yeni Şifre** alanına güçlü bir şifre girin
4. **Kaydet** butonuna tıklayın

### 7.3 Yeni Kullanıcı Ekleme

1. **"Kullanıcılar"** → **"Kullanıcı Ekle"** butonuna tıklayın
2. Ad, e-posta, şifre doldurun
3. Rol seçin: **Admin** / **Editör** / **Görüntüleyici**

| Rol | Yetkiler |
|-----|----------|
| Admin | Her şey: kullanıcı yönetimi dahil |
| Editör | Müşteri ve proje ekle/düzenle, audit log görüntüle |
| Görüntüleyici | Sadece okuma, şablonlar |

---

## 8. Özel Domain (İsteğe Bağlı)

### 8.1 Railway'e Domain Ekleyin

1. Servis → **Settings** → **Networking** → **"Add Custom Domain"**
2. Domain adınızı girin: `admin.supervisor.ai`

### 8.2 DNS Kaydı Ekleyin

Domain sağlayıcınızın (GoDaddy, Cloudflare, Namecheap vb.) DNS panelinde:

```
Tür  : CNAME
Ad   : admin (veya @ tüm domain için)
Değer: SIZIN-RAILWAY-URL.up.railway.app
TTL  : 3600
```

> Cloudflare kullanıyorsanız: Proxy (turuncu bulut) kapalı olsun, yalnızca DNS (gri bulut) seçin.

### 8.3 SSL

Railway otomatik Let's Encrypt SSL sertifikası yükler. 5-10 dakika içinde HTTPS aktif olur.

---

## 9. Sorun Giderme

### "Cannot connect to database"
- Railway PostgreSQL servisi çalışıyor mu? (Railway dashboard'da yeşil olmalı)
- `DATABASE_URL` doğru set edildi mi? Variables sekmesini kontrol edin
- Deploy log'larında hata var mı?

### "Port is already in use" (yerel test)
```bash
# Hangi process 3000 portunu kullanıyor?
netstat -ano | findstr :3000
# PID'i bulup task manager'dan kapatın, sonra tekrar deneyin
```

### "Şifremi unuttum"
Railway Variables'dan `ADMIN_PASSWORD` değerini geçici değiştirin ve yeniden deploy edin. Giriş yaptıktan sonra panelden şifrenizi değiştirin, sonra env var'ı silebilirsiniz.

### Local Docker'da "image build" çok uzun süriyor
İlk seferinde normaldir. node:20-alpine image'ı indirilir (~100MB). Sonraki başlatmalarda çok hızlı olur.

### Railway deploy başarısız
1. **Deployments** → hatalı deployment'a tıklayın
2. Log'ların en altına gidin, kırmızı hata mesajını okuyun
3. En sık sorun: eksik env var veya yanlış root directory ayarı

---

## HIZLI REFERANS

```
# Yerel başlat
cd panel && docker compose up -d

# Yerel durdur
docker compose down

# Log izle
docker compose logs -f app

# GitHub'a güncelleme gönder (Railway otomatik deploy eder)
git add . && git commit -m "update" && git push
```

```
Yerel Admin    : http://localhost:3000/admin
Yerel Site     : http://localhost:3000
Railway Admin  : https://SIZIN-URL.up.railway.app/admin
Railway Site   : https://SIZIN-URL.up.railway.app
```

---

*Oluşturulma tarihi: 2026-06-01 | Supervisor Admin Panel v1.0*

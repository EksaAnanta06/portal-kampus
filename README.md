# 🎓 Portal Kampus UNAS PASIM Bandung

[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%205-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/Database-MySQL%208%20%2F%20TiDB%20Cloud-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Capacitor](https://img.shields.io/badge/Mobile-Capacitor%20Android-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Demo Web](https://img.shields.io/badge/Live%20Demo-Vercel-000000?logo=vercel&logoColor=white)](https://portal-kampus-pasim.vercel.app)

Aplikasi portal kampus terpadu full-stack (Web PWA & Android Native via Capacitor) untuk sivitas akademika **Universitas Nasional Pasim (UNAS PASIM) Bandung**. Proyek ini mencakup galeri kenangan angkatan, warta & agenda kampus, direktori mahasiswa/alumni, perpustakaan materi peer-to-peer, study planner & timer Pomodoro, hiburan kartu virtual real-time, serta sistem autentikasi lengkap (NIM/Email & Google OAuth 2.0).

🌐 **Live Demo Web:** https://portal-kampus-pasim.vercel.app

---

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Tech Stack](#-tech-stack)
- [Struktur Proyek](#-struktur-proyek)
- [Prasyarat](#-prasyarat)
- [Panduan Setup Lokal (Step-by-Step)](#-panduan-setup-lokal-step-by-step)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Setup Database](#2-setup-database)
  - [3. Konfigurasi Environment Variables](#3-konfigurasi-environment-variables)
  - [4. Install Dependensi & Jalankan](#4-install-dependensi--jalankan)
- [Konfigurasi Integrasi Opsional](#-konfigurasi-integrasi-opsional)
- [Akun Demo Siap Pakai](#-akun-demo-siap-pakai)
- [Daftar Perintah Penting (NPM Scripts)](#-daftar-perintah-penting-npm-scripts)
- [Build Aplikasi Android Native (Opsional)](#-build-aplikasi-android-native-opsional)
- [Panduan Deployment Produksi](#-panduan-deployment-produksi)
- [Troubleshooting Umum](#-troubleshooting-umum)
- [Kontribusi & Lisensi](#-kontribusi--lisensi)

---

## ✨ Fitur Utama

- **Dashboard Kampus & Pencarian Cepat (`Ctrl + K`)**: Ringkasan statistik kampus, warta/pengumuman resmi (mendukung *pinned post*), agenda kegiatan, serta pencarian cepat lintas foto, warta, dan pengguna.
- **Galeri Kenangan Angkatan & Moderasi**: Pengelompokan album per angkatan, unggah multi-foto via Cloudinary, sistem *like*, komentar, laporan konten, serta antrean moderasi untuk Moderator/Admin.
- **Direktori Mahasiswa & Alumni**: Pencarian rekan seangkatan/prodi lengkap dengan tautan LinkedIn, Instagram, GitHub, pekerjaan saat ini, dan opsi visibilitas profil publik/privat.
- **Perpustakaan Materi Peer-to-Peer**: Katalog materi kuliah berdasarkan program studi dan mata kuliah, mendukung riwayat versi berkas (*versioning*), voting, komentar diskusi, koleksi pribadi, permintaan (*request*) materi, dan paket belajar.
- **Study Planner & Timer Fokus (Pomodoro)**: Manajemen tugas pribadi mandiri, jadwal sesi belajar, timer fokus Pomodoro beserta pengaturan durasi/jam tenang, dan pengingat otomatis via `node-cron`.
- **Hiburan Kampus (Poker Chip Virtual)**: Permainan kartu multipemain *real-time* berbasis WebSocket **tanpa uang asli/saldo permanen** lengkap dengan riwayat ringkas dan pelaporan pemain (dapat dinonaktifkan lewat `FEATURE_POKER=false`).
- **Autentikasi & Kontrol Akses (RBAC)**:
  - Peran: `admin`, `moderator`, `mahasiswa`, dan `alumni`.
  - Login dengan **Email / NIM + Password** maupun **Google OAuth 2.0** (mendukung Web browser dan Android Chrome Custom Tabs *deep link*).
  - JWT Access Token + rotasi HttpOnly Refresh Token (disimpan aman via `Preferences` pada Android native) serta fitur lupa/reset password via SMTP.
- **PWA & Aplikasi Native Android**: Mode gelap/terang, dukungan Progressive Web App (`sw.js`), notifikasi *real-time* lewat Server-Sent Events (SSE), serta *background polling* notifikasi dan alarm Pomodoro pada build Android Capacitor.

---

## 🛠️ Tech Stack

| Lapisan | Teknologi |
| :--- | :--- |
| **Frontend Web** | React 18, Vite 5, React Router v6, Tailwind CSS 3, Material UI (MUI v5), Zustand, Axios, Vite PWA |
| **Mobile Native** | Capacitor 6 (Android Java native plugin untuk background push & exact alarm notifikasi) |
| **Backend API** | Node.js (ESM), Express 4, WebSocket (`http`/custom WS), Zod, JWT (`jsonwebtoken`), Bcrypt, Multer, Node-Cron |
| **Database** | MySQL 8.0+ / TiDB Cloud Serverless (`mysql2/promise`) |
| **Media & Layanan** | Cloudinary (gambar & dokumen), Nodemailer (SMTP), Web Push / VAPID, Google OAuth 2.0 |

---

## 📁 Struktur Proyek

```text
portal-kampus/
├── client/                     # Frontend React + Vite + PWA + Capacitor Android
│   ├── android/                # Project native Android (Gradle / Capacitor)
│   ├── public/                 # Aset statis, logo, manifest PWA, offline page
│   ├── src/
│   │   ├── api/                # Klien Axios + refresh token interceptor & endpoint API
│   │   ├── components/         # Komponen UI per fitur (auth, galeri, fokus, materi, poker, dll.)
│   │   ├── layouts/            # MainLayout, AuthLayout, AdminLayout
│   │   ├── pages/              # Halaman aplikasi (lazy-loaded)
│   │   ├── platform/           # Abstraksi Web vs Capacitor Native (storage, notif, download, Google OAuth)
│   │   ├── services/           # Sinkronisasi background push native
│   │   ├── store/              # Zustand stores (auth, theme, focus timer, poker)
│   │   └── utils/              # Konstanta, format tanggal, Web Push, WebSocket client
│   ├── .env.example
│   ├── capacitor.config.json
│   └── vercel.json             # Konfigurasi rewrite SPA & header cache Vercel
├── server/                     # Backend REST API & WebSocket server
│   ├── scripts/                # Skrip bantu & uji fitur (syntax-check, focus, poker)
│   ├── src/
│   │   ├── config/             # Env loader, MySQL/TiDB connection pool, Cloudinary, Nodemailer
│   │   ├── controllers/        # Handler HTTP request & response
│   │   ├── middlewares/        # Auth JWT, RBAC, rate limiter, upload, validasi Zod, error handler
│   │   ├── queries/            # Query SQL terparameterisasi
│   │   ├── routes/             # Definisi endpoint /api/v1/*
│   │   ├── services/           # Logika bisnis (auth, Google OAuth, galeri, materi, fokus, notif)
│   │   ├── sockets/            # WebSocket server untuk permainan poker virtual
│   │   ├── utils/              # Helper JWT, CORS, AppError, seedPasswords
│   │   ├── validators/         # Skema validasi Zod
│   │   └── ws/                 # Engine & handler sesi permainan kartu
│   ├── .env.example
│   └── Dockerfile              # Image produksi backend berbasis Node 20 Alpine
├── database/                   # Skema SQL, migrasi bertahap, & seeder
│   ├── migrations/             # File migrasi 001..005 (up & down)
│   ├── seeds/                  # Seeder opsional perpustakaan materi & study planner
│   ├── schema.sql              # Skema inti MySQL 8.0+
│   ├── seed.sql                # Data awal angkatan, album, dan 6 akun demo
│   └── tidb_setup.sql          # Skrip gabungan siap tempel untuk TiDB Cloud Serverless
└── render.yaml                 # Blueprint deployment backend untuk Render
```

---

## 📦 Prasyarat

Pastikan sistem Anda sudah memiliki:

- **Node.js `>= 18.0.0`** (disarankan **Node.js 20 LTS**) dan **npm**.
- **Database MySQL 8.0+** lokal *atau* akun **TiDB Cloud Serverless** (gratis).
- *(Opsional)* Akun **Cloudinary** jika ingin menguji unggah foto, avatar, dan dokumen materi.
- *(Opsional)* **Google Cloud Console** Client ID & Secret jika ingin mengaktifkan tombol Login dengan Google.
- *(Opsional)* **SMTP Email** (misalnya Gmail App Password) untuk fitur email reset password.
- *(Opsional)* **JDK 17 & Android Studio / Android SDK** jika ingin mem-build APK Android native.

---

## 🚀 Panduan Setup Lokal (Step-by-Step)

### 1. Clone Repository

> **Catatan Branch:** Kode terbaru beserta fitur Google OAuth, Study Planner, Poker hiburan, Capacitor Android, dan konfigurasi Vercel saat ini berada di branch **`refactor/revamp`**.

```bash
git clone https://github.com/EksaAnanta06/portal-kampus.git
cd portal-kampus
git checkout refactor/revamp
```

---

### 2. Setup Database

Pilih salah satu opsi database di bawah ini.

#### Opsi A — MySQL 8.0+ Lokal

Jalankan file SQL berikut **secara berurutan**:

```bash
# 1. Buat database & tabel inti
mysql -u root -p < database/schema.sql

# 2. Migrasi skema fitur
mysql -u root -p db_portal_pasim < database/migrations/001_peer_materials_library_up.sql
mysql -u root -p db_portal_pasim < database/migrations/002_hardening_fk_indexes_cloudinary_up.sql
mysql -u root -p db_portal_pasim < database/migrations/004_focus_planner_timer_up.sql
mysql -u root -p db_portal_pasim < database/migrations/005_poker_game_up.sql

# 3. Isi data awal & akun demo (wajib untuk login cepat akun demo)
mysql -u root -p db_portal_pasim < database/seed.sql

# 4. (Opsional) Isi data contoh materi & study planner
mysql -u root -p db_portal_pasim < database/seeds/peer_materials_seed.sql
mysql -u root -p db_portal_pasim < database/seeds/focus_planner_seed.sql
```

#### Opsi B — TiDB Cloud Serverless (1 File Gabungan)

1. Buat cluster Serverless di TiDB Cloud lalu buka **SQL Editor**.
2. Salin seluruh isi file `database/tidb_setup.sql` ke SQL Editor.
3. Jalankan semua perintah dengan **`Shift + Ctrl + Enter`** (atau klik panah di samping tombol *Run* → **Run All**).
4. Pastikan di `server/.env` nanti Anda mengisi **`DB_SSL=true`** dan **`DB_PORT=4000`**.

> 💡 **Catatan Startup Backend:** Saat server pertama kali dijalankan, `server/src/config/db.js` juga otomatis memverifikasi dan memastikan tabel fitur Fokus/Tugas, Poker hiburan, serta kolom `users.google_id` tersedia di database tanpa menghapus data yang sudah ada.

---

### 3. Konfigurasi Environment Variables

#### A. Backend (`server/.env`)

Salin template `.env.example` terlebih dahulu:

```bash
cp server/.env.example server/.env
```

Generate dua kunci acak yang berbeda untuk JWT (`JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ringkasan variabel utama di `server/.env`:

| Variabel | Status | Contoh / Keterangan |
| :--- | :---: | :--- |
| `PORT` | **Wajib** | `5000` |
| `CLIENT_URL` | **Wajib** | `http://localhost:5173` (pisahkan koma jika lebih dari satu origin) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | **Wajib** | Lokal: `127.0.0.1`, `3306`, `root`, `""`, `db_portal_pasim`. TiDB Cloud: `DB_PORT=4000` & `DB_SSL=true` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | **Wajib** | String acak minimal 64 karakter (jangan gunakan nilai default di produksi) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Opsional | Diperlukan bila menguji unggah foto, avatar, dan dokumen |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Opsional | Diperlukan bila mengaktifkan Login dengan Google |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Opsional | Jika kosong di mode dev, tautan reset password dicetak ke console server |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Opsional | Untuk Web Push notification browser |
| `FEATURE_POKER` | Opsional | `true` (default) atau `false` untuk menonaktifkan fitur poker hiburan |

#### B. Frontend (`client/.env`)

Salin template `.env.example`:

```bash
cp client/.env.example client/.env
```

Isi untuk pengembangan lokal:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_NAME="Portal Kampus UNAS PASIM Bandung"
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_MAX_DOC_FILE_SIZE_MB=10
VITE_FEATURE_POKER=true
```

---

### 4. Install Dependensi & Jalankan

Buka **dua terminal terpisah**:

**Terminal 1 — Backend API (`http://localhost:5000/api/v1`):**
```bash
cd server
npm install
npm run dev
```
Untuk memastikan API sehat, buka `http://localhost:5000/api/v1/health` (harus mengembalikan HTTP `200`).

**Terminal 2 — Frontend Client (`http://localhost:5173`):**
```bash
cd client
npm install
npm run dev
```

Buka **`http://localhost:5173`** di browser Anda.

---

## 🔌 Konfigurasi Integrasi Opsional

<details>
<summary><strong>1. Google OAuth 2.0 (Login & Registrasi dengan Google)</strong></summary>

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat/pilih project → masuk ke **APIs & Services → OAuth consent screen** (isi informasi aplikasi & tambahkan email tester jika masih mode *Testing*).
2. Masuk ke **Credentials → Create Credentials → OAuth client ID** → pilih tipe **Web application**.
3. Pada **Authorized redirect URIs**, tambahkan URL callback backend:
   - Lokal: `http://localhost:5000/api/v1/auth/google/callback`
   - Produksi / Tunnel: `https://<domain-backend-anda>/api/v1/auth/google/callback`
4. Salin **Client ID** dan **Client Secret** ke `server/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback
   GOOGLE_NATIVE_CALLBACK_URI=portalpasim://auth/callback
   ```
5. Pastikan origin frontend Anda tercantum di `CLIENT_URL` pada `server/.env`.

</details>

<details>
<summary><strong>2. Cloudinary (Upload Foto & Dokumen Materi)</strong></summary>

1. Buat akun gratis di [Cloudinary](https://cloudinary.com/).
2. Salin `Cloud Name`, `API Key`, dan `API Secret` dari dashboard Cloudinary ke `server/.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_FOLDER=portal-unas-pasim
   ```
3. Isi juga `VITE_CLOUDINARY_CLOUD_NAME` di `client/.env`.

</details>

<details>
<summary><strong>3. SMTP Email & Web Push VAPID Keys</strong></summary>

- **SMTP (Gmail App Password):** Aktifkan 2-Step Verification pada akun Google pengirim, buat **App Password** 16 karakter, lalu isi di `server/.env`:
  ```env
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=emailanda@gmail.com
  SMTP_PASS=app_password_16_karakter
  SMTP_FROM="Portal Kampus UNAS PASIM <emailanda@gmail.com>"
  ```
- **Web Push VAPID Keys:**
  ```bash
  npx web-push generate-vapid-keys
  ```
  Tempel `Public Key` ke `VAPID_PUBLIC_KEY` dan `Private Key` ke `VAPID_PRIVATE_KEY` di `server/.env`.

</details>

---

## 🔑 Akun Demo Siap Pakai

Setelah mengimpor `database/seed.sql`, seluruh akun bawaan menggunakan password yang sama:

```text
Pasim123!
```

| Peran (Role) | Nama Pengguna | Email Login | NIM Login | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Dr. Hendra Wijaya, M.Kom. | `admin@pasim.ac.id` | `ADM-001` | Akses penuh dashboard admin, verifikasi user/NIM, kelola warta, agenda, galeri, dan materi |
| **Moderator** | Gilang Ramadhan | `moderator@pasim.ac.id` | `MOD-202201` | Moderasi antrean foto dan tinjau laporan pelanggaran |
| **Alumni** | Dinda Kirana Putri, S.Kom. | `dinda.alumni@pasim.ac.id` | `020122001` | Alumni 2022: unggah foto, interaksi sosial, perpustakaan materi, direktori |
| **Mahasiswa (TI)** | Rizky Pratama Nugraha | `rizky.mhs@pasim.ac.id` | `020123014` | Mahasiswa 2023: galeri, perpustakaan materi, study planner, timer fokus, poker virtual |
| **Mahasiswa (Manajemen)** | Nadia Aulia Zahra | `nadia.mhs@pasim.ac.id` | `020224008` | Mahasiswa 2024: uji direktori lintas prodi dan fitur mahasiswa |
| **Pending User** | Farhan Akbar Maulana | `farhan.baru@pasim.ac.id` | `020125099` | Berstatus `pending` untuk menguji penolakan login & approval oleh Admin |

> 💡 **Tips Cepat:** Pada halaman `/login` di tampilan **Web**, tersedia kartu **Akun Demo Cepat** (*Demo Mahasiswa* & *Demo Alumni*) yang otomatis mengisi kredensial form login. Jika password demo bermasalah setelah mengimpor database lama, jalankan `npm run seed:passwords` di folder `server/`.

---

## 🧰 Daftar Perintah Penting (NPM Scripts)

### Backend (`server/`)
| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server API dengan `node --watch src/server.js` |
| `npm start` | Menjalankan server API mode standar (`node src/server.js`) |
| `npm run check` | Memeriksa sintaks seluruh file JavaScript backend |
| `npm run seed:passwords` | Menyetel ulang password seluruh user di tabel `users` menjadi `Pasim123!` *(gunakan hanya di database dev/demo)* |

### Frontend (`client/`)
| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan Vite dev server (`http://localhost:5173`) dengan proxy `/api` & `/socket.io` ke port `5000` |
| `npm run build` | Mem-build bundle produksi Vite + Service Worker PWA ke `client/dist/` |
| `npm run preview` | Pratinjau hasil build `client/dist/` di port `5173` |
| `npm run cap:sync` | Menyinkronkan aset web dan plugin Capacitor ke folder `client/android/` |
| `npm run cap:build` | Menjalankan `vite build && cap sync android` |
| `npm run cap:open` | Membuka project `client/android/` di Android Studio |

---

## 📱 Build Aplikasi Android Native (Opsional)

Project Android sudah terkonfigurasi dengan Capacitor (`id.ac.pasim.portal`) di folder `client/android/`.

1. Pastikan backend dapat diakses melalui HTTPS publik (misalnya URL deployment cloud atau HTTPS tunnel sementara).
2. Di `client/.env`, atur `VITE_API_BASE_URL=https://<domain-backend-anda>/api/v1`.
3. Di `client/capacitor.config.json`, sesuaikan bagian `server.url` dan `server.allowNavigation` agar menunjuk ke domain backend Anda.
4. Jalankan build & sinkronisasi Capacitor:
   ```bash
   cd client
   npm run cap:build
   ```
5. Buka di Android Studio dengan `npm run cap:open`, atau build APK debug langsung via Gradle:
   ```bash
   cd client/android
   ./gradlew assembleDebug
   ```
   Hasil APK tersedia di `client/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🌍 Panduan Deployment Produksi

### 1. Frontend ke Vercel (`client/`)

File `client/vercel.json` sudah disiapkan untuk rewrite SPA React Router dan header cache PWA.

- **Root Directory:** `client`
- **Framework Preset:** `Vite`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables di Vercel:**
  - `VITE_API_BASE_URL` = `https://<domain-backend-anda>/api/v1`
  - `VITE_APP_NAME` = `Portal Kampus UNAS PASIM Bandung`
  - `VITE_CLOUDINARY_CLOUD_NAME` = `<cloud_name_anda>`
  - `VITE_FEATURE_POKER` = `true`

### 2. Backend ke Render / Docker / VPS (`server/`)

Tersedia dua konfigurasi siap pakai di repositori:
- **Render Blueprint:** `render.yaml` (menargetkan `rootDir: server`, `npm install`, `npm start`).
- **Docker Container:** `server/Dockerfile` (Node 20 Alpine, expose port `8000`).

Pada environment produksi backend, pastikan variabel berikut diatur dengan benar:
- `NODE_ENV=production`
- `CLIENT_URL=https://<domain-frontend-vercel-anda>` *(sertakan origin lain dipisah koma bila diperlukan)*
- `DB_SSL=true` & `DB_PORT=4000` jika menggunakan TiDB Cloud
- `GOOGLE_CALLBACK_URL=https://<domain-backend-anda>/api/v1/auth/google/callback` (harus sama persis dengan Google Cloud Console)

---

## 🩺 Troubleshooting Umum

<details>
<summary><strong>1. Gagal login akun demo ("Kredensial tidak valid")</strong></summary>

Pastikan `database/seed.sql` sudah terimpor. Jika Anda memakai database lama atau hash password belum sesuai, jalankan di folder `server/`:
```bash
npm run seed:passwords
```

</details>

<details>
<summary><strong>2. Error CORS saat Frontend (Vercel/localhost) mengakses Backend</strong></summary>

Periksa `CLIENT_URL` di `server/.env`. Pastikan origin persis (termasuk `https://` dan tanpa garis miring di akhir) sudah ditambahkan, lalu restart backend. Jika memakai tunnel sementara di luar mode dev, atur `CORS_ALLOW_TUNNELS=true`.

</details>

<details>
<summary><strong>3. Error Google OAuth <code>redirect_uri_mismatch</code></strong></summary>

Pastikan nilai `GOOGLE_CALLBACK_URL` di `server/.env` **sama persis karakter per karakter** dengan salah satu **Authorized redirect URIs** pada OAuth Client ID di Google Cloud Console (contoh: `http://localhost:5000/api/v1/auth/google/callback` untuk lokal).

</details>

<details>
<summary><strong>4. Koneksi ke TiDB Cloud Serverless ditolak / timeout</strong></summary>

TiDB Cloud mewajibkan koneksi TLS/SSL di port `4000`. Pastikan di `server/.env`:
```env
DB_PORT=4000
DB_SSL=true
```

</details>

---

## 🤝 Kontribusi & 📄 Lisensi

### Cara Berkontribusi

1. **Fork** repositori ini dan buat branch fitur baru dari `refactor/revamp`:
   ```bash
   git checkout -b feat/nama-fitur
   ```
2. Lakukan perubahan kode lalu verifikasi sebelum mengirim Pull Request:
   - Pastikan sintaks backend lolos: `npm run check` (di folder `server/`)
   - Pastikan build frontend bersih: `npm run build` (di folder `client/`)
   - **Jangan pernah** meng-commit file `.env` atau kredensial rahasia apa pun.
3. Commit perubahan Anda dan buka **Pull Request**.

### Lisensi

Proyek ini dirilis sebagai perangkat lunak **open source** untuk keperluan pembelajaran, referensi, dan pengembangan sistem informasi kampus. Silakan gunakan, modifikasi, dan kembangkan kembali dengan tetap mencantumkan atribusi yang sesuai (Anda dapat menambahkan file `LICENSE` seperti MIT License apabila ingin menentukan syarat distribusi resmi).

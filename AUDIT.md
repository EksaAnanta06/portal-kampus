# Laporan Audit Menyeluruh — Portal Kampus UNAS PASIM Bandung

- **Mode Audit:** Read-Only (Tahap 1 — belum ada perubahan kode, branch git, ataupun skema database)
- **Repository & Commit Saat Ini:** Branch `main` @ `51ff081` (`Initial commit`, working tree bersih sebelum `AUDIT.md` dibuat)
- **Lingkup Kodebase:** `24.928` total baris di `client/src`, `server/src`, dan `database` (`66` file `client/src`, `39` file `server/src`, `7` file `database`)
- **Status Tooling & Build Saat Audit:**
  - `npm run build` di `client/` (`vite build`): **Berhasil** (`exit 0`, `13.24s`), menghasilkan peringatan chunking (`axiosInstance.js` di-import dinamis oleh `useAuthStore.js` dan statis oleh modul API) serta tetap mem-bundle 2 halaman mati (`ClassMaterialsDetailPage` 25.02 kB, `MaterialsListPage` 12.29 kB).
  - ESLint, Prettier, dan test runner (Jest/Vitest/Supertest): **Belum tersedia** di `client/package.json` maupun `server/package.json`.
- **Konvensi Label Bukti:**
  - **`[PASTI]`** = Terbukti langsung dari kode sumber, konfigurasi, skema SQL, atau output build/CLI pada sesi audit ini.
  - **`[DUGAAN]`** = Membutuhkan verifikasi manual di database MySQL live, penyimpanan Cloudinary, atau browser/device fisik.

---

## Ringkasan Eksekutif Jumlah Temuan

| Tingkat Keparahan | Jumlah | Fokus Utama |
|---|---:|---|
| **Critical** | **10** | IDOR pada detail materi unmoderated/takedown, bypass filter `?status=` di `GET /materials`, IDOR pada `toggleCollectionItem`, bypass validasi MIME upload dokumen (`startsWith('application/')`/`'image/'`), kebocoran `dev_reset_token` saat `NODE_ENV !== 'production'`, reset password & suspend tidak me-revoke atau menyinkronkan token dengan lengkap, `syncDatabaseSchema()` / `ensureAcademicSchema()` membuat 13 tabel materi **tanpa Foreign Key**, `db.js` menjalankan 8 `DROP TABLE` setiap server startup, penghapusan materi tidak menghapus file Cloudinary, CORS development `origin: true` + `credentials: true` |
| **High** | **22** | Tidak ada `material.validator.js` (0 validasi Zod pada modul materi), XSS URL `javascript:` & sanitasi multipart terlewat, ketiadaan DB transaction pada upload/versi/report/paket/password/refresh, tidak adanya rate-limit `req.ip` yang akurat (`trust proxy` hilang), `incrementMaterialDownloadQuery` tidak pernah dipanggil (counter macet), `moderateMaterial` & `handleMaterialReport` tidak mengirim notifikasi, duplikasi kode/DDL 3 tempat, orphan Cloudinary pada angkatan/berita/event/versi, `fulfillMaterialRequest` tanpa cek kepemilikan & alur "Tandai Terpenuhi", tab paket belajar admin tidak punya pemilih `material_ids`, modal koleksi tidak punya daftar/hapus isi item, tab admin & tabel 7 kolom tidak responsif di mobile `360px`–`390px` |
| **Medium** | **24** | File mati & sisa LMS (`academicAuth.middleware.js`, `MaterialsListPage`, `ClassMaterialsDetailPage`, dll.), N+1 & 7 correlated subqueries + pagination tanpa batas di `getMaterialsQuery`, ekspos `uploader_email` di API materi & `nim` di pencarian publik, inkonsistensi hak akses edit album (route vs controller vs UI) & edit angkatan tanpa Zod, blob `URL.createObjectURL` leak di 7 file, search tanpa debounce (`CourseMaterialsPage` dst.), pagination UI hilang di 3 halaman, `HomePage` hardcode `'Tahun 2022 – 2025'`, class Tailwind tak terdefinisi (`slate-850`, `pasim-950`), `main` `overflow-x-hidden` + missing mobile bottom nav untuk Materi, modal form tidak reset & tidak `fullScreen` di mobile, touch target `< 44px` |
| **Low** | **9** | `node-cron` idle (token kadaluarsa tidak pernah dibersihkan), `constants.js` masih menyimpan konstanta LMS (`DOSEN`, `SUBMISSION_STATUS_*`), `index.css` mendefinisikan ulang `.line-clamp-*`, flash tema terang saat reload awal, penggunaan `window.prompt`/`window.confirm` alih-alih `ConfirmDialog`, `.env` vs `.env.example` mismatch (`MAX_DOC_FILE_SIZE_MB` vs `MAX_FILE_SIZE_BYTES`), tombol "Ganti Password" tidak ada di profil, URL filter/pencarian hilang setelah login redirect, `archive` v8 & minor MIME/UI polish |
| **Total** | **65** | Terinci per bagian di **2.1 – 2.5** |

---

## 2.1 Struktur Proyek

### A. Peta Struktur Folder Saat Ini

```text
portal-kampus-pasim/
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   ├── migrations/
│   │   ├── academic_and_lms.sql
│   │   ├── drop_assignment_tables.sql
│   │   ├── peer_materials_library_complete.sql
│   │   └── transform_materials_to_peer_library.sql
│   └── seeders/
│       └── academic_seed.sql
├── server/src/
│   ├── app.js, server.js
│   ├── config/        (cloudinary.js, db.js, env.js, mailer.js)
│   ├── controllers/   (album, angkatan, auth, campus, interaction, material[1031L], photo, user)
│   ├── middlewares/   (academicAuth[DEAD], auth, error, rateLimiter, role, upload, validate)
│   ├── queries/       (album, angkatan, auth, campus, interaction, material[1253L], photo, user)
│   ├── routes/        (index, album, angkatan, auth, campus, material, photo, user)
│   ├── services/      (auth, campus[DEAD], gallery, user)
│   ├── utils/         (apiResponse, AppError, asyncHandler, checkDbStatus, cloudinaryUpload, cronJobs, jwt, seedPasswords)
│   └── validators/    (auth, campus, gallery, user)  <-- TIDAK ADA material.validator.js
└── client/src/
    ├── App.jsx, main.jsx, index.css
    ├── assets/        (kampus-pasim.jpg, logo-pasim.png)
    ├── api/           (axiosInstance, auth, campus, gallery, material, user)
    ├── components/
    │   ├── academic/  (10 file: PdfViewerModal[DEAD], YoutubePlayer[DEAD], UploadMaterialModal, ...)
    │   ├── campus/    (EventDetailModal, UserProfileModal)
    │   ├── common/    (ConfirmDialog, EmptyState, ErrorBoundary, Footer[DEAD], GlobalSearchModal, Navbar[partial DEAD], NotificationMenu, ProtectedRoute, RoleRoute)
    │   └── gallery/   (AngkatanCard, EditAngkatanDialog, PhotoLightboxModal, PhotoMasonryGrid, UploadPhotoDialog)
    ├── hooks/         (useCloudinaryUrl, useCountdown[DEAD], useDebounce)
    ├── layouts/       (AdminLayout, AuthLayout, MainLayout)
    ├── pages/
    │   ├── HomePage.jsx, NotFoundPage.jsx
    │   ├── academic/  (ClassMaterialsDetailPage[DEAD], MaterialsListPage[DEAD], CourseMaterialsPage, MaterialDetailPage, MaterialsLibraryPage)
    │   ├── admin/     (AdminDashboardPage, ManageCampusInfoPage, ManageGalleryPage, ManageMaterialsPage[1462L], ModerationQueuePage, UserVerificationPage)
    │   ├── auth/      (ForgotResetPasswordPage, LoginPage, RegisterPage)
    │   ├── campus/    (AnnouncementsPage, DirectoryPage, EventsPage)
    │   ├── gallery/   (AngkatanDetailPage, AngkatanListPage)
    │   └── profile/   (ProfilePage)
    ├── store/         (useAuthStore, useThemeStore)
    └── utils/         (constants, formatDate)
```

### B. Temuan Struktur Proyek

#### `STR-01` | Medium | `[PASTI]` — File Mati, Halaman LMS Yatim, dan Ekspor Tidak Terpakai
- **Lokasi:**
  - `server/src/middlewares/academicAuth.middleware.js` (L1–182) — 0 import di seluruh repo; masih mengakses tabel `kelas`, `kelas_pengajar`, `kelas_peserta`, `semester_akademik`, `materi_pertemuan`, `materi_item`.
  - `server/src/services/campus.service.js` (L1–7) — 0 import; hanya me-re-export fungsi controller `campus.controller.js`.
  - `server/src/utils/cloudinaryUpload.js` (L106 `getSignedDownloadUrl`, L122 `deleteRawFromCloudinary`) — 0 pemanggil.
  - `server/src/queries/material.queries.js` (L682 `incrementMaterialDownloadQuery`) — 0 pemanggil.
  - `client/src/hooks/useCountdown.js` (L1–132) — 0 import (sisa fitur deadline tugas LMS).
  - `client/src/components/common/Footer.jsx` (L1–81) — 0 import.
  - `client/src/components/common/Navbar.jsx` (L79–279, ekspor `default Navbar`) — 0 import; hanya `BrandLogo` & `ThemeToggleButton` yang dipakai oleh `MainLayout`, `AuthLayout`, `AdminLayout`.
  - `client/src/pages/academic/MaterialsListPage.jsx` (L1–455) & `ClassMaterialsDetailPage.jsx` (L1–747) — hanya di-`lazy()` di `client/src/App.jsx` L30–31 tanpa `<Route>`, menyebabkan Vite tetap menghasilkan 2 chunk mati (`12.29 kB` dan `25.02 kB`). Satu-satunya pemanggil `YoutubePlayer.jsx` (L1–35) & `PdfViewerModal.jsx` (L1–51).
- **Saran Perbaikan:** Hapus file dan ekspor mati setelah konfirmasi pengguna; pindahkan `BrandLogo` dan `ThemeToggleButton` ke komponen mandiri (`BrandLogo.jsx` / `ThemeToggleButton.jsx`). Jika `YoutubePlayer` dan `PdfViewerModal` ingin dipakai di `MaterialDetailPage.jsx`, refaktor dan pindahkan ke modul aktif, bukan dibiarkan tertaut ke halaman LMS lama.

#### `STR-02` | High | `[PASTI]` — Duplikasi DDL Database & Seeder di 3 Lokasi Berbeda
- **Lokasi:** `database/migrations/peer_materials_library_complete.sql` (L1–310), `server/src/config/db.js` (L35–306 `syncDatabaseSchema`), `server/src/queries/material.queries.js` (L6–357 `ensureAcademicSchema`).
- **Penjelasan:** Definisi 13 tabel materi dan seeder contoh (`prodi`, `mata_kuliah`, 3 materi `dummy.pdf`, starter pack) diduplikasi di file migrasi SQL, `db.js`, sekaligus `material.queries.js`. Bahkan `ensureAcademicSchema()` dipanggil di awal hampir setiap fungsi query materi, sedangkan `db.js` & `material.queries.js` membuat tabel tanpa `FOREIGN KEY`.
- **Saran Perbaikan:** Jadikan migrasi SQL (dikelola script migrasi berversi `up`/`down`) sebagai satu-satunya sumber kebenaran DDL; keluarkan seluruh `CREATE TABLE`/`ALTER TABLE`/`DROP TABLE`/`INSERT` seeder dari `db.js` dan `material.queries.js`.

#### `STR-03` | Medium | `[PASTI]` — Duplikasi Helper & Logika Kembar di Server & Client
- **Lokasi:**
  - `booleanish` helper Zod diduplikasi identik di `server/src/validators/user.validator.js` (L6–10) dan `server/src/validators/campus.validator.js` (L5–9).
  - `unwrap` dan `cleanParams` diduplikasi di 5 file API: `client/src/api/auth.api.js`, `user.api.js`, `gallery.api.js`, `campus.api.js`, `material.api.js`.
  - Alias API duplikat di `client/src/api/material.api.js`: `getMaterialClasses` (L40) = `getCourses` (L18); `getClassMaterials` (L42) = `getCourseDetail` (L20); `getReports` (L92) = `getMaterialReports` (L94); `handleReport` (L97) = `handleMaterialReport` (L99); boilerplate download blob ZIP di `downloadCourseZip` (L150–162) & `downloadPackageZip` (L164–176).
  - `formatBytes` diduplikasi di `client/src/pages/academic/MaterialDetailPage.jsx` sementara `client/src/utils/constants.js` (L141–146) sudah menyediakannya.
  - Duplikasi route `<Route path="akademik/materi/matkul/:courseId" ... />` (L81) & `<Route path="akademik/materi/:courseId" ... />` (L83) di `client/src/App.jsx`.
  - Duplikasi alur streaming Archiver di `downloadCourseMaterialsZip` (L862–947) & `downloadPackageMaterialsZip` (L952–1031) di `server/src/controllers/material.controller.js`.
- **Saran Perbaikan:** Ekstrak shared helper (`validators/common.js`, `api/apiHelpers.js`, helper Archiver ZIP bersama, gunakan `formatBytes` dari `utils/format.js`, dan satukan rute mata kuliah).

#### `STR-04` | High | `[PASTI]` — File Terlalu Besar (`> 300` Baris) & Pencampuran Layer Bisnis
- **Lokasi (27 file terverifikasi `> 300` baris via `wc -l`):**
  - `> 1000` baris: `client/src/pages/admin/ManageMaterialsPage.jsx` (**1.462** baris), `server/src/queries/material.queries.js` (**1.253** baris), `server/src/controllers/material.controller.js` (**1.031** baris).
  - `500–999` baris: `PhotoLightboxModal.jsx` (907), `ManageGalleryPage.jsx` (755), `ClassMaterialsDetailPage.jsx` (747 — mati), `AngkatanDetailPage.jsx` (719), `ManageCampusInfoPage.jsx` (701), `MaterialDetailPage.jsx` (639), `ModerationQueuePage.jsx` (593), `EventDetailModal.jsx` (580), `HomePage.jsx` (506).
  - `301–499` baris: `MainLayout.jsx` (488), `MaterialsListPage.jsx` (455 — mati), `UploadMaterialModal.jsx` (451), `campus.queries.js` (387), `MaterialsLibraryPage.jsx` (363), `campus.controller.js` (355), `database/schema.sql` (347), `CourseMaterialsPage.jsx` (336), `MaterialRequestsDrawer.jsx` (333), `DirectoryPage.jsx` (332), `db.js` (322), `UserVerificationPage.jsx` (322), `UploadPhotoDialog.jsx` (317), `peer_materials_library_complete.sql` (310), `UserProfileModal.jsx` (301).
- **Penjelasan Pencampuran Layer:**
  - Modul `material` tidak memiliki `material.service.js` dan `material.validator.js`; seluruh validasi, upload Cloudinary, perhitungan badge `is_kakak_tingkat`, streaming ZIP, dan query dipadatkan ke `material.controller.js` + `material.queries.js`.
  - Di `campus.controller.js` & `angkatan.controller.js`, upload Cloudinary langsung ditangani di controller (sedangkan `photo` & `user` sudah memakai folder `services/`).
  - Di frontend, `ManageMaterialsPage.jsx` menumpuk 5 tab + 4 modal CRUD di satu file, sedangkan `MaterialRequestsDrawer.jsx` (L53) memuat semua materi lalu menyaring milik user di sisi client.
- **Saran Perbaikan:** Pecah `material` ke `material.validator.js`, `material.service.js`, controller tipis per sub-domain (katalog, materi, interaksi/koleksi/request, paket/zip), serta pecah tab-tab `ManageMaterialsPage` menjadi komponen fitur terpisah (`<= 250` baris/komponen).

#### `STR-05` | Medium | `[PASTI]` — Penamaan Tidak Konsisten & Konstanta LMS Tersisa
- **Lokasi:**
  - Campur bahasa & konvensi kolom DB/JSON: `users.full_name`, `uploader_id` (`photos`) vs `uploaded_by` (`materi`) vs `created_by` (`albums`, `events`, `paket_belajar`, `materi_version`); `material.queries.js` bahkan meng-alias dua field identik sekaligus `u.full_name AS uploader_nama` dan `u.full_name AS uploader_name` (L595–596, L632–633) serta `mf2.file_url AS file_url` dan `AS url` (L605–606); `photos` berbahasa Inggris sedangkan `materi_laporan`, `paket_belajar`, `materi_komentar` berbahasa Indonesia.
  - `client/src/utils/constants.js` L28–65 masih menyimpan `ROLES.DOSEN`, `ROLES.ASISTEN_LAB`, `INSTRUCTOR_ROLES`, `SUBMISSION_STATUS_LABELS`, `SUBMISSION_STATUS_COLORS`.
- **Saran Perbaikan:** Bersihkan konstanta LMS yang tidak relevan di `constants.js`, hentikan alias field kembar di API, dan dokumentasikan konvensi kontrak respons JSON/DTO per domain.

### C. Struktur Target Yang Diusulkan & Tabel Pemetaan `"File Lama -> Lokasi Baru"`

```text
server/src/
├── app.js, server.js
├── config/          (env.js, db.js, cloudinary.js, mailer.js)
├── db/migrations/   (001_initial_core.sql, 002_peer_library_fk_fixes.sql, ...)
├── db/seeds/        (demo_seed.sql)
├── middlewares/     (auth, role, rateLimiter, upload, validate, error)
├── validators/      (common.validator.js, auth, user, gallery, campus, material)
├── routes/          (index, auth, user, angkatan, album, photo, campus, material)
├── controllers/     (auth, user, angkatan, album, photo, interaction, campus, material, catalog, package)
├── services/        (auth, user, gallery, campus, material, zipStream)
├── repositories/    (ex-queries: auth, user, angkatan, album, photo, interaction, campus, material)
└── utils/           (apiResponse, AppError, asyncHandler, cloudinaryUpload, jwt, cronJobs, sanitize)

client/src/
├── App.jsx, main.jsx, index.css
├── layouts/         (MainLayout, AdminLayout, AuthLayout)
├── store/           (useAuthStore, useThemeStore)
├── services/api/    (axiosInstance, apiHelpers, auth.api, user.api, gallery.api, campus.api, material.api)
├── hooks/           (useCloudinaryUrl, useDebounce, usePagination, useAbortEffect)
├── utils/           (constants, formatDate, formatBytes, youtube)
├── components/shared/ (BrandLogo, ThemeToggleButton, ConfirmDialog, EmptyState, ErrorBoundary, GlobalSearchModal, NotificationMenu, ProtectedRoute, RoleRoute)
├── features/
│   ├── auth/        (pages/...)
│   ├── profile/     (ProfilePage, ChangePasswordSection)
│   ├── campus/      (HomePage, AnnouncementsPage, EventsPage, DirectoryPage, EventDetailModal, UserProfileModal)
│   ├── gallery/     (AngkatanListPage, AngkatanDetailPage, AngkatanCard, EditAngkatanDialog, PhotoLightboxModal, PhotoMasonryGrid, UploadPhotoDialog)
│   ├── materials/   (MaterialsLibraryPage, CourseMaterialsPage, MaterialDetailPage, UploadMaterialModal, MaterialRequestsDrawer, MyCollectionsModal, LearningPackagesModal, LeaderboardModal, ProposeCourseModal, ReportMaterialModal, MaterialRulesModal, PdfPreviewModal, YoutubeEmbed)
│   └── admin/       (AdminDashboardPage, UserVerificationPage, ModerationQueuePage, ManageGalleryPage, ManageCampusInfoPage, ManageMaterialsPage + sub-tab components)
└── pages/NotFoundPage.jsx
```

| File Lama | Status | Lokasi Baru Target |
|---|---|---|
| `database/schema.sql`, `seed.sql` | Dipertahankan/pecah | `server/src/db/migrations/001_core_schema.sql`, `db/seeds/` |
| `database/migrations/peer_materials_library_complete.sql` | Digabung jadi sumber tunggal | `server/src/db/migrations/002_peer_materials.sql` (+ `003_fk_indexes_up_down.sql`) |
| `database/migrations/academic_and_lms.sql`, `drop_assignment_tables.sql`, `transform_materials_to_peer_library.sql`, `seeders/academic_seed.sql` | Arsip/migrasi terdokumentasi | `server/src/db/migrations/legacy_archive/` (non-eksekusi otomatis) |
| `server/src/app.js`, `server.js` | Dirapikan | Tetap `server/src/app.js`, `server/src/server.js` |
| `server/src/config/{cloudinary,db,env,mailer}.js` | Refaktor (`db.js` bebas DDL/DROP) | Tetap `server/src/config/*.js` |
| `server/src/middlewares/academicAuth.middleware.js` | **HAPUS (File Mati LMS)** | — |
| `server/src/middlewares/{auth,error,rateLimiter,role,upload,validate}.middleware.js` | Diperbaiki | Tetap `server/src/middlewares/*.middleware.js` |
| `server/src/routes/*.routes.js`, `routes/index.js` | Tambah `validate(...)` | Tetap `server/src/routes/*.routes.js` |
| `server/src/validators/{auth,campus,gallery,user}.validator.js` | Tambah `common` & `material` | `server/src/validators/{common,auth,campus,gallery,user,material}.validator.js` |
| `server/src/services/campus.service.js` | **HAPUS / ganti isi asli** | Diisi logika bisnis `campus` yang dicabut dari controller |
| `server/src/services/{auth,gallery,user}.service.js` | Diperbaiki (tx & cleanup) | Tetap `server/src/services/` + baru `material.service.js`, `zipStream.service.js` |
| `server/src/controllers/{auth,user,angkatan,album,photo,interaction,campus}.controller.js` | Tipiskan delegasi ke service | Tetap `server/src/controllers/` |
| `server/src/controllers/material.controller.js` (1.031L) | Pecah | `controllers/{material,materialCatalog,materialPackage,materialInteraction}.controller.js` |
| `server/src/queries/*.queries.js` (terutama `material.queries.js` 1.253L) | Pindah ke repositories & pecah | `server/src/repositories/{auth,user,angkatan,album,photo,interaction,campus,material,materialCatalog,materialPackage,materialSocial}.repository.js` |
| `server/src/utils/{apiResponse,AppError,asyncHandler,checkDbStatus,cloudinaryUpload,cronJobs,jwt,seedPasswords}.js` | Perkuat (`cronJobs`, `cloudinaryUpload`) | Tetap `server/src/utils/*.js` + `youtube.js`, `sanitize.js` |
| `client/src/App.jsx`, `main.jsx`, `index.css` | Bersihkan import mati & FOUC | Tetap di `client/src/` |
| `client/src/api/*` | Konsolidasi helper & timeout | `client/src/services/api/{axiosInstance,apiHelpers,auth.api,user.api,gallery.api,campus.api,material.api}.js` |
| `client/src/hooks/useCountdown.js` | **HAPUS (File Mati LMS)** | — |
| `client/src/hooks/{useCloudinaryUrl,useDebounce}.js` | Tambah `usePagination` | Tetap `client/src/hooks/` |
| `client/src/store/{useAuthStore,useThemeStore}.js` | Dipertahankan | Tetap `client/src/store/` |
| `client/src/utils/{constants,formatDate}.js` | Bersihkan konstanta LMS | Tetap `client/src/utils/` + `youtube.js` |
| `client/src/layouts/{MainLayout,AdminLayout,AuthLayout}.jsx` | Fix responsivitas & bottom nav | Tetap `client/src/layouts/` |
| `client/src/components/common/{Footer,Navbar}.jsx` | **HAPUS** `Footer` & default `Navbar`; ekstrak `BrandLogo`, `ThemeToggleButton` | `client/src/components/shared/{BrandLogo,ThemeToggleButton,ConfirmDialog,EmptyState,ErrorBoundary,GlobalSearchModal,NotificationMenu,ProtectedRoute,RoleRoute}.jsx` |
| `client/src/components/campus/{EventDetailModal,UserProfileModal}.jsx` | Pindah | `client/src/features/campus/components/` |
| `client/src/components/gallery/*.jsx` | Pecah `PhotoLightboxModal` | `client/src/features/gallery/components/` |
| `client/src/pages/academic/{MaterialsListPage,ClassMaterialsDetailPage}.jsx` | **HAPUS (File Mati LMS)** | — |
| `client/src/components/academic/{YoutubePlayer,PdfViewerModal}.jsx` | Refaktor atau hapus jika tak dipakai | `client/src/features/materials/components/{YoutubeEmbed,PdfPreviewModal}.jsx` (integrasikan ke `MaterialDetailPage`) |
| `client/src/components/academic/{LeaderboardModal,LearningPackagesModal,MaterialRequestsDrawer,MaterialRulesModal,MyCollectionsModal,ProposeCourseModal,ReportMaterialModal,UploadMaterialModal}.jsx` | Perbaiki & pindah | `client/src/features/materials/components/` |
| `client/src/pages/{HomePage,NotFoundPage}.jsx` | `HomePage` -> `features/campus/` | `features/campus/pages/HomePage.jsx`, `pages/NotFoundPage.jsx` |
| `client/src/pages/auth/*`, `pages/profile/*`, `pages/campus/*`, `pages/gallery/*`, `pages/academic/{MaterialsLibraryPage,CourseMaterialsPage,MaterialDetailPage}.jsx` | Pindah per domain fitur | `client/src/features/{auth,profile,campus,gallery,materials}/pages/` |
| `client/src/pages/admin/*` (`ManageMaterialsPage` 1.462L dipecah) | Pindah & modularisasi tab | `client/src/features/admin/pages/` + `features/admin/components/materials/{MaterialsCatalogTab,CourseProposalsTab,MaterialsModerationTab,MaterialReportsTab,LearningPackagesTab}.jsx` |

---

## 2.2 Database

### A. Inventaris Tabel & Klasifikasi Pemakaian

Total terdapat **27 tabel aktif** (`14` di `schema.sql` + `13` di modul perpustakaan materi) dan **12 tabel legacy LMS** (8 di-drop di `db.js`, 4 belum di-drop).

| Kelompok | Nama Tabel | Klasifikasi | Bukti Referensi Kode (`server/src/`) | Kolom Terdaftar (Diverifikasi dari Skema & Query) |
|---|---|---|---|---|
| **Core** | `angkatan` | **DIPAKAI** | `angkatan.queries.js`, `auth.queries.js` | `id`, `year`, `title`, `description`, `cover_url`, `cover_public_id`, `is_active` *(ditambah timestamp)* |
| **Core** | `users` | **DIPAKAI** | `auth.queries.js`, `user.queries.js` | `id`, `nim`, `full_name`, `email`, `password_hash`, `role`, `status`, `prodi`, `angkatan_year`, `avatar_url`, `avatar_public_id`, `bio`, `current_job`, `linkedin_url`, `instagram_url`, `github_url`, `is_public_profile`, `verified_by`, `verified_at`, `created_at` |
| **Core** | `refresh_tokens` | **DIPAKAI** | `auth.queries.js` | `id`, `user_id`, `token_hash`, `user_agent`, `ip_address`, `expires_at`, `revoked_at` |
| **Core** | `password_resets` | **DIPAKAI** | `auth.queries.js` | `id`, `user_id`, `token_hash`, `expires_at`, `used_at` |
| **Core** | `albums` | **DIPAKAI** | `album.queries.js`, `photo.queries.js` | `id`, `angkatan_id`, `name`, `slug`, `description`, `created_by`, `created_at` |
| **Core** | `photos` | **DIPAKAI** | `photo.queries.js`, `campus.queries.js` | `id`, `cloudinary_public_id`, `url`, `width`, `height`, `format`, `bytes`, `caption`, `tags`, `taken_date`, `status`, `rejection_reason`, `uploader_id`, `angkatan_id`, `album_id`, `moderated_by`, `moderated_at`, `created_at` |
| **Core** | `photo_likes` | **DIPAKAI** | `interaction.queries.js`, `photo.queries.js` | `id`, `photo_id`, `user_id`, `created_at` |
| **Core** | `photo_comments` | **DIPAKAI** | `interaction.queries.js`, `photo.queries.js` | `id`, `photo_id`, `user_id`, `content`, `created_at`, `updated_at` |
| **Core** | `photo_reports` | **DIPAKAI** | `interaction.queries.js`, `campus.queries.js` | `id`, `photo_id`, `reporter_id`, `reason`, `description`, `status`, `resolved_by`, `resolved_at`, `created_at` |
| **Core** | `announcements` | **DIPAKAI** | `campus.queries.js` | `id`, `title`, `slug`, `category`, `excerpt`, `content`, `banner_url`, `is_pinned`, `author_id`, `published_at` |
| **Core** | `events` | **DIPAKAI** | `campus.queries.js` | `id`, `title`, `description`, `location`, `organizer`, `start_date`, `end_date`, `registration_link`, `banner_url`, `created_by` |
| **Core** | `event_likes` | **DIPAKAI** | `campus.queries.js` | `id`, `event_id`, `user_id`, `created_at` |
| **Core** | `event_comments` | **DIPAKAI** | `campus.queries.js` | `id`, `event_id`, `user_id`, `content`, `created_at`, `updated_at` |
| **Core** | `notifications` | **DIPAKAI** | `campus.queries.js` | `id`, `user_id`, `type`, `title`, `message`, `reference_link`, `is_read`, `created_at` |
| **Materi** | `prodi` | **DIPAKAI** | `material.queries.js` (L10–32, L363–376) | `id`, `kode`, `nama`, `jenjang` *(minim UI)*, `fakultas` *(minim UI)*, `created_at` |
| **Materi** | `mata_kuliah` | **DIPAKAI** | `material.queries.js`, `campus.queries.js` | `id`, `kode`, `nama`, `sks`, `prodi_id`, `semester_rekomendasi`, `deskripsi`, `status`, `proposed_by`, `created_at`, `updated_at` *(+ sisa kolom migrasi lama `prodi`, `semester_paket` jika berasal dari `academic_and_lms.sql` -> **TIDAK TERPAKAI**, butuh cek & drop)* |
| **Materi** | `materi` | **DIPAKAI** | `material.queries.js`, `campus.queries.js` | `id`, `mata_kuliah_id`, `uploaded_by`, `judul`, `tipe_materi`, `deskripsi`, `tags`, `tahun_akademik`, `angkatan_kontributor`, `dosen_pengampu_teks`, `sumber_kredit`, `external_url`, `youtube_video_id`, **`is_published`** *(PERLU KONFIRMASI — selalu `1`, tidak ada toggle UI aktif)*, `status`, `moderated_by`, `moderated_at`, `moderation_note`, `view_count`, **`download_count`** *(macet, query increment ada namun tak pernah dipanggil)*, `created_at`, `updated_at` |
| **Materi** | `materi_file` | **DIPAKAI** | `material.queries.js` | `id`, `materi_id`, `file_url`, `public_id`, `file_name`, `file_size`, `file_format`, `urutan`, `created_at` |
| **Materi** | `materi_version` | **DIPAKAI** | `material.queries.js` | `id`, `materi_id`, `version_num`, `file_url`, `file_name`, `file_size`, `changelog_note`, `created_by`, `created_at` *(kekurangan kolom `public_id` & `file_format`)* |
| **Materi** | `materi_vote` | **DIPAKAI** | `material.queries.js` | `id`, `materi_id`, `user_id`, `created_at` |
| **Materi** | `materi_komentar` | **DIPAKAI** | `material.queries.js` | `id`, `materi_id`, `user_id`, **`parent_id`** *(PERLU KONFIRMASI — didukung query/API, UI belum render reply bertingkat)*, `konten`, `created_at`, `updated_at` |
| **Materi** | `materi_koleksi` | **DIPAKAI** | `material.queries.js` | `id`, `user_id`, `nama`, `deskripsi`, `created_at` |
| **Materi** | `materi_koleksi_item` | **DIPAKAI** | `material.queries.js` | `id`, `koleksi_id`, `materi_id`, `added_at` |
| **Materi** | `materi_request` | **DIPAKAI** | `material.queries.js` | `id`, `user_id`, `mata_kuliah_id`, `judul`, `deskripsi`, `tipe_materi_diminta`, `is_fulfilled`, `fulfilled_materi_id`, `created_at`, `updated_at` |
| **Materi** | `paket_belajar` | **DIPAKAI** | `material.queries.js` | `id`, `prodi_id`, `semester`, `judul`, `deskripsi`, `created_by`, `created_at` |
| **Materi** | `paket_belajar_item` | **DIPAKAI** | `material.queries.js` | `id`, `paket_belajar_id`, `materi_id`, `urutan` |
| **Materi** | `materi_laporan` | **DIPAKAI** | `material.queries.js`, `campus.queries.js` | `id`, `materi_id`, `reporter_id`, `alasan`, `deskripsi`, `status`, `handled_by`, `handled_at`, `action_taken`, `takedown_note`, `created_at` |
| **Legacy LMS** | `materi_progress`, `penilaian`, `pengumpulan_berkas`, `pengumpulan`, `tugas_lampiran`, `tugas`, `kelas_pengajar`, `kelas_peserta` (8 tabel) | **TIDAK TERPAKAI** (terbukti via grep; hanya di `db.js` `DROP TABLE` L297–304 & file mati `academicAuth.middleware.js`) | `db.js` L297–304, `academicAuth.middleware.js` | — *(tetap cek `SELECT COUNT(*)` jika skema lama masih ada sebelum server dijalankan)* |
| **Legacy LMS** | `semester_akademik`, `kelas`, `materi_pertemuan`, `materi_item` (4 tabel) | **PERLU KONFIRMASI** (0 pemakai di endpoint aktif; hanya di file mati `academicAuth.middleware.js` & SQL lama, namun **tidak** ikut di-drop `db.js`) | `academic_and_lms.sql`, `academicAuth.middleware.js` | — *(wajib cek `SELECT COUNT(*)` sebelum drop)* |

### B. Temuan Skema, Foreign Key, Index, ENUM, Orphan, dan Query

#### `DB-01` | Critical | `[PASTI]` — `db.js` Menjalankan 8 `DROP TABLE IF EXISTS` Saat Startup & `ensureAcademicSchema` Membuat Tabel Tanpa Foreign Key
- **Lokasi:** `server/src/config/db.js` (L35–306), `server/src/queries/material.queries.js` (L6–357).
- **Penjelasan:** Setiap kali aplikasi startup, `db.js` mengeksekusi 8 `DROP TABLE IF EXISTS` (`L297–304`). Lebih kritis lagi, ke-13 tabel perpustakaan materi yang dibuat otomatis oleh `db.js` dan `material.queries.js` **tidak memiliki `CONSTRAINT FOREIGN KEY` sama sekali**. Jika DB dibangun oleh auto-sync server (bukan file SQL manual), penghapusan di `materi`, `mata_kuliah`, atau `materi_koleksi` meninggalkan orphan row dan merusak `INNER JOIN`.
- **Saran Perbaikan:** Hapus eksekusi DDL/DROP dari runtime (`db.js` & `material.queries.js`). Buat file migrasi eksplisit untuk menambah seluruh FK (`ON DELETE CASCADE`/`SET NULL`/`RESTRICT`) setelah membersihkan orphan row.

#### `DB-02` | High | `[PASTI]` — `ON DELETE CASCADE` Terlalu Agresif pada `materi_version.created_by` & `paket_belajar.created_by`
- **Lokasi:** `database/migrations/peer_materials_library_complete.sql` (L120, L221).
- **Penjelasan:** Berbeda dari FK moderasi lain (`ON DELETE SET NULL`), `materi_version.created_by` dan `paket_belajar.created_by` diset `NOT NULL` dengan `ON DELETE CASCADE`. Menghapus 1 akun moderator/kurator akan otomatis menghapus seluruh paket belajar kurasi maupun riwayat versi materi terkait.
- **Saran Perbaikan:** Ubah keduanya menjadi `NULL` + `ON DELETE SET NULL` (atau `RESTRICT` dengan soft-delete user).

#### `DB-03` | High | `[PASTI]` — ENUM Tidak Sinkron (`notifications.type`, `users.role`, `materi_laporan.status`)
- **Lokasi:** `database/schema.sql` (L337 `notifications.type`), `database/migrations/academic_and_lms.sql` (L8–10 `users.role`), `server/src/queries/material.queries.js` (L267, L923–926).
- **Penjelasan:**
  1. `notifications.type` hanya memiliki `'photo_approved','photo_rejected','new_comment','new_like','account_verified','system'` — **tidak memiliki nilai untuk modul materi** (`material_approved`, `material_rejected`, `material_takedown`, `course_approved`, `request_fulfilled`).
  2. `academic_and_lms.sql` memperluas `users.role` dengan `'dosen','asisten_lab'` (sedangkan kode modul peer-library memakai 4 role: `admin`, `moderator`, `mahasiswa`, `alumni`).
  3. `materi_laporan.status` mendefinisikan `'pending','resolved','dismissed'`, tetapi `handleMaterialReportQuery` L924 selalu menulis `status = 'resolved'` dan menaruh `'dismissed'` ke `action_taken`.
- **Saran Perbaikan:** Perluas ENUM `notifications.type` lewat migrasi; sinkronkan logic `handleMaterialReportQuery` agar `status = 'dismissed'` dipakai saat laporan ditolak; verifikasi apakah ada row `users.role IN ('dosen','asisten_lab')` di DB live sebelum menghapusnya dari ENUM.

#### `DB-04` | High | `[PASTI]` — Index Filter, Join, Sort, dan Unique Constraint Kurang
- **Lokasi:** `server/src/queries/material.queries.js` (L109–273), `database/migrations/peer_materials_library_complete.sql`, `database/schema.sql`.
- **Penjelasan:**
  - `materi_laporan` tidak memiliki `UNIQUE KEY (materi_id, reporter_id)` seperti `photo_reports` -> satu user dapat spam laporan berulang pada 1 materi yang sama.
  - Tidak ada composite index untuk pola query utama: `materi(status, is_published, created_at)`, `materi(mata_kuliah_id, status, is_published)`, `mata_kuliah(status, prodi_id, semester_rekomendasi)`, `materi_laporan(status, created_at)`, `materi_request(is_fulfilled, created_at)`.
  - `refresh_tokens(expires_at)` & `password_resets(expires_at)` tidak dibersihkan (potensi tabel membengkak).
  - Pencarian di `material.queries.js` (L564–570) dan `photo.queries.js` (L41, L45 `FIND_IN_SET(..., REPLACE(p.tags, " ", ""))`) dan `campus.queries.js` (L49, L370 `LIKE '%keyword%'`) memaksa **Full Table Scan**.
- **Saran Perbaikan:** Tambahkan composite index, `UNIQUE` anti-spam laporan materi, serta `FULLTEXT` index (MySQL InnoDB `utf8mb4`) untuk pencarian multi-kolom materi & pengumuman bila skala data meningkat.

#### `DB-05` | High | `[PASTI]` — Ketiadaan DB Transaction & Potensi Orphan Cloudinary/Database
- **Lokasi:** `server/src/controllers/material.controller.js` (`createMaterial` L264–319, `deleteMaterial` L397, `uploadNewVersion` L440), `server/src/queries/material.queries.js` (L774–802, L907–930, L1164–1188), `server/src/controllers/angkatan.controller.js` (`deleteAngkatan` L93–105), `server/src/controllers/campus.controller.js` (`updateAnnouncement`, `deleteAnnouncement`, `updateEvent`, `deleteEvent`), `server/src/queries/auth.queries.js` (L88–90), `server/src/services/auth.service.js` (L107–125).
- **Penjelasan:**
  - `createMaterial`: insert ke `materi` terlebih dulu, baru loop upload ke Cloudinary. Jika file ke-2 gagal -> DB sudah ter-commit tanpa roll-back & file ke-1 yatim di Cloudinary.
  - `deleteMaterial`: menghapus row DB tanpa menghapus aset di Cloudinary. `materi_version` tidak menyimpan `public_id` & `file_format` sehingga versi lama juga yatim permanen di Cloudinary saat ditimpa/dihapus.
  - `deleteAngkatan` hanya soft-delete `is_active = 0` tapi tidak membersihkan cover; `deleteAnnouncement`, `deleteEvent`, `updateAnnouncement`, `updateEvent` tidak pernah memanggil `deleteFromCloudinary` dan tabel `announcements`/`events` tidak menyimpan kolom `banner_public_id`.
- **Saran Perbaikan:** Upload ke Cloudinary dulu (rollback hapus jika DB gagal), bungkus operasi multi-tabel dengan `pool.getConnection()` + `beginTransaction()`/`commit()`/`rollback()`, tambahkan kolom `public_id` pada `materi_version` (`banner_public_id` opsional pada `announcements`/`events`), dan hapus file Cloudinary dengan `resource_type` yang sesuai (`image` vs `raw`).

#### `DB-06` | Medium | `[PASTI]` — Query Bermasalah: Unbounded Pagination, 7 Correlated Subqueries, `SELECT *`, dan Seed Broken FK
- **Lokasi:**
  - Unbounded query (tanpa `LIMIT`/`OFFSET`): `getMaterialsQuery` (`material.queries.js` L585–616), `getCoursesQuery` (L411–438), `getMaterialRequestsQuery` (L1043–1063), `getMaterialReportsQuery` (L886–904), `listPhotoReportsQuery` (`interaction.queries.js` L126–145).
  - Correlated subqueries berat: `getMaterialsQuery` (7 subquery per row termasuk duplikasi `mf2.file_url` di L605–606), `getAngkatanWithStats` (`angkatan.queries.js` L11–19), `listPhotosQuery` (`photo.queries.js` L87–89).
  - `SELECT *` & `m.*`: `auth.queries.js` L6 (`SELECT * FROM users`), `material.queries.js` L587 & L624 (`m.*`, memaparkan internal field moderasi ke non-staff), `campus.queries.js` L15, L55, L105.
  - Seed rusak: `database/seed.sql` L102–113 mereferensikan `photo_id` 1, 2, 3 pada `photo_likes` & `photo_comments` padahal ID tabel `photos` dimulai dari 5 (`[DUGAAN]` gagal saat di-seed ke DB bersih dengan FK aktif).

### C. Query `SELECT COUNT(*)` Untuk Verifikasi Manual User Sebelum Drop/Ubah

> ⚠️ **Jangan jalankan DROP sebelum memeriksa hasil query di bawah pada MySQL live + melakukan backup `mysqldump`.**

```sql
-- 1. Cek sisa 4 tabel LMS yang TIDAK otomatis di-drop oleh db.js
SELECT 'semester_akademik' AS tbl, COUNT(*) AS rows_count FROM semester_akademik
UNION ALL SELECT 'kelas', COUNT(*) FROM kelas
UNION ALL SELECT 'materi_pertemuan', COUNT(*) FROM materi_pertemuan
UNION ALL SELECT 'materi_item', COUNT(*) FROM materi_item;

-- 2. Cek apakah 8 tabel LMS yang di-drop db.js masih ada & punya baris (jika belum menjalankan app)
SELECT TABLE_NAME, TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'materi_progress','penilaian','pengumpulan_berkas','pengumpulan',
    'tugas_lampiran','tugas','kelas_pengajar','kelas_peserta',
    'semester_akademik','kelas','materi_pertemuan','materi_item'
  );

-- 3. Cek kolom legacy & kolom dengan penggunaan minimum pada tabel aktif
SELECT
  SUM(CASE WHEN role IN ('dosen','asisten_lab') THEN 1 ELSE 0 END) AS legacy_role_users
FROM users;

SELECT COUNT(*) AS unpublished_materi FROM materi WHERE is_published = 0;
SELECT COUNT(*) AS threaded_comments FROM materi_komentar WHERE parent_id IS NOT NULL;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah'
  AND COLUMN_NAME IN ('prodi', 'semester_paket');

-- 4. Cek orphan rows sebelum menambah FOREIGN KEY pada tabel modul materi
SELECT COUNT(*) AS orphan_materi_mk FROM materi m LEFT JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id WHERE mk.id IS NULL;
SELECT COUNT(*) AS orphan_materi_file FROM materi_file mf LEFT JOIN materi m ON m.id = mf.materi_id WHERE m.id IS NULL;
SELECT COUNT(*) AS orphan_materi_version FROM materi_version mv LEFT JOIN materi m ON m.id = mv.materi_id WHERE m.id IS NULL;
SELECT COUNT(*) AS orphan_koleksi_item FROM materi_koleksi_item mki LEFT JOIN materi m ON m.id = mki.materi_id WHERE m.id IS NULL;
SELECT COUNT(*) AS orphan_paket_item FROM paket_belajar_item pbi LEFT JOIN materi m ON m.id = pbi.materi_id WHERE m.id IS NULL;
```

---

## 2.3 Bug dan Potensi Bug

### A. Backend (`server/src/`)

| ID | Severity | Status | Lokasi | Penjelasan | Saran Perbaikan |
|---|---|---|---|---|---|
| `BUG-BE-01` | **Critical** | `PASTI` | `material.queries.js:525-536` | **Bypass Moderasi Materi (`GET /materials?status=pending\|rejected\|takedown`):** Blok `if (status)` tidak mengecek `!isStaff`, sehingga user biasa dapat membaca seluruh materi `pending`, `rejected`, atau `takedown` pelanggaran hak cipta milik siapa pun. | Paksa filter `status = 'approved'` untuk non-staff kecuali saat memfilter milik sendiri (`uploaded_by = currentUserId` dan tidak boleh melihat `takedown` sebagai publik). |
| `BUG-BE-02` | **Critical** | `PASTI` | `material.controller.js:202-225` | **IDOR pada `getMaterialDetail` (`GET /materials/:id`):** Sama sekali tidak mengecek `material.status === 'approved'` ataupun kepemilikan/staff. Materi `pending`/`rejected`/`takedown` bebas dilihat siapa saja sekaligus menaikkan `view_count`. | Samakan guard dengan `getPhotoDetail` (`photo.controller.js:59-65`): tolak 403/404 jika `status !== 'approved'` dan peminta bukan `owner`/`staff`, dan jangan naikkan `view_count` untuk item belum disetujui. |
| `BUG-BE-03` | **Critical** | `PASTI` | `material.controller.js:658-674` | **IDOR pada `toggleCollectionItem` (`POST /collections/:id/toggle`):** Tidak mengecek `materi_koleksi.user_id === req.user.id`. User mana pun bisa menambah/menghapus materi dari koleksi pribadi orang lain cukup dengan mengganti parameter `:id`. | Verifikasi kepemilikan `SELECT user_id FROM materi_koleksi WHERE id = ?` = `req.user.id` serta cek `materi.status = 'approved'`. |
| `BUG-BE-04` | **Critical** | `PASTI` | `upload.middleware.js:75-97` | **Bypass Validasi MIME Upload Dokumen:** Kondisi `ALLOWED_DOCUMENT_MIMES.includes(...) \|\| !file.mimetype \|\| file.mimetype === 'application/octet-stream' \|\| file.mimetype.startsWith('application/') \|\| file.mimetype.startsWith('image/')` meloloskan `image/svg+xml` (XSS) & `.exe`/`application/*`, tanpa pengecekan *magic bytes*, serta masih mengizinkan `.rar` (L61 — di luar spec) dan baca env `MAX_FILE_SIZE_BYTES` alih-alih `MAX_DOC_FILE_SIZE_MB` (`.env.example:27`). | Perketat ke whitelist MIME resmi saja (tanpa `startsWith`), blokir `.rar` & `image/svg+xml`, validasi magic bytes buffer, simpan ke disk temp/stream atau batasi total payload agar terhindar dari lonjakan RAM 10x10 MB di `memoryStorage()`. |
| `BUG-BE-05` | **Critical** | `PASTI` | `auth.service.js:158-161` | **Kebocoran Reset Password Token di Response HTTP:** `forgotPasswordService` mengembalikan `dev_reset_token` & `dev_reset_url` ke client selama `env.nodeEnv !== 'production'` (`env.js` default ke `'development'`). Jika server ter-deploy lupa set `NODE_ENV=production`, siapa pun bisa mereset akun admin. | Jangan pernah mengembalikan token reset lewat HTTP response; log hanya ke stdout server saat dev atau kirim SMTP saja, atau gating dengan flag eksplisit `ENABLE_DEV_TOKEN_RESPONSE=true` + warning keras. |
| `BUG-BE-06` | **Critical** | `PASTI` | `auth.middleware.js:45-60`, `auth.service.js:101-107` | **Token Lifecycle Gaps:** (1) `optionalAuth` hanya decode JWT tanpa cek status `active` atau blacklist di DB (user yang baru disuspend tetap teridentifikasi aktif hingga access token expired); (2) `rotateRefreshTokenService` tidak mendeteksi *refresh token reuse* (replay token lama tidak me-revoke semua token user); (3) User `verifyUserByAdminService` yang disuspend/ditolak tidak di-revoke refresh token-nya; (4) Tidak ada endpoint *Ganti Password* user terautentikasi. | Cek DB/cache status aktif user pada `optionalAuth`, revoke semua `refresh_tokens` saat admin mengubah status ke `suspended`/`rejected` atau saat token lama dipakai ulang, dan tambah endpoint `PATCH /auth/change-password`. |
| `BUG-BE-07` | **Critical** | `PASTI` | `app.js:49-62` | **CORS Development Terbuka & Hilangnya `trust proxy`:** (1) Ketika `NODE_ENV=development`, CORS mengizinkan SEMUA `origin` dengan `credentials: true` + `sameSite`; (2) `app.set('trust proxy', 1)` belum diset, sehingga `express-rate-limit` memakai IP proxy/localhost bersama untuk semua user (meskipun logger L19 sudah membaca `cf-connecting-ip`/`x-forwarded-for`). | Set `app.set('trust proxy', 1)` bila di belakang Nginx/Cloudflare; selalu whitelist origin eksplisit meskipun di mode development. |
| `BUG-BE-08` | **High** | `PASTI` | `material.queries.js:682-684`, `material.routes.js` | **Counter Unduhan (`download_count`) Mati Total:** `incrementMaterialDownloadQuery` terdefinisi di `material.queries.js:682` tetapi **0 pemanggil** di controller maupun route. Download per file di `MaterialDetailPage` langsung mengarah ke `<a href={f.file_url}>` dan ZIP download tidak menambah `download_count`. | Buat endpoint `POST /materials/:id/download` (atau proxy redirect/download) serta increment saat single-file download & ZIP download. |
| `BUG-BE-09` | **High** | `PASTI` | `material.routes.js` (seluruh 26 endpoint) | **Ketiadaan `material.validator.js` (0 Validasi Zod):** Semua input (Prodi, Course, Material, Comment, Report, Request, Collection, Package) langsung dipakai di controller tanpa validasi tipe/panjang/URL. `createMaterial` tidak memvalidasi `tipe_materi` maupun protokol `external_url` (**XSS `javascript:`** jika link dirender di frontend) serta menerima ID `mata_kuliah` berstatus `pending`/`rejected`. `createCourse` tidak mengecek `semester_rekomendasi` `1..8` atau validitas `prodi_id`. | Buat `material.validator.js` lengkap dengan Zod untuk semua route (termasuk whitelist `https://`/`http://` pada `external_url`, enum `tipe_materi`, batas panjang, SKS, semester `1..8`). |
| `BUG-BE-10` | **High** | `PASTI` | `material.controller.js:459-485, 594-620`, `material.queries.js:907-930` | **Moderasi & Takedown Materi Tidak Mengirim Notifikasi:** Berbeda dari galeri (`moderatePhotoService`), `moderateMaterial` dan `handleMaterialReportQuery` (`takedown`) sama sekali tidak memanggil `createNotification` kepada uploader maupun pelapor, melanggar aturan sistem etika konten. | Tambahkan `createNotification` untuk `approved`, `rejected`, dan `takedown` materi (beserta alasan moderator/takedown) serta saat usulan matkul disetujui/ditolak. |
| `BUG-BE-11` | **High** | `PASTI` | `material.controller.js:491-583`, `interaction.controller.js:45-65` | **Endpoint Interaksi Tidak Validasi Status Target:** `toggleMaterialVote`, `getMaterialComments`, `addMaterialComment`, `reportMaterial`, serta galeri `getPhotoLikers` & `listComments` tidak mengecek apakah target berstatus `'approved'`. User bisa men-vote, berkomentar, atau membaca komentar foto/materi `pending`/`rejected`/`takedown` (atau memicu error FK 500 pada ID fiktif). | Pastikan target ada dan berstatus `'approved'` (atau untuk read, `owner`/`staff`) sebelum memproses interaksi. |
| `BUG-BE-12` | **High** | `PASTI` | `material.controller.js:730-748`, `album.routes.js:20-25`, `album.controller.js:56-95` | **Ketidakkonsistenan Otorisasi & Ownership:** (1) `fulfillMaterialRequest` tidak memverifikasi apakah request ada di matkul terkait, materi penaut berstatus `'approved'`, atau izin peminta untuk menandai "Terpenuhi" tanpa harus menautkan file sendiri; (2) `PUT /albums/:id` dikunci `authorizeRoles('admin','moderator')` di route meski controller `updateAlbum` (L58) & `DELETE /albums/:id` mengizinkan `isCreator`. | Selaraskan izin `album.routes.js` & `album.controller.js`; pisahkan endpoint menautkan materi (`linkMaterial`) dengan menandai terpenuhi oleh `requester` (`user_id === req.user.id` atau staff). |
| `BUG-BE-13` | **High** | `PASTI` | `material.controller.js:824-1031` | **Bug Streaming ZIP (`appendRemoteFileToArchive`):** (1) `https.get` tidak mengikuti HTTP `301`/`302` redirect (body redirect di-zip sebagai dokumen rusak); (2) Error stream setelah `res.setHeader` & `archive.pipe(res)` memanggil `next(error)` -> berpotensi `ERR_HTTP_HEADERS_SENT` crash; (3) Potensi SSRF bila `file_url` mengarah ke host internal; (4) `linkEntries` duplikat jika 1 materi video punya >1 file lampiran. | Gunakan validator host Cloudinary/whitelist pada `file_url`, tangani redirect dengan batas hop, hentikan stream bersih jika header sudah terkirim (`res.destroyed`), dan deduplikasi `external_url` per `materi_id`. |
| `BUG-BE-14` | **High** | `PASTI` | `error.middleware.js:22-25` | **Pesan Error Multer Salah Modul:** `LIMIT_FILE_SIZE` selalu membalas *"Maksimal 5 MB per foto"* dan *"Maksimal 10 foto"*, bahkan saat upload dokumen materi yang batasnya 10 MB gagal. | Bedakan batas/pesan Multer berdasarkan tipe upload/route atau baca metadata limit dinamis. |
| `BUG-BE-15` | **High** | `PASTI` | `material.queries.js:598, 635`, `campus.queries.js:376-385`, `photo.queries.js:59, 149` | **Kebocoran Email/NIM & SQL String Interpolation:** (1) `getMaterialsQuery` & `getMaterialByIdQuery` mengembalikan `u.email AS uploader_email` + `uploader_nim` ke publik terautentikasi; (2) `globalSearchQuery` (`campus.routes.js` memakai `optionalAuth`) memaparkan `nim` user ke tamu anonim; (3) `photo.queries.js` & `material.queries.js` menginterpolasi `${Number(currentUserId)}` langsung ke SQL (aman sementara karena `Number()`, tapi anti-pattern dibanding placeholder `?`). | Hapus `email` dari API katalog/materi; wajibkan login atau hilangkan `nim` dari global search untuk anonim; gunakan `?` untuk semua parameter SQL. |
| `BUG-BE-16` | **High** | `PASTI` | `material.controller.js:213-220`, `material.queries.js:936-958` | **Bug Logika Gamifikasi & Badge:** (1) `is_kakak_tingkat` hanya dihitung di `getMaterialDetail` (tidak ada di list `getMaterials`), dan memakai `currentYear - uploaderYear >= Math.ceil(semester / 2)` (mahasiswa tahun ke-2 bisa dapat badge saat semester 1 padahal baru masuk tahun lalu, dan mengabaikan `angkatan_kontributor`); (2) `getContributorsLeaderboardQuery` tidak memfilter `AND u.status = 'active'` sehingga akun `suspended` masih masuk peringkat. | Tambah `AND u.status = 'active'` di leaderboard; konsistenkan & pindahkan kalkulasi `is_kakak_tingkat` ke helper/DTO agar muncul di daftar & detail materi. |
| `BUG-BE-17` | **Medium** | `PASTI` | `validate.middleware.js:10, 26-31`, `app.js:69`, `upload.middleware.js` | **Sanitasi XSS Melewati Multipart & Terlalu Sempit:** `sanitizeRequest` di `app.js` berjalan sebelum Multer mem-parsing `multipart/form-data`, sehingga field teks pada upload foto/materi/profil **tidak tersanitasi sama sekali**; regex juga hanya menghapus `<script>`, membiarkan `<img onerror=...>` atau event handler HTML. | Pindahkan/jalankan sanitasi setelah parser route (atau dalam schema Zod) dan encode output di frontend / strip HTML berbahaya secara menyeluruh. |
| `BUG-BE-18` | **Medium** | `PASTI` | `auth.service.js:26-70`, `cronJobs.js:7-10`, `campus.controller.js`, `material.controller.js:367` | **Bug Pendukung Backend:** (1) `register` (409 spesifik email/NIM) & `login` (403 spesifik status sesudah cocok password) memungkinkan enumerasi status akun; (2) `cronJobs.js` kosong sehingga token expired tidak pernah dihapus; (3) `updateMaterial` (`if (updateFields.external_url)`) tidak mereset `youtube_video_id = null` saat user mengosongkan `external_url`; (4) `deleteAnnouncement`/`deleteEvent` tidak cek apakah record ada (404) sebelum mengembalikan 200 OK; (5) `material.controller.js` tidak memakai `sendResponse` standar `{ success, message, data, meta }` sehingga format respons inkonsisten dengan modul lain; (6) `[DUGAAN]` Query tanggal (`events.end_date >= NOW()` di `campus.queries.js:102`) bergantung pada zona waktu server MySQL (UTC vs WIB +07:00). | Aktifkan cron cleanup `refresh_tokens`/`password_resets`; reset `youtube_video_id` saat URL dihapus; seragamkan `sendResponse`; cek `affectedRows`; pastikan koneksi DB/node menyamakan UTC vs WIB saat deploy. |

### B. Frontend (`client/src/`)

| ID | Severity | Status | Lokasi | Penjelasan | Saran Perbaikan |
|---|---|---|---|---|---|
| `BUG-FE-01` | **High** | `PASTI` | `ManageMaterialsPage.jsx:1384-1459` | **Form Buat Paket Belajar Tidak Memiliki Selector Materi (`material_ids`):** Moderator/Admin hanya dapat membuat Paket Belajar **kosong** karena tidak ada field pemilihan materi di dialog, sekaligus tidak ada fitur edit Paket Belajar. | Tambah komponen autocomplete/checklist `approved` materials (terfilter prodi & semester) pada form tambah & edit paket belajar. |
| `BUG-FE-02` | **High** | `PASTI` | `ManageMaterialsPage.jsx:420, 467`, `AdminDashboardPage.jsx:123`, `ModerationQueuePage.jsx` | **Mismatch Stats Admin, Counter Laporan, & Rute Antrean Laporan:** (1) `ManageMaterialsPage` Tab 2/3 baru di-fetch saat tab diklik, menyebabkan badge "Usulan Matkul" & "Laporan Konten" tampil `0` saat awal masuk; L467 menampilkan jumlah materi tersaring sebagai "Total Materi"; (2) `AdminDashboardPage.jsx:123` mengarahkan kartu `material_reports` ke `/admin/moderasi?tab=reports`, padahal `ModerationQueuePage.jsx` di tab `reports` **hanya** mem-fetch `galleryApi.getReports('open')` dan mengabaikan laporan materi; (3) `ModerationQueuePage.jsx` membaca `?tab=` hanya untuk `'reports'`, mengabaikan `?tab=materials`. | Fetch ringkasan tab di mount atau dari `/campus/admin/stats`; arahkan laporan materi ke `/admin/materi?tab=reports` (atau integrasikan di `ModerationQueuePage`) dan sinkronkan seluruh query `?tab=`. |
| `BUG-FE-03` | **High** | `PASTI` | `MyCollectionsModal.jsx`, `MaterialRequestsDrawer.jsx`, `MaterialDetailPage.jsx:30-165` | **Fitur Peer-Library Tidak Lengkap / Terputus:** (1) `MyCollectionsModal` tidak menyediakan tampilan isi koleksi maupun tombol hapus materi dari folder; (2) `MaterialRequestsDrawer.jsx:53` memanggil `getMaterials()` paginasi lalu filter di client (materi page 2+ hilang dari pilihan taut), judul `fulfilled_materi_judul` bukan `<Link>`, dan peminta tidak bisa menandai "Terpenuhi" sendiri; (3) `MaterialDetailPage` klik langsung `<a href={f.file_url} download>` sehingga counter unduhan tidak tercatat; (4) `MaterialDetailPage` parser YouTube (L413) mengabaikan `?list=` playlist, `/shorts/`, dan `/live/`, sementara `YoutubePlayer.jsx` adalah file mati. | Tambah detail isi koleksi & tombol remove; buat endpoint khusus "materi saya yang disetujui"; tambahkan link materi & tombol "Tandai Terpenuhi"; catat unduhan sebelum unduh; satukan parser YouTube lengkap (`list=`, `youtu.be`, `shorts`, `live`). |
| `BUG-FE-04` | **High** | `PASTI` | `UploadMaterialModal.jsx`, `ProposeCourseModal.jsx`, `EventDetailModal.jsx`, `LearningPackagesModal.jsx`, `UploadPhotoDialog.jsx` | **State Form Tidak Di-reset & Validasi Hilang:** (1) `UploadMaterialModal`: `form` & `selectedFiles` tidak reset saat tutup/submit, menerima `.rar` (melanggar spec), hanya cek ekstensi tanpa `file.type` MIME, inisialisasi `angkatan_kontributor` tanpa input edit di form, pakai index array `idx` sebagai `key`, dan progress bar upload menggantung di 100% saat backend upload ke Cloudinary; (2) `ProposeCourseModal`: form tidak reset & render `({p.jenjang})` bernilai `undefined` dengan fallback prodi; (3) `EventDetailModal` & `LearningPackagesModal`: state modal sebelumnya (`comments`, `selectedPkg`) tidak di-reset saat ganti item/tutup; (4) `MaterialDetailPage` raw `<input type="file">` unggah versi baru tanpa cek ukuran/MIME/progress. | Reset state pada `open`/`onClose`, selaraskan whitelist ekstensi + MIME dengan spec (tanpa `.rar`, tambahkan gambar ke `constants.js`), gunakan id/nama+size unik sebagai key, dan tambahkan feedback fase "Memproses di server". |
| `BUG-FE-05` | **High** | `PASTI` | `AngkatanDetailPage.jsx:81`, `CourseMaterialsPage.jsx`, `MaterialsLibraryPage.jsx`, `MaterialDetailPage.jsx` | **Guard Izin UI Salah / Mengizinkan Tamu:** (1) `AngkatanDetailPage.jsx:81`: `(al.created_by === user.id \|\| !al.created_by)` memberi tombol edit/hapus album seed ke SEMUA user login, dan mengizinkan creator tombol Edit padahal backend `PUT /albums/:id` memblokir non-staff (403); (2) `MaterialDetailPage`: memanggil `fetchCollections()` saat user belum login (atau tidak mengarahkan ke `/login` saat klik vote/bookmark/report); `CourseMaterialsPage` & `MaterialsLibraryPage` juga mengizinkan tombol aksi terbuka sebelum login. | Perketat `canManageAlbum` ke pemilik asli/staff; arahkan guest atau akun non-aktif cleanly tanpa memicu API call terlarang 401. |
| `BUG-FE-06` | **Medium** | `PASTI` | `AngkatanListPage.jsx:65`, `EditAngkatanDialog.jsx:44`, `ProfilePage.jsx:51`, `ManageGalleryPage.jsx:187`, `ManageCampusInfoPage.jsx:103,658`, `UploadPhotoDialog.jsx:89` | **Memory Leak `URL.createObjectURL` di 7 Komponen:** Preview gambar dibuat dengan `URL.createObjectURL(file)` tetapi **tidak pernah** di-cleanup via `URL.revokeObjectURL(...)` saat mengganti file atau component unmount. | Simpan URL object di `useEffect`/ref cleanup dan panggil `URL.revokeObjectURL` pada pergantian file & unmount. |
| `BUG-FE-07` | **Medium** | `PASTI` | `AnnouncementsPage.jsx:65`, `DirectoryPage.jsx:82`, `AngkatanDetailPage.jsx:136`, `CourseMaterialsPage.jsx:72`, `MaterialsLibraryPage.jsx:95`, `UserVerificationPage.jsx:74`, `ManageGalleryPage.jsx:134`, `ManageMaterialsPage.jsx:233` | **Search Tanpa Debounce & Tanpa `AbortController`:** Setiap ketikan langsung memicu request API (berisiko race condition jawaban lama menimpa yang baru), padahal hook `useDebounce.js` sudah tersedia. `CourseMaterialsPage` juga me-refetch `getCourseDetail` di setiap ketikan. | Gunakan `useDebounce` (`GlobalSearchModal` sudah memakainya!) dan `AbortController` (serta pisahkan `useEffect` `getCourseDetail` dari search). |
| `BUG-FE-08` | **Medium** | `PASTI` | `AnnouncementsPage.jsx:30-34`, `DirectoryPage.jsx:35-43`, `UserVerificationPage.jsx:40-46`, `ManageMaterialsPage.jsx:1121` | **Pagination UI Hilang & Error Handling Kosong:** (1) Halaman Pengumuman (`limit: 9`), Direktori (`limit: 12`), dan Verifikasi User (`limit: 20`) menerima `total` dan `totalPages` dari API namun tidak merender kontrol `<Pagination>` sama sekali; (2) `downloadPackageZip` di `ManageMaterialsPage.jsx:1121`, dropdown bookmark `MaterialDetailPage` (tanpa click-outside), `HomePage.jsx` L481/492/493, serta beberapa `.then()` tidak punya `try/catch` atau toast error. | Tambah komponen `<Pagination>` bersama di seluruh daftar berpaginasi; bungkus semua async download/action dengan `try/catch` + `loading` + `toast`. |
| `BUG-FE-09` | **Medium** | `PASTI` | `AngkatanDetailPage.jsx`, `HomePage.jsx:200`, `LoginPage.jsx:27,131-155`, `ProtectedRoute.jsx:26`, `axiosInstance.js` | **Bug State & Auth Frontend:** (1) `AngkatanDetailPage` memutasi `searchParams` `prev` in-place & tidak menutup lightbox saat tombol *Back* browser ditekan; (2) `HomePage.jsx:200` hardcode `'Tahun 2022 – 2025'`; (3) `LoginPage` hanya mengambil `location.state?.from?.pathname` (menghapus query string `?search=...`) & menampilkan akun demo + password plaintext `'Pasim123!'` pada build produksi; (4) `ProtectedRoute` hanya mengecek `accessToken` tanpa `user`; (5) `material.api.js` ZIP download mewarisi `timeout: 60000` (putus untuk ZIP besar); (6) `GlobalSearchModal.jsx` tidak mencari materi/mata kuliah. | Hitung rentang tahun dinamis dari `angkatanList`, preservasi `pathname + search`, sembunyikan shortcut demo jika `!import.meta.env.DEV`, cek `accessToken && user`, set `timeout: 0` untuk download ZIP. |
| `BUG-FE-10` | **Low** | `PASTI` | `MaterialDetailPage.jsx:170,183`, `ModerationQueuePage.jsx:169`, `ManageMaterialsPage.jsx:408`, `MyCollectionsModal.jsx:64`, `ProfilePage.jsx:139,172` | **Dialog Native & Input Inkonsisten:** Menggunakan `window.prompt`/`window.confirm` alih-alih `ConfirmDialog`/MUI Dialog; `ProfilePage` memakai `accept="image/*"` (lolos GIF/SVG), tidak validasi size client, tidak punya form "Ganti Password", dan `TextField select` prodi rentan out-of-range jika nilai prodi DB di luar `PRODI_LIST`. | Ganti semua `prompt`/`confirm` dengan MUI modal/`ConfirmDialog`; samakan accept `.jpg,.jpeg,.png,.webp` + validasi 5 MB + seksi Ubah Password di `ProfilePage`. |

---

## 2.4 Layout & Responsivitas Mobile (`360px` · `390px` · `412px` · `768px` · `1280px`)

### A. Ringkasan Temuan per Breakpoint & Komponen

#### `UI-01` | High | `[PASTI]` — Tabs Admin Non-Scrollable & Tabel 7 Kolom Pecah di Mobile (`360px`–`412px`)
- **Lokasi:**
  - `client/src/pages/admin/ManageMaterialsPage.jsx:502` (`<Tabs value={activeTab} ...>` — 5 tab tanpa `variant="scrollable"`)
  - `client/src/pages/admin/ModerationQueuePage.jsx:205` (`<Tabs value={activeTab} ...>` — 3 tab tanpa `variant="scrollable"`)
  - `client/src/pages/admin/ManageCampusInfoPage.jsx:298` (`<Tabs value={activeTab} ...>` — 2 tab tanpa `variant="scrollable"`)
  - `client/src/pages/admin/UserVerificationPage.jsx:163-173` (`<Table>` 7 kolom memaksa scroll horizontal jauh pada viewport `360px`–`768px`)
- **Saran Perbaikan:** Tambahkan `variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile` pada semua `<Tabs>` (seperti di `AnnouncementsPage` & `ManageGalleryPage`). Pada `UserVerificationPage`, tampilkan daftar berbasis Card responsif untuk `< md` (`sm`/`xs`) dan pertahankan `<Table>` untuk `>= md`.

#### `UI-02` | High | `[PASTI]` — `100vh` vs `100dvh`, Keyboard Virtual Mobile, & Konflik `overflow-x-hidden`
- **Lokasi:**
  - `client/src/layouts/MainLayout.jsx:239, 242, 386` (`min-h-screen`, sidebar `h-screen`, `<main className="... overflow-x-hidden">`)
  - `client/src/layouts/AuthLayout.jsx:9, 70`, `AdminLayout.jsx:127`, `ErrorBoundary.jsx:38` (`min-h-screen`), `HomePage.jsx:107` (`overflow-x-hidden`)
  - `client/src/components/academic/MaterialRequestsDrawer.jsx:221` (`max-h-[calc(100vh-250px)]`)
  - `client/src/pages/academic/MaterialDetailPage.jsx:439` (`<div className="h-[600px]">` iframe pratinjau PDF terlalu tinggi untuk viewport mobile `360x640/800`)
- **Penjelasan:** `100vh` pada browser mobile tidak memperhitungkan address bar dinamis; `max-h-[calc(100vh-250px)]` membuat list terpotong atau tertutup saat keyboard virtual terbuka; sementara `overflow-x-hidden` pada `<main>` di `MainLayout` dan wrapper `HomePage` menyembunyikan bug lebar serta dapat mematahkan elemen `position: sticky` di dalamnya.
- **Saran Perbaikan:** Ganti ke `min-h-dvh` / `h-dvh` (`overflow-x: clip` pada body/wrapper jika perlu, bukan `overflow-x-hidden` di ancestor `sticky`), gunakan flexbox `flex-1 min-h-0` pada `MaterialRequestsDrawer`, dan buat tinggi pratinjau PDF responsif `h-[55dvh] sm:h-[600px]`.

#### `UI-03` | High | `[PASTI]` — Safe-Area, Double Padding Bawah, & Absennya Menu "Materi" di Bottom Nav Mobile
- **Lokasi:** `client/src/layouts/MainLayout.jsx:265, 386, 393-482`.
- **Penjelasan:**
  1. Wrapper konten memakai `pb-16 lg:pb-0` (L265) **DAN** `<main>` memakai `pb-24 lg:pb-8` (L386) — menyisakan celah kosong ~`160px` di dasar halaman mobile.
  2. Mobile bottom bar (`L393`) tidak menyertakan `env(safe-area-inset-bottom)` untuk iPhone home indicator/Android gesture bar.
  3. Bottom navigation hanya menampilkan 5 link (Beranda, Galeri, Warta, Agenda, Direktori/Masuk) — **halaman Materi Perkuliahan tidak tersedia di navigasi utama mobile** (hanya di drawer).
  4. `AppBar` di `L271` memakai `z-10` yang menurunkan `zIndex` bawaan MUI AppBar (`1100`).
- **Saran Perbaikan:** Hapus `pb-16` ganda, tambahkan `pb-[calc(0.375rem+env(safe-area-inset-bottom))]`, sesuaikan bottom nav (misal Beranda, Galeri, Materi, Warta/Agenda, atau Lainnya/Direktori), dan kembalikan stacking z-index header standar.

#### `UI-04` | High | `[PASTI]` — Dialog & Modal di Mobile (`fullScreen` Tidak Konsisten & Konflik Tailwind vs MUI)
- **Lokasi:**
  - `client/src/components/campus/UserProfileModal.jsx:74-76` & `EventDetailModal.jsx:207-209`: memasang `!rounded-2xl` / `max-h-[92vh]` walau `fullScreen={isMobile}` aktif -> sudut tetap membulat dan tinggi menyisakan celah di layar HP.
  - `client/src/components/gallery/PhotoLightboxModal.jsx:365, 368-424, 667`: `<aside>` komentar kekurangan `min-h-0` (scroll area kolaps di beberapa viewport) dan input komentar `L667` tanpa `fullWidth`.
  - Seluruh modal di modul materi (`UploadMaterialModal`, `ProposeCourseModal`, `ReportMaterialModal`, `MaterialRulesModal`, `MyCollectionsModal`, `LearningPackagesModal`, `LeaderboardModal`), `UploadPhotoDialog`, `EditAngkatanDialog`, dan modal CRUD admin belum menggunakan `fullScreen={isMobile}` (khususnya `UploadMaterialModal` 451L sangat padat di layar `360px`).
  - `GlobalSearchModal.jsx:76` memakai `!mt-[8vh]` sehingga terdorong ke atas/terpotong ketika keyboard mobile muncul.
- **Saran Perbaikan:** Terapkan pola `!rounded-none` saat `isMobile` + `fullScreen`, tambahkan `min-h-0` & `fullWidth` di `PhotoLightboxModal`, dan jadikan modal form besar responsif (`fullScreen={isMobile}` via hook/breakpoint `sm`).

#### `UI-05` | Medium | `[PASTI]` — Touch Target `< 44px` & Tipografi Mikro `< 14px`
- **Lokasi:**
  - Touch target kecil: `MainLayout.jsx:275` (`!p-1.5`), `L305` (`!p-1`), bottom nav item `L399` (`py-1 px-2` < `44px`); `AdminLayout.jsx:153` (`!p-1.5`); `ProfilePage.jsx:131` (tombol kamera `h-8 w-8` = `32px`); semester pills `CourseMaterialsPage` & `MaterialsLibraryPage` (`h-8 min-w-[32px]` = `32px`); tombol aksi icon `size="small"` di `AngkatanCard.jsx:68`, `DirectoryPage.jsx`, `ManageMaterialsPage.jsx`, `PhotoMasonryGrid.jsx:34`.
  - Tipografi sangat kecil: banyak label aksi/meta memakai `text-[10px]` atau `text-[11px]` (`MainLayout.jsx:399` bottom nav `text-[10px]`, `HomePage.jsx:196,200,375`, `ManageMaterialsPage.jsx`).
- **Saran Perbaikan:** Pastikan target sentuh interaktif minimal `44x44px` (atau padding klik memperluas area sentuh) di mobile, serta gunakan minimal `11px–12px` untuk teks label nav & badge fungsional penting.

#### `UI-06` | Medium | `[PASTI]` — Class Tailwind Tidak Terdefinisi, Dark Mode FOUC, & Inkonsistensi Visual
- **Lokasi:**
  - `dark:bg-slate-850` / `dark:hover:bg-slate-850` di `UserProfileModal.jsx:290` & `ManageCampusInfoPage.jsx:640` (**`slate-850` tidak ada** di Tailwind v3 bawaan maupun `tailwind.config.js`).
  - `pasim-950` di `AuthLayout.jsx:25,79`, `LoginPage.jsx:49`, `UserProfileModal.jsx:177` (**`pasim` di `tailwind.config.js` hanya terdefinisi `50..900`**, sehingga `pasim-950` tidak menghasilkan CSS apapun!).
  - `client/src/index.css:62-74` menulis ulang `.line-clamp-2` / `.line-clamp-3` padahal Tailwind bawaan sudah menyediakannya.
  - `client/index.html` belum memiliki inline script pembaca `localStorage('pasim-theme')` sebelum React mount -> menyebabkan kilasan terang sesaat (*FOUC*) saat pengguna Dark Mode me-refresh halaman.
  - Kontras & kepadatan: `HomePage.jsx` L347 menggunakan `<div onClick>` alih-alih element interaktif semantik; inkonsistensi penggunaan `Card` MUI vs `.card-surface` Tailwind + dialog native `confirm`/`prompt`.
- **Saran Perbaikan:** Definisikan `pasim-950` atau ubah ke `pasim-900`, ganti `slate-850` ke `slate-800`/`navy-800`, tambah inline pre-paint script di `index.html`, dan seragamkan elemen interaktif aksesibel (`<button>`/`<CardActionArea>`).

#### `UI-07` | Medium | `[PASTI]` — Optimasi Bundle, Lazy-Loading, & Aset Gambar
- **Lokasi:** `client/vite.config.js`, `client/src/App.jsx:30-31`, `client/src/store/useAuthStore.js:30`, `client/src/pages/HomePage.jsx:24-29`, `client/src/pages/gallery/AngkatanDetailPage.jsx`.
- **Hasil Build Teramati:** `mui` chunk `321.12 kB` (`96.85 kB` gzip), `react` `164.96 kB`, `index` `133.66 kB`, `MaterialsLibraryPage` `36.44 kB`, `ManageMaterialsPage` `30.75 kB`, chunk mati `ClassMaterialsDetailPage` `25.02 kB` & `MaterialsListPage` `12.29 kB`.
- **Masalah:** (1) `App.jsx` meng-import 2 halaman mati; (2) `useAuthStore.js` me-lazy-import `axiosInstance.js` sementara semua API memanggilnya statis -> warning Vite; (3) Modal besar (`PhotoLightboxModal` 907L, `EventDetailModal` 580L, `UploadPhotoDialog` 317L) di-import statis di `HomePage` & `AngkatanDetailPage`; (4) Hero `AuthLayout` `/kampus-pasim.jpg` di-import sebagai static public asset tanpa `srcSet`/ukuran responsif, sedangkan foto avatar/galeri sudah memakai helper `useCloudinaryUrl`.
- **Saran Perbaikan:** Hapus import mati; buat modul token/auth callback terpisah untuk memutus siklus import `useAuthStore` <-> `axiosInstance`; lazy-load modal berat hanya saat dibuka (`open && <Suspense><Modal/></Suspense>`).

---

## 2.5 Matriks Role & Hak Akses

### A. Catatan Status & Role Sistem
- Role resmi aktif: **`admin`**, **`moderator`**, **`mahasiswa`**, **`alumni`**, ditambah status **`Guest`** (tidak login) serta akun terdaftar berstatus **`pending` / `rejected` / `suspended`** (semua login dan middleware `authenticate` memblokir status `!== 'active'`).
- Sisa role LMS **`dosen` / `asisten_lab`** masih ada di enum lama SQL (`academic_and_lms.sql`) dan `constants.js`, namun tidak dipakai di route mana pun.

### B. Matriks Hak Akses Aktual vs Target

| Fitur / Endpoint / Halaman | Guest | Pending / Reject / Suspend | Mahasiswa (Active) | Alumni (Active) | Moderator | Admin | Kondisi Aktual vs Target & Temuan Gap |
|---|---|---|---|---|---|---|---|
| **Auth (`/login`, `/register`, `/lupa-password`, `/reset-password`)** | Akses penuh | Login ditolak (403); bisa `forgot-password` | Akses `/auth/me`, `/logout`, `/refresh` | Sama | Sama | Sama | **`[PASTI]`** Password tidak berubah sesi refresh lama pasca-reset; token dev bocor jika non-prod; tidak ada *Ganti Password*. |
| **Profil Pribadi (`/profil`, `PUT /users/profile`)** | Redirect `/login` | Ditolak API (401/403) | Edit profil sendiri + visibilitas | Sama | Sama | Sama | Sesuai. Kurang halaman/form Ubah Password. |
| **Beranda & Global Search (`GET /campus/home`, `GET /campus/search`)** | Baca beranda & search | Tidak aktif | Baca | Baca | Baca | Baca | **`[PASTI]` BUG:** `GET /campus/search` (`optionalAuth`) mengekspos **NIM** mahasiswa/alumni ke **Guest** walaupun Direktori dikunci wajib login (`user.routes.js:18`). Global search juga belum menyertakan **Materi**. |
| **Direktori Mahasiswa & Alumni (`/direktori`, `GET /users/directory`, `GET /users/profile/:id`)** | Redirect `/login` & API 401 | Ditolak 403 | Lihat profil publik/aktif | Sama | Sama | Sama | **`[PASTI]`** Sesuai guard, namun `getUserProfile` (`user.queries.js:85-95`) tidak memfilter `is_public_profile = 1` jika ID ditebak! **(Gap privasi profil)** |
| **Pengumuman & Agenda Publik (`GET /campus/announcements`, `GET /campus/events`)** | Baca | Tidak aktif | Baca + Like/Komentar Event | Sama | Sama | Baca + Interaksi + **CRUD** (`/admin/info-kampus`) | Sesuai (`POST/PUT/DELETE` announcements & events = `admin` saja). |
| **Angkatan (`/angkatan`, `POST/PUT/DELETE /angkatan`)** | Baca galeri approved | Ditolak 403 | Baca & lihat foto `approved` + foto miliknya (`pending`/`rejected`) | Sama | **PUT (Edit Angkatan)** | **Create + PUT + Delete** | **`[PASTI]`** `PUT /angkatan/:id` membuka role `moderator` tanpa validasi Zod; `deleteAngkatan` tidak membersihkan aset Cloudinary foto/cover. |
| **Album (`GET/POST/PUT/DELETE /albums`)** | Baca daftar | Ditolak 403 | Create + Delete milik sendiri | Sama | Create + **PUT + Delete** semua | Sama | **`[PASTI]` GAP (`RBAC-01`):** `PUT /albums/:id` di route dibatasi `admin/moderator`, tapi controller menulis izin `isCreator`, dan UI `AngkatanDetailPage.jsx:81` memberi tombol Edit/Hapus pada semua user untuk album tanpa `created_by` (`!al.created_by`)! |
| **Galeri Foto (`photos` upload, edit, hapus, moderasi, like, comment, report)** | Baca approved + komen + liker | Ditolak 403 | Upload (`pending`), edit/hapus milik sendiri, like, komen, lapor | Sama | Upload (**auto-approve**), edit/hapus/moderasi semua, kelola laporan | Sama | **`[PASTI]` GAP (`RBAC-02`):** `GET /photos/:id/comments` & `GET /photos/:id/likes` tidak mengecek `photo.status === 'approved'` -> foto `pending`/`rejected` bisa diintip interaksinya oleh publik! |
| **Perpustakaan Materi — Browse & Detail (`GET /materials*`, `/catalog/*`, `/packages*`, `/leaderboard`)** | **Diblokir UI (`/login`) & API 401 (`authenticate`)** | Ditolak 403 | Baca semua materi approved + milik sendiri; unduh ZIP | Sama | Baca **semua status**, unduh ZIP | Sama | **`[PASTI]` BUG CRITICAL (`BUG-BE-01/02`):** Mahasiswa/Alumni **bisa membaca semua materi `pending`/`rejected`/`takedown`** orang lain lewat `?status=pending` dan `GET /materials/:id`. **AMBIGUITAS:** apakah Guest boleh baca katalog/daftar materi publik (read-only) atau wajib login seperti sekarang? |
| **Kontribusi Materi (`POST /materials`, `PUT/DELETE /:id`, `POST /:id/versions`)** | Ditolak 401 | Ditolak 403 | Upload (`pending`), edit/hapus/upload versi **milik sendiri** | Sama | Upload (**auto-approve**), edit/hapus/versi **milik siapa pun** | Sama | **`[PASTI]` GAP:** Mahasiswa bisa mengedit materi yang sudah berstatus `approved` tanpa kembali ke antrean moderasi (atau mengedit materi `takedown`!); pemilik bisa mengeset `is_published = 0/1`. |
| **Katalog Prodi & Matkul (`/catalog/prodi`, `/catalog/courses`)** | Ditolak 401 | Ditolak 403 | Baca katalog + **Usul Matkul (`pending`)** | Sama | Baca + **CRUD Prodi/Matkul + Approve Usulan** | Sama | **`[PASTI]`** Sesuai di backend, namun perlu cek bahwa mahasiswa tidak bisa menyalahgunakan ID `mata_kuliah` `pending`/`rejected` saat upload materi. |
| **Koleksi Saya (`/collections*`)** | Ditolak 401 | Ditolak 403 | CRUD koleksi & toggle item **milik sendiri** | Sama | Sama (milik pribadi) | Sama | **`[PASTI]` BUG CRITICAL (`BUG-BE-03`):** `POST /collections/:id/toggle` bisa memodifikasi koleksi user lain (**IDOR**). |
| **Papan Minta Materi (`/requests*`)** | Ditolak 401 | Ditolak 403 | Baca + Buat request + **Fulfill request milik siapa pun** | Sama | Sama | Sama | **`[PASTI]` GAP:** `PATCH /requests/:id/fulfill` tidak membatasi pemilik untuk menandai "Terpenuhi" maupun memvalidasi materi penaut (`status = 'approved'`). |
| **Moderasi & Laporan Materi (`PATCH /:id/moderate`, `/reports*`, `/packages*`)** | Ditolak 401 | Ditolak 403 | Lapor materi (`POST /:id/report`); diblokir akses moderasi/laporan/paket | Sama | **Moderasi materi, proses laporan/takedown, kelola Paket Belajar** | Sama | **`[PASTI]`** Role backend sudah tepat (`admin, moderator`), tapi `handleMaterialReport` & `moderateMaterial` belum mengirim notifikasi takedown/moderasi, dan `/admin/materi` belum ada di tombol aksi cepat yang terintegrasi dari Dashboard laporan. |
| **Manajemen User & Info Kampus (`/admin/pengguna`, `/admin/info-kampus`)** | Ditolak 401 | Ditolak 403 | Diblokir UI & API (403) | Sama | **Diblokir** UI & API (403) — khusus `admin` | **Penuh** (`verify user`, ubah role, kelola berita & event) | **`[PASTI]`** Sesuai, namun Admin UI hanya menampilkan link sidebar ke admin; tidak ada proteksi agar admin tidak tidak sengaja menurunkan role dirinya sendiri (`self-demote`). |

### C. Daftar Keputusan Ambigu yang Wajib Dikonfirmasi Pengguna (Sebelum Tahap Implementasi)

1. **Akses Guest pada Perpustakaan Materi (`GET /materials`, `/catalog/*`, `/packages`):** Saat ini semua halaman & endpoint materi mewajibkan login (`ProtectedRoute` + `authenticate`), sedangkan Galeri, Pengumuman, dan Agenda terbuka read-only untuk Guest (hanya interaksi/upload yang butuh login). **Apakah Perpustakaan Materi tetap tertutup untuk member login saja, atau boleh dilihat read-only oleh Guest (dengan unduh/vote/komen wajib login)?**
2. **Privasi Profil & `is_public_profile`:** Di `DirectoryPage`, user dapat mematikan "Tampilkan di Direktori Kampus", tetapi `GET /users/profile/:id` masih menampilkan profil jika ID diketahui, dan `GET /campus/search` mengekspos `nim` ke Guest. **Apakah profil privat (`is_public_profile = 0`) harus mengembalikan 403/404 pada `GET /users/profile/:id` untuk non-staff?**
3. **Edit Materi yang Sudah Disetujui (`approved`) atau Di-`takedown`:** Jika pemilik mengedit materi yang sudah `approved` (atau mengunggah versi file baru), **apakah statusnya langsung tetap `approved` atau harus kembali `pending` moderasi ulang? Dan bolehkah pemilik mengedit materi yang sudah kena `takedown` oleh moderator?**
4. **Hak Edit Album oleh Pembuat (`mahasiswa`/`alumni`):** Saat ini `POST` & `DELETE /albums/:id` mengizinkan pembuat album, sedangkan route `PUT /albums/:id` memblokir pembuat (`authorizeRoles('admin','moderator')`) walaupun di controller tertulis `!isStaff && !isCreator`. **Apakah pembuat album boleh mengedit albumnya sendiri (selain album sistem/seed yang `created_by IS NULL`), atau hanya Moderator/Admin?**
5. **Menandai Terpenuhi di Papan "Minta Materi":** Spesifikasi menyatakan adik kelas meminta materi, kakak tingkat menautkan materinya sebagai jawaban, dan peminta dapat menandai "Terpenuhi". **Apakah penandaan `is_fulfilled = 1` hanya boleh dilakukan oleh peminta asli (`user_id === req.user.id`) & Moderator/Admin, atau otomatis terpenuhi begitu siapa pun menautkan materi?**
6. **Penghapusan Prodi / Mata Kuliah (`DELETE /catalog/courses/:id`):** Saat ini hanya `admin`/`moderator` bisa menghapus mata kuliah, namun belum ada UI/endpoint hapus/edit Prodi maupun pengaman jika mata kuliah sudah punya puluhan materi. **Apakah penghapusan mata kuliah yang sudah punya materi harus diblokir (`RESTRICT`/arsip), atau ikut menghapus materi di dalamnya?**
7. **Poin Leaderboard Moderator/Admin & `role` LMS Lama:** Saat ini leaderboard membatasi `WHERE u.role IN ('mahasiswa','alumni')` (`material.queries.js:951`). **Apakah kontribusi `admin`/`moderator` tetap dikecualikan dari leaderboard, dan apakah akun/enum role `'dosen'` / `'asisten_lab'` di DB boleh dihapus permanen?**

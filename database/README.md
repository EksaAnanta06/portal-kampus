# Panduan Skema & Migrasi Database (`db_portal_pasim`)

Seluruh definisi tabel, Foreign Key, Index, dan Seeder kini dikelola secara terpusat di folder `database/` (tidak ada lagi auto-DDL atau `DROP TABLE` otomatis di backend saat startup).

## 1. Instalasi Database Baru (Fresh Setup)

Jalankan berurutan di MySQL 8.0+:
1. `database/schema.sql`
2. `database/migrations/001_peer_materials_library_up.sql`
3. `database/seed.sql`
4. `database/seeds/peer_materials_seed.sql` *(opsional data demo modul materi)*

## 2. Upgrade Database Existing (Sudah Pernah Jalan Sebelumnya)

> **WAJIB backup penuh terlebih dahulu:**
> ```bash
> mysqldump -u root -p db_portal_pasim > backup_db_portal_pasim.sql
> ```

1. Jalankan `database/migrations/002_hardening_fk_indexes_cloudinary_up.sql` (non-destruktif: menambah kolom `public_id` / `banner_public_id`, memperluas ENUM `notifications.type`, index performa, serta Foreign Key yang kurang).
2. *(Opsional & Manual)* Jika ingin menghapus tabel/kolom LMS lama (`semester_akademik`, `kelas`, `materi_pertemuan`, `materi_item`, dll.), jalankan query pengecekan `SELECT COUNT(*)` di dalam header `database/migrations/003_cleanup_legacy_lms_up.sql` terlebih dahulu, pastikan data sudah kosong/tidak diperlukan, lalu eksekusi secara manual.

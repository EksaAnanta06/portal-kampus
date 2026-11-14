-- ============================================================================
-- MIGRATION 003 (UP — BERSIFAT MERUSAK / MANUAL ONLY):
-- Pembersihan Tabel & Kolom Legacy LMS Lama
--
-- ⚠️ PERINGATAN KERAS:
-- 1. JANGAN jalankan file ini sebelum melakukan BACKUP penuh:
--      mysqldump -u root -p db_portal_pasim > backup_sebelum_drop_legacy.sql
-- 2. Pastikan hasil SELECT COUNT(*) di bawah semuanya bernilai 0 baris (kosong)
--    atau datanya sudah tidak dibutuhkan lagi:
--
--    SELECT 'semester_akademik' AS tbl, COUNT(*) AS rows_count FROM semester_akademik
--    UNION ALL SELECT 'kelas', COUNT(*) FROM kelas
--    UNION ALL SELECT 'materi_pertemuan', COUNT(*) FROM materi_pertemuan
--    UNION ALL SELECT 'materi_item', COUNT(*) FROM materi_item;
--
--    SELECT COUNT(*) AS legacy_role_users FROM users WHERE role IN ('dosen', 'asisten_lab');
-- ============================================================================

USE db_portal_pasim;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Hapus sisa tabel Assignment Hub & LMS lama (tidak direferensikan kode aktif)
DROP TABLE IF EXISTS materi_progress;
DROP TABLE IF EXISTS penilaian;
DROP TABLE IF EXISTS pengumpulan_berkas;
DROP TABLE IF EXISTS pengumpulan;
DROP TABLE IF EXISTS tugas_lampiran;
DROP TABLE IF EXISTS tugas;
DROP TABLE IF EXISTS kelas_pengajar;
DROP TABLE IF EXISTS kelas_peserta;
DROP TABLE IF EXISTS materi_item;
DROP TABLE IF EXISTS materi_pertemuan;
DROP TABLE IF EXISTS kelas;
DROP TABLE IF EXISTS semester_akademik;

SET FOREIGN_KEY_CHECKS = 1;

-- 2. Hapus kolom transisi lama di mata_kuliah (jika berasal dari academic_and_lms.sql)
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah' AND COLUMN_NAME = 'prodi') > 0,
    'ALTER TABLE mata_kuliah DROP COLUMN prodi',
    'SELECT "mata_kuliah.prodi not present"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah' AND COLUMN_NAME = 'semester_paket') > 0,
    'ALTER TABLE mata_kuliah DROP COLUMN semester_paket',
    'SELECT "mata_kuliah.semester_paket not present"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Bersihkan enum role lama di users (hanya jalankan jika tidak ada user role dosen/asisten_lab)
-- Jika ada user dengan role tersebut, migrasikan lebih dulu sebelum ALTER ENUM ini.
ALTER TABLE users
MODIFY COLUMN role ENUM('admin', 'moderator', 'mahasiswa', 'alumni')
NOT NULL DEFAULT 'mahasiswa';

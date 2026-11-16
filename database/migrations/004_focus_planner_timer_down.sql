-- ============================================================================
-- MIGRATION 004 (DOWN — BERSIFAT MERUSAK / MANUAL ONLY):
-- Menghapus tabel modul Penjadwalan, Timer Fokus, Pengingat & Web Push
--
-- ⚠️ PERINGATAN: Lakukan backup terlebih dahulu sebelum menjalankan script ini:
--   mysqldump -u root -p db_portal_pasim > backup_sebelum_down_004.sql
-- Catatan: Tabel tugas_pribadi sendiri tidak di-DROP agar data tugas eksisting tetap aman;
-- hanya dua kolom tambahan (estimasi_menit, target_mulai) yang dihapus.
-- ============================================================================

USE db_portal_pasim;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS pengingat;
DROP TABLE IF EXISTS fokus_pengaturan;
DROP TABLE IF EXISTS fokus_sesi;
DROP TABLE IF EXISTS sesi_jadwal;
SET FOREIGN_KEY_CHECKS = 1;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tugas_pribadi' AND COLUMN_NAME = 'target_mulai') > 0,
    'ALTER TABLE tugas_pribadi DROP COLUMN target_mulai',
    'SELECT "tugas_pribadi.target_mulai not present"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tugas_pribadi' AND COLUMN_NAME = 'estimasi_menit') > 0,
    'ALTER TABLE tugas_pribadi DROP COLUMN estimasi_menit',
    'SELECT "tugas_pribadi.estimasi_menit not present"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Kembalikan ENUM notifications.type ke kondisi sebelum migrasi 004
UPDATE notifications SET type = 'system' WHERE type IN ('focus_reminder', 'task_deadline');
ALTER TABLE notifications
MODIFY COLUMN type ENUM(
    'photo_approved',
    'photo_rejected',
    'new_comment',
    'new_like',
    'account_verified',
    'material_approved',
    'material_rejected',
    'material_takedown',
    'course_approved',
    'course_rejected',
    'request_fulfilled',
    'system'
) NOT NULL;

-- ============================================================================
-- MIGRATION 004 (DOWN — BERSIFAT MERUSAK / MANUAL ONLY):
-- Menghapus tabel modul Penjadwalan Tugas Pribadi, Timer Fokus, Pengingat & Web Push
--
-- ⚠️ PERINGATAN: Lakukan backup terlebih dahulu sebelum menjalankan script ini:
--   mysqldump -u root -p db_portal_pasim > backup_sebelum_down_004.sql
-- ============================================================================

USE db_portal_pasim;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS pengingat;
DROP TABLE IF EXISTS fokus_pengaturan;
DROP TABLE IF EXISTS fokus_sesi;
DROP TABLE IF EXISTS sesi_jadwal;
DROP TABLE IF EXISTS tugas_pribadi;
SET FOREIGN_KEY_CHECKS = 1;

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

-- ============================================================================
-- MIGRATION 003 (DOWN): Kembalikan Kolom & Struktur Enum Legacy LMS
-- Catatan: Data baris yang sudah ter-DROP hanya dapat dipulihkan dari file backup mysqldump.
-- ============================================================================

USE db_portal_pasim;

ALTER TABLE users
MODIFY COLUMN role ENUM('admin', 'moderator', 'mahasiswa', 'alumni', 'dosen', 'asisten_lab')
NOT NULL DEFAULT 'mahasiswa';

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah' AND COLUMN_NAME = 'prodi') = 0,
    'ALTER TABLE mata_kuliah ADD COLUMN prodi VARCHAR(100) NULL AFTER sks',
    'SELECT "skip"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah' AND COLUMN_NAME = 'semester_paket') = 0,
    'ALTER TABLE mata_kuliah ADD COLUMN semester_paket TINYINT UNSIGNED NULL AFTER prodi',
    'SELECT "skip"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

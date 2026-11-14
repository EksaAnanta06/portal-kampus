-- ============================================================================
-- MIGRATION 002 (DOWN): Rollback Hardening Kolom & Index Tambahan
-- Catatan: Pastikan tidak ada nilai notifications.type bertipe materi sebelum rollback ENUM.
-- ============================================================================

USE db_portal_pasim;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'banner_public_id') > 0,
    'ALTER TABLE announcements DROP COLUMN banner_public_id',
    'SELECT "skip"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'banner_public_id') > 0,
    'ALTER TABLE events DROP COLUMN banner_public_id',
    'SELECT "skip"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_version' AND COLUMN_NAME = 'public_id') > 0,
    'ALTER TABLE materi_version DROP COLUMN public_id',
    'SELECT "skip"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_version' AND COLUMN_NAME = 'file_format') > 0,
    'ALTER TABLE materi_version DROP COLUMN file_format',
    'SELECT "skip"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- MIGRATION 002 (UP): Hardening Skema, Kolom Public ID, ENUM, Index, & FK
-- Diperuntukkan bagi database EXISTING yang sudah dibuat sebelum refactor.
-- TIDAK menghapus tabel atau kolom apa pun.
--
-- WAJIB BACKUP SEBELUM MENJALANKAN:
--   mysqldump -u root -p db_portal_pasim > backup_pre_002.sql
--
-- Jika ADD FOREIGN KEY gagal karena data yatim (orphan rows), periksa dulu:
--   SELECT COUNT(*) FROM materi m LEFT JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id WHERE mk.id IS NULL;
--   SELECT COUNT(*) FROM materi_file mf LEFT JOIN materi m ON m.id = mf.materi_id WHERE m.id IS NULL;
--   SELECT COUNT(*) FROM materi_laporan ml LEFT JOIN materi m ON m.id = ml.materi_id WHERE m.id IS NULL;
-- ============================================================================

USE db_portal_pasim;

-- 1. Tambah banner_public_id pada announcements & events (cleanup Cloudinary aman)
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements' AND COLUMN_NAME = 'banner_public_id') = 0,
    'ALTER TABLE announcements ADD COLUMN banner_public_id VARCHAR(255) NULL AFTER banner_url',
    'SELECT "announcements.banner_public_id already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'banner_public_id') = 0,
    'ALTER TABLE events ADD COLUMN banner_public_id VARCHAR(255) NULL AFTER banner_url',
    'SELECT "events.banner_public_id already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Tambah public_id dan file_format pada materi_version
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_version' AND COLUMN_NAME = 'public_id') = 0,
    'ALTER TABLE materi_version ADD COLUMN public_id VARCHAR(255) NULL AFTER file_url',
    'SELECT "materi_version.public_id already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_version' AND COLUMN_NAME = 'file_format') = 0,
    'ALTER TABLE materi_version ADD COLUMN file_format VARCHAR(20) NULL AFTER file_size',
    'SELECT "materi_version.file_format already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Perluas ENUM notifications.type agar mendukung notifikasi modul materi & request
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

-- 3b. Pastikan ENUM materi.status mendukung status takedown
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi' AND COLUMN_NAME = 'status'
       AND COLUMN_TYPE NOT LIKE '%takedown%') > 0,
    "ALTER TABLE materi MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'takedown') NOT NULL DEFAULT 'pending'",
    'SELECT "materi.status already supports takedown"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Sinkronkan status materi_laporan yang diabaikan
UPDATE materi_laporan
SET status = 'dismissed'
WHERE action_taken = 'dismissed' AND status = 'resolved';

-- 5. Ubah created_by di materi_version & paket_belajar agar nullable (aman untuk ON DELETE SET NULL)
ALTER TABLE materi_version MODIFY COLUMN created_by INT UNSIGNED NULL;
ALTER TABLE paket_belajar MODIFY COLUMN created_by INT UNSIGNED NULL;

-- 6. Index performa & anti-spam laporan
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi' AND INDEX_NAME = 'idx_mat_status_pub_created') = 0,
    'ALTER TABLE materi ADD INDEX idx_mat_status_pub_created (status, is_published, created_at DESC)',
    'SELECT "idx_mat_status_pub_created exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi' AND INDEX_NAME = 'idx_mat_course_status_pub') = 0,
    'ALTER TABLE materi ADD INDEX idx_mat_course_status_pub (mata_kuliah_id, status, is_published)',
    'SELECT "idx_mat_course_status_pub exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah' AND INDEX_NAME = 'idx_mk_status_prodi_sem') = 0,
    'ALTER TABLE mata_kuliah ADD INDEX idx_mk_status_prodi_sem (status, prodi_id, semester_rekomendasi)',
    'SELECT "idx_mk_status_prodi_sem exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_request' AND INDEX_NAME = 'idx_mreq_status_created') = 0,
    'ALTER TABLE materi_request ADD INDEX idx_mreq_status_created (is_fulfilled, created_at DESC)',
    'SELECT "idx_mreq_status_created exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_laporan' AND INDEX_NAME = 'idx_mlap_status_created') = 0,
    'ALTER TABLE materi_laporan ADD INDEX idx_mlap_status_created (status, created_at DESC)',
    'SELECT "idx_mlap_status_created exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. Tambah Foreign Key yang hilang (jika database sebelumnya dibuat lewat auto-sync db.js)
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah' AND CONSTRAINT_NAME = 'fk_mk_prodi') = 0,
    'ALTER TABLE mata_kuliah ADD CONSTRAINT fk_mk_prodi FOREIGN KEY (prodi_id) REFERENCES prodi(id) ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT "fk_mk_prodi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'materi' AND CONSTRAINT_NAME = 'fk_mat_course') = 0,
    'ALTER TABLE materi ADD CONSTRAINT fk_mat_course FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id) ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT "fk_mat_course exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_file' AND CONSTRAINT_NAME = 'fk_mf_materi') = 0,
    'ALTER TABLE materi_file ADD CONSTRAINT fk_mf_materi FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE',
    'SELECT "fk_mf_materi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_version' AND CONSTRAINT_NAME = 'fk_mv_materi') = 0,
    'ALTER TABLE materi_version ADD CONSTRAINT fk_mv_materi FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE',
    'SELECT "fk_mv_materi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_vote' AND CONSTRAINT_NAME = 'fk_mvote_materi') = 0,
    'ALTER TABLE materi_vote ADD CONSTRAINT fk_mvote_materi FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE',
    'SELECT "fk_mvote_materi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_komentar' AND CONSTRAINT_NAME = 'fk_mkom_materi') = 0,
    'ALTER TABLE materi_komentar ADD CONSTRAINT fk_mkom_materi FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE',
    'SELECT "fk_mkom_materi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_koleksi_item' AND CONSTRAINT_NAME = 'fk_mki_koleksi') = 0,
    'ALTER TABLE materi_koleksi_item ADD CONSTRAINT fk_mki_koleksi FOREIGN KEY (koleksi_id) REFERENCES materi_koleksi(id) ON DELETE CASCADE',
    'SELECT "fk_mki_koleksi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_koleksi_item' AND CONSTRAINT_NAME = 'fk_mki_materi') = 0,
    'ALTER TABLE materi_koleksi_item ADD CONSTRAINT fk_mki_materi FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE',
    'SELECT "fk_mki_materi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'paket_belajar_item' AND CONSTRAINT_NAME = 'fk_pbi_paket') = 0,
    'ALTER TABLE paket_belajar_item ADD CONSTRAINT fk_pbi_paket FOREIGN KEY (paket_belajar_id) REFERENCES paket_belajar(id) ON DELETE CASCADE',
    'SELECT "fk_pbi_paket exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'paket_belajar_item' AND CONSTRAINT_NAME = 'fk_pbi_materi') = 0,
    'ALTER TABLE paket_belajar_item ADD CONSTRAINT fk_pbi_materi FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE',
    'SELECT "fk_pbi_materi exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

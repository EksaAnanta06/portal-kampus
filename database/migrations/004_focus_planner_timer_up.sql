-- ============================================================================
-- MIGRATION 004 (UP): Penjadwalan Tugas Pribadi, Timer Fokus, Pengingat & Web Push
-- Catatan: Disarankan backup database terlebih dahulu:
--   mysqldump -u root -p db_portal_pasim > backup_sebelum_004.sql
-- Semua timestamp terencana disimpan dalam UTC (DATETIME UTC) dan ditampilkan sesuai zona waktu user.
-- ============================================================================

USE db_portal_pasim;

-- 1. Gunakan ulang tabel tugas_pribadi (buat jika belum ada, lalu pastikan kolom tambahan tersedia)
CREATE TABLE IF NOT EXISTS tugas_pribadi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    mata_kuliah_id INT UNSIGNED NULL,
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT NULL,
    prioritas ENUM('rendah', 'sedang', 'tinggi') NOT NULL DEFAULT 'sedang',
    status ENUM('belum_mulai', 'sedang_dikerjakan', 'selesai') NOT NULL DEFAULT 'belum_mulai',
    deadline_at DATETIME NULL COMMENT 'Waktu deadline tugas (UTC)',
    estimasi_menit INT UNSIGNED NULL COMMENT 'Estimasi total waktu pengerjaan dalam menit',
    target_mulai DATETIME NULL COMMENT 'Target mulai paling lambat (UTC)',
    completed_at DATETIME NULL COMMENT 'Waktu selesai tugas (UTC)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tp_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tp_matkul
        FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)
        ON DELETE SET NULL,
    INDEX idx_tp_user_status_deadline (user_id, status, deadline_at),
    INDEX idx_tp_deadline (status, deadline_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tugas_pribadi' AND COLUMN_NAME = 'estimasi_menit') = 0,
    'ALTER TABLE tugas_pribadi ADD COLUMN estimasi_menit INT UNSIGNED NULL COMMENT ''Estimasi total pengerjaan dalam menit'' AFTER deadline_at',
    'SELECT "tugas_pribadi.estimasi_menit already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tugas_pribadi' AND COLUMN_NAME = 'target_mulai') = 0,
    'ALTER TABLE tugas_pribadi ADD COLUMN target_mulai DATETIME NULL COMMENT ''Target mulai paling lambat (UTC)'' AFTER estimasi_menit',
    'SELECT "tugas_pribadi.target_mulai already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Sesi Kerja Terjadwal ("Kapan dikerjakan")
CREATE TABLE IF NOT EXISTS sesi_jadwal (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    tugas_id INT UNSIGNED NOT NULL,
    mulai_at DATETIME NOT NULL COMMENT 'Waktu mulai sesi terjadwal (UTC)',
    durasi_menit INT UNSIGNED NOT NULL DEFAULT 50,
    status ENUM('terjadwal', 'selesai', 'dilewati', 'terlewat') NOT NULL DEFAULT 'terjadwal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sj_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sj_tugas
        FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id)
        ON DELETE CASCADE,
    INDEX idx_sj_user_mulai (user_id, mulai_at),
    INDEX idx_sj_status_mulai (status, mulai_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Sesi Timer Fokus (Pomodoro) dengan penegakan 1 sesi aktif per user
CREATE TABLE IF NOT EXISTS fokus_sesi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    tugas_id INT UNSIGNED NULL,
    sesi_jadwal_id INT UNSIGNED NULL,
    tipe ENUM('fokus', 'istirahat_pendek', 'istirahat_panjang') NOT NULL DEFAULT 'fokus',
    status ENUM('berjalan', 'dijeda', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'berjalan',
    mulai_at DATETIME NOT NULL COMMENT 'Waktu mulai sesi (UTC)',
    durasi_rencana_detik INT UNSIGNED NOT NULL,
    total_jeda_detik INT UNSIGNED NOT NULL DEFAULT 0,
    jeda_sejak DATETIME NULL COMMENT 'Waktu mulai jeda aktif (UTC)',
    selesai_at DATETIME NULL COMMENT 'Waktu selesai/berhenti (UTC)',
    catatan VARCHAR(500) NULL,
    siklus_ke TINYINT UNSIGNED NOT NULL DEFAULT 1,
    active_user_lock INT UNSIGNED GENERATED ALWAYS AS (IF(status IN ('berjalan', 'dijeda'), user_id, NULL)) STORED,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_fs_tugas
        FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_fs_jadwal
        FOREIGN KEY (sesi_jadwal_id) REFERENCES sesi_jadwal(id)
        ON DELETE SET NULL,
    UNIQUE KEY uq_fokus_sesi_active_user (active_user_lock),
    INDEX idx_fs_user_status (user_id, status),
    INDEX idx_fs_user_selesai (user_id, status, selesai_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Pengaturan Fokus, Jam Aktif, Jam Tenang & Preferensi Pengingat per User
CREATE TABLE IF NOT EXISTS fokus_pengaturan (
    user_id INT UNSIGNED PRIMARY KEY,
    durasi_fokus INT UNSIGNED NOT NULL DEFAULT 25,
    durasi_istirahat_pendek INT UNSIGNED NOT NULL DEFAULT 5,
    durasi_istirahat_panjang INT UNSIGNED NOT NULL DEFAULT 15,
    siklus_sebelum_panjang TINYINT UNSIGNED NOT NULL DEFAULT 4,
    auto_start TINYINT(1) NOT NULL DEFAULT 0,
    suara_aktif TINYINT(1) NOT NULL DEFAULT 1,
    getar_aktif TINYINT(1) NOT NULL DEFAULT 1,
    batas_beban_harian_menit INT UNSIGNED NOT NULL DEFAULT 240,
    jam_aktif_mulai CHAR(5) NOT NULL DEFAULT '08:00',
    jam_aktif_selesai CHAR(5) NOT NULL DEFAULT '22:00',
    jam_tenang_aktif TINYINT(1) NOT NULL DEFAULT 1,
    jam_tenang_mulai CHAR(5) NOT NULL DEFAULT '22:00',
    jam_tenang_selesai CHAR(5) NOT NULL DEFAULT '07:00',
    zona_waktu VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    ingatkan_sesi_akan_mulai TINYINT(1) NOT NULL DEFAULT 1,
    offset_sesi_menit INT UNSIGNED NOT NULL DEFAULT 10,
    ingatkan_sesi_mulai TINYINT(1) NOT NULL DEFAULT 1,
    ingatkan_deadline_h3 TINYINT(1) NOT NULL DEFAULT 1,
    ingatkan_deadline_h1 TINYINT(1) NOT NULL DEFAULT 1,
    ingatkan_deadline_3jam TINYINT(1) NOT NULL DEFAULT 1,
    ingatkan_sesi_terlewat TINYINT(1) NOT NULL DEFAULT 1,
    email_pengingat_aktif TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fp_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Antrean Pengingat Idempoten (In-App + Web Push + Email Opsional)
CREATE TABLE IF NOT EXISTS pengingat (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    tugas_id INT UNSIGNED NULL,
    sesi_jadwal_id INT UNSIGNED NULL,
    jenis ENUM(
        'sesi_akan_mulai',
        'sesi_mulai',
        'deadline_h3',
        'deadline_h1',
        'deadline_3jam',
        'sesi_terlewat'
    ) NOT NULL,
    kirim_at DATETIME NOT NULL COMMENT 'Waktu kirim terhitung setelah jam tenang (UTC)',
    status ENUM('menunggu', 'terkirim', 'dibatalkan', 'gagal') NOT NULL DEFAULT 'menunggu',
    dikirim_at DATETIME NULL COMMENT 'Waktu aktual terkirim (UTC)',
    dedupe_key VARCHAR(150) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pg_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pg_tugas
        FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pg_jadwal
        FOREIGN KEY (sesi_jadwal_id) REFERENCES sesi_jadwal(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_pengingat_dedupe (dedupe_key),
    INDEX idx_pengingat_due (status, kirim_at),
    INDEX idx_pengingat_user (user_id, status, kirim_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Langganan Web Push Perangkat/Browser User
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NULL COMMENT 'UTC',
    CONSTRAINT fk_ps_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_push_endpoint (endpoint),
    INDEX idx_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Perluas ENUM notifications.type agar mendukung pengingat fokus & deadline tugas
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
    'focus_reminder',
    'task_deadline',
    'system'
) NOT NULL;

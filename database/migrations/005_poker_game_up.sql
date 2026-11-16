-- ============================================================================
-- MIGRATION 005 (UP): Fitur Poker Virtual Hiburan (Tanpa Uang Asli / Tanpa Saldo)
-- Menyimpan hanya riwayat ringkas permainan (tanpa detail kartu/chip permanen)
-- serta laporan pemain yang terhubung dengan notifikasi moderator/admin.
-- ============================================================================

USE db_portal_pasim;

-- 1. Tabel riwayat permainan poker hiburan (statistik main/menang per user)
CREATE TABLE IF NOT EXISTS poker_riwayat (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id CHAR(6) NOT NULL,
    mulai_at DATETIME NOT NULL,
    selesai_at DATETIME NOT NULL,
    pemain JSON NOT NULL COMMENT 'Daftar ringkas { userId, fullName, eliminated } tanpa kartu atau nilai uang',
    pemenang_user_id INT UNSIGNED NULL,
    jumlah_tangan INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pri_winner
        FOREIGN KEY (pemenang_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_pri_selesai (selesai_at DESC),
    INDEX idx_pri_winner (pemenang_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel laporan perilaku pemain di meja poker
CREATE TABLE IF NOT EXISTS poker_laporan (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id CHAR(6) NOT NULL,
    reporter_id INT UNSIGNED NOT NULL,
    reported_user_id INT UNSIGNED NOT NULL,
    reason ENUM('harassment', 'inappropriate', 'spam', 'cheating', 'other') NOT NULL DEFAULT 'other',
    description VARCHAR(500) NULL,
    status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_plap_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_plap_reported
        FOREIGN KEY (reported_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_plap_status (status, created_at DESC),
    INDEX idx_plap_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

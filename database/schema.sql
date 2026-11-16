-- ============================================================================
-- FILE: database/schema.sql
-- DESKRIPSI: Skema Database Portal Kampus Universitas Nasional Pasim Bandung
-- ENGINE: MySQL 8.0+ (InnoDB, utf8mb4)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS db_portal_pasim
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_portal_pasim;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS photo_reports;
DROP TABLE IF EXISTS photo_comments;
DROP TABLE IF EXISTS photo_likes;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS angkatan;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. TABEL ANGKATAN
-- Menyimpan daftar tahun angkatan beserta deskripsi dan cover foto
-- ============================================================================
CREATE TABLE angkatan (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    year YEAR NOT NULL UNIQUE COMMENT 'Tahun masuk angkatan, contoh: 2022, 2023',
    title VARCHAR(100) NOT NULL COMMENT 'Nama julukan/judul angkatan',
    description TEXT NULL,
    cover_url VARCHAR(500) NULL,
    cover_public_id VARCHAR(255) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_angkatan_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. TABEL USERS
-- Menyimpan data mahasiswa, alumni, moderator, dan admin beserta status verifikasi NIM
-- ============================================================================
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nim VARCHAR(30) NOT NULL UNIQUE COMMENT 'Nomor Induk Mahasiswa / ID Staf',
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'moderator', 'mahasiswa', 'alumni') NOT NULL DEFAULT 'mahasiswa',
    status ENUM('pending', 'active', 'suspended', 'rejected') NOT NULL DEFAULT 'pending' COMMENT 'pending = menunggu verifikasi NIM oleh admin',
    prodi VARCHAR(100) NOT NULL COMMENT 'Program Studi di UNAS PASIM',
    angkatan_year YEAR NULL COMMENT 'Tahun angkatan mahasiswa/alumni',
    avatar_url VARCHAR(500) NULL,
    avatar_public_id VARCHAR(255) NULL,
    bio TEXT NULL,
    current_job VARCHAR(150) NULL COMMENT 'Pekerjaan/perusahaan saat ini (khususnya alumni)',
    linkedin_url VARCHAR(255) NULL,
    instagram_url VARCHAR(255) NULL,
    github_url VARCHAR(255) NULL,
    is_public_profile TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = tampil di direktori publik, 0 = disembunyikan',
    verified_at TIMESTAMP NULL DEFAULT NULL,
    verified_by INT UNSIGNED NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_angkatan_year
        FOREIGN KEY (angkatan_year) REFERENCES angkatan(year)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_users_verified_by
        FOREIGN KEY (verified_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_users_role_status (role, status),
    INDEX idx_users_directory (is_public_profile, status, angkatan_year, prodi),
    INDEX idx_users_search (full_name, nim)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. TABEL REFRESH_TOKENS
-- Menyimpan sesi refresh token untuk mendukung rotasi & pencabutan akses (logout)
-- ============================================================================
CREATE TABLE refresh_tokens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE COMMENT 'SHA-256 hash dari refresh token',
    user_agent VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_refresh_tokens_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. TABEL PASSWORD_RESETS
-- Menyimpan token reset password dengan masa berlaku singkat
-- ============================================================================
CREATE TABLE password_resets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_password_resets_user (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. TABEL ALBUMS
-- Mengelompokkan foto di dalam satu angkatan (contoh: Ospek, KKN, Wisuda, Seminar)
-- ============================================================================
CREATE TABLE albums (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    angkatan_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_albums_angkatan_slug UNIQUE (angkatan_id, slug),
    CONSTRAINT fk_albums_angkatan
        FOREIGN KEY (angkatan_id) REFERENCES angkatan(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_albums_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_albums_angkatan (angkatan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. TABEL PHOTOS
-- Menyimpan metadata foto kenangan, integrasi Cloudinary, dan status moderasi
-- ============================================================================
CREATE TABLE photos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cloudinary_public_id VARCHAR(255) NOT NULL UNIQUE,
    url VARCHAR(500) NOT NULL,
    width INT UNSIGNED NULL,
    height INT UNSIGNED NULL,
    format VARCHAR(20) NULL,
    bytes INT UNSIGNED NULL,
    caption TEXT NOT NULL,
    tags VARCHAR(255) NULL COMMENT 'Tag dipisahkan koma, contoh: ospek,bandung,informatika',
    taken_date DATE NULL COMMENT 'Tanggal momen foto diambil',
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    rejection_reason VARCHAR(255) NULL,
    uploader_id INT UNSIGNED NOT NULL,
    angkatan_id INT UNSIGNED NOT NULL,
    album_id INT UNSIGNED NULL,
    moderated_by INT UNSIGNED NULL,
    moderated_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_photos_uploader
        FOREIGN KEY (uploader_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photos_angkatan
        FOREIGN KEY (angkatan_id) REFERENCES angkatan(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photos_album
        FOREIGN KEY (album_id) REFERENCES albums(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_photos_moderator
        FOREIGN KEY (moderated_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_photos_gallery_filter (angkatan_id, status, album_id, created_at DESC),
    INDEX idx_photos_moderation (status, created_at ASC),
    INDEX idx_photos_uploader (uploader_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. TABEL PHOTO_LIKES
-- Menyimpan daftar like per foto (1 user maksimal 1 like per foto)
-- ============================================================================
CREATE TABLE photo_likes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    photo_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_photo_likes_user UNIQUE (photo_id, user_id),
    CONSTRAINT fk_photo_likes_photo
        FOREIGN KEY (photo_id) REFERENCES photos(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_photo_likes_photo (photo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. TABEL PHOTO_COMMENTS
-- Menyimpan komentar pengguna pada foto
-- ============================================================================
CREATE TABLE photo_comments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    photo_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_photo_comments_photo
        FOREIGN KEY (photo_id) REFERENCES photos(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_photo_comments_photo_date (photo_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. TABEL PHOTO_REPORTS
-- Menyimpan laporan foto yang melanggar pedoman komunitas kampus
-- ============================================================================
CREATE TABLE photo_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    photo_id INT UNSIGNED NOT NULL,
    reporter_id INT UNSIGNED NOT NULL,
    reason ENUM('inappropriate', 'spam', 'harassment', 'copyright', 'other') NOT NULL,
    description TEXT NULL,
    status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
    resolved_by INT UNSIGNED NULL,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_photo_reports_user UNIQUE (photo_id, reporter_id),
    CONSTRAINT fk_photo_reports_photo
        FOREIGN KEY (photo_id) REFERENCES photos(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_reports_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_photo_reports_resolver
        FOREIGN KEY (resolved_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_photo_reports_status (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. TABEL ANNOUNCEMENTS
-- Menyimpan pengumuman resmi kampus (CRUD oleh Admin)
-- ============================================================================
CREATE TABLE announcements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    category ENUM('akademik', 'kemahasiswaan', 'alumni', 'beasiswa', 'umum') NOT NULL DEFAULT 'umum',
    excerpt VARCHAR(300) NOT NULL,
    content LONGTEXT NOT NULL,
    banner_url VARCHAR(500) NULL,
    banner_public_id VARCHAR(255) NULL,
    is_pinned TINYINT(1) NOT NULL DEFAULT 0,
    author_id INT UNSIGNED NULL,
    published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_announcements_author
        FOREIGN KEY (author_id) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_announcements_pinned_date (is_pinned DESC, published_at DESC),
    INDEX idx_announcements_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. TABEL EVENTS
-- Menyimpan agenda & kegiatan kampus (CRUD oleh Admin)
-- ============================================================================
CREATE TABLE events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(200) NOT NULL COMMENT 'Contoh: Aula Utama UNAS PASIM Jl. Dakota No. 8A Bandung',
    organizer VARCHAR(120) NOT NULL DEFAULT 'BEM UNAS PASIM',
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    registration_link VARCHAR(500) NULL,
    banner_url VARCHAR(500) NULL,
    banner_public_id VARCHAR(255) NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_events_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_events_dates (start_date ASC, end_date ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. TABEL EVENT_LIKES & EVENT_COMMENTS
-- Menyimpan interaksi like dan komentar pada agenda & kegiatan kampus
-- ============================================================================
CREATE TABLE event_likes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_event_user_like (event_id, user_id),
    CONSTRAINT fk_event_likes_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_event_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_event_likes_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event_comments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_comments_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_event_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_event_comments_event_date (event_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. TABEL NOTIFICATIONS
-- Menyimpan notifikasi real-time/in-app untuk pengguna (moderasi foto, komentar, like)
-- ============================================================================
CREATE TABLE notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type ENUM(
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
    ) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message VARCHAR(300) NOT NULL,
    reference_link VARCHAR(255) NULL COMMENT 'Route tujuan di frontend saat diklik, misal: /angkatan/2023?photo=4',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_notifications_user_unread (user_id, is_read, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. TABEL PENJADWALAN TUGAS PRIBADI, TIMER FOKUS, PENGINGAT & WEB PUSH
-- ============================================================================
CREATE TABLE IF NOT EXISTS tugas_pribadi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    kategori VARCHAR(100) NULL DEFAULT 'Belajar Mandiri',
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT NULL,
    prioritas ENUM('rendah', 'sedang', 'tinggi') NOT NULL DEFAULT 'sedang',
    status ENUM('belum_mulai', 'sedang_dikerjakan', 'selesai') NOT NULL DEFAULT 'belum_mulai',
    deadline_at DATETIME NULL,
    estimasi_menit INT UNSIGNED NULL,
    target_mulai DATETIME NULL,
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tp_user_status_deadline (user_id, status, deadline_at),
    INDEX idx_tp_deadline (status, deadline_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sesi_jadwal (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    tugas_id INT UNSIGNED NOT NULL,
    mulai_at DATETIME NOT NULL,
    durasi_menit INT UNSIGNED NOT NULL DEFAULT 50,
    status ENUM('terjadwal', 'selesai', 'dilewati', 'terlewat') NOT NULL DEFAULT 'terjadwal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sj_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sj_tugas FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id) ON DELETE CASCADE,
    INDEX idx_sj_user_mulai (user_id, mulai_at),
    INDEX idx_sj_status_mulai (status, mulai_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fokus_sesi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    tugas_id INT UNSIGNED NULL,
    sesi_jadwal_id INT UNSIGNED NULL,
    tipe ENUM('fokus', 'istirahat_pendek', 'istirahat_panjang') NOT NULL DEFAULT 'fokus',
    status ENUM('berjalan', 'dijeda', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'berjalan',
    mulai_at DATETIME NOT NULL,
    durasi_rencana_detik INT UNSIGNED NOT NULL,
    total_jeda_detik INT UNSIGNED NOT NULL DEFAULT 0,
    jeda_sejak DATETIME NULL,
    selesai_at DATETIME NULL,
    catatan VARCHAR(500) NULL,
    siklus_ke TINYINT UNSIGNED NOT NULL DEFAULT 1,
    active_user_lock INT UNSIGNED GENERATED ALWAYS AS (IF(status IN ('berjalan', 'dijeda'), user_id, NULL)) STORED,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fs_tugas FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id) ON DELETE SET NULL,
    CONSTRAINT fk_fs_jadwal FOREIGN KEY (sesi_jadwal_id) REFERENCES sesi_jadwal(id) ON DELETE SET NULL,
    UNIQUE KEY uq_fokus_sesi_active_user (active_user_lock),
    INDEX idx_fs_user_status (user_id, status),
    INDEX idx_fs_user_selesai (user_id, status, selesai_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    CONSTRAINT fk_fp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pengingat (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    tugas_id INT UNSIGNED NULL,
    sesi_jadwal_id INT UNSIGNED NULL,
    jenis ENUM('sesi_akan_mulai', 'sesi_mulai', 'deadline_h3', 'deadline_h1', 'deadline_3jam', 'sesi_terlewat') NOT NULL,
    kirim_at DATETIME NOT NULL,
    status ENUM('menunggu', 'terkirim', 'dibatalkan', 'gagal') NOT NULL DEFAULT 'menunggu',
    dikirim_at DATETIME NULL,
    dedupe_key VARCHAR(150) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pg_tugas FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id) ON DELETE CASCADE,
    CONSTRAINT fk_pg_jadwal FOREIGN KEY (sesi_jadwal_id) REFERENCES sesi_jadwal(id) ON DELETE CASCADE,
    UNIQUE KEY uq_pengingat_dedupe (dedupe_key),
    INDEX idx_pengingat_due (status, kirim_at),
    INDEX idx_pengingat_user (user_id, status, kirim_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NULL,
    CONSTRAINT fk_ps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_push_endpoint (endpoint),
    INDEX idx_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 15. TABEL POKER VIRTUAL HIBURAN (RIWAYAT RINGAN & LAPORAN PEMAIN)
-- ============================================================================
CREATE TABLE IF NOT EXISTS poker_riwayat (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id CHAR(6) NOT NULL,
    mulai_at DATETIME NOT NULL,
    selesai_at DATETIME NOT NULL,
    pemain JSON NOT NULL,
    pemenang_user_id INT UNSIGNED NULL,
    jumlah_tangan INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pri_winner FOREIGN KEY (pemenang_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_pri_selesai (selesai_at DESC),
    INDEX idx_pri_winner (pemenang_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poker_laporan (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id CHAR(6) NOT NULL,
    reporter_id INT UNSIGNED NOT NULL,
    reported_user_id INT UNSIGNED NOT NULL,
    reason ENUM('harassment', 'inappropriate', 'spam', 'cheating', 'other') NOT NULL DEFAULT 'other',
    description VARCHAR(500) NULL,
    status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_plap_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_plap_reported FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_plap_status (status, created_at DESC),
    INDEX idx_plap_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

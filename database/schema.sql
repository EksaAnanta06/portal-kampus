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

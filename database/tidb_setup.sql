-- ============================================================================
-- FILE: database/tidb_setup.sql
-- DESKRIPSI: SKRIP GABUNGAN LENGKAP SETUP DATABASE PORTAL KAMPUS UNAS PASIM
-- COCOK UNTUK: TiDB Cloud Serverless / MySQL 8.0+
-- PANDUAN PENTING DI TIDB CLOUD SQL EDITOR:
--   1. Salin seluruh isi file ini (Ctrl+A -> Ctrl+C).
--   2. Tempel ke SQL Editor TiDB Cloud.
--   3. TEKAN: Shift + Ctrl + Enter (atau klik panah di samping tombol RUN -> pilih "Run All").
--      *JANGAN hanya klik RUN biasa karena hanya menjalankan 1 baris kursor.*
-- ============================================================================

CREATE DATABASE IF NOT EXISTS db_portal_pasim
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_portal_pasim;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. STRUKTUR TABEL UTAMA (schema.sql)
-- ----------------------------------------------------------------------------
-- ============================================================================
-- FILE: database/schema.sql
-- DESKRIPSI: Skema Database Portal Kampus Universitas Nasional Pasim Bandung
-- ENGINE: MySQL 8.0+ (InnoDB, utf8mb4)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS db_portal_pasim
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;




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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fs_tugas FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id) ON DELETE SET NULL,
    CONSTRAINT fk_fs_jadwal FOREIGN KEY (sesi_jadwal_id) REFERENCES sesi_jadwal(id) ON DELETE SET NULL,
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

-- ----------------------------------------------------------------------------
-- 2. STRUKTUR TABEL MODUL MATERI & PRODI (001_peer_materials_library_up.sql)
-- ----------------------------------------------------------------------------
-- ============================================================================
-- MIGRATION 001 (UP): Modul A — Perpustakaan Materi (Peer-to-Peer)
-- Jalankan setelah database/schema.sql pada database baru.
-- ============================================================================



-- 1. Master Program Studi
CREATE TABLE IF NOT EXISTS prodi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(20) NOT NULL UNIQUE COMMENT 'Contoh: TIF, SI, MNJ, AKT',
    nama VARCHAR(100) NOT NULL COMMENT 'Contoh: Teknik Informatika',
    jenjang ENUM('D3', 'S1', 'S2') NOT NULL DEFAULT 'S1',
    fakultas VARCHAR(100) NOT NULL DEFAULT 'Fakultas Ilmu Komputer & Desain',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Master Mata Kuliah (Kurikulum Semester 1-8)
CREATE TABLE IF NOT EXISTS mata_kuliah (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(20) NOT NULL UNIQUE COMMENT 'Contoh: IF1101, IF3105',
    nama VARCHAR(150) NOT NULL COMMENT 'Contoh: Dasar Pemrograman & Logika',
    sks TINYINT UNSIGNED NOT NULL DEFAULT 3,
    prodi_id INT UNSIGNED NULL,
    semester_rekomendasi TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Semester kurikulum 1 s.d. 8',
    deskripsi TEXT NULL,
    status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved' COMMENT 'Pending jika diusulkan mahasiswa',
    proposed_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mk_prodi
        FOREIGN KEY (prodi_id) REFERENCES prodi(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_mk_proposer
        FOREIGN KEY (proposed_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_mk_prodi_sem (prodi_id, semester_rekomendasi),
    INDEX idx_mk_status_prodi_sem (status, prodi_id, semester_rekomendasi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Entitas Materi Utama (Peer-to-Peer)
CREATE TABLE IF NOT EXISTS materi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mata_kuliah_id INT UNSIGNED NOT NULL,
    uploaded_by INT UNSIGNED NOT NULL,
    judul VARCHAR(255) NOT NULL,
    tipe_materi ENUM(
        'ringkasan_catatan',
        'slide',
        'modul',
        'soal_latihan',
        'video',
        'kode_referensi',
        'tips_belajar',
        'lainnya'
    ) NOT NULL DEFAULT 'ringkasan_catatan',
    deskripsi TEXT NULL,
    tags VARCHAR(255) NULL COMMENT 'Kata kunci / tagar terpisah koma',
    tahun_akademik VARCHAR(20) NULL COMMENT 'Contoh: 2025/2026',
    angkatan_kontributor VARCHAR(10) NULL COMMENT 'Contoh: 2021',
    dosen_pengampu_teks VARCHAR(150) NULL COMMENT 'Metadata teks opsional konteks kelas dosen',
    sumber_kredit VARCHAR(255) NULL COMMENT 'Kredit sumber asli materi',
    external_url VARCHAR(500) NULL COMMENT 'Link YouTube, link Repo GitHub, dsb',
    youtube_video_id VARCHAR(50) NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM('pending', 'approved', 'rejected', 'takedown') NOT NULL DEFAULT 'pending',
    moderated_by INT UNSIGNED NULL,
    moderated_at TIMESTAMP NULL,
    moderation_note TEXT NULL,
    view_count INT UNSIGNED NOT NULL DEFAULT 0,
    download_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mat_course
        FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_mat_uploader
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mat_moderator
        FOREIGN KEY (moderated_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_mat_status_course (status, mata_kuliah_id),
    INDEX idx_mat_status_pub_created (status, is_published, created_at DESC),
    INDEX idx_mat_course_status_pub (mata_kuliah_id, status, is_published),
    INDEX idx_mat_uploader (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Berkas Lampiran Materi (Satu materi boleh punya banyak file)
CREATE TABLE IF NOT EXISTS materi_file (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materi_id INT UNSIGNED NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT UNSIGNED NOT NULL DEFAULT 0,
    file_format VARCHAR(20) NULL,
    urutan INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mf_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    INDEX idx_mf_materi (materi_id, urutan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Riwayat Versi Berkas Materi
CREATE TABLE IF NOT EXISTS materi_version (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materi_id INT UNSIGNED NOT NULL,
    version_num INT UNSIGNED NOT NULL DEFAULT 1,
    file_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT UNSIGNED NULL,
    file_format VARCHAR(20) NULL,
    changelog_note VARCHAR(255) NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mv_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mv_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_mv_materi_ver (materi_id, version_num DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Vote Bermanfaat (Helpful Votes: 1 vote per user)
CREATE TABLE IF NOT EXISTS materi_vote (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materi_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mvote_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mvote_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_materi_user_vote (materi_id, user_id),
    INDEX idx_mvote_materi (materi_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Komentar & Diskusi Tanya Jawab Materi
CREATE TABLE IF NOT EXISTS materi_komentar (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materi_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    parent_id INT UNSIGNED NULL,
    konten TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mkom_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mkom_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mkom_parent
        FOREIGN KEY (parent_id) REFERENCES materi_komentar(id)
        ON DELETE CASCADE,
    INDEX idx_mkom_materi_date (materi_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Koleksi Saya (Bookmark Materi)
CREATE TABLE IF NOT EXISTS materi_koleksi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    nama VARCHAR(100) NOT NULL COMMENT 'Contoh: Persiapan UTS Algoritma',
    deskripsi VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mkol_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_mkol_user (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materi_koleksi_item (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    koleksi_id INT UNSIGNED NOT NULL,
    materi_id INT UNSIGNED NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mki_koleksi
        FOREIGN KEY (koleksi_id) REFERENCES materi_koleksi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mki_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_koleksi_materi (koleksi_id, materi_id),
    INDEX idx_mki_materi (materi_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Papan "Minta Materi"
CREATE TABLE IF NOT EXISTS materi_request (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    mata_kuliah_id INT UNSIGNED NOT NULL,
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT NULL,
    tipe_materi_diminta VARCHAR(50) NULL,
    is_fulfilled TINYINT(1) NOT NULL DEFAULT 0,
    fulfilled_materi_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mreq_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mreq_matkul
        FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mreq_materi
        FOREIGN KEY (fulfilled_materi_id) REFERENCES materi(id)
        ON DELETE SET NULL,
    INDEX idx_mreq_status_created (is_fulfilled, created_at DESC),
    INDEX idx_mreq_course (mata_kuliah_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Paket Belajar Semester (Kurasi Moderator/Admin)
CREATE TABLE IF NOT EXISTS paket_belajar (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prodi_id INT UNSIGNED NOT NULL,
    semester TINYINT UNSIGNED NOT NULL COMMENT '1 sampai 8',
    judul VARCHAR(150) NOT NULL COMMENT 'Contoh: Starter Pack Semester 1 Teknik Informatika',
    deskripsi TEXT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pb_prodi
        FOREIGN KEY (prodi_id) REFERENCES prodi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pb_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_pb_prodi_sem (prodi_id, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paket_belajar_item (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paket_belajar_id INT UNSIGNED NOT NULL,
    materi_id INT UNSIGNED NOT NULL,
    urutan INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_pbi_paket
        FOREIGN KEY (paket_belajar_id) REFERENCES paket_belajar(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pbi_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_paket_materi (paket_belajar_id, materi_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Pelaporan Materi & Takedown
CREATE TABLE IF NOT EXISTS materi_laporan (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materi_id INT UNSIGNED NOT NULL,
    reporter_id INT UNSIGNED NOT NULL,
    alasan ENUM('hak_cipta', 'konten_salah_menyesatkan', 'tidak_pantas', 'spam', 'lainnya') NOT NULL,
    deskripsi TEXT NULL,
    status ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
    handled_by INT UNSIGNED NULL,
    handled_at TIMESTAMP NULL,
    action_taken ENUM('none', 'takedown', 'dismissed') NOT NULL DEFAULT 'none',
    takedown_note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mlap_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mlap_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mlap_handler
        FOREIGN KEY (handled_by) REFERENCES users(id)
        ON DELETE SET NULL,
    UNIQUE KEY uq_materi_reporter (materi_id, reporter_id),
    INDEX idx_mlap_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 3. DATA AWAL AKUN & ANGKATAN (seed.sql)
-- ----------------------------------------------------------------------------
-- ============================================================================
-- FILE: database/seed.sql
-- DESKRIPSI: Data Awal (Seeder) Portal Kampus UNAS PASIM Bandung
-- CATATAN LOGIN DEMO:
--   Password default seluruh akun di bawah: Pasim123!
--   1. Admin     : admin@pasim.ac.id        | NIM: ADM-001
--   2. Moderator : moderator@pasim.ac.id    | NIM: MOD-202201
--   3. Alumni    : dinda.alumni@pasim.ac.id | NIM: 020122001 (Angkatan 2022)
--   4. Mahasiswa : rizky.mhs@pasim.ac.id    | NIM: 020123014 (Angkatan 2023)
--   5. Mahasiswa : nadia.mhs@pasim.ac.id    | NIM: 020224008 (Angkatan 2024)
--   6. Pending   : farhan.baru@pasim.ac.id  | NIM: 020125099 (Status: Pending Verifikasi)
-- ============================================================================



-- 1. SEED ANGKATAN (2022 - 2025)
INSERT INTO angkatan (id, year, title, description, cover_url, cover_public_id, is_active) VALUES
(1, 2022, 'Angkatan 2022 — Prawira Sankara', 'Generasi bangkit pasca-pandemi yang memelopori transformasi digital kegiatan mahasiswa di Kampus Dakota UNAS PASIM Bandung.', 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80', 'seed/angkatan-2022-cover', 1),
(2, 2023, 'Angkatan 2023 — Nawasena Karsa', 'Angkatan penuh kolaborasi lintas fakultas, aktif dalam riset teknologi, kompetisi nasional, dan pengabdian masyarakat di Jawa Barat.', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80', 'seed/angkatan-2023-cover', 1),
(3, 2024, 'Angkatan 2024 — Adikara Pradipa', 'Semangat baru sivitas akademika UNAS PASIM dengan kreativitas tinggi di bidang teknologi informasi, ekonomi kreatif, dan budaya.', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80', 'seed/angkatan-2024-cover', 1),
(4, 2025, 'Angkatan 2025 — Cakrawala Muda', 'Tunas muda Universitas Nasional Pasim Bandung yang siap mengukir prestasi akademik dan kenangan kebersamaan.', 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80', 'seed/angkatan-2025-cover', 1);

-- 2. SEED USERS
-- Catatan: Hash bcrypt di bawah dihasilkan dari plaintext "Pasim123!"
INSERT INTO users (
    id, nim, full_name, email, password_hash, role, status, prodi, angkatan_year,
    avatar_url, bio, current_job, linkedin_url, instagram_url, github_url, is_public_profile, verified_at, verified_by
) VALUES
(1, 'ADM-001', 'Dr. Hendra Wijaya, M.Kom.', 'admin@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'admin', 'active', 'S1 Teknik Informatika', NULL,
 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
 'Administrator Sistem & Kemahasiswaan Universitas Nasional Pasim Bandung.', 'Kepala Puskom UNAS PASIM', 'https://linkedin.com', 'https://instagram.com', NULL, 1, NOW(), 1),

(2, 'MOD-202201', 'Gilang Ramadhan', 'moderator@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'moderator', 'active', 'S1 Sistem Informasi', 2022,
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
 'Pengurus BEM & Moderator Dokumentasi Portal Kampus UNAS PASIM.', 'Asisten Laboratorium Komputer', 'https://linkedin.com', 'https://instagram.com', 'https://github.com', 1, NOW(), 1),

(3, '020122001', 'Dinda Kirana Putri, S.Kom.', 'dinda.alumni@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'alumni', 'active', 'S1 Teknik Informatika', 2022,
 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
 'Lulusan terbaik Fasilkom UNAS PASIM. Senang berbagi cerita seputar karier software engineering.', 'Software Engineer di PT Telkom Indonesia', 'https://linkedin.com', 'https://instagram.com', 'https://github.com', 1, NOW(), 1),

(4, '020123014', 'Rizky Pratama Nugraha', 'rizky.mhs@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'mahasiswa', 'active', 'S1 Teknik Informatika', 2023,
 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
 'Mahasiswa aktif semester 5, hobi fotografi jalanan dan pengembangan web.', 'Freelance Web Developer', 'https://linkedin.com', 'https://instagram.com', 'https://github.com', 1, NOW(), 1),

(5, '020224008', 'Nadia Aulia Zahra', 'nadia.mhs@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'mahasiswa', 'active', 'S1 Manajemen', 2024,
 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
 'Aktif di Himpunan Mahasiswa Manajemen dan UKM Kesenian Pasim.', NULL, 'https://linkedin.com', 'https://instagram.com', NULL, 1, NOW(), 1),

(6, '020125099', 'Farhan Akbar Maulana', 'farhan.baru@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'mahasiswa', 'pending', 'S1 Psikologi', 2025,
 NULL, 'Mahasiswa baru Fakultas Psikologi UNAS PASIM 2025.', NULL, NULL, NULL, NULL, 1, NULL, NULL);

-- 3. SEED ALBUMS PER ANGKATAN
INSERT INTO albums (id, angkatan_id, name, slug, description, created_by) VALUES
(1, 1, 'Ospek & PKKMB', 'ospek-pkkmb', 'Kenangan masa pengenalan kehidupan kampus mahasiswa baru 2022', 1),
(2, 1, 'KKN Tematik', 'kkn-tematik', 'Dokumentasi pengabdian masyarakat mahasiswa 2022 di Kabupaten Bandung', 1),
(3, 1, 'Wisuda & Yudisium', 'wisuda-yudisium', 'Momen bahagia kelulusan dan pelepasan wisudawan', 1),
(4, 2, 'Ospek & PKKMB', 'ospek-pkkmb', 'PKKMB Angkatan 2023 di Kampus Dakota', 1),
(5, 2, 'Seminar & Workshop', 'seminar-workshop', 'Kegiatan akademik, hackathon, dan kuliah umum', 2),
(6, 2, 'Makrab & UKM', 'makrab-ukm', 'Malam keakraban dan kegiatan unit kegiatan mahasiswa', 2),
(7, 3, 'Ospek & PKKMB', 'ospek-pkkmb', 'Penyambutan mahasiswa baru Angkatan 2024', 1),
(8, 3, 'Praktikum & Lab', 'praktikum-lab', 'Suasana belajar di laboratorium komputer dan bahasa', 1),
(9, 4, 'Ospek & PKKMB', 'ospek-pkkmb', 'Momen perdana mahasiswa baru Angkatan 2025 di UNAS PASIM', 1);

-- 4. SEED PHOTOS (APPROVED & PENDING)
INSERT INTO photos (
    id, cloudinary_public_id, url, width, height, format, bytes, caption, tags,
    taken_date, status, uploader_id, angkatan_id, album_id, moderated_by, moderated_at
) VALUES
(5, 'seed/pasim-2022-wisuda-1', 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 420150,
 'Momen lempar toga bersama rekan-rekan S1 Teknik Informatika usai Sidang Senat Terbuka Wisuda UNAS PASIM Bandung.', 'wisuda,informatika,toga,2022',
 '2025-10-18', 'approved', 3, 1, 3, 1, NOW()),

(6, 'seed/pasim-2022-kkn-1', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 385000,
 'Tim KKN Kelompok 4 Desa Ciburial setelah menyelesaikan program literasi digital untuk UMKM warga desa.', 'kkn,pengabdian,ciburial,2022',
 '2025-02-12', 'approved', 2, 1, 2, 1, NOW()),

(7, 'seed/pasim-2023-seminar-1', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 512000,
 'Antusiasme peserta Seminar Nasional AI & Cloud Computing di Aula Utama Kampus Dakota No. 8A Sukaraja, Bandung.', 'seminar,ai,teknologi,aula',
 '2025-05-20', 'approved', 4, 2, 5, 2, NOW()),

(8, 'seed/pasim-2023-makrab-1', 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 460200,
 'Api unggun dan malam keakraban Himpunan Mahasiswa Teknik Informatika (HIMATIF) di Lembang.', 'makrab,himatif,lembang,2023',
 '2024-11-09', 'approved', 4, 2, 6, 1, NOW()),

(9, 'seed/pasim-2024-ospek-1', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 398100,
 'Diskusi kelompok lintas jurusan saat kegiatan PKKMB UNAS PASIM 2024 hari kedua.', 'pkkmb,ospek,mabapasim,2024',
 '2024-09-14', 'approved', 5, 3, 7, 2, NOW()),

(10, 'seed/pasim-2024-lab-1', 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 410000,
 'Kolaborasi tim penyusunan proyek akhir mata kuliah Pemrograman Web & Basis Data.', 'praktikum,koding,lab',
 '2025-04-03', 'approved', 5, 3, 8, 1, NOW()),

(11, 'seed/pasim-2025-ospek-1', 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 440900,
 'Foto bersama gugus Garuda seusai upacara pembukaan PKKMB Mahasiswa Baru Angkatan 2025.', 'ospek,maba2025,pasimbandung',
 '2025-09-10', 'approved', 2, 4, 9, 1, NOW()),

(12, 'seed/pasim-2023-pending-1', 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1080&q=80', 1080, 720, 'jpg', 350000,
 'Persiapan panitia bazaar kewirausahaan mahasiswa di halaman depan kampus (Menunggu persetujuan moderator).', 'bazaar,wirausaha,kampus',
 '2026-10-25', 'pending', 4, 2, 5, NULL, NULL);

-- 5. SEED PHOTO LIKES (mereferensikan photos.id = 5, 6, 7, 9 yang valid)
INSERT INTO photo_likes (photo_id, user_id) VALUES
(5, 1), (5, 2), (5, 4), (5, 5),
(6, 1), (6, 3), (6, 4),
(7, 1), (7, 2), (7, 3), (7, 5),
(9, 2), (9, 4);

-- 6. SEED PHOTO COMMENTS (mereferensikan photos.id = 5, 7, 9)
INSERT INTO photo_comments (id, photo_id, user_id, content) VALUES
(1, 5, 4, 'Selamat Kak Dinda dan teman-teman Angkatan 2022! Semoga sukses selalu di dunia kerja.'),
(2, 5, 3, 'Terima kasih banyak Rizky! Semangat terus kuliahnya sampai wisuda nanti ya.'),
(3, 7, 2, 'Acara kemarin seru banget, pematerinya daging semua. Ditunggu workshop lanjutannya!'),
(4, 9, 5, 'Kangen banget suasana PKKMB hari pertama kenal teman-teman seangkatan!');

-- 7. SEED ANNOUNCEMENTS
INSERT INTO announcements (id, title, slug, category, excerpt, content, banner_url, is_pinned, author_id, published_at) VALUES
(2, 'Pendaftaran Wisuda & Yudisium Semester Ganjil Tahun Akademik 2026/2027',
 'pendaftaran-wisuda-yudisium-ganjil-2026-2027', 'akademik',
 'Informasi jadwal, persyaratan berkas bebas pustaka, dan pengumpulan foto ijazah bagi calon wisudawan UNAS PASIM Bandung.',
 'Diberitahukan kepada seluruh mahasiswa tingkat akhir Universitas Nasional Pasim Bandung bahwa pendaftaran Yudisium dan Wisuda telah dibuka.\n\nPersyaratan Utama:\n1. Telah dinyatakan lulus sidang Tugas Akhir/Skripsi.\n2. Melampirkan surat bebas administrasi keuangan dan perpustakaan.\n3. Mengunggah dokumentasi kenangan angkatan di Portal Kampus UNAS PASIM.\n\nSilakan menghubungi bagian BAAK di Kampus Jl. Dakota No. 8A Sukaraja, Cicendo, Kota Bandung untuk verifikasi fisik.',
 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80', 1, 1, NOW() - INTERVAL 3 DAY),

(3, 'Peluncuran Resmi Portal Galeri Kenangan & Jejaring Alumni UNAS PASIM',
 'peluncuran-portal-galeri-kenangan-dan-alumni-pasim', 'alumni',
 'Wadah resmi berbagi dokumentasi per angkatan serta direktori jejaring profesional mahasiswa dan alumni.',
 'Pusat Komputer bersama Bagian Kemahasiswaan & Alumni resmi meluncurkan Portal Kampus UNAS PASIM.\n\nMelalui portal ini, setiap angkatan dapat mengarsipkan foto kegiatan mulai dari PKKMB/Ospek, Praktikum, Makrab, KKN, hingga Wisuda secara terorganisir dalam album digital.\n\nSeluruh unggahan akan melalui proses kurasi/moderasi singkat untuk menjaga kenyamanan dan nama baik sivitas akademika.',
 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80', 1, 1, NOW() - INTERVAL 7 DAY),

(4, 'Beasiswa Prestasi Akademik & Aktivis Organisasi Mahasiswa 2026',
 'beasiswa-prestasi-akademik-dan-aktivis-2026', 'beasiswa',
 'Program apresiasi beasiswa potongan UKT bagi mahasiswa berprestasi akademik maupun non-akademik.',
 'Universitas Nasional Pasim membuka kesempatan Beasiswa Prestasi bagi mahasiswa aktif minimal semester 3 dari seluruh Program Studi (Teknik Informatika, Sistem Informasi, Manajemen, Akuntansi, Psikologi, dan Sastra Jepang).\n\nBatas akhir pengumpulan berkas di Ruang Kemahasiswaan adalah tanggal 30 setiap akhir semester.',
 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80', 0, 1, NOW() - INTERVAL 10 DAY);

-- 8. SEED EVENTS
INSERT INTO events (id, title, description, location, organizer, start_date, end_date, registration_link, created_by) VALUES
(1, 'PASIM Tech & Career Expo 2026',
 'Bursa kerja, pameran karya inovasi mahasiswa Fasilkom, serta talkshow karier bersama alumni UNAS PASIM yang berkarier di industri teknologi nasional.',
 'Aula Utama Kampus UNAS PASIM, Jl. Dakota No. 8A Bandung',
 'Pusat Karier & Ikatan Alumni PASIM',
 DATE_ADD(NOW(), INTERVAL 7 DAY),
 DATE_ADD(NOW(), INTERVAL 8 DAY),
 'https://pasim.ac.id/career-expo', 1),

(2, 'Malam Reuni Akbar & Temu Kangen Lintas Angkatan',
 'Acara silaturahmi tahunan mahasiswa aktif dan alumni lintas angkatan disertai pameran foto kenangan terbaik dari galeri portal kampus.',
 'Lapangan Utama & Auditorium UNAS PASIM Bandung',
 'BEM & Ikatan Alumni UNAS PASIM',
 DATE_ADD(NOW(), INTERVAL 21 DAY),
 DATE_ADD(NOW(), INTERVAL 21 DAY),
 'https://pasim.ac.id/reuni-akbar', 1),

(3, 'Workshop Fullstack Web Development & Cloud Deployment',
 'Pelatihan intensif membangun aplikasi web modern dengan React, Express, MySQL, dan Cloudinary bagi mahasiswa semester awal dan menengah.',
 'Laboratorium Komputer Terpadu Lt. 3 UNAS PASIM',
 'HIMATIF & HMSI UNAS PASIM',
 DATE_ADD(NOW(), INTERVAL 14 DAY),
 DATE_ADD(NOW(), INTERVAL 14 DAY),
 'https://pasim.ac.id/workshop-web', 2);

-- 9. SEED NOTIFICATIONS
INSERT INTO notifications (user_id, type, title, message, reference_link, is_read) VALUES
(3, 'photo_approved', 'Foto Disetujui Moderator', 'Foto "Momen lempar toga bersama rekan-rekan..." telah disetujui dan tampil di Galeri Angkatan 2022.', '/angkatan/2022', 0),
(3, 'new_comment', 'Komentar Baru pada Foto Anda', 'Rizky Pratama Nugraha mengomentari foto wisuda Anda.', '/angkatan/2022', 0),
(4, 'photo_approved', 'Foto Disetujui Moderator', 'Foto "Antusiasme peserta Seminar Nasional AI..." telah tayang di Galeri Angkatan 2023.', '/angkatan/2023', 1);

-- ----------------------------------------------------------------------------
-- 4. DATA MASTER PRODI, MATA KULIAH & MODUL MATERI (peer_materials_seed.sql)
-- ----------------------------------------------------------------------------
-- ============================================================================
-- SEEDER: Data Awal Modul Materi Perpustakaan (Peer-to-Peer)
-- Diselaraskan dengan Kurikulum & Jadwal UTS Semester Ganjil 2026/2027
-- Universitas Nasional Pasim Bandung
-- Idempoten (aman dijalankan pada DB baru maupun DB existing dengan INSERT IGNORE)
-- ============================================================================



-- 1. MASTER PROGRAM STUDI (Sinkron dengan PRODI_LIST & Jadwal UTS 2026/2027)
INSERT IGNORE INTO prodi (id, kode, nama, jenjang, fakultas) VALUES
(1, 'TIF', 'S1 Teknik Informatika', 'S1', 'Fakultas Ilmu Komputer & Desain'),
(2, 'SI', 'S1 Sistem Informasi', 'S1', 'Fakultas Ilmu Komputer & Desain');

INSERT IGNORE INTO prodi (kode, nama, jenjang, fakultas) VALUES
('MI', 'D3 Manajemen Informatika', 'D3', 'Fakultas Ilmu Komputer & Desain'),
('MNJ', 'S1 Manajemen', 'S1', 'Fakultas Ekonomi & Bisnis'),
('AKT', 'S1 Akuntansi', 'S1', 'Fakultas Ekonomi & Bisnis'),
('TIN', 'S1 Teknik Industri', 'S1', 'Fakultas Teknik'),
('PSI', 'S1 Psikologi', 'S1', 'Fakultas Psikologi'),
('SASJAP', 'S1 Sastra Jepang', 'S1', 'Fakultas Sastra'),
('SASING', 'S1 Sastra Inggris', 'S1', 'Fakultas Sastra'),
('KOM', 'S1 Ilmu Komunikasi', 'S1', 'Fakultas Ilmu Sosial & Humaniora');

SET @prodi_tif    = (SELECT id FROM prodi WHERE kode = 'TIF' LIMIT 1);
SET @prodi_si     = (SELECT id FROM prodi WHERE kode = 'SI' LIMIT 1);
SET @prodi_mi     = (SELECT id FROM prodi WHERE kode = 'MI' LIMIT 1);
SET @prodi_mnj    = (SELECT id FROM prodi WHERE kode = 'MNJ' LIMIT 1);
SET @prodi_akt    = (SELECT id FROM prodi WHERE kode = 'AKT' LIMIT 1);
SET @prodi_tin    = (SELECT id FROM prodi WHERE kode = 'TIN' LIMIT 1);
SET @prodi_psi    = (SELECT id FROM prodi WHERE kode = 'PSI' LIMIT 1);
SET @prodi_sasjap = (SELECT id FROM prodi WHERE kode = 'SASJAP' LIMIT 1);
SET @prodi_sasing = (SELECT id FROM prodi WHERE kode = 'SASING' LIMIT 1);
SET @prodi_kom    = (SELECT id FROM prodi WHERE kode = 'KOM' LIMIT 1);

-- 2. MASTER MATA KULIAH (Kurikulum Inti + Sampel Mata Kuliah UTS Ganjil 2026/2027)
INSERT IGNORE INTO mata_kuliah (kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status) VALUES
-- S1 Teknik Informatika (TIF)
('IF1101', 'Dasar Pemrograman & Logika', 3, @prodi_tif, 1, 'Pengenalan logika algoritma, tipe data, percabangan, perulangan, dan fungsi.', 'approved'),
('IF1102', 'Matematika Diskrit', 3, @prodi_tif, 1, 'Himpunan, logika proposisional, relasi fungsi, dan graf.', 'approved'),
('IF1103', 'Pengantar Teknologi Informasi', 2, @prodi_tif, 1, 'Konsep sistem komputer, hardware, software, dan internet (PTI TI).', 'approved'),
('IF1201', 'Struktur Data & Algoritma', 3, @prodi_tif, 2, 'Array, stack, queue, linked list, tree, graph, sorting & searching.', 'approved'),
('IF1202', 'Arsitektur & Organisasi Komputer', 3, @prodi_tif, 2, 'Struktur CPU, memori, instruksi set, dan pipeline (ORKOM).', 'approved'),
('IF2101', 'Pemrograman Berorientasi Objek', 3, @prodi_tif, 3, 'OOP, class, object, inheritance, polymorphism, encapsulation.', 'approved'),
('IF2102', 'Sistem Basis Data', 3, @prodi_tif, 3, 'Model data relasional, ERD, normalisasi, dan SQL query (Basis Data TI).', 'approved'),
('IF2103', 'Grafika Komputer', 3, @prodi_tif, 3, 'Primitif grafika 2D/3D, transformasi geometri, rasterisasi, dan animasi komputer.', 'approved'),
('IF2201', 'Pemrograman Web Lanjut', 3, @prodi_tif, 4, 'Full-stack web modern, REST API, Node.js, Express, dan React.', 'approved'),
('IF2202', 'Rekayasa Perangkat Lunak', 3, @prodi_tif, 4, 'SDLC, Agile Scrum, requirement analysis, UML, dan software testing.', 'approved'),
('IF3101', 'Kecerdasan Buatan', 3, @prodi_tif, 5, 'Search algorithm, machine learning dasar, neural network, dan NLP.', 'approved'),
('IF3102', 'Jaringan Komputer & Keamanan', 3, @prodi_tif, 5, 'OSI Layer, TCP/IP, subnetting, routing, firewall, dan kriptografi.', 'approved'),
('IF3103', 'Sistem Pakar', 3, @prodi_tif, 5, 'Representasi pengetahuan, forward & backward chaining, dan certainty factor.', 'approved'),
('IF3104', 'Teori Bahasa & Automata', 3, @prodi_tif, 5, 'Finite automata (DFA/NFA), ekspresi reguler, CFG, dan mesin Turing.', 'approved'),
('IF3201', 'Pengembangan Aplikasi Mobile', 3, @prodi_tif, 6, 'Android, React Native/Flutter, state management, dan mobile UI.', 'approved'),
('IF4101', 'Metodologi Penelitian & Skripsi', 2, @prodi_tif, 7, 'Penyusunan proposal skripsi, kajian literatur, dan etika penelitian.', 'approved'),
('IF4102', 'Kapita Selekta Informatika', 2, @prodi_tif, 7, 'Kajian topik mutakhir teknologi informasi, AI terapan, dan studi kasus industri.', 'approved'),
('IF4201', 'Tugas Akhir / Skripsi', 6, @prodi_tif, 8, 'Implementasi dan sidang tugas akhir kesarjanaan.', 'approved'),

-- S1 Sistem Informasi (SI)
('SI1101', 'Pengantar Sistem Informasi', 3, @prodi_si, 1, 'Konsep dasar sistem informasi dalam organisasi dan proses bisnis.', 'approved'),
('SI1102', 'Konsep Sistem Informasi (KSI)', 3, @prodi_si, 1, 'Komponen SI, sistem informasi manajemen, transaksi, dan pengambilan keputusan.', 'approved'),
('SI2101', 'Analisis & Perancangan Sistem', 3, @prodi_si, 3, 'DFD, UML, BPMN, dan analisis kebutuhan sistem informasi bisnis.', 'approved'),
('SI2102', 'Pengantar Basis Data & DBMS', 3, @prodi_si, 3, 'Perancangan skema relasional, query SQL, dan administrasi DBMS.', 'approved'),
('SI3101', 'APSI Berorientasi Objek', 3, @prodi_si, 5, 'Analisis dan perancangan sistem berorientasi objek dengan UML terapan.', 'approved'),
('SI3102', 'E-Commerce', 3, @prodi_si, 5, 'Model bisnis digital, marketplace, payment gateway, dan strategi pemasaran daring.', 'approved'),

-- D3 Manajemen Informatika (MI)
('MI1101', 'Pengantar Teknologi Informasi (MI)', 2, @prodi_mi, 1, 'Pengenalan perangkat keras, perangkat lunak, jaringan, dan aplikasi perkantoran.', 'approved'),
('MI1102', 'Algoritma & Pemrograman (MI)', 3, @prodi_mi, 1, 'Dasar algoritma terstruktur, flowchart, pseudocode, dan implementasi kode.', 'approved'),
('MI2101', 'Pemrograman Web I (MI)', 3, @prodi_mi, 3, 'HTML5, CSS3, tata letak responsif, dan dasar JavaScript sisi klien.', 'approved'),
('MI2102', 'Pemrograman Visual & Java (VB III MI)', 3, @prodi_mi, 3, 'Pengembangan aplikasi desktop berorientasi objek berbasis Java GUI.', 'approved'),
('MI3101', 'Sistem Informasi Manajemen (MI)', 3, @prodi_mi, 5, 'Pemanfaatan sistem informasi dan manajemen data untuk operasional perusahaan.', 'approved'),

-- S1 Manajemen (MNJ)
('MN1101', 'Pengantar Manajemen & Bisnis', 3, @prodi_mnj, 1, 'Prinsip POAC manajemen, kepemimpinan, dan fungsi dasar perusahaan.', 'approved'),
('MN1102', 'Pengantar Bisnis', 3, @prodi_mnj, 1, 'Bentuk badan usaha, kewirausahaan, operasional, dan etika bisnis dasar.', 'approved'),
('MN2101', 'Manajemen Sumber Daya Manusia I', 3, @prodi_mnj, 3, 'Rekrutmen, seleksi, pelatihan, penilaian kinerja, dan kompensasi karyawan.', 'approved'),
('MN2102', 'Manajemen Keuangan I', 3, @prodi_mnj, 3, 'Nilai waktu uang, analisis laporan keuangan, dan manajemen modal kerja.', 'approved'),
('MN3101', 'Manajemen Pemasaran II', 3, @prodi_mnj, 5, 'Strategi bauran pemasaran, segmentasi pasar, merek, dan pemasaran digital.', 'approved'),
('MN4101', 'Manajemen Stratejik', 3, @prodi_mnj, 7, 'Analisis SWOT, keunggulan kompetitif Porter, dan perumusan strategi korporasi.', 'approved'),

-- S1 Akuntansi (AKT)
('AK1101', 'Pengantar Akuntansi 1', 3, @prodi_akt, 1, 'Persamaan dasar akuntansi, jurnal, buku besar, dan siklus perusahaan jasa/dagang.', 'approved'),
('AK2101', 'Akuntansi Keuangan Menengah I', 3, @prodi_akt, 3, 'Pengakuan kas, piutang, persediaan, dan aset tetap sesuai PSAK.', 'approved'),
('AK2102', 'Akuntansi Biaya', 3, @prodi_akt, 3, 'Perhitungan harga pokok pesanan (job order), proses, dan analisis biaya.', 'approved'),
('AK3101', 'Auditing I', 3, @prodi_akt, 5, 'Standar audit, pengendalian internal, bukti audit, dan kertas kerja pemeriksaan.', 'approved'),
('AK3102', 'Perpajakan', 3, @prodi_akt, 5, 'Ketentuan umum perpajakan, PPh Pasal 21/22/23/25, dan PPN terapan.', 'approved'),
('AK4101', 'Teori Akuntansi', 3, @prodi_akt, 7, 'Kerangka konseptual pelaporan keuangan, standar akuntansi, dan isu kontemporer.', 'approved'),

-- S1 Teknik Industri (TIN)
('TN1101', 'Pengantar Teknik Industri', 2, @prodi_tin, 1, 'Ruang lingkup keilmuan teknik industri, sistem manufaktur, dan produktivitas.', 'approved'),
('TN1102', 'Menggambar Teknik', 3, @prodi_tin, 1, 'Proyeksi ortogonal, isometrik, toleransi dimensi, dan standar gambar teknik.', 'approved'),
('TN2101', 'Mekanika Teknik', 3, @prodi_tin, 3, 'Statika struktur, gaya momen, keseimbangan benda tegar, dan analisis rangka.', 'approved'),
('TN3101', 'Penelitian Operasional', 3, @prodi_tin, 5, 'Pemrograman linier, metode simpleks, transportasi, dan optimasi penugasan.', 'approved'),
('TN3102', 'Perencanaan & Pengendalian Produksi', 3, @prodi_tin, 5, 'Peramalan permintaan, jadwal induk produksi (MPS), MRP, dan pengendalian persediaan.', 'approved'),

-- S1 Psikologi (PSI)
('PS1101', 'Pengantar Ilmu Psikologi', 3, @prodi_psi, 1, 'Sejarah psikologi, aliran utama, persepsi, memori, emosi, dan motivasi.', 'approved'),
('PS1102', 'Biopsikologi', 3, @prodi_psi, 1, 'Sistem saraf pusat, neurotransmiter, fungsi otak, dan dasar biologis perilaku.', 'approved'),
('PS2101', 'Psikologi Sosial I', 3, @prodi_psi, 3, 'Persepsi sosial, konformitas, sikap, prasangka, dan dinamika kelompok.', 'approved'),
('PS2102', 'Psikologi Kognitif', 3, @prodi_psi, 3, 'Atensi, pemrosesan informasi, bahasa, pemecahan masalah, dan pengambilan keputusan.', 'approved'),
('PS3101', 'Psikometri & Konstruksi Alat Ukur', 3, @prodi_psi, 5, 'Skala psikologi, reliabilitas, validitas item, dan teknik penyusunan tes.', 'approved'),

-- S1 Sastra Jepang (SASJAP)
('JP1101', 'Kiso Nihongo Bunpou', 3, @prodi_sasjap, 1, 'Tata bahasa Jepang tingkat dasar: partikel, kata kerja bentuk -masu/-te, dan pola kalimat.', 'approved'),
('JP1102', 'Kiso Moji Goi', 2, @prodi_sasjap, 1, 'Penguasaan Hiragana, Katakana, Kanji dasar, dan kosakata sehari-hari.', 'approved'),
('JP2101', 'Shochuukyuu Dokkai', 3, @prodi_sasjap, 3, 'Pemahaman bacaan bahasa Jepang tingkat dasar-menengah dan identifikasi gagasan pokok.', 'approved'),
('JP3101', 'Chuukyuu Bunpou', 3, @prodi_sasjap, 5, 'Tata bahasa tingkat menengah, ragam keigo (sopan), dan struktur kalimat majemuk.', 'approved'),
('JP3102', 'Japanese Grammar for JLPT', 2, @prodi_sasjap, 5, 'Latihan pola tata bahasa standar JLPT N3/N2 dan analisis perbedaan nuansa partikel.', 'approved'),

-- S1 Sastra Inggris (SASING)
('EN1101', 'Basic Grammar', 3, @prodi_sasing, 1, 'Parts of speech, tenses dasar, subject-verb agreement, dan struktur kalimat sederhana.', 'approved'),
('EN1102', 'Basic Writing', 2, @prodi_sasing, 1, 'Penyusunan paragraf efektif, topic sentence, kohesi, dan mekanik penulisan.', 'approved'),
('EN2101', 'English Linguistics', 3, @prodi_sasing, 3, 'Pengantar fonologi, morfologi, sintaksis, dan semantik bahasa Inggris.', 'approved'),
('EN3101', 'Translating English - Indonesia', 3, @prodi_sasing, 5, 'Teknik penerjemahan akurat teks akademik, berita, dan budaya Inggris ke Indonesia.', 'approved'),
('EN4101', 'ESP Introduction to IELTS Preparation', 2, @prodi_sasing, 7, 'Strategi IELTS Reading, Listening, Writing Task 1/2, dan Speaking akademik.', 'approved'),

-- S1 Ilmu Komunikasi (KOM)
('KM1101', 'Pengantar Broadcasting', 3, @prodi_kom, 1, 'Dasar penyiaran radio dan televisi, produksi siaran, dan etika media.', 'approved'),
('KM1102', 'Bahasa Inggris I (Ilmu Komunikasi)', 2, @prodi_kom, 1, 'Kosakata media, pemahaman artikel komunikasi, dan presentasi dasar berbahasa Inggris.', 'approved'),
('KM2101', 'Bahasa Inggris III (Ilmu Komunikasi)', 2, @prodi_kom, 3, 'Penulisan berita berbahasa Inggris, wawancara media, dan analisis kampanye global.', 'approved'),
('KM3101', 'Analisis Media Digital', 3, @prodi_kom, 5, 'Analisis konten media sosial, metrik audiens digital, dan ekosistem platform baru.', 'approved');

-- 3. RESOLVE PENGGUNA KONTRIBUTOR & MODERATOR AKTIF
SET @uploader_alumni = COALESCE(
  (SELECT id FROM users WHERE email = 'dinda.alumni@pasim.ac.id' AND status = 'active' LIMIT 1),
  (SELECT id FROM users WHERE status = 'active' ORDER BY id ASC LIMIT 1)
);
SET @uploader_mhs = COALESCE(
  (SELECT id FROM users WHERE email = 'rizky.mhs@pasim.ac.id' AND status = 'active' LIMIT 1),
  @uploader_alumni
);
SET @mod_user = COALESCE(
  (SELECT id FROM users WHERE role IN ('moderator', 'admin') AND status = 'active' ORDER BY id ASC LIMIT 1),
  @uploader_alumni
);

-- 4. CONTOH MATERI PEMBELAJARAN PER PRODI (Kisi-kisi & Persiapan UTS Ganjil 2026/2027)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'IF1101' LIMIT 1),
  @uploader_alumni,
  'Catatan Rangkuman Lengkap Logika & Percabangan C++',
  'ringkasan_catatan',
  'Catatan tulisan tangan rapi + penjelasan sintaks if-else, switch-case, dan ternary operator disertai latihan soal.',
  'logika,c++,algoritma,catatan',
  '2025/2026', '2022', 'Tim Dosen Dasar Pemrograman Fasilkom', 'Catatan Mandiri Mahasiswa',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 42, 18
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'IF1101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM materi WHERE judul = 'Catatan Rangkuman Lengkap Logika & Percabangan C++');

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'IF1102' LIMIT 1),
  @uploader_alumni,
  'Kumpulan Latihan Soal Logika Proposisional & Himpunan',
  'soal_latihan',
  'Bank soal latihan mandiri materi himpunan dan tabel kebenaran lengkap dengan kunci pembahasan.',
  'matdis,himpunan,soal',
  '2025/2026', '2022', 'Tim Dosen Matematika Diskrit', 'Catatan Alumni 2022',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 60, 25
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'IF1102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM materi WHERE judul = 'Kumpulan Latihan Soal Logika Proposisional & Himpunan');

-- Sampel UTS Ganjil 2026/2027 — S1 Teknik Informatika (TIF)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'IF2102' LIMIT 1),
  @uploader_alumni,
  'Ringkasan ERD, Normalisasi 1NF-3NF & Latihan SQL Basis Data (Persiapan UTS)',
  'ringkasan_catatan',
  'Checklist materi UTS Basis Data Ganjil 2026/2027:\n1. Pemetaan entitas, atribut, kardinalitas (1:1, 1:N, M:N) ke skema relasional.\n2. Tahapan normalisasi 1NF, 2NF, dan 3NF untuk menghilangkan anomali data.\n3. Perintah DDL & DML dasar: CREATE TABLE dengan FOREIGN KEY, SELECT JOIN, dan GROUP BY.',
  'basisdata,erd,normalisasi,sql,uts',
  '2026/2027', '2022', 'Tim Dosen Basis Data Fasilkom', 'Arsip Belajar HIMATIF PASIM',
  'https://www.w3schools.com/sql/', NULL, 1, 'approved', @mod_user, NOW(), 34, 12
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'IF2102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'IF2102' LIMIT 1)
      AND judul = 'Ringkasan ERD, Normalisasi 1NF-3NF & Latihan SQL Basis Data (Persiapan UTS)'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'IF3103' LIMIT 1),
  @uploader_mhs,
  'Rangkuman Metode Inferensi Forward & Backward Chaining Sistem Pakar',
  'soal_latihan',
  'Fokus UTS Sistem Pakar:\n- Arsitektur basis pengetahuan & mesin inferensi.\n- Penelusuran aturan IF-THEN dengan Forward Chaining vs Backward Chaining.\n- Contoh perhitungan Certainty Factor (CF) gabungan beberapa gejala.',
  'sistempakar,ai,chaining,cf,uts',
  '2026/2027', '2023', 'Tim Dosen AI Fasilkom', 'Catatan Kuliah Semester 5',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 19, 7
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'IF3103' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'IF3103' LIMIT 1)
      AND judul = 'Rangkuman Metode Inferensi Forward & Backward Chaining Sistem Pakar'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Sistem Informasi (SI)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'SI1102' LIMIT 1),
  @uploader_alumni,
  'Rangkuman Konsep Sistem Informasi (KSI): TPS, SIM, DSS & Peran Organisasi',
  'ringkasan_catatan',
  'Ringkasan materi UTS Konsep Sistem Informasi:\n- Definisi data vs informasi vs pengetahuan.\n- Hirarki sistem informasi: Transaction Processing System (TPS), Management Information System (MIS), Decision Support System (DSS), dan Executive Support System (ESS).\n- Studi kasus transformasi digital pada proses bisnis perusahaan.',
  'ksi,sisteminformasi,tps,sim,uts',
  '2026/2027', '2022', 'Tim Dosen Sistem Informasi', 'Ringkasan HMSI PASIM',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 28, 9
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'SI1102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'SI1102' LIMIT 1)
      AND judul = 'Rangkuman Konsep Sistem Informasi (KSI): TPS, SIM, DSS & Peran Organisasi'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'SI3101' LIMIT 1),
  @uploader_mhs,
  'Panduan Praktis Diagram UML APSI Objek (Use Case, Activity & Sequence)',
  'modul',
  'Kisi-kisi UTS APSI Berorientasi Objek:\n1. Identifikasi aktor dan relasi <<include>> vs <<extend>> pada Use Case Diagram.\n2. Pemodelan alur proses bisnis menggunakan Activity Diagram dengan swimlane.\n3. Pemetaan interaksi pesan antar objek pada Sequence Diagram serta Class Diagram.',
  'apsi,uml,usecase,sequence,uts',
  '2026/2027', '2023', 'Tim Dosen APSI Fasilkom', 'Catatan Proyek Mahasiswa',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 23, 11
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'SI3101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'SI3101' LIMIT 1)
      AND judul = 'Panduan Praktis Diagram UML APSI Objek (Use Case, Activity & Sequence)'
  );

-- Sampel UTS Ganjil 2026/2027 — D3 Manajemen Informatika (MI)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'MI1102' LIMIT 1),
  @uploader_mhs,
  'Kisi-Kisi Flowchart & Pseudocode UTS Algoritma MI',
  'soal_latihan',
  'Panduan latihan praktikum & UTS Algoritma MI:\n- Simbol standar flowchart (terminator, input/output, proses, decision).\n- Penulisan pseudocode terstruktur untuk perhitungan gaji, diskon, dan deret bilangan.\n- Penelusuran trace table nilai variabel pada perulangan FOR dan WHILE.',
  'algoritma,flowchart,pseudocode,mi,uts',
  '2026/2027', '2023', 'Tim Dosen Algoritma MI', 'Asisten Lab Komputer PASIM',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 27, 14
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'MI1102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'MI1102' LIMIT 1)
      AND judul = 'Kisi-Kisi Flowchart & Pseudocode UTS Algoritma MI'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'MI2101' LIMIT 1),
  @uploader_alumni,
  'Cheatsheet HTML5 Semantik, CSS Flexbox & Form Web I (MI)',
  'kode_referensi',
  'Ringkasan materi praktikum Web I (MI) untuk UTS di Lab Komputer:\n- Struktur dokumen HTML5 semantik (header, nav, main, article, footer).\n- Pembuatan tabel jadwal dan formulir input tervalidasi.\n- Pengaturan tata letak responsif dengan CSS Flexbox dan Box Model.',
  'web,html,css,flexbox,mi,uts',
  '2026/2027', '2022', 'Tim Dosen Pemrograman Web MI', 'Referensi Praktikum Lab Komp',
  'https://developer.mozilla.org/id/docs/Web/HTML', NULL, 1, 'approved', @mod_user, NOW(), 31, 15
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'MI2101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'MI2101' LIMIT 1)
      AND judul = 'Cheatsheet HTML5 Semantik, CSS Flexbox & Form Web I (MI)'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Manajemen (MNJ)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'MN1102' LIMIT 1),
  @uploader_mhs,
  'Ringkasan Lingkungan Bisnis, Bentuk Badan Usaha & Kewirausahaan (UTS)',
  'ringkasan_catatan',
  'Catatan kuliah Pengantar Bisnis Semester Ganjil:\n1. Pengertian sistem ekonomi dan lingkungan eksternal bisnis (PESTEL).\n2. Perbandingan perusahaan perseorangan, firma, CV, PT, dan koperasi.\n3. Peran etika bisnis serta tanggung jawab sosial perusahaan (CSR).',
  'manajemen,bisnis,uts,badanusaha',
  '2026/2027', '2024', 'Tim Dosen Fakultas Ekonomi', 'Catatan Kuliah Manajemen K.1',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 25, 8
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'MN1102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'MN1102' LIMIT 1)
      AND judul = 'Ringkasan Lingkungan Bisnis, Bentuk Badan Usaha & Kewirausahaan (UTS)'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'MN2102' LIMIT 1),
  @uploader_alumni,
  'Rumus & Contoh Soal Time Value of Money serta Rasio Keuangan (UTS)',
  'soal_latihan',
  'Kumpulan soal latihan Manajemen Keuangan I menghadapi UTS:\n- Menghitung Future Value (FV), Present Value (PV), dan anuitas.\n- Analisis rasio likuiditas (Current Ratio, Quick Ratio), solvabilitas (DER), dan profitabilitas (ROA, ROE).\n- Dilengkapi langkah penyelesaian terstruktur.',
  'keuangan,tvm,rasio,manajemen,uts',
  '2026/2027', '2022', 'Tim Dosen Manajemen Keuangan', 'Bank Soal FEB PASIM',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 37, 19
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'MN2102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'MN2102' LIMIT 1)
      AND judul = 'Rumus & Contoh Soal Time Value of Money serta Rasio Keuangan (UTS)'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Akuntansi (AKT)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'AK1101' LIMIT 1),
  @uploader_mhs,
  'Latihan Siklus Akuntansi Perusahaan Jasa: Jurnal Umum hingga Neraca Lajur',
  'soal_latihan',
  'Bahan latihan mandiri Pengantar Akuntansi 1 untuk UTS:\n- Mekanisme debit dan kredit untuk kelompok akun aset, liabilitas, ekuitas, pendapatan, dan beban.\n- Contoh transaksi lengkap satu bulan beserta jurnal penyesuaian (AJP) dan laporan laba rugi.',
  'akuntansi,jurnal,ajp,neraca,uts',
  '2026/2027', '2023', 'Tim Dosen Akuntansi FEB', 'Kelompok Belajar Akuntansi PASIM',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 41, 21
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'AK1101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'AK1101' LIMIT 1)
      AND judul = 'Latihan Siklus Akuntansi Perusahaan Jasa: Jurnal Umum hingga Neraca Lajur'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'AK2102' LIMIT 1),
  @uploader_alumni,
  'Ringkasan Harga Pokok Pesanan (Job Order Costing) & Biaya Overhead Pabrik',
  'ringkasan_catatan',
  'Poin penting UTS Akuntansi Biaya:\n1. Klasifikasi biaya produksi: bahan baku langsung, tenaga kerja langsung, dan BOP.\n2. Perhitungan tarif BOP dibebankan di muka serta selisih pembebanan.\n3. Contoh kartu harga pokok pesanan dan laporan harga pokok produksi.',
  'akuntansibiaya,joborder,bop,uts',
  '2026/2027', '2022', 'Tim Dosen Akuntansi Biaya', 'Catatan Alumni Akuntansi',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 29, 13
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'AK2102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'AK2102' LIMIT 1)
      AND judul = 'Ringkasan Harga Pokok Pesanan (Job Order Costing) & Biaya Overhead Pabrik'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Teknik Industri (TIN)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'TN1101' LIMIT 1),
  @uploader_mhs,
  'Rangkuman Konsep Sistem Manufaktur, 5M & Pengukuran Produktivitas (UTS)',
  'ringkasan_catatan',
  'Materi inti Pengantar Teknik Industri:\n- Definisi Teknik Industri menurut IISE dan pendekatan sistem terintegrasi (Man, Machine, Material, Method, Money).\n- Rumus produktivitas parsial vs produktivitas total disertai studi kasus lini produksi.\n- Pengantar ergonomi dasar dan efisiensi tata cara kerja.',
  'teknikindustri,manufaktur,produktivitas,uts',
  '2026/2027', '2023', 'Tim Dosen Fakultas Teknik', 'Catatan Teknik Industri PASIM',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 22, 10
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'TN1101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'TN1101' LIMIT 1)
      AND judul = 'Rangkuman Konsep Sistem Manufaktur, 5M & Pengukuran Produktivitas (UTS)'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'TN3101' LIMIT 1),
  @uploader_alumni,
  'Langkah Penyelesaian Program Linier: Metode Grafik & Tabel Simpleks',
  'soal_latihan',
  'Checklist persiapan UTS Penelitian Operasional:\n- Memodelkan fungsi tujuan (maksimasi/minimasi) dan kendala ketidaksamaan.\n- Menentukan daerah layak (feasible region) pada metode grafik 2 variabel.\n- Iterasi metode simpleks standar: penentuan variabel masuk, variabel keluar, dan baris pivot.',
  'penelitianoperasional,simpleks,optimasi,uts',
  '2026/2027', '2022', 'Tim Dosen Teknik Industri', 'Catatan Senior Teknik Industri',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 33, 16
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'TN3101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'TN3101' LIMIT 1)
      AND judul = 'Langkah Penyelesaian Program Linier: Metode Grafik & Tabel Simpleks'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Psikologi (PSI)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'PS1101' LIMIT 1),
  @uploader_mhs,
  'Ringkasan Aliran Utama Psikologi & Proses Sensasi-Persepsi (UTS)',
  'ringkasan_catatan',
  'Rangkuman Pengantar Ilmu Psikologi untuk UTS Ganjil 2026/2027:\n- Perspektif psikodinamika (Freud), behaviorisme (Watson/Skinner), kognitif, humanistik (Maslow/Rogers), dan biopsikologi.\n- Mekanisme pengkodean memori jangka pendek vs memori jangka panjang.\n- Faktor internal dan eksternal yang memengaruhi perhatian serta persepsi.',
  'psikologi,pengantar,persepsi,memori,uts',
  '2026/2027', '2024', 'Tim Dosen Fakultas Psikologi', 'Catatan Belajar Psikologi',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 30, 14
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'PS1101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'PS1101' LIMIT 1)
      AND judul = 'Ringkasan Aliran Utama Psikologi & Proses Sensasi-Persepsi (UTS)'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'PS3101' LIMIT 1),
  @uploader_alumni,
  'Panduan Reliabilitas Alpha Cronbach & Validitas Konstruk Psikometri',
  'modul',
  'Ringkasan materi Psikometri & Konstruksi Alat Ukur:\n- Penyusunan blueprint skala psikologi berdasarkan dimensi perilaku (indikator & aitem favorable/unfavorable).\n- Uji daya beda aitem (korelasi aitem-total) serta koefisien Alpha Cronbach.\n- Konsep validitas isi, konstruk, dan kriteria pada instrumen psikologi.',
  'psikometri,alatukur,reliabilitas,validitas,uts',
  '2026/2027', '2022', 'Tim Dosen Psikometri PASIM', 'Catatan Lab Psikologi PASIM',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 24, 11
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'PS3101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'PS3101' LIMIT 1)
      AND judul = 'Panduan Reliabilitas Alpha Cronbach & Validitas Konstruk Psikometri'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Sastra Jepang (SASJAP)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'JP1101' LIMIT 1),
  @uploader_mhs,
  'Ringkasan Partikel Dasar (wa, ga, o, ni, de, e) & Bentuk Kata Kerja Kiso Bunpou',
  'ringkasan_catatan',
  'Catatan inti Kiso Nihongo Bunpou persiapan UTS:\n- Fungsi pembeda partikel wa (topik) vs ga (subjek penegasan) serta ni (tujuan/waktu) vs de (tempat aksi/alat).\n- Perubahan kata kerja kelompok 1, 2, dan 3 ke bentuk -masu, -masen, -mashita, serta bentuk -te.\n- Contoh kalimat tanya menggunakan kata tanya nani, doko, itsu, dan dare.',
  'nihongo,bunpou,partikel,bahasajepang,uts',
  '2026/2027', '2023', 'Tim Dosen Sastra Jepang', 'Catatan Komunitas Nihongo PASIM',
  'https://www.jlptsensei.com/', NULL, 1, 'approved', @mod_user, NOW(), 35, 17
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'JP1101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'JP1101' LIMIT 1)
      AND judul = 'Ringkasan Partikel Dasar (wa, ga, o, ni, de, e) & Bentuk Kata Kerja Kiso Bunpou'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'JP3102' LIMIT 1),
  @uploader_alumni,
  'Tips & Pola Tata Bahasa JLPT N3 yang Sering Keluar di UTS',
  'tips_belajar',
  'Daftar pola bunpou JLPT N3 penting:\n1. Perbandingan you ni naru vs koto ni naru.\n2. Ekspresi alasan dan kondisi: tame ni, okage de, sei de, to shitara.\n3. Strategi membaca cepat soal dokkai agar hemat waktu ujian.',
  'jlpt,bunpou,sasjap,tips,uts',
  '2026/2027', '2022', 'Tim Dosen Sastra Jepang', 'Sharing Alumni Sastra Jepang',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 21, 9
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'JP3102' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'JP3102' LIMIT 1)
      AND judul = 'Tips & Pola Tata Bahasa JLPT N3 yang Sering Keluar di UTS'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Sastra Inggris (SASING)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'EN1101' LIMIT 1),
  @uploader_mhs,
  'Rangkuman 8 Parts of Speech & Tenses Dasar + Latihan Error Recognition',
  'soal_latihan',
  'Materi persiapan UTS Basic Grammar:\n- Identifikasi noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection dalam kalimat.\n- Penggunaan Simple Present, Present Continuous, Simple Past, dan Present Perfect.\n- Latihan Subject-Verb Agreement dan soal error recognition.',
  'grammar,tenses,english,uts',
  '2026/2027', '2023', 'Tim Dosen Sastra Inggris', 'English Study Club PASIM',
  'https://learnenglish.britishcouncil.org/grammar', NULL, 1, 'approved', @mod_user, NOW(), 26, 12
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'EN1101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'EN1101' LIMIT 1)
      AND judul = 'Rangkuman 8 Parts of Speech & Tenses Dasar + Latihan Error Recognition'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'EN3101' LIMIT 1),
  @uploader_alumni,
  'Teknik Penerjemahan Transposisi, Modulasi & Padanan Budaya Inggris-Indonesia',
  'ringkasan_catatan',
  'Kisi-kisi UTS Translating English - Indonesia:\n- Membedakan penerjemahan harfiah vs idiomatis vs komunikatif.\n- Teknik transposisi (perubahan kategori gramatikal) dan modulasi (perubahan sudut pandang makna).\n- Contoh analisis terjemahan teks artikel ilmiah dan berita.',
  'translation,linguistik,sasing,uts',
  '2026/2027', '2022', 'Tim Dosen Translation Studies', 'Catatan Alumni Sastra Inggris',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 18, 6
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'EN3101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'EN3101' LIMIT 1)
      AND judul = 'Teknik Penerjemahan Transposisi, Modulasi & Padanan Budaya Inggris-Indonesia'
  );

-- Sampel UTS Ganjil 2026/2027 — S1 Ilmu Komunikasi (KOM)
INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'KM1101' LIMIT 1),
  @uploader_mhs,
  'Ringkasan Pra-Produksi, Produksi & Etika Siaran Broadcasting (UTS)',
  'ringkasan_catatan',
  'Catatan kuliah Pengantar Broadcasting Semester Ganjil:\n- Karakteristik media penyiaran radio (theater of mind) dan televisi (audio-visual).\n- Tahapan produksi program siaran: riset ide, penulisan naskah/rundown, shooting/recording, dan editing.\n- Prinsip dasar regulasi penyiaran (P3SPS) dan etika jurnalistik penyiaran.',
  'broadcasting,ilkom,siaran,p3sps,uts',
  '2026/2027', '2023', 'Tim Dosen Ilmu Komunikasi', 'Catatan Belajar Ilkom PASIM',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 20, 8
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'KM1101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'KM1101' LIMIT 1)
      AND judul = 'Ringkasan Pra-Produksi, Produksi & Etika Siaran Broadcasting (UTS)'
  );

INSERT INTO materi (
  mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
  tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
  external_url, youtube_video_id, is_published, status, moderated_by, moderated_at, view_count, download_count
)
SELECT
  (SELECT id FROM mata_kuliah WHERE kode = 'KM3101' LIMIT 1),
  @uploader_alumni,
  'Kerangka Analisis Konten Media Digital & Metrik Engagement Audiens',
  'slide',
  'Pokok bahasan UTS Analisis Media Digital:\n- Perbedaan komunikasi massa konvensional dengan media baru berbasis algoritma.\n- Membaca indikator reach, impression, engagement rate, dan sentimen percakapan.\n- Teknik menyusun laporan audit konten kampanye digital.',
  'mediadigital,ilkom,analisiskonten,uts',
  '2026/2027', '2022', 'Tim Dosen Komunikasi Digital', 'Arsip Alumni Ilmu Komunikasi',
  NULL, NULL, 1, 'approved', @mod_user, NOW(), 16, 7
FROM DUAL
WHERE (SELECT id FROM mata_kuliah WHERE kode = 'KM3101' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM materi
    WHERE mata_kuliah_id = (SELECT id FROM mata_kuliah WHERE kode = 'KM3101' LIMIT 1)
      AND judul = 'Kerangka Analisis Konten Media Digital & Metrik Engagement Audiens'
  );

-- 5. BERKAS LAMPIRAN PDF CONTOH (Idempoten untuk 2 materi PDF starter TIF)
INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan)
SELECT
  m.id,
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  NULL,
  'Rangkuman_Logika_Percabangan_C++.pdf',
  145000,
  'pdf',
  1
FROM materi m
WHERE m.judul = 'Catatan Rangkuman Lengkap Logika & Percabangan C++'
  AND NOT EXISTS (SELECT 1 FROM materi_file mf WHERE mf.materi_id = m.id)
LIMIT 1;

INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan)
SELECT
  m.id,
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  NULL,
  'Soal_Pembahasan_Matematika_Diskrit.pdf',
  210000,
  'pdf',
  1
FROM materi m
WHERE m.judul = 'Kumpulan Latihan Soal Logika Proposisional & Himpunan'
  AND NOT EXISTS (SELECT 1 FROM materi_file mf WHERE mf.materi_id = m.id)
LIMIT 1;

-- 6. PAKET BELAJAR SEMESTER (Starter Pack Kurasi Persiapan UTS Ganjil 2026/2027)
INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by)
SELECT @prodi_tif, 1, 'Starter Pack Semester 1 Teknik Informatika',
  'Kumpulan materi dasar logika algoritma, matematika diskrit, dan pengantar teknologi informasi untuk mahasiswa baru.',
  @mod_user
FROM DUAL
WHERE @prodi_tif IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM paket_belajar WHERE prodi_id = @prodi_tif AND judul = 'Starter Pack Semester 1 Teknik Informatika'
  );

INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by)
SELECT @prodi_mnj, 1, 'Starter Pack UTS Ganjil FEB (Manajemen & Akuntansi)',
  'Rangkuman Pengantar Bisnis, Manajemen Keuangan, Akuntansi Dasar, dan Akuntansi Biaya untuk persiapan UTS 2026/2027.',
  @mod_user
FROM DUAL
WHERE @prodi_mnj IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM paket_belajar WHERE prodi_id = @prodi_mnj AND judul = 'Starter Pack UTS Ganjil FEB (Manajemen & Akuntansi)'
  );

INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by)
SELECT @prodi_psi, 1, 'Starter Pack UTS Ganjil Fakultas Psikologi',
  'Kompilasi ringkasan Pengantar Ilmu Psikologi dan modul Psikometri untuk bekal ujian tengah semester.',
  @mod_user
FROM DUAL
WHERE @prodi_psi IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM paket_belajar WHERE prodi_id = @prodi_psi AND judul = 'Starter Pack UTS Ganjil Fakultas Psikologi'
  );

INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by)
SELECT @prodi_sasjap, 1, 'Starter Pack UTS Ganjil Fakultas Sastra & Bahasa',
  'Gabungan catatan Kiso Nihongo Bunpou, pola JLPT N3, Basic Grammar, dan Teknik Penerjemahan.',
  @mod_user
FROM DUAL
WHERE @prodi_sasjap IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM paket_belajar WHERE prodi_id = @prodi_sasjap AND judul = 'Starter Pack UTS Ganjil Fakultas Sastra & Bahasa'
  );

-- Item Paket Belajar (Idempoten via INSERT IGNORE)
INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 1
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Catatan Rangkuman Lengkap Logika & Percabangan C++'
WHERE pb.judul = 'Starter Pack Semester 1 Teknik Informatika';

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 2
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Kumpulan Latihan Soal Logika Proposisional & Himpunan'
WHERE pb.judul = 'Starter Pack Semester 1 Teknik Informatika';

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 1
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Ringkasan Lingkungan Bisnis, Bentuk Badan Usaha & Kewirausahaan (UTS)'
WHERE pb.judul = 'Starter Pack UTS Ganjil FEB (Manajemen & Akuntansi)';

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 2
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Latihan Siklus Akuntansi Perusahaan Jasa: Jurnal Umum hingga Neraca Lajur'
WHERE pb.judul = 'Starter Pack UTS Ganjil FEB (Manajemen & Akuntansi)';

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 1
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Ringkasan Aliran Utama Psikologi & Proses Sensasi-Persepsi (UTS)'
WHERE pb.judul = 'Starter Pack UTS Ganjil Fakultas Psikologi';

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 2
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Panduan Reliabilitas Alpha Cronbach & Validitas Konstruk Psikometri'
WHERE pb.judul = 'Starter Pack UTS Ganjil Fakultas Psikologi';

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 1
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Ringkasan Partikel Dasar (wa, ga, o, ni, de, e) & Bentuk Kata Kerja Kiso Bunpou'
WHERE pb.judul = 'Starter Pack UTS Ganjil Fakultas Sastra & Bahasa';

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan)
SELECT pb.id, m.id, 2
FROM paket_belajar pb
JOIN materi m ON m.judul = 'Rangkuman 8 Parts of Speech & Tenses Dasar + Latihan Error Recognition'
WHERE pb.judul = 'Starter Pack UTS Ganjil Fakultas Sastra & Bahasa';

-- ----------------------------------------------------------------------------
-- 5. DATA CONTOH PENGATURAN FOKUS & TUGAS (focus_planner_seed.sql)
-- ----------------------------------------------------------------------------
-- ============================================================================
-- SEEDER: Contoh Data Penjadwalan Tugas Pribadi Mandiri, Sesi Kerja, Fokus & Pengingat
-- Universitas Nasional Pasim Bandung
-- Jalankan setelah database/schema.sql, database/seed.sql,
-- dan database/migrations/004_focus_planner_timer_up.sql.
-- Tidak bergantung pada tabel LMS/mata kuliah; semua tugas & kategori dibuat oleh user sendiri.
-- Semua waktu DATETIME disimpan dalam UTC.
-- ============================================================================



SET @mhs_id = (
    SELECT id FROM users
    WHERE role = 'mahasiswa' AND status = 'active'
    ORDER BY id ASC
    LIMIT 1
);

-- 1. Pengaturan Fokus default untuk sampel mahasiswa
INSERT IGNORE INTO fokus_pengaturan (
    user_id, durasi_fokus, durasi_istirahat_pendek, durasi_istirahat_panjang,
    siklus_sebelum_panjang, auto_start, suara_aktif, getar_aktif,
    batas_beban_harian_menit, jam_aktif_mulai, jam_aktif_selesai,
    jam_tenang_aktif, jam_tenang_mulai, jam_tenang_selesai, zona_waktu
)
SELECT
    @mhs_id, 25, 5, 15, 4, 0, 1, 1, 240, '08:00', '22:00', 1, '22:00', '07:00', 'Asia/Jakarta'
WHERE @mhs_id IS NOT NULL;

-- 2. Sampel Tugas Pribadi Mandiri (idempoten via NOT EXISTS)
INSERT INTO tugas_pribadi (user_id, kategori, judul, deskripsi, prioritas, status, deadline_at, estimasi_menit, target_mulai)
SELECT
    @mhs_id,
    'Proyek Coding',
    'Implementasi Linked List & Stack untuk Studi Kasus Antrean',
    'Buat implementasi struktur data Stack & Queue serta analisis kompleksitas waktunya.',
    'tinggi',
    'sedang_dikerjakan',
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 DAY),
    150,
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY)
WHERE @mhs_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tugas_pribadi
    WHERE user_id = @mhs_id AND judul = 'Implementasi Linked List & Stack untuk Studi Kasus Antrean'
  );

INSERT INTO tugas_pribadi (user_id, kategori, judul, deskripsi, prioritas, status, deadline_at, estimasi_menit, target_mulai)
SELECT
    @mhs_id,
    'Belajar Mandiri',
    'Normalisasi ERD Sistem Perpustakaan Kampus (1NF - 3NF)',
    'Lengkapi diagram relasi entitas dan DDL SQL sampai bentuk normal ketiga.',
    'sedang',
    'belum_mulai',
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 DAY),
    120,
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 DAY)
WHERE @mhs_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tugas_pribadi
    WHERE user_id = @mhs_id AND judul = 'Normalisasi ERD Sistem Perpustakaan Kampus (1NF - 3NF)'
  );

INSERT INTO tugas_pribadi (user_id, kategori, judul, deskripsi, prioritas, status, deadline_at, estimasi_menit, target_mulai, completed_at)
SELECT
    @mhs_id,
    'Latihan Soal',
    'Latihan Pseudocode Percabangan & Perulangan',
    'Menyelesaikan 10 soal algoritma dasar dengan flowchart dan pseudocode.',
    'rendah',
    'selesai',
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY),
    60,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)
WHERE @mhs_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tugas_pribadi
    WHERE user_id = @mhs_id AND judul = 'Latihan Pseudocode Percabangan & Perulangan'
  );

SET @tugas_stack = (
    SELECT id FROM tugas_pribadi
    WHERE user_id = @mhs_id AND judul = 'Implementasi Linked List & Stack untuk Studi Kasus Antrean'
    LIMIT 1
);
SET @tugas_erd = (
    SELECT id FROM tugas_pribadi
    WHERE user_id = @mhs_id AND judul = 'Normalisasi ERD Sistem Perpustakaan Kampus (1NF - 3NF)'
    LIMIT 1
);

-- 3. Sampel Sesi Jadwal (UTC)
INSERT INTO sesi_jadwal (user_id, tugas_id, mulai_at, durasi_menit, status)
SELECT
    @mhs_id,
    @tugas_stack,
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR),
    50,
    'terjadwal'
WHERE @mhs_id IS NOT NULL AND @tugas_stack IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sesi_jadwal WHERE user_id = @mhs_id AND tugas_id = @tugas_stack AND status = 'terjadwal'
  );

INSERT INTO sesi_jadwal (user_id, tugas_id, mulai_at, durasi_menit, status)
SELECT
    @mhs_id,
    @tugas_erd,
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY),
    60,
    'terjadwal'
WHERE @mhs_id IS NOT NULL AND @tugas_erd IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sesi_jadwal WHERE user_id = @mhs_id AND tugas_id = @tugas_erd AND status = 'terjadwal'
  );

-- 4. Sampel Riwayat Sesi Fokus Selesai (untuk demo statistik & streak 3 hari berturut-turut)
INSERT INTO fokus_sesi (user_id, tugas_id, tipe, status, mulai_at, durasi_rencana_detik, total_jeda_detik, selesai_at, catatan, siklus_ke)
SELECT
    @mhs_id, @tugas_stack, 'fokus', 'selesai',
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 50 HOUR), 1500, 0,
    DATE_ADD(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 50 HOUR), INTERVAL 1500 SECOND),
    'Menyelesaikan kerangka class Node dan LinkedList', 1
WHERE @mhs_id IS NOT NULL AND @tugas_stack IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fokus_sesi WHERE user_id = @mhs_id AND catatan = 'Menyelesaikan kerangka class Node dan LinkedList'
  );

INSERT INTO fokus_sesi (user_id, tugas_id, tipe, status, mulai_at, durasi_rencana_detik, total_jeda_detik, selesai_at, catatan, siklus_ke)
SELECT
    @mhs_id, @tugas_stack, 'fokus', 'selesai',
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 26 HOUR), 1500, 60,
    DATE_ADD(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 26 HOUR), INTERVAL 1560 SECOND),
    'Implementasi push/pop dan uji edge case queue kosong', 2
WHERE @mhs_id IS NOT NULL AND @tugas_stack IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fokus_sesi WHERE user_id = @mhs_id AND catatan = 'Implementasi push/pop dan uji edge case queue kosong'
  );

INSERT INTO fokus_sesi (user_id, tugas_id, tipe, status, mulai_at, durasi_rencana_detik, total_jeda_detik, selesai_at, catatan, siklus_ke)
SELECT
    @mhs_id, @tugas_erd, 'fokus', 'selesai',
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 MINUTE), 1500, 0,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 65 MINUTE),
    'Memetakan entitas peminjaman buku dan relasi mahasiswa', 1
WHERE @mhs_id IS NOT NULL AND @tugas_erd IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fokus_sesi WHERE user_id = @mhs_id AND catatan = 'Memetakan entitas peminjaman buku dan relasi mahasiswa'
  );

-- ============================================================================
-- SELESAI! Seluruh tabel dan data awal UNAS PASIM berhasil disiapkan.
-- ============================================================================

-- ============================================================================
-- MIGRATION 001 (UP): Modul A — Perpustakaan Materi (Peer-to-Peer)
-- Jalankan setelah database/schema.sql pada database baru.
-- ============================================================================

USE db_portal_pasim;

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

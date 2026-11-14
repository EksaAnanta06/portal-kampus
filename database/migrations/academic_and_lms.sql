-- ============================================================================
-- FILE: database/migrations/academic_and_lms.sql
-- DESKRIPSI: Migrasi Master Akademik, Assignment Hub, & Repositori Materi Kuliah
-- UNIVERSITAS NASIONAL PASIM BANDUNG
-- ============================================================================

-- 1. Perluas role pada tabel users untuk Dosen dan Asisten Lab
ALTER TABLE users 
MODIFY COLUMN role ENUM('admin', 'moderator', 'mahasiswa', 'alumni', 'dosen', 'asisten_lab') 
NOT NULL DEFAULT 'mahasiswa';

-- 2. Tabel Master Program Studi
CREATE TABLE IF NOT EXISTS prodi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(20) NOT NULL UNIQUE COMMENT 'Contoh: TIF, SI, MNJ, AKT',
    nama VARCHAR(100) NOT NULL COMMENT 'Contoh: S1 Teknik Informatika',
    jenjang ENUM('D3', 'S1', 'S2') NOT NULL DEFAULT 'S1',
    fakultas VARCHAR(100) NOT NULL DEFAULT 'Fakultas Ilmu Komputer & Desain',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Master Semester Akademik
CREATE TABLE IF NOT EXISTS semester_akademik (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(50) NOT NULL COMMENT 'Contoh: 2026/2027 Ganjil',
    tahun_ajaran VARCHAR(20) NOT NULL COMMENT 'Contoh: 2026/2027',
    semester ENUM('ganjil', 'genap', 'pendek') NOT NULL DEFAULT 'ganjil',
    tanggal_mulai DATE NULL,
    tanggal_selesai DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 jika semester sedang berjalan aktif',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_semester_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Master Mata Kuliah
CREATE TABLE IF NOT EXISTS mata_kuliah (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(20) NOT NULL UNIQUE COMMENT 'Contoh: IF3105',
    nama VARCHAR(150) NOT NULL COMMENT 'Contoh: Pemrograman Web Lanjut',
    sks TINYINT UNSIGNED NOT NULL DEFAULT 3,
    prodi VARCHAR(100) NOT NULL DEFAULT 'S1 Teknik Informatika',
    semester_paket TINYINT UNSIGNED NULL COMMENT 'Semester rekomendasi kurikulum (1-8)',
    deskripsi TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_matkul_prodi (prodi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Kelas Mata Kuliah (Per Semester)
CREATE TABLE IF NOT EXISTS kelas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mata_kuliah_id INT UNSIGNED NOT NULL,
    semester_akademik_id INT UNSIGNED NOT NULL,
    nama VARCHAR(50) NOT NULL COMMENT 'Contoh: TIF-22A atau Reguler Pagi',
    ruangan VARCHAR(50) NULL DEFAULT 'Lab Komputer 2',
    hari_jadwal ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu') NULL,
    jam_mulai TIME NULL,
    jam_selesai TIME NULL,
    kuota INT UNSIGNED NOT NULL DEFAULT 40,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_kelas_matkul
        FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_kelas_semester
        FOREIGN KEY (semester_akademik_id) REFERENCES semester_akademik(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_kelas_matkul_sem_nama (mata_kuliah_id, semester_akademik_id, nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MODUL: PERPUSTAKAAN & REPOSITORI BERBAGI MATERI KULIAH (PEER-TO-PEER)
-- Dibagikan oleh Alumni & Mahasiswa untuk pembelajaran adik tingkat
-- ============================================================================

-- 6. Tabel Pertemuan Kuliah (1 s/d 16)
CREATE TABLE IF NOT EXISTS materi_pertemuan (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kelas_id INT UNSIGNED NOT NULL,
    nomor_pertemuan TINYINT UNSIGNED NOT NULL COMMENT '1 sampai 16',
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT NULL,
    is_uts TINYINT(1) NOT NULL DEFAULT 0,
    is_uas TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mp_kelas
        FOREIGN KEY (kelas_id) REFERENCES kelas(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_kelas_pertemuan (kelas_id, nomor_pertemuan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel Item Materi (Slide PDF, Silabus, Rekaman YouTube, Modul Praktikum)
CREATE TABLE IF NOT EXISTS materi_item (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pertemuan_id INT UNSIGNED NOT NULL,
    uploaded_by INT UNSIGNED NULL COMMENT 'Alumni atau Mahasiswa yang membagikan materi',
    tipe ENUM('silabus', 'slide', 'rekaman', 'modul_praktikum', 'lainnya') NOT NULL,
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT NULL,
    url VARCHAR(500) NULL,
    public_id VARCHAR(255) NULL,
    file_size INT UNSIGNED NULL,
    file_format VARCHAR(20) NULL,
    resource_type VARCHAR(20) NOT NULL DEFAULT 'raw',
    youtube_video_id VARCHAR(50) NULL,
    urutan INT NOT NULL DEFAULT 1,
    is_published TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = Terbit, 0 = Draft',
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' COMMENT 'Moderasi Admin/Moderator',
    moderated_by INT UNSIGNED NULL,
    moderated_at TIMESTAMP NULL,
    moderation_note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mi_pertemuan
        FOREIGN KEY (pertemuan_id) REFERENCES materi_pertemuan(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mi_uploader
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_mi_moderator
        FOREIGN KEY (moderated_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_materi_urutan (pertemuan_id, urutan),
    INDEX idx_materi_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabel Progress Belajar Mahasiswa
CREATE TABLE IF NOT EXISTS materi_progress (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materi_item_id INT UNSIGNED NOT NULL,
    mahasiswa_id INT UNSIGNED NOT NULL,
    is_completed TINYINT(1) NOT NULL DEFAULT 1,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mprog_item
        FOREIGN KEY (materi_item_id) REFERENCES materi_item(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mprog_mhs
        FOREIGN KEY (mahasiswa_id) REFERENCES users(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_item_mhs_prog (materi_item_id, mahasiswa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

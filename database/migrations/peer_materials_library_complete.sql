-- ============================================================================
-- FILE: database/migrations/peer_materials_library_complete.sql
-- DESKRIPSI: Skema Lengkap Modul A: Perpustakaan Materi (Peer-to-Peer)
-- Universitas Nasional Pasim Bandung
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Master Program Studi
CREATE TABLE IF NOT EXISTS prodi (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(20) NOT NULL UNIQUE COMMENT 'Contoh: TIF, SI, MNJ, AKT',
    nama VARCHAR(100) NOT NULL COMMENT 'Contoh: S1 Teknik Informatika',
    jenjang ENUM('D3', 'S1', 'S2') NOT NULL DEFAULT 'S1',
    fakultas VARCHAR(100) NOT NULL DEFAULT 'Fakultas Ilmu Komputer & Desain',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Master Mata Kuliah (Katalog Akademik Kurikulum 1-8)
CREATE TABLE IF NOT EXISTS mata_kuliah (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(20) NOT NULL UNIQUE COMMENT 'Contoh: IF1101, IF3105',
    nama VARCHAR(150) NOT NULL COMMENT 'Contoh: Algoritma & Pemrograman',
    sks TINYINT UNSIGNED NOT NULL DEFAULT 3,
    prodi_id INT UNSIGNED NULL,
    semester_rekomendasi TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Semester kurikulum 1 s.d. 8',
    deskripsi TEXT NULL,
    status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved' COMMENT 'Pending jika diusulkan mhs',
    proposed_by INT UNSIGNED NULL COMMENT 'Mahasiswa pengusul jika ada',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mk_prodi
        FOREIGN KEY (prodi_id) REFERENCES prodi(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_mk_proposer
        FOREIGN KEY (proposed_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_mk_prodi_sem (prodi_id, semester_rekomendasi),
    INDEX idx_mk_status (status)
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
        ON DELETE CASCADE,
    CONSTRAINT fk_mat_uploader
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mat_moderator
        FOREIGN KEY (moderated_by) REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_mat_status_course (status, mata_kuliah_id),
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
    INDEX idx_mf_materi (materi_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Riwayat Versi Berkas Materi
CREATE TABLE IF NOT EXISTS materi_version (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    materi_id INT UNSIGNED NOT NULL,
    version_num INT UNSIGNED NOT NULL DEFAULT 1,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT UNSIGNED NULL,
    changelog_note VARCHAR(255) NULL,
    created_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mv_materi
        FOREIGN KEY (materi_id) REFERENCES materi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_mv_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE CASCADE
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
    UNIQUE KEY uq_materi_user_vote (materi_id, user_id)
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
        ON DELETE CASCADE
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
        ON DELETE CASCADE
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
    UNIQUE KEY uq_koleksi_materi (koleksi_id, materi_id)
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
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Paket Belajar Semester (Kurasi Moderator/Admin)
CREATE TABLE IF NOT EXISTS paket_belajar (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prodi_id INT UNSIGNED NOT NULL,
    semester TINYINT UNSIGNED NOT NULL COMMENT '1 sampai 8',
    judul VARCHAR(150) NOT NULL COMMENT 'Contoh: Starter Pack Semester 1 Teknik Informatika',
    deskripsi TEXT NULL,
    created_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pb_prodi
        FOREIGN KEY (prodi_id) REFERENCES prodi(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pb_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE CASCADE
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
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Seeder Data Awal Master Prodi
INSERT IGNORE INTO prodi (id, kode, nama, jenjang, fakultas) VALUES
(1, 'TIF', 'Teknik Informatika', 'S1', 'Fakultas Ilmu Komputer & Desain'),
(2, 'SI', 'Sistem Informasi', 'S1', 'Fakultas Ilmu Komputer & Desain'),
(3, 'MNJ', 'Manajemen', 'S1', 'Fakultas Ekonomi & Bisnis'),
(4, 'AKT', 'Akuntansi', 'S1', 'Fakultas Ekonomi & Bisnis'),
(5, 'KOM', 'Ilmu Komunikasi', 'S1', 'Fakultas Ilmu Sosial & Humaniora');

-- 13. Seeder Data Awal Master Mata Kuliah (Per Semester Rekomendasi 1-8)
INSERT IGNORE INTO mata_kuliah (id, kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status) VALUES
(1, 'IF1101', 'Dasar Pemrograman & Logika', 3, 1, 1, 'Pengenalan logika algoritma, tipe data, percabangan, perulangan, dan fungsi.', 'approved'),
(2, 'IF1102', 'Matematika Diskrit', 3, 1, 1, 'Himpunan, logika proposisional, relasi fungsi, dan graf.', 'approved'),
(3, 'IF1103', 'Pengantar Teknologi Informasi', 2, 1, 1, 'Konsep sistem komputer, hardware, software, dan internet.', 'approved'),
(4, 'IF1201', 'Struktur Data & Algoritma', 3, 1, 2, 'Array, stack, queue, linked list, tree, graph, sorting & searching.', 'approved'),
(5, 'IF1202', 'Arsitektur & Organisasi Komputer', 3, 1, 2, 'Struktur CPU, memori, instruksi set, dan pipeline.', 'approved'),
(6, 'IF2101', 'Pemrograman Berorientasi Objek', 3, 1, 3, 'OOP, class, object, inheritance, polymorphism, encapsulation.', 'approved'),
(7, 'IF2102', 'Sistem Basis Data', 3, 1, 3, 'Model data relasional, ERD, normalisasi, dan SQL query.', 'approved'),
(8, 'IF2201', 'Pemrograman Web Lanjut', 3, 1, 4, 'Full-stack web modern, REST API, Node.js, Express, dan React.', 'approved'),
(9, 'IF2202', 'Rekayasa Perangkat Lunak', 3, 1, 4, 'SDLC, Agile Scrum, requirement analysis, UML, dan software testing.', 'approved'),
(10, 'IF3101', 'Kecerdasan Buatan', 3, 1, 5, 'Search algorithm, machine learning dasar, neural network, dan NLP.', 'approved'),
(11, 'IF3102', 'Jaringan Komputer & Keamanan', 3, 1, 5, 'OSI Layer, TCP/IP, subnetting, routing, firewall, dan kriptografi.', 'approved'),
(12, 'IF3201', 'Pengembangan Aplikasi Mobile', 3, 1, 6, 'Android, React Native/Flutter, state management, dan mobile UI.', 'approved'),
(13, 'IF4101', 'Metodologi Penelitian & Skripsi', 2, 1, 7, 'Penyusunan proposal skripsi, kajian literatur, dan etika penelitian.', 'approved'),
(14, 'IF4201', 'Tugas Akhir / Skripsi', 6, 1, 8, 'Implementasi dan sidang tugas akhir kesarjanaan.', 'approved'),
(15, 'SI1101', 'Pengantar Sistem Informasi', 3, 2, 1, 'Konsep dasar SI dalam organisasi dan bisnis.', 'approved'),
(16, 'SI2101', 'Analisis & Perancangan Sistem', 3, 2, 3, 'DFD, UML, BPMN, dan analisis kebutuhan bisnis.', 'approved'),
(17, 'MN1101', 'Pengantar Manajemen & Bisnis', 3, 3, 1, 'Prinsip manajemen, kepemimpinan, dan fungsi bisnis.', 'approved'),
(18, 'AK1101', 'Pengantar Akuntansi 1', 3, 4, 1, 'Siklus akuntansi perusahaan jasa dan dagang.', 'approved');

-- 14. Seeder Contoh Materi Pembelajaran Awal
INSERT IGNORE INTO materi (id, mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags, tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit, external_url, youtube_video_id, is_published, status, view_count, download_count) VALUES
(1, 1, 1, 'Catatan Rangkuman Lengkap Logika & Percabangan C++', 'ringkasan_catatan', 'Catatan tulisan tangan rapi + penjelasan sintaks if-else, switch-case, dan ternary operator disertai latihan soal.', 'logika,c++,algoritma,catatan', '2024/2025', '2022', 'Dr. Ahmad Fauzi, M.Kom', 'Catatan Mandiri Mahasiswa', NULL, NULL, 1, 'approved', 42, 18),
(2, 1, 1, 'Video Pembahasan Soal Logika & Algoritma Percabangan', 'video', 'Video penjelasan step-by-step trace tabel logika percabangan untuk persiapan kuis dan UTS.', 'video,youtube,c++,percabangan', '2024/2025', '2022', 'Dr. Ahmad Fauzi, M.Kom', 'Channel Belajar Pasim', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 1, 'approved', 85, 0),
(3, 2, 1, 'Kumpulan Latihan Soal Logika Proposisional & Himpunan', 'soal_latihan', 'Bank soal latihan mandiri materi himpunan dan tabel kebenaran lengkap dengan kunci pembahasan.', 'matdis,himpunan,soal', '2024/2025', '2021', 'Siti Nurhaliza, M.T', 'Catatan Kakak Tingkat 2021', NULL, NULL, 1, 'approved', 60, 25);

INSERT IGNORE INTO materi_file (id, materi_id, file_url, public_id, file_name, file_size, file_format, urutan) VALUES
(1, 1, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'dummy_pdf_1', 'Rangkuman_Logika_Percabangan_C++.pdf', 145000, 'pdf', 1),
(2, 3, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'dummy_pdf_2', 'Soal_Pembahasan_Matematika_Diskrit.pdf', 210000, 'pdf', 1);

-- 15. Seeder Contoh Paket Belajar Semester
INSERT IGNORE INTO paket_belajar (id, prodi_id, semester, judul, deskripsi, created_by) VALUES
(1, 1, 1, 'Starter Pack Semester 1 Teknik Informatika', 'Kumpulan materi dasar logika algoritma, matematika diskrit, dan pengantar teknologi informasi untuk mahasiswa baru.', 1);

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan) VALUES
(1, 1, 1),
(1, 3, 2);

SET FOREIGN_KEY_CHECKS = 1;

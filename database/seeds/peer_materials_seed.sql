-- ============================================================================
-- SEEDER: Data Awal Modul Perpustakaan Materi (Peer-to-Peer)
-- Jalankan opsional setelah database/schema.sql, database/seed.sql,
-- dan database/migrations/001_peer_materials_library_up.sql.
-- ============================================================================

USE db_portal_pasim;

INSERT IGNORE INTO prodi (id, kode, nama, jenjang, fakultas) VALUES
(1, 'TIF', 'Teknik Informatika', 'S1', 'Fakultas Ilmu Komputer & Desain'),
(2, 'SI', 'Sistem Informasi', 'S1', 'Fakultas Ilmu Komputer & Desain'),
(3, 'MNJ', 'Manajemen', 'S1', 'Fakultas Ekonomi & Bisnis'),
(4, 'AKT', 'Akuntansi', 'S1', 'Fakultas Ekonomi & Bisnis'),
(5, 'KOM', 'Ilmu Komunikasi', 'S1', 'Fakultas Ilmu Sosial & Humaniora');

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

INSERT IGNORE INTO materi (
    id, mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
    tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
    external_url, youtube_video_id, is_published, status, view_count, download_count
) VALUES
(1, 1, 3, 'Catatan Rangkuman Lengkap Logika & Percabangan C++', 'ringkasan_catatan',
 'Catatan tulisan tangan rapi + penjelasan sintaks if-else, switch-case, dan ternary operator disertai latihan soal.',
 'logika,c++,algoritma,catatan', '2024/2025', '2022', 'Dr. Ahmad Fauzi, M.Kom', 'Catatan Mandiri Mahasiswa',
 NULL, NULL, 1, 'approved', 42, 18),
(2, 1, 4, 'Video Pembahasan Soal Logika & Algoritma Percabangan', 'video',
 'Video penjelasan step-by-step trace tabel logika percabangan untuk persiapan kuis dan UTS.',
 'video,youtube,c++,percabangan', '2024/2025', '2023', 'Dr. Ahmad Fauzi, M.Kom', 'Channel Belajar Pasim',
 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 1, 'approved', 85, 0),
(3, 2, 3, 'Kumpulan Latihan Soal Logika Proposisional & Himpunan', 'soal_latihan',
 'Bank soal latihan mandiri materi himpunan dan tabel kebenaran lengkap dengan kunci pembahasan.',
 'matdis,himpunan,soal', '2024/2025', '2022', 'Siti Nurhaliza, M.T', 'Catatan Alumni 2022',
 NULL, NULL, 1, 'approved', 60, 25);

INSERT IGNORE INTO materi_file (id, materi_id, file_url, public_id, file_name, file_size, file_format, urutan) VALUES
(1, 1, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', NULL, 'Rangkuman_Logika_Percabangan_C++.pdf', 145000, 'pdf', 1),
(2, 3, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', NULL, 'Soal_Pembahasan_Matematika_Diskrit.pdf', 210000, 'pdf', 1);

INSERT IGNORE INTO paket_belajar (id, prodi_id, semester, judul, deskripsi, created_by) VALUES
(1, 1, 1, 'Starter Pack Semester 1 Teknik Informatika',
 'Kumpulan materi dasar logika algoritma, matematika diskrit, dan pengantar teknologi informasi untuk mahasiswa baru.', 2);

INSERT IGNORE INTO paket_belajar_item (paket_belajar_id, materi_id, urutan) VALUES
(1, 1, 1),
(1, 3, 2);

-- ============================================================================
-- FILE: database/seeders/academic_seed.sql
-- DESKRIPSI: Data Seeder Master Akademik, Dosen, Asisten, Kelas, Tugas & Materi
-- UNIVERSITAS NASIONAL PASIM BANDUNG
-- ============================================================================

-- 1. Tambah Akun Demo Dosen & Asisten Lab (Password: Pasim123!)
INSERT INTO users (
    nim, full_name, email, password_hash, role, status, prodi, angkatan_year,
    avatar_url, bio, current_job, linkedin_url, github_url, is_public_profile, verified_at, verified_by
) VALUES
('DOSEN-001', 'Dr. Hendra Wijaya, M.Kom.', 'dr.hendra@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'dosen', 'active', 'S1 Teknik Informatika', NULL,
 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
 'Dosen Pengampu Pemrograman Web & Arsitektur Perangkat Lunak UNAS PASIM.', 'Dosen Tetap Fasilkom PASIM', 'https://linkedin.com', 'https://github.com', 1, NOW(), 1),

('ASLAB-001', 'Budi Santoso, S.Kom.', 'budi.aslab@pasim.ac.id', '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO', 'asisten_lab', 'active', 'S1 Teknik Informatika', NULL,
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
 'Asisten Laboratorium Rekayasa Perangkat Lunak & Basis Data PASIM.', 'Asisten Lab Komputer', 'https://linkedin.com', 'https://github.com', 1, NOW(), 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role);

-- 2. Master Program Studi
INSERT INTO prodi (kode, nama, jenjang, fakultas) VALUES
('TIF', 'S1 Teknik Informatika', 'S1', 'Fakultas Ilmu Komputer & Desain'),
('SI', 'S1 Sistem Informasi', 'S1', 'Fakultas Ilmu Komputer & Desain'),
('MNJ', 'S1 Manajemen', 'S1', 'Fakultas Ekonomi & Bisnis'),
('AKT', 'S1 Akuntansi', 'S1', 'Fakultas Ekonomi & Bisnis'),
('PSI', 'S1 Psikologi', 'S1', 'Fakultas Psikologi'),
('SASJAP', 'S1 Sastra Jepang', 'S1', 'Fakultas Sastra')
ON DUPLICATE KEY UPDATE nama = VALUES(nama);

-- 3. Master Semester Akademik
INSERT INTO semester_akademik (id, nama, tahun_ajaran, semester, tanggal_mulai, tanggal_selesai, is_active) VALUES
(1, '2026/2027 Ganjil', '2026/2027', 'ganjil', '2026-09-01', '2027-01-31', 1),
(2, '2025/2026 Genap', '2025/2026', 'genap', '2026-02-01', '2026-06-30', 0)
ON DUPLICATE KEY UPDATE nama = VALUES(nama), is_active = VALUES(is_active);

-- 4. Master Mata Kuliah
INSERT INTO mata_kuliah (id, kode, nama, sks, prodi, semester_paket, deskripsi) VALUES
(1, 'IF3105', 'Pemrograman Web Lanjut', 3, 'S1 Teknik Informatika', 5, 'Membahas arsitektur microservices, RESTful API Express, JWT Auth, Cloudinary, dan SPA React Vite.'),
(2, 'IF3102', 'Rekayasa Perangkat Lunak', 3, 'S1 Teknik Informatika', 5, 'Metodologi Agile, Scrum, perancangan diagram UML, SDLC, dan pengujian perangkat lunak terintegrasi.'),
(3, 'IF3108', 'Basis Data Terdistribusi', 3, 'S1 Teknik Informatika', 5, 'Replikasi, sharding, transaksi ACID, query optimization, dan database NoSQL.')
ON DUPLICATE KEY UPDATE nama = VALUES(nama);

-- 5. Kelas Mata Kuliah
INSERT INTO kelas (id, mata_kuliah_id, semester_akademik_id, nama, ruangan, hari_jadwal, jam_mulai, jam_selesai, kuota) VALUES
(1, 1, 1, 'TIF-22A', 'Lab Komputer 2', 'Selasa', '08:00:00', '10:30:00', 40),
(2, 2, 1, 'TIF-22A', 'Ruang Teori 302', 'Rabu', '10:30:00', '13:00:00', 40),
(3, 3, 1, 'TIF-22B', 'Lab Jaringan 1', 'Kamis', '13:30:00', '16:00:00', 35)
ON DUPLICATE KEY UPDATE nama = VALUES(nama);

-- 6. User Kontributor Pembagi Materi
SET @mhs_rizky_id = (SELECT id FROM users WHERE email = 'rizky.mhs@pasim.ac.id' LIMIT 1);

-- 7. Struktur 16 Pertemuan Materi Kuliah Kelas 1 (Pemrograman Web Lanjut)
INSERT INTO materi_pertemuan (id, kelas_id, nomor_pertemuan, judul, deskripsi, is_uts, is_uas) VALUES
(1, 1, 1, 'Pertemuan 1: Pengantar Pemrograman Web Lanjut & Kontrak Kuliah', 'Orientasi mata kuliah, pengenalan arsitektur modern web, dan silabus pembelajaran.', 0, 0),
(2, 1, 2, 'Pertemuan 2: Arsitektur RESTful API & Konfigurasi Express.js', 'Struktur folder clean code, middleware express, router modular, dan environment variables.', 0, 0),
(3, 1, 3, 'Pertemuan 3: Integrasi Database MySQL & Connection Pooling', 'Optimalisasi koneksi mysql2 pool, query parameterized, dan penanganan error terpusat.', 0, 0),
(4, 1, 4, 'Pertemuan 4: Autentikasi Modern: JWT & Cookie Security', 'Implementasi access token, refresh token rotation, XSS & CSRF defense.', 0, 0),
(5, 1, 5, 'Pertemuan 5: Pengelolaan Berkas Cloud: Cloudinary & Multer', 'Upload stream buffer, tipe asset raw vs image, dan private signed URL.', 0, 0),
(6, 1, 6, 'Pertemuan 6: Validasi Skema Data dengan Zod', 'Validasi request body, query params, sanitasi data, dan custom error formatter.', 0, 0),
(7, 1, 7, 'Pertemuan 7: Review & Simulasi Ujian Tengah Semester', 'Review materi pertemuan 1-6 dan persiapan studi kasus praktikum.', 0, 0),
(8, 1, 8, 'Pertemuan 8: Ujian Tengah Semester (UTS)', 'Pelaksanaan UTS Praktik Pemrograman Web Lanjut.', 1, 0),
(9, 1, 9, 'Pertemuan 9: Frontend Modern dengan React Vite & Tailwind', 'Komponen modular, hooks state management Zustand, dan styling responsif.', 0, 0),
(10, 1, 10, 'Pertemuan 10: State Management & Axios Interceptor', 'Manajemen sesi global, auto refresh token di interceptor response 401.', 0, 0),
(11, 1, 11, 'Pertemuan 11: Real-time UI: Countdown Timer & WebSocket Konsep', 'Penanganan countdown bebas drift dan update status submission dinamis.', 0, 0),
(12, 1, 12, 'Pertemuan 12: Integrasi Komponen UI: PDF Viewer & YouTube Embed', 'Embed video kuliah YouTube, pratinjau dokumen PDF di browser.', 0, 0),
(13, 1, 13, 'Pertemuan 13: Export Data & Streaming ZIP dengan Archiver', 'Arsitektur streaming file tanpa membebani RAM server dan sanitasi path traversal.', 0, 0),
(14, 1, 14, 'Pertemuan 14: Automated Task Scheduler dengan Node-Cron', 'Pengingat deadline otomatis dan background notification service.', 0, 0),
(15, 1, 15, 'Pertemuan 15: Final Review & Demo Proyek Aplikasi', 'Presentasi milestone proyek tugas besar antar kelompok mahasiswa.', 0, 0),
(16, 1, 16, 'Pertemuan 16: Ujian Akhir Semester (UAS)', 'Pengumpulan dan penilaian proyek akhir portal akademik.', 0, 1)
ON DUPLICATE KEY UPDATE judul = VALUES(judul);

-- 8. Item Materi Pertemuan 1 & 2 (Dibagikan oleh Mahasiswa/Alumni, Status: approved)
INSERT INTO materi_item (id, pertemuan_id, uploaded_by, tipe, judul, deskripsi, url, public_id, file_size, file_format, resource_type, youtube_video_id, urutan, is_published, status) VALUES
(1, 1, @mhs_rizky_id, 'silabus', 'Silabus & Kontrak Kuliah Pemrograman Web Lanjut', 'Rancangan pembelajaran semester (RPS) dan ringkasan topik perkuliahan.', 'https://res.cloudinary.com/xph6jy6u/raw/upload/v1/portal/rps_pemweb.pdf', 'portal/rps_pemweb', 520000, 'pdf', 'raw', NULL, 1, 1, 'approved'),
(2, 1, @mhs_rizky_id, 'slide', 'Slide 01: Pengantar Arsitektur Web Modern', 'Slide presentasi pengenalan web stack modern (MERN/Node+React).', 'https://res.cloudinary.com/xph6jy6u/raw/upload/v1/portal/slide_01.pdf', 'portal/slide_01', 1250000, 'pdf', 'raw', NULL, 2, 1, 'approved'),
(3, 1, @mhs_rizky_id, 'rekaman', 'Rekaman Kuliah: Pengantar Web Lanjut & Tooling', 'Video rekaman Zoom pertemuan pembuka.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, NULL, NULL, 'raw', 'dQw4w9WgXcQ', 3, 1, 'approved'),
(4, 2, @mhs_rizky_id, 'slide', 'Slide 02: Arsitektur RESTful API & Best Practice Express', 'Konsep status code, HTTP methods, dan arsitektur controller-service-query.', 'https://res.cloudinary.com/xph6jy6u/raw/upload/v1/portal/slide_02.pdf', 'portal/slide_02', 1420000, 'pdf', 'raw', NULL, 1, 1, 'approved'),
(5, 2, @mhs_rizky_id, 'modul_praktikum', 'Modul Praktikum 01: Setup Express.js Boilerplate', 'Panduan langkah demi langkah inisialisasi project Node.js dan testing Postman.', 'https://res.cloudinary.com/xph6jy6u/raw/upload/v1/portal/modul_01.pdf', 'portal/modul_01', 890000, 'pdf', 'raw', NULL, 2, 1, 'approved')
ON DUPLICATE KEY UPDATE judul = VALUES(judul);

-- 9. Contoh Progress Belajar Materi (Rizky sudah mempelajari item 1 & 2)
INSERT INTO materi_progress (materi_item_id, mahasiswa_id, is_completed, completed_at) VALUES
(1, @mhs_rizky_id, 1, NOW()),
(2, @mhs_rizky_id, 1, NOW())
ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed);

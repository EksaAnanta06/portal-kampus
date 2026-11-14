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

USE db_portal_pasim;

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

-- 5. SEED PHOTO LIKES
INSERT INTO photo_likes (photo_id, user_id) VALUES
(1, 1), (1, 2), (1, 4), (1, 5),
(2, 1), (2, 3), (2, 4),
(3, 1), (3, 2), (3, 3), (3, 5),
(5, 2), (5, 4);

-- 6. SEED PHOTO COMMENTS
INSERT INTO photo_comments (id, photo_id, user_id, content) VALUES
(1, 1, 4, 'Selamat Kak Dinda dan teman-teman Angkatan 2022! Semoga sukses selalu di dunia kerja.'),
(2, 1, 3, 'Terima kasih banyak Rizky! Semangat terus kuliahnya sampai wisuda nanti ya.'),
(3, 3, 2, 'Acara kemarin seru banget, pematerinya daging semua. Ditunggu workshop lanjutannya!'),
(4, 5, 5, 'Kangen banget suasana PKKMB hari pertama kenal teman-teman seangkatan!');

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

-- ============================================================================
-- SEEDER: Data Awal Modul Materi Perpustakaan (Peer-to-Peer)
-- Diselaraskan dengan Kurikulum & Jadwal UTS Semester Ganjil 2026/2027
-- Universitas Nasional Pasim Bandung
-- Idempoten (aman dijalankan pada DB baru maupun DB existing dengan INSERT IGNORE)
-- ============================================================================

USE db_portal_pasim;

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

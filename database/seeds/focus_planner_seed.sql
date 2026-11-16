-- ============================================================================
-- SEEDER: Contoh Data Penjadwalan Tugas Pribadi Mandiri, Sesi Kerja, Fokus & Pengingat
-- Universitas Nasional Pasim Bandung
-- Jalankan setelah database/schema.sql, database/seed.sql,
-- dan database/migrations/004_focus_planner_timer_up.sql.
-- Tidak bergantung pada tabel LMS/mata kuliah; semua tugas & kategori dibuat oleh user sendiri.
-- Semua waktu DATETIME disimpan dalam UTC.
-- ============================================================================

USE db_portal_pasim;

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

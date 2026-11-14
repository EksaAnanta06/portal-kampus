// FILE: server/src/config/db.js
import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  timezone: '+07:00',
});

export const syncDatabaseSchema = async () => {
  try {
    // 1. Master Program Studi
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prodi (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        kode VARCHAR(20) NOT NULL UNIQUE,
        nama VARCHAR(100) NOT NULL,
        jenjang ENUM('D3', 'S1', 'S2') NOT NULL DEFAULT 'S1',
        fakultas VARCHAR(100) NOT NULL DEFAULT 'Fakultas Ilmu Komputer & Desain',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Master Mata Kuliah
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mata_kuliah (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        kode VARCHAR(20) NOT NULL UNIQUE,
        nama VARCHAR(150) NOT NULL,
        sks TINYINT UNSIGNED NOT NULL DEFAULT 3,
        prodi_id INT UNSIGNED NULL,
        semester_rekomendasi TINYINT UNSIGNED NOT NULL DEFAULT 1,
        deskripsi TEXT NULL,
        status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved',
        proposed_by INT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_mk_prodi_sem (prodi_id, semester_rekomendasi),
        INDEX idx_mk_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Pastikan kolom baru di mata_kuliah sudah ada jika tabel sudah dibuat sebelumnya
    const [mkCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah'`
    );
    const existingMkCols = mkCols.map((c) => c.COLUMN_NAME);

    if (!existingMkCols.includes('prodi_id')) {
      console.log('🔄 [AUTO-MIGRATION] Menambahkan kolom prodi_id ke mata_kuliah...');
      await pool.query('ALTER TABLE mata_kuliah ADD COLUMN prodi_id INT UNSIGNED NULL AFTER sks');
      await pool.query('UPDATE mata_kuliah SET prodi_id = 1 WHERE prodi_id IS NULL');
    }
    if (!existingMkCols.includes('semester_rekomendasi')) {
      console.log('🔄 [AUTO-MIGRATION] Menambahkan kolom semester_rekomendasi ke mata_kuliah...');
      await pool.query(
        'ALTER TABLE mata_kuliah ADD COLUMN semester_rekomendasi TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER prodi_id'
      );
      if (existingMkCols.includes('semester_paket')) {
        await pool.query(
          'UPDATE mata_kuliah SET semester_rekomendasi = COALESCE(semester_paket, 1) WHERE semester_paket IS NOT NULL'
        );
      }
    }
    if (!existingMkCols.includes('status')) {
      console.log('🔄 [AUTO-MIGRATION] Menambahkan kolom status ke mata_kuliah...');
      await pool.query(
        `ALTER TABLE mata_kuliah ADD COLUMN status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved' AFTER deskripsi`
      );
    }
    if (!existingMkCols.includes('proposed_by')) {
      console.log('🔄 [AUTO-MIGRATION] Menambahkan kolom proposed_by ke mata_kuliah...');
      await pool.query('ALTER TABLE mata_kuliah ADD COLUMN proposed_by INT UNSIGNED NULL AFTER status');
    }

    // 3. Entitas Materi Utama (Peer-to-Peer)
    await pool.query(`
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
        tags VARCHAR(255) NULL,
        tahun_akademik VARCHAR(20) NULL,
        angkatan_kontributor VARCHAR(10) NULL,
        dosen_pengampu_teks VARCHAR(150) NULL,
        sumber_kredit VARCHAR(255) NULL,
        external_url VARCHAR(500) NULL,
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
        INDEX idx_mat_status_course (status, mata_kuliah_id),
        INDEX idx_mat_uploader (uploaded_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Berkas Lampiran Materi (Multiple Files)
    await pool.query(`
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
        INDEX idx_mf_materi (materi_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Riwayat Versi Berkas Materi
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materi_version (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        materi_id INT UNSIGNED NOT NULL,
        version_num INT UNSIGNED NOT NULL DEFAULT 1,
        file_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size INT UNSIGNED NULL,
        changelog_note VARCHAR(255) NULL,
        created_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Vote Bermanfaat (Helpful Votes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materi_vote (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        materi_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_materi_user_vote (materi_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Komentar & Diskusi Tanya Jawab
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materi_komentar (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        materi_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        parent_id INT UNSIGNED NULL,
        konten TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Koleksi Saya (Bookmark)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materi_koleksi (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        nama VARCHAR(100) NOT NULL,
        deskripsi VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS materi_koleksi_item (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        koleksi_id INT UNSIGNED NOT NULL,
        materi_id INT UNSIGNED NOT NULL,
        added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_koleksi_materi (koleksi_id, materi_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Papan "Minta Materi"
    await pool.query(`
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
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Paket Belajar Semester
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paket_belajar (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        prodi_id INT UNSIGNED NOT NULL,
        semester TINYINT UNSIGNED NOT NULL,
        judul VARCHAR(150) NOT NULL,
        deskripsi TEXT NULL,
        created_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS paket_belajar_item (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        paket_belajar_id INT UNSIGNED NOT NULL,
        materi_id INT UNSIGNED NOT NULL,
        urutan INT NOT NULL DEFAULT 1,
        UNIQUE KEY uq_paket_materi (paket_belajar_id, materi_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Pelaporan Materi & Takedown
    await pool.query(`
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
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Seeder Prodi awal jika kosong
    const [pRows] = await pool.query('SELECT COUNT(*) as c FROM prodi');
    if (pRows[0]?.c === 0) {
      await pool.query(`
        INSERT INTO prodi (id, kode, nama, jenjang, fakultas) VALUES
        (1, 'TIF', 'Teknik Informatika', 'S1', 'Fakultas Ilmu Komputer & Desain'),
        (2, 'SI', 'Sistem Informasi', 'S1', 'Fakultas Ilmu Komputer & Desain'),
        (3, 'MNJ', 'Manajemen', 'S1', 'Fakultas Ekonomi & Bisnis'),
        (4, 'AKT', 'Akuntansi', 'S1', 'Fakultas Ekonomi & Bisnis'),
        (5, 'KOM', 'Ilmu Komunikasi', 'S1', 'Fakultas Ilmu Sosial & Humaniora');
      `);
    }

    // Normalisasi data existing jika ada kolom NULL atau 0
    await pool.query('UPDATE mata_kuliah SET prodi_id = 1 WHERE prodi_id IS NULL');
    await pool.query(
      'UPDATE mata_kuliah SET semester_rekomendasi = 1 WHERE semester_rekomendasi IS NULL OR semester_rekomendasi = 0'
    );

    // Seeder Mata Kuliah kurikulum 1-8 prodi lengkap (INSERT IGNORE aman tanpa duplikasi)
    await pool.query(`
      INSERT IGNORE INTO mata_kuliah (kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status) VALUES
      ('IF1101', 'Dasar Pemrograman & Logika', 3, 1, 1, 'Pengenalan logika algoritma, tipe data, percabangan, perulangan, dan fungsi.', 'approved'),
      ('IF1102', 'Matematika Diskrit', 3, 1, 1, 'Himpunan, logika proposisional, relasi fungsi, dan graf.', 'approved'),
      ('IF1103', 'Pengantar Teknologi Informasi', 2, 1, 1, 'Konsep sistem komputer, hardware, software, dan internet.', 'approved'),
      ('IF1201', 'Struktur Data & Algoritma', 3, 1, 2, 'Array, stack, queue, linked list, tree, graph, sorting & searching.', 'approved'),
      ('IF1202', 'Arsitektur & Organisasi Komputer', 3, 1, 2, 'Struktur CPU, memori, instruksi set, dan pipeline.', 'approved'),
      ('IF2101', 'Pemrograman Berorientasi Objek', 3, 1, 3, 'OOP, class, object, inheritance, polymorphism, encapsulation.', 'approved'),
      ('IF2102', 'Sistem Basis Data', 3, 1, 3, 'Model data relasional, ERD, normalisasi, dan SQL query.', 'approved'),
      ('IF2201', 'Pemrograman Web Lanjut', 3, 1, 4, 'Full-stack web modern, REST API, Node.js, Express, dan React.', 'approved'),
      ('IF2202', 'Rekayasa Perangkat Lunak', 3, 1, 4, 'SDLC, Agile Scrum, requirement analysis, UML, dan software testing.', 'approved'),
      ('IF3101', 'Kecerdasan Buatan', 3, 1, 5, 'Search algorithm, machine learning dasar, neural network, dan NLP.', 'approved'),
      ('IF3102', 'Jaringan Komputer & Keamanan', 3, 1, 5, 'OSI Layer, TCP/IP, subnetting, routing, firewall, dan kriptografi.', 'approved'),
      ('IF3201', 'Pengembangan Aplikasi Mobile', 3, 1, 6, 'Android, React Native/Flutter, state management, dan mobile UI.', 'approved'),
      ('IF4101', 'Metodologi Penelitian & Skripsi', 2, 1, 7, 'Penyusunan proposal skripsi, kajian literatur, dan etika penelitian.', 'approved'),
      ('IF4201', 'Tugas Akhir / Skripsi', 6, 1, 8, 'Implementasi dan sidang tugas akhir kesarjanaan.', 'approved'),
      ('SI1101', 'Pengantar Sistem Informasi', 3, 2, 1, 'Konsep dasar SI dalam organisasi dan transformasi proses bisnis.', 'approved'),
      ('SI2101', 'Analisis & Perancangan Sistem', 3, 2, 3, 'DFD, UML, BPMN, dan analisis kebutuhan pengguna.', 'approved'),
      ('MN1101', 'Pengantar Manajemen & Bisnis', 3, 3, 1, 'Prinsip dasar manajemen, kepemimpinan, dan fungsi bisnis.', 'approved'),
      ('AK1101', 'Pengantar Akuntansi 1', 3, 4, 1, 'Siklus akuntansi perusahaan jasa dan dagang.', 'approved');
    `);

    // Bersihkan tabel tugas & LMS lama yang sudah tidak dipakai
    await pool.query('DROP TABLE IF EXISTS materi_progress');
    await pool.query('DROP TABLE IF EXISTS penilaian');
    await pool.query('DROP TABLE IF EXISTS pengumpulan_berkas');
    await pool.query('DROP TABLE IF EXISTS pengumpulan');
    await pool.query('DROP TABLE IF EXISTS tugas_lampiran');
    await pool.query('DROP TABLE IF EXISTS tugas');
    await pool.query('DROP TABLE IF EXISTS kelas_pengajar');
    await pool.query('DROP TABLE IF EXISTS kelas_peserta');

    console.log('✅ [AUTO-MIGRATION] Seluruh skema perpustakaan materi peer-to-peer berhasil diverifikasi.');
  } catch (err) {
    console.warn('⚠️ [AUTO-MIGRATION] Peringatan saat sinkronisasi skema DB:', err.message);
  }
};

export const testDbConnection = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    console.log(`[DB] Terhubung ke MySQL (${env.db.database} di ${env.db.host}:${env.db.port})`);
    // Jalankan auto-migration agar skema selalu sinkron
    await syncDatabaseSchema();
  } finally {
    connection.release();
  }
};

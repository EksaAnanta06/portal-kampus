// FILE: server/src/queries/material.queries.js
import { pool } from '../config/db.js';

let isAcademicSchemaChecked = false;

export const ensureAcademicSchema = async () => {
  if (isAcademicSchemaChecked) return;
  try {
    // 1. Pastikan tabel prodi ada
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

    // Isi seeder prodi jika kosong
    const [pCount] = await pool.query('SELECT COUNT(*) as c FROM prodi');
    if (pCount[0]?.c === 0) {
      await pool.query(`
        INSERT IGNORE INTO prodi (id, kode, nama, jenjang, fakultas) VALUES
        (1, 'TIF', 'Teknik Informatika', 'S1', 'Fakultas Ilmu Komputer & Desain'),
        (2, 'SI', 'Sistem Informasi', 'S1', 'Fakultas Ilmu Komputer & Desain'),
        (3, 'MNJ', 'Manajemen', 'S1', 'Fakultas Ekonomi & Bisnis'),
        (4, 'AKT', 'Akuntansi', 'S1', 'Fakultas Ekonomi & Bisnis'),
        (5, 'KOM', 'Ilmu Komunikasi', 'S1', 'Fakultas Ilmu Sosial & Humaniora');
      `);
    }

    // 2. Pastikan tabel mata_kuliah ada
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
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Verifikasi kolom di mata_kuliah
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mata_kuliah'`
    );
    const colNames = cols.map((c) => c.COLUMN_NAME);

    if (!colNames.includes('prodi_id')) {
      await pool.query('ALTER TABLE mata_kuliah ADD COLUMN prodi_id INT UNSIGNED NULL AFTER sks');
    }
    if (!colNames.includes('semester_rekomendasi')) {
      await pool.query(
        'ALTER TABLE mata_kuliah ADD COLUMN semester_rekomendasi TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER prodi_id'
      );
      if (colNames.includes('semester_paket')) {
        await pool.query(
          'UPDATE mata_kuliah SET semester_rekomendasi = COALESCE(semester_paket, 1) WHERE semester_paket IS NOT NULL'
        );
      }
    }
    if (!colNames.includes('status')) {
      await pool.query(
        `ALTER TABLE mata_kuliah ADD COLUMN status ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved' AFTER deskripsi`
      );
    }
    if (!colNames.includes('proposed_by')) {
      await pool.query('ALTER TABLE mata_kuliah ADD COLUMN proposed_by INT UNSIGNED NULL AFTER status');
    }

    // Normalisasi data existing jika ada kolom NULL atau 0
    await pool.query('UPDATE mata_kuliah SET prodi_id = 1 WHERE prodi_id IS NULL');
    await pool.query(
      'UPDATE mata_kuliah SET semester_rekomendasi = 1 WHERE semester_rekomendasi IS NULL OR semester_rekomendasi = 0'
    );

    // Seeder MK kurikulum 1-8 prodi lengkap (INSERT IGNORE aman tanpa duplikasi)
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

    // 3. Pastikan tabel materi ada
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
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Pastikan tabel materi_file ada
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
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Pastikan tabel materi_version ada
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

    // 6. Pastikan tabel materi_vote ada
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materi_vote (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        materi_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_materi_user_vote (materi_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Pastikan tabel materi_komentar ada
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

    // 8. Pastikan tabel materi_koleksi & item ada
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

    // 9. Pastikan tabel materi_request ada
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

    // 10. Pastikan tabel paket_belajar & item ada
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

    // 11. Pastikan tabel materi_laporan ada
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

    // Seeder contoh materi awal jika repositori masih kosong
    const [matCount] = await pool.query('SELECT COUNT(*) as c FROM materi');
    if (matCount[0]?.c === 0) {
      const [uRows] = await pool.query('SELECT id, angkatan_year FROM users ORDER BY id ASC LIMIT 1');
      const seedUserId = uRows[0]?.id || 1;
      const seedAngkatan = uRows[0]?.angkatan_year || '2022';

      const [resMat1] = await pool.query(
        `INSERT INTO materi (
          mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
          tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
          external_url, youtube_video_id, is_published, status, view_count, download_count
        ) VALUES (
          1, ?, 'Catatan Rangkuman Lengkap Logika & Percabangan C++', 'ringkasan_catatan',
          'Catatan tulisan tangan rapi + penjelasan sintaks if-else, switch-case, dan ternary operator disertai latihan soal.',
          'logika,c++,algoritma,catatan', '2024/2025', ?, 'Dr. Ahmad Fauzi, M.Kom', 'Catatan Mandiri Mahasiswa',
          NULL, NULL, 1, 'approved', 42, 18
        )`,
        [seedUserId, seedAngkatan]
      );
      const matId1 = resMat1.insertId;

      await pool.query(
        `INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan)
         VALUES (?, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'dummy_pdf_1', 'Rangkuman_Logika_Percabangan_C++.pdf', 145000, 'pdf', 1)`,
        [matId1]
      );

      const [resMat2] = await pool.query(
        `INSERT INTO materi (
          mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
          tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
          external_url, youtube_video_id, is_published, status, view_count, download_count
        ) VALUES (
          1, ?, 'Video Pembahasan Soal Logika & Algoritma Percabangan', 'video',
          'Video penjelasan step-by-step trace tabel logika percabangan untuk persiapan kuis dan UTS.',
          'video,youtube,c++,percabangan', '2024/2025', ?, 'Dr. Ahmad Fauzi, M.Kom', 'Channel Belajar Pasim',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 1, 'approved', 85, 0
        )`,
        [seedUserId, seedAngkatan]
      );

      const [resMat3] = await pool.query(
        `INSERT INTO materi (
          mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
          tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
          external_url, youtube_video_id, is_published, status, view_count, download_count
        ) VALUES (
          2, ?, 'Kumpulan Latihan Soal Logika Proposisional & Himpunan', 'soal_latihan',
          'Bank soal latihan mandiri materi himpunan dan tabel kebenaran lengkap dengan kunci pembahasan.',
          'matdis,himpunan,soal', '2024/2025', ?, 'Siti Nurhaliza, M.T', 'Catatan Kakak Tingkat 2021',
          NULL, NULL, 1, 'approved', 60, 25
        )`,
        [seedUserId, seedAngkatan]
      );
      const matId3 = resMat3.insertId;

      await pool.query(
        `INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan)
         VALUES (?, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'dummy_pdf_2', 'Soal_Pembahasan_Matematika_Diskrit.pdf', 210000, 'pdf', 1)`,
        [matId3]
      );

      // Starter pack paket belajar semester 1
      const [resPkg] = await pool.query(
        `INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by)
         VALUES (1, 1, 'Starter Pack Semester 1 Teknik Informatika', 'Kumpulan materi dasar logika algoritma, matematika diskrit, dan pengantar teknologi informasi untuk mahasiswa baru.', ?)`,
        [seedUserId]
      );
      const pkgId = resPkg.insertId;

      await pool.query(
        `INSERT INTO paket_belajar_item (paket_belajar_id, materi_id, urutan) VALUES (?, ?, 1), (?, ?, 2)`,
        [pkgId, matId1, pkgId, matId3]
      );
    }

    isAcademicSchemaChecked = true;
  } catch (err) {
    console.warn('⚠️ Gagal sinkronisasi skema akademik di queries:', err.message);
  }
};

// ============================================================================
// 1. KATALOG AKADEMIK (PRODI & MATA KULIAH)
// ============================================================================

export const getProdiListQuery = async () => {
  await ensureAcademicSchema();
  const [rows] = await pool.query('SELECT * FROM prodi ORDER BY kode ASC');
  return rows;
};

export const createProdiQuery = async ({ kode, nama, jenjang = 'S1', fakultas }) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    'INSERT INTO prodi (kode, nama, jenjang, fakultas) VALUES (?, ?, ?, ?)',
    [kode, nama, jenjang, fakultas || 'Fakultas Ilmu Komputer & Desain']
  );
  return result.insertId;
};

export const getCoursesQuery = async ({
  prodiId = null,
  semesterRekomendasi = null,
  search = '',
  status = 'approved',
  includeAll = false,
}) => {
  await ensureAcademicSchema();
  const params = [];
  const whereClauses = [];

  if (!includeAll && status) {
    whereClauses.push('mk.status = ?');
    params.push(status);
  }

  if (prodiId) {
    whereClauses.push('(mk.prodi_id = ? OR mk.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (semesterRekomendasi) {
    whereClauses.push('(mk.semester_rekomendasi = ? OR mk.semester_rekomendasi = 0)');
    params.push(Number(semesterRekomendasi));
  }

  if (search && search.trim() !== '') {
    whereClauses.push('(mk.nama LIKE ? OR mk.kode LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      mk.id,
      mk.kode,
      mk.nama,
      mk.sks,
      mk.prodi_id,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      mk.semester_rekomendasi,
      mk.deskripsi,
      mk.status,
      mk.proposed_by,
      u.full_name AS proposer_nama,
      (
        SELECT COUNT(m.id)
        FROM materi m
        WHERE m.mata_kuliah_id = mk.id AND m.status = 'approved' AND m.is_published = 1
      ) AS total_materials
    FROM mata_kuliah mk
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = mk.proposed_by
    ${whereSql}
    ORDER BY mk.semester_rekomendasi ASC, mk.kode ASC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const getCourseByIdQuery = async (courseId) => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      mk.*,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama
    FROM mata_kuliah mk
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    WHERE mk.id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [courseId]);
  return rows[0] || null;
};

export const createCourseQuery = async ({
  kode,
  nama,
  sks = 3,
  prodi_id,
  semester_rekomendasi = 1,
  deskripsi = '',
  status = 'approved',
  proposed_by = null,
}) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    `INSERT INTO mata_kuliah (kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status, proposed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status, proposed_by]
  );
  return result.insertId;
};

export const approveProposedCourseQuery = async (id, status = 'approved') => {
  await ensureAcademicSchema();
  const [result] = await pool.query('UPDATE mata_kuliah SET status = ? WHERE id = ?', [status, id]);
  return result.affectedRows > 0;
};

export const updateCourseQuery = async (
  id,
  { kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status }
) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    `UPDATE mata_kuliah 
     SET kode = ?, nama = ?, sks = ?, prodi_id = ?, semester_rekomendasi = ?, deskripsi = ?, status = ?
     WHERE id = ?`,
    [kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status, id]
  );
  return result.affectedRows > 0;
};

export const deleteCourseQuery = async (id) => {
  await ensureAcademicSchema();
  const [result] = await pool.query('DELETE FROM mata_kuliah WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

// ============================================================================
// 2. REPOSITORI & KONTRIBUSI MATERI (PEER-TO-PEER)
// ============================================================================

export const getMaterialsQuery = async ({
  prodiId = null,
  semester = null,
  mataKuliahId = null,
  tipeMateri = null,
  tahun = null,
  search = '',
  sort = 'terbaru',
  status = null,
  currentUserId = null,
  role = null,
}) => {
  await ensureAcademicSchema();
  const params = [];
  const whereClauses = [];

  const isStaff = role === 'admin' || role === 'moderator';

  // Filter Status Moderasi
  if (status) {
    whereClauses.push('m.status = ?');
    params.push(status);
  } else if (!isStaff) {
    if (currentUserId) {
      whereClauses.push('(m.status = "approved" OR m.uploaded_by = ?)');
      params.push(currentUserId);
    } else {
      whereClauses.push('m.status = "approved"');
    }
    whereClauses.push('m.is_published = 1');
  }

  if (mataKuliahId) {
    whereClauses.push('m.mata_kuliah_id = ?');
    params.push(Number(mataKuliahId));
  }

  if (prodiId) {
    whereClauses.push('(mk.prodi_id = ? OR mk.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (semester) {
    whereClauses.push('(mk.semester_rekomendasi = ? OR mk.semester_rekomendasi = 0)');
    params.push(Number(semester));
  }

  if (tipeMateri) {
    whereClauses.push('m.tipe_materi = ?');
    params.push(tipeMateri);
  }

  if (tahun) {
    whereClauses.push('(m.tahun_akademik LIKE ? OR m.angkatan_kontributor LIKE ?)');
    params.push(`%${tahun}%`, `%${tahun}%`);
  }

  if (search && search.trim() !== '') {
    whereClauses.push(`(
      m.judul LIKE ? OR 
      m.deskripsi LIKE ? OR 
      m.tags LIKE ? OR 
      mk.nama LIKE ? OR 
      mk.kode LIKE ?
    )`);
    const s = `%${search.trim()}%`;
    params.push(s, s, s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Order sorting: terbaru, terpopuler (view/download), paling bermanfaat (upvotes)
  let orderSql = 'ORDER BY m.created_at DESC';
  if (sort === 'terpopuler') {
    orderSql = 'ORDER BY (m.view_count + m.download_count) DESC, m.created_at DESC';
  } else if (sort === 'paling_bermanfaat') {
    orderSql = 'ORDER BY helpful_votes DESC, m.created_at DESC';
  }

  const sql = `
    SELECT
      m.*,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.sks AS mata_kuliah_sks,
      mk.semester_rekomendasi,
      p.id AS prodi_id,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS uploader_nama,
      u.full_name AS uploader_name,
      u.nim AS uploader_nim,
      u.email AS uploader_email,
      u.role AS uploader_role,
      u.angkatan_year AS uploader_angkatan,
      u.avatar_url AS uploader_avatar,
      (SELECT COUNT(mv.id) FROM materi_vote mv WHERE mv.materi_id = m.id) AS helpful_votes,
      (SELECT COUNT(mkom.id) FROM materi_komentar mkom WHERE mkom.materi_id = m.id) AS total_comments,
      (SELECT COUNT(mf.id) FROM materi_file mf WHERE mf.materi_id = m.id) AS total_files,
      (SELECT mf2.file_url FROM materi_file mf2 WHERE mf2.materi_id = m.id ORDER BY mf2.urutan ASC LIMIT 1) AS file_url,
      (SELECT mf2.file_url FROM materi_file mf2 WHERE mf2.materi_id = m.id ORDER BY mf2.urutan ASC LIMIT 1) AS url,
      ${currentUserId ? `(SELECT COUNT(mv2.id) FROM materi_vote mv2 WHERE mv2.materi_id = m.id AND mv2.user_id = ${Number(currentUserId)}) > 0` : '0'} AS has_voted
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = m.uploaded_by
    ${whereSql}
    ${orderSql}
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const getMaterialByIdQuery = async (materialId, currentUserId = null) => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      m.*,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.sks AS mata_kuliah_sks,
      mk.semester_rekomendasi,
      p.id AS prodi_id,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS uploader_nama,
      u.full_name AS uploader_name,
      u.nim AS uploader_nim,
      u.email AS uploader_email,
      u.role AS uploader_role,
      u.angkatan_year AS uploader_angkatan,
      u.avatar_url AS uploader_avatar,
      mod_u.full_name AS moderator_nama,
      (SELECT COUNT(mv.id) FROM materi_vote mv WHERE mv.materi_id = m.id) AS helpful_votes,
      (SELECT COUNT(mkom.id) FROM materi_komentar mkom WHERE mkom.materi_id = m.id) AS total_comments,
      ${currentUserId ? `(SELECT COUNT(mv2.id) FROM materi_vote mv2 WHERE mv2.materi_id = m.id AND mv2.user_id = ${Number(currentUserId)}) > 0` : '0'} AS has_voted,
      ${currentUserId ? `(SELECT COUNT(mki.id) FROM materi_koleksi_item mki INNER JOIN materi_koleksi mk2 ON mk2.id = mki.koleksi_id WHERE mki.materi_id = m.id AND mk2.user_id = ${Number(currentUserId)}) > 0` : '0'} AS is_bookmarked
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = m.uploaded_by
    LEFT JOIN users mod_u ON mod_u.id = m.moderated_by
    WHERE m.id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [materialId]);
  if (rows.length === 0) return null;

  const item = rows[0];

  // Ambil berkas-berkas lampiran
  const [files] = await pool.query(
    'SELECT * FROM materi_file WHERE materi_id = ? ORDER BY urutan ASC, id ASC',
    [materialId]
  );
  item.files = files;

  // Ambil riwayat versi singkat
  const [versions] = await pool.query(
    `SELECT mv.*, u.full_name AS creator_nama 
     FROM materi_version mv 
     LEFT JOIN users u ON u.id = mv.created_by 
     WHERE mv.materi_id = ? 
     ORDER BY mv.version_num DESC`,
    [materialId]
  );
  item.versions = versions;

  return item;
};

export const incrementMaterialViewQuery = async (materialId) => {
  await pool.query('UPDATE materi SET view_count = view_count + 1 WHERE id = ?', [materialId]);
};

export const incrementMaterialDownloadQuery = async (materialId) => {
  await pool.query('UPDATE materi SET download_count = download_count + 1 WHERE id = ?', [materialId]);
};

export const createMaterialQuery = async ({
  mata_kuliah_id,
  uploaded_by,
  judul,
  tipe_materi,
  deskripsi = '',
  tags = '',
  tahun_akademik = '',
  angkatan_kontributor = '',
  dosen_pengampu_teks = '',
  sumber_kredit = '',
  external_url = '',
  youtube_video_id = '',
  is_published = 1,
  status = 'pending',
}) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    `INSERT INTO materi (
      mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
      tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
      external_url, youtube_video_id, is_published, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mata_kuliah_id,
      uploaded_by,
      judul,
      tipe_materi,
      deskripsi,
      tags,
      tahun_akademik,
      angkatan_kontributor,
      dosen_pengampu_teks,
      sumber_kredit,
      external_url,
      youtube_video_id,
      is_published,
      status,
    ]
  );
  return result.insertId;
};

export const insertMaterialFilesQuery = async (materiId, files = []) => {
  if (!files || files.length === 0) return;
  const values = files.map((f, idx) => [
    materiId,
    f.file_url,
    f.public_id || null,
    f.file_name,
    f.file_size || 0,
    f.file_format || null,
    idx + 1,
  ]);
  await pool.query(
    'INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan) VALUES ?',
    [values]
  );
};

export const updateMaterialQuery = async (materialId, updateFields) => {
  const allowedKeys = [
    'judul',
    'deskripsi',
    'tags',
    'tahun_akademik',
    'dosen_pengampu_teks',
    'sumber_kredit',
    'external_url',
    'youtube_video_id',
    'is_published',
  ];
  const keys = Object.keys(updateFields).filter((k) => allowedKeys.includes(k));
  if (keys.length === 0) return false;

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => updateFields[k]);
  values.push(materialId);

  const [result] = await pool.query(`UPDATE materi SET ${setClauses} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

export const deleteMaterialQuery = async (materialId) => {
  const [result] = await pool.query('DELETE FROM materi WHERE id = ?', [materialId]);
  return result.affectedRows > 0;
};

export const createMaterialVersionQuery = async ({
  materi_id,
  file_url,
  file_name,
  file_size,
  changelog_note,
  created_by,
}) => {
  // Hitung nomor versi selanjutnya
  const [rows] = await pool.query(
    'SELECT COALESCE(MAX(version_num), 0) + 1 AS next_ver FROM materi_version WHERE materi_id = ?',
    [materi_id]
  );
  const nextVer = rows[0].next_ver;

  const [result] = await pool.query(
    `INSERT INTO materi_version (materi_id, version_num, file_url, file_name, file_size, changelog_note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [materi_id, nextVer, file_url, file_name, file_size, changelog_note, created_by]
  );

  // Perbarui file utama pada materi_file jika ada
  await pool.query(
    'UPDATE materi_file SET file_url = ?, file_name = ?, file_size = ? WHERE materi_id = ? AND urutan = 1',
    [file_url, file_name, file_size, materi_id]
  );

  return result.insertId;
};

export const moderateMaterialQuery = async (materialId, { status, note, moderatorId }) => {
  const [result] = await pool.query(
    `UPDATE materi 
     SET status = ?, moderation_note = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, note, moderatorId, materialId]
  );
  return result.affectedRows > 0;
};

// ============================================================================
// 3. INTERAKSI & GAMIFIKASI (VOTE, KOMENTAR, LAPORAN, LEADERBOARD)
// ============================================================================

export const toggleMaterialVoteQuery = async (materialId, userId) => {
  await ensureAcademicSchema();
  const [existing] = await pool.query(
    'SELECT id FROM materi_vote WHERE materi_id = ? AND user_id = ? LIMIT 1',
    [materialId, userId]
  );

  if (existing.length > 0) {
    await pool.query('DELETE FROM materi_vote WHERE id = ?', [existing[0].id]);
    return { voted: false };
  } else {
    await pool.query('INSERT INTO materi_vote (materi_id, user_id) VALUES (?, ?)', [
      materialId,
      userId,
    ]);
    return { voted: true };
  }
};

export const getMaterialCommentsQuery = async (materialId) => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      mk.*,
      u.full_name AS user_nama,
      u.role AS user_role,
      u.angkatan_year AS user_angkatan,
      u.avatar_url AS user_avatar
    FROM materi_komentar mk
    INNER JOIN users u ON u.id = mk.user_id
    WHERE mk.materi_id = ?
    ORDER BY mk.created_at ASC
  `;
  const [rows] = await pool.query(sql, [materialId]);
  return rows;
};

export const createMaterialCommentQuery = async ({ materialId, userId, parentId = null, konten }) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    'INSERT INTO materi_komentar (materi_id, user_id, parent_id, konten) VALUES (?, ?, ?, ?)',
    [materialId, userId, parentId, konten]
  );
  return result.insertId;
};

export const deleteMaterialCommentQuery = async (commentId, userId, isStaff = false) => {
  let sql = 'DELETE FROM materi_komentar WHERE id = ?';
  const params = [commentId];
  if (!isStaff) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  const [result] = await pool.query(sql, params);
  return result.affectedRows > 0;
};

export const createMaterialReportQuery = async ({ materialId, reporterId, alasan, deskripsi = '' }) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    'INSERT INTO materi_laporan (materi_id, reporter_id, alasan, deskripsi) VALUES (?, ?, ?, ?)',
    [materialId, reporterId, alasan, deskripsi]
  );
  return result.insertId;
};

export const getMaterialReportsQuery = async () => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      ml.*,
      m.judul AS materi_judul,
      m.tipe_materi,
      m.status AS materi_status,
      mk.nama AS mata_kuliah_nama,
      u_rep.full_name AS reporter_nama,
      u_uploader.full_name AS uploader_nama,
      u_uploader.id AS uploader_id
    FROM materi_laporan ml
    INNER JOIN materi m ON m.id = ml.materi_id
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN users u_rep ON u_rep.id = ml.reporter_id
    LEFT JOIN users u_uploader ON u_uploader.id = m.uploaded_by
    ORDER BY ml.created_at DESC
  `;
  const [rows] = await pool.query(sql);
  return rows;
};

export const handleMaterialReportQuery = async (reportId, { action, takedownNote, handlerId }) => {
  // Ambil materi_id
  const [rep] = await pool.query('SELECT materi_id FROM materi_laporan WHERE id = ? LIMIT 1', [reportId]);
  if (rep.length === 0) return false;
  const materiId = rep[0].materi_id;

  if (action === 'takedown') {
    await pool.query(
      `UPDATE materi 
       SET status = 'takedown', moderation_note = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [takedownNote || 'Diturunkan karena laporan pelanggaran konten.', handlerId, materiId]
    );
  }

  await pool.query(
    `UPDATE materi_laporan 
     SET status = 'resolved', action_taken = ?, takedown_note = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [action, takedownNote || '', handlerId, reportId]
  );

  return true;
};

/**
 * Papan Peringkat Kontributor Teratas (Gamifikasi)
 * Poin = (Materi Approved * 20) + (Total Helpful Votes * 5)
 */
export const getContributorsLeaderboardQuery = async (limit = 15) => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      u.id AS user_id,
      u.full_name AS nama,
      u.role,
      u.angkatan_year AS angkatan,
      u.avatar_url,
      COUNT(DISTINCT m.id) AS approved_materials_count,
      COUNT(DISTINCT mv.id) AS total_helpful_votes,
      ( (COUNT(DISTINCT m.id) * 20) + (COUNT(DISTINCT mv.id) * 5) ) AS total_points
    FROM users u
    INNER JOIN materi m ON m.uploaded_by = u.id AND m.status = 'approved'
    LEFT JOIN materi_vote mv ON mv.materi_id = m.id
    WHERE u.role IN ('mahasiswa', 'alumni')
    GROUP BY u.id
    ORDER BY total_points DESC, approved_materials_count DESC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [Number(limit)]);
  return rows;
};

// ============================================================================
// 4. KOLEKSI SAYA (BOOKMARK)
// ============================================================================

export const getUserCollectionsQuery = async (userId) => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      mk.*,
      COUNT(mki.id) AS total_items
    FROM materi_koleksi mk
    LEFT JOIN materi_koleksi_item mki ON mki.koleksi_id = mk.id
    WHERE mk.user_id = ?
    GROUP BY mk.id
    ORDER BY mk.created_at DESC
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows;
};

export const createCollectionQuery = async (userId, nama, deskripsi = '') => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    'INSERT INTO materi_koleksi (user_id, nama, deskripsi) VALUES (?, ?, ?)',
    [userId, nama, deskripsi]
  );
  return result.insertId;
};

export const toggleCollectionItemQuery = async (koleksiId, materiId) => {
  await ensureAcademicSchema();
  const [existing] = await pool.query(
    'SELECT id FROM materi_koleksi_item WHERE koleksi_id = ? AND materi_id = ? LIMIT 1',
    [koleksiId, materiId]
  );

  if (existing.length > 0) {
    await pool.query('DELETE FROM materi_koleksi_item WHERE id = ?', [existing[0].id]);
    return { saved: false };
  } else {
    await pool.query(
      'INSERT INTO materi_koleksi_item (koleksi_id, materi_id) VALUES (?, ?)',
      [koleksiId, materiId]
    );
    return { saved: true };
  }
};

export const deleteCollectionQuery = async (koleksiId, userId) => {
  const [result] = await pool.query(
    'DELETE FROM materi_koleksi WHERE id = ? AND user_id = ?',
    [koleksiId, userId]
  );
  return result.affectedRows > 0;
};

// ============================================================================
// 5. PAPAN "MINTA MATERI"
// ============================================================================

export const getMaterialRequestsQuery = async ({ prodiId = null, mataKuliahId = null, search = '' }) => {
  await ensureAcademicSchema();
  const params = [];
  const whereClauses = [];

  if (mataKuliahId) {
    whereClauses.push('mr.mata_kuliah_id = ?');
    params.push(Number(mataKuliahId));
  }

  if (prodiId) {
    whereClauses.push('(mk.prodi_id = ? OR mk.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (search && search.trim() !== '') {
    whereClauses.push('(mr.judul LIKE ? OR mr.deskripsi LIKE ? OR mk.nama LIKE ?)');
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      mr.*,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS requester_nama,
      u.angkatan_year AS requester_angkatan,
      m_ful.judul AS fulfilled_materi_judul
    FROM materi_request mr
    INNER JOIN mata_kuliah mk ON mk.id = mr.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = mr.user_id
    LEFT JOIN materi m_ful ON m_ful.id = mr.fulfilled_materi_id
    ${whereSql}
    ORDER BY mr.is_fulfilled ASC, mr.created_at DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const createMaterialRequestQuery = async ({
  userId,
  mataKuliahId,
  judul,
  deskripsi = '',
  tipe_materi_diminta = '',
}) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    'INSERT INTO materi_request (user_id, mata_kuliah_id, judul, deskripsi, tipe_materi_diminta) VALUES (?, ?, ?, ?, ?)',
    [userId, mataKuliahId, judul, deskripsi, tipe_materi_diminta]
  );
  return result.insertId;
};

export const fulfillMaterialRequestQuery = async (requestId, fulfilledMateriId) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    'UPDATE materi_request SET is_fulfilled = 1, fulfilled_materi_id = ? WHERE id = ?',
    [fulfilledMateriId, requestId]
  );
  return result.affectedRows > 0;
};

// ============================================================================
// 6. PAKET BELAJAR SEMESTER
// ============================================================================

export const getLearningPackagesQuery = async ({ prodiId = null, semester = null }) => {
  await ensureAcademicSchema();
  const params = [];
  const whereClauses = [];

  if (prodiId) {
    whereClauses.push('(pb.prodi_id = ? OR pb.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (semester) {
    whereClauses.push('pb.semester = ?');
    params.push(Number(semester));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      pb.*,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS creator_nama,
      (SELECT COUNT(pbi.id) FROM paket_belajar_item pbi WHERE pbi.paket_belajar_id = pb.id) AS total_materials
    FROM paket_belajar pb
    LEFT JOIN prodi p ON p.id = pb.prodi_id
    LEFT JOIN users u ON u.id = pb.created_by
    ${whereSql}
    ORDER BY pb.semester ASC, pb.created_at DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const getLearningPackageDetailQuery = async (packageId) => {
  await ensureAcademicSchema();
  const [rows] = await pool.query(
    `SELECT pb.*, p.kode AS prodi_kode, p.nama AS prodi_nama, u.full_name AS creator_nama
     FROM paket_belajar pb
     LEFT JOIN prodi p ON p.id = pb.prodi_id
     LEFT JOIN users u ON u.id = pb.created_by
     WHERE pb.id = ? LIMIT 1`,
    [packageId]
  );
  if (rows.length === 0) return null;

  const pkg = rows[0];

  const [items] = await pool.query(
    `SELECT
       pbi.id AS item_id,
       pbi.urutan,
       m.*,
       mk.kode AS mata_kuliah_kode,
       mk.nama AS mata_kuliah_nama,
       u_upload.full_name AS uploader_nama
     FROM paket_belajar_item pbi
     INNER JOIN materi m ON m.id = pbi.materi_id
     INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
     LEFT JOIN users u_upload ON u_upload.id = m.uploaded_by
     WHERE pbi.paket_belajar_id = ? AND m.status = 'approved'
     ORDER BY pbi.urutan ASC`,
    [packageId]
  );

  pkg.materials = items;
  return pkg;
};

export const createLearningPackageQuery = async ({
  prodi_id,
  semester,
  judul,
  deskripsi = '',
  created_by,
  materialIds = [],
}) => {
  await ensureAcademicSchema();
  const [result] = await pool.query(
    'INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by) VALUES (?, ?, ?, ?, ?)',
    [prodi_id, semester, judul, deskripsi, created_by]
  );
  const packageId = result.insertId;

  if (materialIds.length > 0) {
    const values = materialIds.map((matId, idx) => [packageId, matId, idx + 1]);
    await pool.query(
      'INSERT INTO paket_belajar_item (paket_belajar_id, materi_id, urutan) VALUES ?',
      [values]
    );
  }

  return packageId;
};

export const deleteLearningPackageQuery = async (packageId) => {
  await ensureAcademicSchema();
  const [result] = await pool.query('DELETE FROM paket_belajar WHERE id = ?', [packageId]);
  return result.affectedRows > 0;
};

// ============================================================================
// 7. DOWNLOAD ZIP MATERI TERSETUJUI
// ============================================================================

export const getApprovedMaterialsForCourseDownload = async (courseId) => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      m.id AS materi_id,
      m.judul AS materi_judul,
      m.tipe_materi,
      m.external_url,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.semester_rekomendasi,
      p.kode AS prodi_kode,
      mf.id AS file_id,
      mf.file_url,
      mf.file_name,
      mf.file_size,
      mf.file_format
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN materi_file mf ON mf.materi_id = m.id
    WHERE m.mata_kuliah_id = ? AND m.status = 'approved' AND m.is_published = 1
  `;
  const [rows] = await pool.query(sql, [courseId]);
  return rows;
};

export const getApprovedMaterialsForPackageDownload = async (packageId) => {
  await ensureAcademicSchema();
  const sql = `
    SELECT
      m.id AS materi_id,
      m.judul AS materi_judul,
      m.tipe_materi,
      m.external_url,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.semester_rekomendasi,
      p.kode AS prodi_kode,
      mf.id AS file_id,
      mf.file_url,
      mf.file_name,
      mf.file_size,
      mf.file_format
    FROM paket_belajar_item pbi
    INNER JOIN materi m ON m.id = pbi.materi_id
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN materi_file mf ON mf.materi_id = m.id
    WHERE pbi.paket_belajar_id = ? AND m.status = 'approved' AND m.is_published = 1
  `;
  const [rows] = await pool.query(sql, [packageId]);
  return rows;
};

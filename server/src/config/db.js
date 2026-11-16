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

const REQUIRED_CORE_TABLES = [
  'angkatan',
  'users',
  'refresh_tokens',
  'password_resets',
  'albums',
  'photos',
  'announcements',
  'events',
  'notifications',
  'prodi',
  'mata_kuliah',
  'materi',
  'materi_file',
  'materi_version',
  'materi_vote',
  'materi_komentar',
  'materi_koleksi',
  'materi_koleksi_item',
  'materi_request',
  'paket_belajar',
  'paket_belajar_item',
  'materi_laporan',
  'tugas_pribadi',
  'sesi_jadwal',
  'fokus_sesi',
  'fokus_pengaturan',
  'pengingat',
  'push_subscriptions',
  'poker_riwayat',
  'poker_laporan',
];

let pokerSchemaInitialized = false;
let pokerSchemaPromise = null;

/**
 * Memastikan tabel fitur Poker Virtual Hiburan (tanpa uang asli/saldo permanen) tersedia.
 */
export const ensurePokerSchema = async () => {
  if (pokerSchemaInitialized) return;
  if (pokerSchemaPromise) return pokerSchemaPromise;

  pokerSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poker_riwayat (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_id CHAR(6) NOT NULL,
        mulai_at DATETIME NOT NULL,
        selesai_at DATETIME NOT NULL,
        pemain JSON NOT NULL,
        pemenang_user_id INT UNSIGNED NULL,
        jumlah_tangan INT UNSIGNED NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pri_winner
          FOREIGN KEY (pemenang_user_id) REFERENCES users(id)
          ON DELETE SET NULL,
        INDEX idx_pri_selesai (selesai_at DESC),
        INDEX idx_pri_winner (pemenang_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS poker_laporan (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_id CHAR(6) NOT NULL,
        reporter_id INT UNSIGNED NOT NULL,
        reported_user_id INT UNSIGNED NOT NULL,
        reason ENUM('harassment', 'inappropriate', 'spam', 'cheating', 'other') NOT NULL DEFAULT 'other',
        description VARCHAR(500) NULL,
        status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_plap_reporter
          FOREIGN KEY (reporter_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_plap_reported
          FOREIGN KEY (reported_user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_plap_status (status, created_at DESC),
        INDEX idx_plap_room (room_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    pokerSchemaInitialized = true;
  })().catch((err) => {
    pokerSchemaPromise = null;
    throw err;
  });

  return pokerSchemaPromise;
};

let focusSchemaInitialized = false;
let focusSchemaPromise = null;

/**
 * Memastikan seluruh tabel modul Penjadwalan Tugas Pribadi, Timer Fokus, Pengingat & Web Push
 * tersedia (hanya CREATE IF NOT EXISTS & ADD COLUMN IF NOT EXISTS; tidak pernah DROP data).
 */
export const ensureFocusPlannerSchema = async () => {
  if (focusSchemaInitialized) return;
  if (focusSchemaPromise) return focusSchemaPromise;

  focusSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tugas_pribadi (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        kategori VARCHAR(100) NULL DEFAULT 'Belajar Mandiri' COMMENT 'Kategori atau topik bebas buatan user sendiri',
        judul VARCHAR(200) NOT NULL,
        deskripsi TEXT NULL,
        prioritas ENUM('rendah', 'sedang', 'tinggi') NOT NULL DEFAULT 'sedang',
        status ENUM('belum_mulai', 'sedang_dikerjakan', 'selesai') NOT NULL DEFAULT 'belum_mulai',
        deadline_at DATETIME NULL COMMENT 'Waktu deadline tugas (UTC)',
        estimasi_menit INT UNSIGNED NULL COMMENT 'Estimasi total waktu pengerjaan dalam menit',
        target_mulai DATETIME NULL COMMENT 'Target mulai paling lambat (UTC)',
        completed_at DATETIME NULL COMMENT 'Waktu selesai tugas (UTC)',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_tp_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_tp_user_status_deadline (user_id, status, deadline_at),
        INDEX idx_tp_deadline (status, deadline_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [tpConstraints] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tugas_pribadi' AND CONSTRAINT_NAME = 'fk_tp_matkul'`
    );
    if (tpConstraints.length > 0) {
      await pool.query('ALTER TABLE tugas_pribadi DROP FOREIGN KEY fk_tp_matkul');
    }

    const [tpCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tugas_pribadi'`
    );
    const colSet = new Set(tpCols.map((c) => c.COLUMN_NAME));
    if (!colSet.has('kategori')) {
      await pool.query(
        `ALTER TABLE tugas_pribadi ADD COLUMN kategori VARCHAR(100) NULL DEFAULT 'Belajar Mandiri' AFTER user_id`
      );
    }
    if (!colSet.has('estimasi_menit')) {
      await pool.query(
        `ALTER TABLE tugas_pribadi ADD COLUMN estimasi_menit INT UNSIGNED NULL AFTER deadline_at`
      );
    }
    if (!colSet.has('target_mulai')) {
      await pool.query(
        `ALTER TABLE tugas_pribadi ADD COLUMN target_mulai DATETIME NULL AFTER estimasi_menit`
      );
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sesi_jadwal (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        tugas_id INT UNSIGNED NOT NULL,
        mulai_at DATETIME NOT NULL COMMENT 'Waktu mulai sesi terjadwal (UTC)',
        durasi_menit INT UNSIGNED NOT NULL DEFAULT 50,
        status ENUM('terjadwal', 'selesai', 'dilewati', 'terlewat') NOT NULL DEFAULT 'terjadwal',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sj_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_sj_tugas
          FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id)
          ON DELETE CASCADE,
        INDEX idx_sj_user_mulai (user_id, mulai_at),
        INDEX idx_sj_status_mulai (status, mulai_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fokus_sesi (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        tugas_id INT UNSIGNED NULL,
        sesi_jadwal_id INT UNSIGNED NULL,
        tipe ENUM('fokus', 'istirahat_pendek', 'istirahat_panjang') NOT NULL DEFAULT 'fokus',
        status ENUM('berjalan', 'dijeda', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'berjalan',
        mulai_at DATETIME NOT NULL COMMENT 'Waktu mulai sesi (UTC)',
        durasi_rencana_detik INT UNSIGNED NOT NULL,
        total_jeda_detik INT UNSIGNED NOT NULL DEFAULT 0,
        jeda_sejak DATETIME NULL COMMENT 'Waktu mulai jeda aktif (UTC)',
        selesai_at DATETIME NULL COMMENT 'Waktu selesai/berhenti (UTC)',
        catatan VARCHAR(500) NULL,
        siklus_ke TINYINT UNSIGNED NOT NULL DEFAULT 1,
        active_user_lock INT UNSIGNED GENERATED ALWAYS AS (IF(status IN ('berjalan', 'dijeda'), user_id, NULL)) STORED,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_fs_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_fs_tugas
          FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id)
          ON DELETE SET NULL,
        CONSTRAINT fk_fs_jadwal
          FOREIGN KEY (sesi_jadwal_id) REFERENCES sesi_jadwal(id)
          ON DELETE SET NULL,
        UNIQUE KEY uq_fokus_sesi_active_user (active_user_lock),
        INDEX idx_fs_user_status (user_id, status),
        INDEX idx_fs_user_selesai (user_id, status, selesai_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fokus_pengaturan (
        user_id INT UNSIGNED PRIMARY KEY,
        durasi_fokus INT UNSIGNED NOT NULL DEFAULT 25,
        durasi_istirahat_pendek INT UNSIGNED NOT NULL DEFAULT 5,
        durasi_istirahat_panjang INT UNSIGNED NOT NULL DEFAULT 15,
        siklus_sebelum_panjang TINYINT UNSIGNED NOT NULL DEFAULT 4,
        auto_start TINYINT(1) NOT NULL DEFAULT 0,
        suara_aktif TINYINT(1) NOT NULL DEFAULT 1,
        getar_aktif TINYINT(1) NOT NULL DEFAULT 1,
        batas_beban_harian_menit INT UNSIGNED NOT NULL DEFAULT 240,
        jam_aktif_mulai CHAR(5) NOT NULL DEFAULT '08:00',
        jam_aktif_selesai CHAR(5) NOT NULL DEFAULT '22:00',
        jam_tenang_aktif TINYINT(1) NOT NULL DEFAULT 1,
        jam_tenang_mulai CHAR(5) NOT NULL DEFAULT '22:00',
        jam_tenang_selesai CHAR(5) NOT NULL DEFAULT '07:00',
        zona_waktu VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
        ingatkan_sesi_akan_mulai TINYINT(1) NOT NULL DEFAULT 1,
        offset_sesi_menit INT UNSIGNED NOT NULL DEFAULT 10,
        ingatkan_sesi_mulai TINYINT(1) NOT NULL DEFAULT 1,
        ingatkan_deadline_h3 TINYINT(1) NOT NULL DEFAULT 1,
        ingatkan_deadline_h1 TINYINT(1) NOT NULL DEFAULT 1,
        ingatkan_deadline_3jam TINYINT(1) NOT NULL DEFAULT 1,
        ingatkan_sesi_terlewat TINYINT(1) NOT NULL DEFAULT 1,
        email_pengingat_aktif TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_fp_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pengingat (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        tugas_id INT UNSIGNED NULL,
        sesi_jadwal_id INT UNSIGNED NULL,
        jenis ENUM('sesi_akan_mulai', 'sesi_mulai', 'deadline_h3', 'deadline_h1', 'deadline_3jam', 'sesi_terlewat') NOT NULL,
        kirim_at DATETIME NOT NULL COMMENT 'Waktu kirim setelah jam tenang (UTC)',
        status ENUM('menunggu', 'terkirim', 'dibatalkan', 'gagal') NOT NULL DEFAULT 'menunggu',
        dikirim_at DATETIME NULL COMMENT 'Waktu aktual terkirim (UTC)',
        dedupe_key VARCHAR(150) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pg_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_pg_tugas
          FOREIGN KEY (tugas_id) REFERENCES tugas_pribadi(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_pg_jadwal
          FOREIGN KEY (sesi_jadwal_id) REFERENCES sesi_jadwal(id)
          ON DELETE CASCADE,
        UNIQUE KEY uq_pengingat_dedupe (dedupe_key),
        INDEX idx_pengingat_due (status, kirim_at),
        INDEX idx_pengingat_user (user_id, status, kirim_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        endpoint VARCHAR(500) NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME NULL COMMENT 'UTC',
        CONSTRAINT fk_ps_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        UNIQUE KEY uq_push_endpoint (endpoint),
        INDEX idx_push_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Perluas ENUM notifications.type bila belum mendukung focus_reminder/task_deadline
    const [notifCols] = await pool.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'
       LIMIT 1`
    );
    const notifType = String(notifCols[0]?.COLUMN_TYPE || '');
    if (notifType && (!notifType.includes('focus_reminder') || !notifType.includes('task_deadline'))) {
      await pool.query(`
        ALTER TABLE notifications
        MODIFY COLUMN type ENUM(
          'photo_approved',
          'photo_rejected',
          'new_comment',
          'new_like',
          'account_verified',
          'material_approved',
          'material_rejected',
          'material_takedown',
          'course_approved',
          'course_rejected',
          'request_fulfilled',
          'focus_reminder',
          'task_deadline',
          'system'
        ) NOT NULL
      `);
    }

    // Seed contoh awal tugas pribadi & riwayat fokus sekali saja bila tabel tugas masih kosong
    const [taskCountRows] = await pool.query('SELECT COUNT(*) AS cnt FROM tugas_pribadi');
    if (Number(taskCountRows[0]?.cnt || 0) === 0) {
      const [mhsRows] = await pool.query(
        `SELECT id FROM users WHERE role = 'mahasiswa' AND status = 'active' ORDER BY id ASC LIMIT 1`
      );
      const mhsId = mhsRows[0]?.id;
      if (mhsId) {
        await pool.query('INSERT IGNORE INTO fokus_pengaturan (user_id) VALUES (?)', [mhsId]);
        const [t1] = await pool.query(
          `INSERT INTO tugas_pribadi (user_id, kategori, judul, deskripsi, prioritas, status, deadline_at, estimasi_menit, target_mulai)
           VALUES (?, 'Proyek Coding', 'Implementasi Linked List & Stack', 'Buat implementasi struktur data Stack & Queue serta uji coba.', 'tinggi', 'sedang_dikerjakan', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 DAY), 120, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))`,
          [mhsId]
        );
        if (t1.insertId) {
          await pool.query(
            `INSERT INTO sesi_jadwal (user_id, tugas_id, mulai_at, durasi_menit, status)
             VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR), 50, 'terjadwal')`,
            [mhsId, t1.insertId]
          );
          await pool.query(
            `INSERT INTO fokus_sesi (user_id, tugas_id, tipe, status, mulai_at, durasi_rencana_detik, total_jeda_detik, selesai_at, catatan, siklus_ke)
             VALUES (?, ?, 'fokus', 'selesai', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 MINUTE), 1500, 0, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 65 MINUTE), 'Menyelesaikan kerangka awal', 1)`,
            [mhsId, t1.insertId]
          );
        }
      }
    }

    focusSchemaInitialized = true;
  })().catch((err) => {
    focusSchemaPromise = null;
    throw err;
  });

  return focusSchemaPromise;
};

/**
 * Verifikasi read-only tabel & kolom penting saat startup tanpa melakukan DDL/DROP otomatis.
 */
export const verifyDatabaseSchema = async () => {
  try {
    const [tables] = await pool.query(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    const existingTables = new Set(tables.map((t) => t.TABLE_NAME));
    const missingTables = REQUIRED_CORE_TABLES.filter((t) => !existingTables.has(t));

    if (missingTables.length > 0) {
      console.warn(
        `⚠️ [DB] Tabel berikut belum ditemukan di "${env.db.database}": ${missingTables.join(', ')}. ` +
          'Silakan import database/schema.sql dan migrasi database/migrations/001..004.'
      );
      return;
    }

    const [cols] = await pool.query(
      `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND ((TABLE_NAME = 'materi_version' AND COLUMN_NAME = 'public_id')
           OR (TABLE_NAME = 'announcements' AND COLUMN_NAME = 'banner_public_id')
           OR (TABLE_NAME = 'events' AND COLUMN_NAME = 'banner_public_id'))`
    );

    if (cols.length < 3) {
      console.warn(
        '⚠️ [DB] Kolom migrasi 002 (public_id / banner_public_id) belum lengkap. ' +
          'Jalankan database/migrations/002_hardening_fk_indexes_cloudinary_up.sql setelah backup.'
      );
    }
  } catch (err) {
    console.warn('⚠️ [DB] Gagal memverifikasi skema database:', err.message);
  }
};

export const testDbConnection = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    console.log(`[DB] Terhubung ke MySQL (${env.db.database} di ${env.db.host}:${env.db.port})`);
  } finally {
    connection.release();
  }

  try {
    await ensureFocusPlannerSchema();
  } catch (err) {
    console.warn('⚠️ [DB] Gagal menginisialisasi skema tabel fokus/tugas:', err.message);
  }

  try {
    await ensurePokerSchema();
  } catch (err) {
    console.warn('⚠️ [DB] Gagal menginisialisasi skema tabel poker:', err.message);
  }

  await verifyDatabaseSchema();
};

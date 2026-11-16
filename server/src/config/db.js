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
];

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

  await verifyDatabaseSchema();
};

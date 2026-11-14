// FILE: server/src/utils/cronJobs.js
import cron from 'node-cron';
import { pool } from '../config/db.js';

const scheduledTasks = [];

const cleanupExpiredAuthRecords = async () => {
  try {
    const [rtResult] = await pool.execute(
      `DELETE FROM refresh_tokens
       WHERE expires_at < (NOW() - INTERVAL 1 DAY)
          OR (revoked_at IS NOT NULL AND revoked_at < (NOW() - INTERVAL 7 DAY))`
    );
    const [prResult] = await pool.execute(
      `DELETE FROM password_resets
       WHERE expires_at < (NOW() - INTERVAL 1 DAY)
          OR (used_at IS NOT NULL AND used_at < (NOW() - INTERVAL 7 DAY))`
    );
    const totalDeleted = (rtResult.affectedRows || 0) + (prResult.affectedRows || 0);
    if (totalDeleted > 0) {
      console.log(`🧹 [CRON] Membersihkan ${totalDeleted} record token auth kedaluwarsa.`);
    }
  } catch (err) {
    console.warn('⚠️ [CRON] Gagal membersihkan token kedaluwarsa:', err.message);
  }
};

/**
 * Inisialisasi background cron job portal kampus
 */
export const initCronJobs = () => {
  if (scheduledTasks.length > 0) return;

  const tokenCleanupTask = cron.schedule(
    '0 3 * * *',
    () => {
      void cleanupExpiredAuthRecords();
    },
    {
      name: 'auth-token-cleanup',
      timezone: 'Asia/Jakarta',
      noOverlap: true,
      unref: true,
    }
  );

  scheduledTasks.push(tokenCleanupTask);
  console.log('🕒 [CRON] Background task scheduler (pembersihan token harian) aktif.');
};

export const stopCronJobs = async () => {
  while (scheduledTasks.length > 0) {
    const task = scheduledTasks.pop();
    try {
      await task.stop();
    } catch {
      // Abaikan error saat shutdown
    }
  }
};

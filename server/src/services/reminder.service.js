// FILE: server/src/services/reminder.service.js
import { pool, ensureFocusPlannerSchema } from '../config/db.js';
import { createNotification } from '../queries/campus.queries.js';
import { sendMailOrLog } from '../config/mailer.js';
import { sendWebPushNotification } from '../utils/webPushClient.js';
import {
  adjustForQuietHours,
  DEFAULT_TIMEZONE,
  resolveTimeZone,
  toUtcMs,
  toUtcMysqlDatetime,
} from '../utils/timezone.js';
import * as focusRepo from '../repositories/focus.repository.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const DEADLINE_OFFSETS = [
  { jenis: 'deadline_h3', settingKey: 'ingatkan_deadline_h3', offsetMs: 72 * HOUR_MS },
  { jenis: 'deadline_h1', settingKey: 'ingatkan_deadline_h1', offsetMs: 24 * HOUR_MS },
  { jenis: 'deadline_3jam', settingKey: 'ingatkan_deadline_3jam', offsetMs: 3 * HOUR_MS },
];

const formatLocalTimeDisplay = (utcMs, timeZone = DEFAULT_TIMEZONE) => {
  if (!utcMs) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: resolveTimeZone(timeZone),
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(utcMs));
};

/**
 * Menghitung daftar pengingat deadline (H-3, H-1, 3 jam sebelum) beserta kunci idempoten.
 * Mengembalikan array kosong bila tugas sudah selesai atau tidak punya deadline.
 */
export const buildTaskDeadlineReminders = ({ task, settings = {}, nowUtcMs = Date.now() }) => {
  if (!task || task.status === 'selesai' || !task.deadline_at) {
    return [];
  }

  const deadlineMs = toUtcMs(task.deadline_at);
  if (!deadlineMs || deadlineMs <= nowUtcMs) {
    return [];
  }

  const result = [];
  for (const cfg of DEADLINE_OFFSETS) {
    if (settings[cfg.settingKey] === false || settings[cfg.settingKey] === 0) continue;
    const targetMs = deadlineMs - cfg.offsetMs;
    if (targetMs < nowUtcMs - 30 * MINUTE_MS) continue;

    const sendAtMs = Math.max(nowUtcMs, adjustForQuietHours(targetMs, settings));
    result.push({
      user_id: task.user_id,
      tugas_id: task.id,
      sesi_jadwal_id: null,
      jenis: cfg.jenis,
      kirim_at_ms: sendAtMs,
      dedupe_key: `${cfg.jenis}:tugas:${task.id}:${deadlineMs}`,
    });
  }

  return result;
};

/**
 * Menghitung daftar pengingat sesi kerja terjadwal (sebelum mulai & saat mulai).
 */
export const buildScheduleSessionReminders = ({ session, settings = {}, nowUtcMs = Date.now() }) => {
  if (!session || session.status !== 'terjadwal' || !session.mulai_at) {
    return [];
  }

  const mulaiMs = toUtcMs(session.mulai_at);
  if (!mulaiMs || mulaiMs + (Number(session.durasi_menit) || 50) * MINUTE_MS <= nowUtcMs) {
    return [];
  }

  const result = [];
  const offsetMenit = Math.max(1, Math.min(120, Number(settings.offset_sesi_menit) || 10));

  if (settings.ingatkan_sesi_akan_mulai !== false && settings.ingatkan_sesi_akan_mulai !== 0) {
    const beforeMs = mulaiMs - offsetMenit * MINUTE_MS;
    if (beforeMs >= nowUtcMs - 15 * MINUTE_MS) {
      const sendAtMs = Math.max(nowUtcMs, adjustForQuietHours(beforeMs, settings));
      result.push({
        user_id: session.user_id,
        tugas_id: session.tugas_id,
        sesi_jadwal_id: session.id,
        jenis: 'sesi_akan_mulai',
        kirim_at_ms: sendAtMs,
        dedupe_key: `sesi_akan_mulai:sesi:${session.id}:${mulaiMs}`,
      });
    }
  }

  if (settings.ingatkan_sesi_mulai !== false && settings.ingatkan_sesi_mulai !== 0) {
    if (mulaiMs >= nowUtcMs - 15 * MINUTE_MS) {
      const sendAtMs = Math.max(nowUtcMs, adjustForQuietHours(mulaiMs, settings));
      result.push({
        user_id: session.user_id,
        tugas_id: session.tugas_id,
        sesi_jadwal_id: session.id,
        jenis: 'sesi_mulai',
        kirim_at_ms: sendAtMs,
        dedupe_key: `sesi_mulai:sesi:${session.id}:${mulaiMs}`,
      });
    }
  }

  return result;
};

const upsertReminders = async (reminders, db = pool) => {
  for (const r of reminders) {
    await db.query(
      `INSERT INTO pengingat (user_id, tugas_id, sesi_jadwal_id, jenis, kirim_at, status, dedupe_key)
       VALUES (?, ?, ?, ?, ?, 'menunggu', ?)
       ON DUPLICATE KEY UPDATE
         kirim_at = IF(status = 'terkirim', kirim_at, VALUES(kirim_at)),
         status = IF(status = 'terkirim', 'terkirim', 'menunggu')`,
      [r.user_id, r.tugas_id, r.sesi_jadwal_id, r.jenis, toUtcMysqlDatetime(r.kirim_at_ms), r.dedupe_key]
    );
  }
};

/**
 * Menyelaraskan baris pengingat deadline ketika tugas dibuat, diubah, atau selesai.
 */
export const syncTaskReminders = async (taskId, userId, db = pool) => {
  const [task, settings] = await Promise.all([
    focusRepo.getUserTaskById(taskId, userId, db),
    focusRepo.getOrCreateSettings(userId, db),
  ]);

  await db.query(
    `UPDATE pengingat
     SET status = 'dibatalkan'
     WHERE user_id = ? AND tugas_id = ?
       AND jenis IN ('deadline_h3', 'deadline_h1', 'deadline_3jam')
       AND status = 'menunggu'`,
    [userId, taskId]
  );

  if (!task || task.status === 'selesai') {
    if (task && task.status === 'selesai') {
      await db.query(
        `UPDATE pengingat
         SET status = 'dibatalkan'
         WHERE user_id = ? AND tugas_id = ? AND status = 'menunggu'`,
        [userId, taskId]
      );
    }
    return;
  }

  const reminders = buildTaskDeadlineReminders({ task, settings });
  await upsertReminders(reminders, db);
};

/**
 * Menyelaraskan baris pengingat sesi kerja ketika sesi dijadwalkan/diubah/dibatalkan.
 */
export const syncScheduleSessionReminders = async (sessionId, userId, db = pool) => {
  const [session, settings] = await Promise.all([
    focusRepo.getScheduleById(sessionId, userId, db),
    focusRepo.getOrCreateSettings(userId, db),
  ]);

  await db.query(
    `UPDATE pengingat
     SET status = 'dibatalkan'
     WHERE user_id = ? AND sesi_jadwal_id = ?
       AND jenis IN ('sesi_akan_mulai', 'sesi_mulai')
       AND status = 'menunggu'`,
    [userId, sessionId]
  );

  if (!session || session.status !== 'terjadwal') return;

  const reminders = buildScheduleSessionReminders({ session, settings });
  await upsertReminders(reminders, db);
};

export const syncAllPendingRemindersForUser = async (userId, db = pool) => {
  const [tasks, schedules] = await Promise.all([
    focusRepo.listUserTasks(userId, {}, db),
    focusRepo.listUserSchedules(userId, { status: 'terjadwal' }, db),
  ]);

  for (const t of tasks) {
    if (t.status !== 'selesai' && t.deadline_at) {
      await syncTaskReminders(t.id, userId, db);
    }
  }
  for (const s of schedules) {
    await syncScheduleSessionReminders(s.id, userId, db);
  }
};

const composeReminderCopy = (row) => {
  const judul = row.judul_tugas || 'Tugas Anda';
  const tz = row.zona_waktu || DEFAULT_TIMEZONE;
  const mulaiFmt = row.sesi_mulai_at ? formatLocalTimeDisplay(toUtcMs(row.sesi_mulai_at), tz) : '';
  const deadlineFmt = row.tugas_deadline_at ? formatLocalTimeDisplay(toUtcMs(row.tugas_deadline_at), tz) : '';

  switch (row.jenis) {
    case 'sesi_akan_mulai':
      return {
        notifType: 'focus_reminder',
        title: 'Sesi Fokus Segera Dimulai',
        message: `Sesi "${judul}" dijadwalkan pukul ${mulaiFmt}. Siapkan materi belajar Anda.`,
        link: row.sesi_jadwal_id ? `/fokus?scheduleId=${row.sesi_jadwal_id}` : '/fokus',
      };
    case 'sesi_mulai':
      return {
        notifType: 'focus_reminder',
        title: 'Waktunya Mulai Sesi Fokus!',
        message: `Jadwal pengerjaan "${judul}" (${row.durasi_menit || 25} menit) sudah dimulai.`,
        link: row.sesi_jadwal_id ? `/fokus?scheduleId=${row.sesi_jadwal_id}` : '/fokus',
      };
    case 'sesi_terlewat':
      return {
        notifType: 'focus_reminder',
        title: 'Sesi Terjadwal Terlewat',
        message: `Sesi "${judul}" telah melewati waktunya. Buka halaman Rencana untuk menjadwalkan ulang.`,
        link: row.sesi_jadwal_id ? `/rencana?reschedule=${row.sesi_jadwal_id}` : '/rencana',
      };
    case 'deadline_h3':
      return {
        notifType: 'task_deadline',
        title: 'Pengingat Deadline (H-3)',
        message: `Tugas "${judul}" akan jatuh tempo pada ${deadlineFmt}.`,
        link: '/rencana',
      };
    case 'deadline_h1':
      return {
        notifType: 'task_deadline',
        title: 'Deadline Tugas Besok (H-1)',
        message: `Segera selesaikan "${judul}". Deadline: ${deadlineFmt}.`,
        link: '/rencana',
      };
    case 'deadline_3jam':
      return {
        notifType: 'task_deadline',
        title: 'Deadline Tugas 3 Jam Lagi!',
        message: `Tugas "${judul}" berakhir pukul ${deadlineFmt}.`,
        link: '/rencana',
      };
    default:
      return {
        notifType: 'focus_reminder',
        title: 'Pengingat Belajar',
        message: `Saatnya meninjau "${judul}".`,
        link: '/rencana',
      };
  }
};

/**
 * Mengunci & memproses pengingat yang jatuh tempo serta menandai sesi jadwal yang terlewat.
 * Dirancang aman untuk concurrency (FOR UPDATE SKIP LOCKED + dedupe_key UNIQUE).
 */
export const processDueRemindersAndMissedSessions = async (nowUtcMs = Date.now()) => {
  try {
    await ensureFocusPlannerSchema();
  } catch (err) {
    console.warn('⚠️ [CRON] Skema fokus belum siap:', err.message);
    return { processed: 0 };
  }

  const nowSqlUtc = toUtcMysqlDatetime(nowUtcMs);

  // 1. Deteksi sesi terjadwal yang sudah melewati waktu selesai -> ubah status ke 'terlewat'
  try {
    const [missedRows] = await pool.query(
      `SELECT
          sj.id,
          sj.user_id,
          sj.tugas_id,
          DATE_FORMAT(sj.mulai_at, '%Y-%m-%dT%H:%i:%sZ') AS mulai_at,
          sj.durasi_menit,
          COALESCE(fp.ingatkan_sesi_terlewat, 1) AS ingatkan_sesi_terlewat,
          COALESCE(fp.jam_tenang_aktif, 1) AS jam_tenang_aktif,
          COALESCE(fp.jam_tenang_mulai, '22:00') AS jam_tenang_mulai,
          COALESCE(fp.jam_tenang_selesai, '07:00') AS jam_tenang_selesai,
          COALESCE(fp.zona_waktu, 'Asia/Jakarta') AS zona_waktu
       FROM sesi_jadwal sj
       INNER JOIN tugas_pribadi tp ON tp.id = sj.tugas_id
       LEFT JOIN fokus_pengaturan fp ON fp.user_id = sj.user_id
       WHERE sj.status = 'terjadwal'
         AND tp.status <> 'selesai'
         AND DATE_ADD(sj.mulai_at, INTERVAL sj.durasi_menit MINUTE) < ?
       LIMIT 100`,
      [nowSqlUtc]
    );

    for (const s of missedRows) {
      const [upd] = await pool.query(
        `UPDATE sesi_jadwal SET status = 'terlewat' WHERE id = ? AND status = 'terjadwal'`,
        [s.id]
      );
      if (upd.affectedRows > 0 && Boolean(s.ingatkan_sesi_terlewat)) {
        const sendAtMs = Math.max(nowUtcMs, adjustForQuietHours(nowUtcMs, s));
        await pool.query(
          `INSERT IGNORE INTO pengingat
            (user_id, tugas_id, sesi_jadwal_id, jenis, kirim_at, status, dedupe_key)
           VALUES (?, ?, ?, 'sesi_terlewat', ?, 'menunggu', ?)`,
          [s.user_id, s.tugas_id, s.id, toUtcMysqlDatetime(sendAtMs), `sesi_terlewat:sesi:${s.id}`]
        );
      }
    }
  } catch (err) {
    console.warn('⚠️ [CRON] Gagal memeriksa sesi jadwal terlewat:', err.message);
  }

  // 2. Proses batch pengingat yang jatuh tempo secara atomik (mencegah pengiriman ganda)
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let dueRows;
    const dueQueryBase = `
      SELECT
        pg.id,
        pg.user_id,
        pg.tugas_id,
        pg.sesi_jadwal_id,
        pg.jenis,
        tp.judul AS judul_tugas,
        tp.status AS status_tugas,
        DATE_FORMAT(tp.deadline_at, '%Y-%m-%dT%H:%i:%sZ') AS tugas_deadline_at,
        sj.status AS status_jadwal,
        sj.durasi_menit,
        DATE_FORMAT(sj.mulai_at, '%Y-%m-%dT%H:%i:%sZ') AS sesi_mulai_at,
        u.email AS user_email,
        u.full_name AS user_name,
        COALESCE(fp.zona_waktu, 'Asia/Jakarta') AS zona_waktu,
        COALESCE(fp.email_pengingat_aktif, 0) AS email_pengingat_aktif
      FROM pengingat pg
      INNER JOIN users u ON u.id = pg.user_id
      LEFT JOIN tugas_pribadi tp ON tp.id = pg.tugas_id
      LEFT JOIN sesi_jadwal sj ON sj.id = pg.sesi_jadwal_id
      LEFT JOIN fokus_pengaturan fp ON fp.user_id = pg.user_id
      WHERE pg.status = 'menunggu' AND pg.kirim_at <= ?
      ORDER BY pg.kirim_at ASC
      LIMIT 25
    `;

    try {
      const [rows] = await connection.query(`${dueQueryBase} FOR UPDATE SKIP LOCKED`, [nowSqlUtc]);
      dueRows = rows;
    } catch {
      const [rows] = await connection.query(`${dueQueryBase} FOR UPDATE`, [nowSqlUtc]);
      dueRows = rows;
    }

    if (!dueRows || dueRows.length === 0) {
      await connection.commit();
      return { processed: 0 };
    }

    const toDeliver = [];
    for (const row of dueRows) {
      const taskAlreadyDone = row.status_tugas === 'selesai';
      const scheduleNotRelevant =
        ['sesi_akan_mulai', 'sesi_mulai'].includes(row.jenis) &&
        row.status_jadwal &&
        row.status_jadwal !== 'terjadwal';

      if (taskAlreadyDone || scheduleNotRelevant) {
        await connection.query(`UPDATE pengingat SET status = 'dibatalkan' WHERE id = ?`, [row.id]);
        continue;
      }

      const [claimed] = await connection.query(
        `UPDATE pengingat SET status = 'terkirim', dikirim_at = ? WHERE id = ? AND status = 'menunggu'`,
        [nowSqlUtc, row.id]
      );
      if (claimed.affectedRows > 0) {
        toDeliver.push(row);
      }
    }

    await connection.commit();
    connection.release();
    connection = null;

    // 3. Pengiriman keluar transaksi DB agar koneksi DB tidak tertahan jaringan eksternal
    for (const row of toDeliver) {
      const copy = composeReminderCopy(row);

      await createNotification({
        userId: row.user_id,
        type: copy.notifType,
        title: copy.title,
        message: copy.message,
        referenceLink: copy.link,
      }).catch((err) => {
        console.warn(`⚠️ [REMINDER] Gagal simpan in-app notif #${row.id}:`, err.message);
      });

      const subs = await focusRepo.listUserPushSubscriptions(row.user_id).catch(() => []);
      for (const sub of subs) {
        try {
          const res = await sendWebPushNotification(sub, {
            title: copy.title,
            body: copy.message,
            url: copy.link,
            tag: `pasim-reminder-${row.id}`,
            jenis: row.jenis,
            sesi_jadwal_id: row.sesi_jadwal_id,
            tugas_id: row.tugas_id,
          });
          if (res.expired) {
            await focusRepo.deletePushSubscriptionByEndpoint(sub.endpoint);
          } else if (res.delivered) {
            await pool.query(
              'UPDATE push_subscriptions SET last_used_at = UTC_TIMESTAMP() WHERE id = ?',
              [sub.id]
            );
          }
        } catch (pushErr) {
          console.warn(`⚠️ [PUSH] Gagal kirim Web Push ke subscription #${sub.id}:`, pushErr.message);
        }
      }

      if (row.email_pengingat_aktif && row.user_email) {
        await sendMailOrLog({
          to: row.user_email,
          subject: `[Portal UNAS PASIM] ${copy.title}`,
          text: `${copy.title}\n\n${copy.message}\n\nBuka Portal: ${copy.link}`,
          html: `<p>Halo <strong>${row.user_name || 'Mahasiswa'}</strong>,</p><p><strong>${copy.title}</strong></p><p>${copy.message}</p>`,
        }).catch((mailErr) => {
          console.warn(`⚠️ [EMAIL] Gagal kirim email pengingat #${row.id}:`, mailErr.message);
        });
      }
    }

    return { processed: toDeliver.length };
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.warn('⚠️ [CRON] Gagal memproses antrean pengingat:', err.message);
    return { processed: 0, error: err.message };
  } finally {
    if (connection) connection.release();
  }
};

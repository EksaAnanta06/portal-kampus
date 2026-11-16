// FILE: server/src/repositories/focus.repository.js
import { pool } from '../config/db.js';
import { toUtcMysqlDatetime } from '../utils/timezone.js';

export const DEFAULT_FOCUS_SETTINGS = {
  durasi_fokus: 25,
  durasi_istirahat_pendek: 5,
  durasi_istirahat_panjang: 15,
  siklus_sebelum_panjang: 4,
  auto_start: 0,
  suara_aktif: 1,
  getar_aktif: 1,
  batas_beban_harian_menit: 240,
  jam_aktif_mulai: '08:00',
  jam_aktif_selesai: '22:00',
  jam_tenang_aktif: 1,
  jam_tenang_mulai: '22:00',
  jam_tenang_selesai: '07:00',
  zona_waktu: 'Asia/Jakarta',
  ingatkan_sesi_akan_mulai: 1,
  offset_sesi_menit: 10,
  ingatkan_sesi_mulai: 1,
  ingatkan_deadline_h3: 1,
  ingatkan_deadline_h1: 1,
  ingatkan_deadline_3jam: 1,
  ingatkan_sesi_terlewat: 1,
  email_pengingat_aktif: 0,
};

const normalizeSettingsRow = (row) => {
  if (!row) return { ...DEFAULT_FOCUS_SETTINGS };
  return {
    ...DEFAULT_FOCUS_SETTINGS,
    ...row,
    durasi_fokus: Number(row.durasi_fokus) || 25,
    durasi_istirahat_pendek: Number(row.durasi_istirahat_pendek) || 5,
    durasi_istirahat_panjang: Number(row.durasi_istirahat_panjang) || 15,
    siklus_sebelum_panjang: Number(row.siklus_sebelum_panjang) || 4,
    auto_start: Boolean(row.auto_start),
    suara_aktif: Boolean(row.suara_aktif),
    getar_aktif: Boolean(row.getar_aktif),
    batas_beban_harian_menit: Number(row.batas_beban_harian_menit) || 240,
    jam_tenang_aktif: Boolean(row.jam_tenang_aktif),
    ingatkan_sesi_akan_mulai: Boolean(row.ingatkan_sesi_akan_mulai),
    offset_sesi_menit: Number(row.offset_sesi_menit ?? 10),
    ingatkan_sesi_mulai: Boolean(row.ingatkan_sesi_mulai),
    ingatkan_deadline_h3: Boolean(row.ingatkan_deadline_h3),
    ingatkan_deadline_h1: Boolean(row.ingatkan_deadline_h1),
    ingatkan_deadline_3jam: Boolean(row.ingatkan_deadline_3jam),
    ingatkan_sesi_terlewat: Boolean(row.ingatkan_sesi_terlewat),
    email_pengingat_aktif: Boolean(row.email_pengingat_aktif),
  };
};

// ============================================================================
// PENGATURAN FOKUS
// ============================================================================

export const getOrCreateSettings = async (userId, db = pool) => {
  await db.query('INSERT IGNORE INTO fokus_pengaturan (user_id) VALUES (?)', [userId]);
  const [rows] = await db.query('SELECT * FROM fokus_pengaturan WHERE user_id = ? LIMIT 1', [userId]);
  return normalizeSettingsRow(rows[0]);
};

export const updateSettings = async (userId, fields, db = pool) => {
  await db.query('INSERT IGNORE INTO fokus_pengaturan (user_id) VALUES (?)', [userId]);
  const allowed = Object.keys(DEFAULT_FOCUS_SETTINGS);
  const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
  if (keys.length > 0) {
    const clauses = keys.map((k) => `${k} = ?`).join(', ');
    const vals = keys.map((k) => (typeof fields[k] === 'boolean' ? (fields[k] ? 1 : 0) : fields[k]));
    vals.push(userId);
    await db.query(`UPDATE fokus_pengaturan SET ${clauses} WHERE user_id = ?`, vals);
  }
  return getOrCreateSettings(userId, db);
};

// ============================================================================
// TUGAS PRIBADI MANDIRI (tugas_pribadi — tanpa relasi ke tabel LMS/mata kuliah)
// ============================================================================

export const listUserTasks = async (userId, { status } = {}, db = pool) => {
  const params = [userId];
  let where = 'WHERE tp.user_id = ?';
  if (status) {
    where += ' AND tp.status = ?';
    params.push(status);
  }

  const [rows] = await db.query(
    `SELECT
        tp.id,
        tp.user_id,
        tp.kategori,
        tp.judul,
        tp.deskripsi,
        tp.prioritas,
        tp.status,
        DATE_FORMAT(tp.deadline_at, '%Y-%m-%dT%H:%i:%sZ') AS deadline_at,
        tp.estimasi_menit,
        DATE_FORMAT(tp.target_mulai, '%Y-%m-%dT%H:%i:%sZ') AS target_mulai,
        DATE_FORMAT(tp.completed_at, '%Y-%m-%dT%H:%i:%sZ') AS completed_at,
        tp.created_at,
        tp.updated_at,
        COALESCE(fs_agg.total_fokus_detik, 0) AS total_fokus_detik,
        COALESCE(fs_agg.jumlah_sesi_fokus, 0) AS jumlah_sesi_fokus,
        COALESCE(sj_agg.jadwal_mendatang_count, 0) AS jadwal_mendatang_count,
        COALESCE(sj_agg.total_jadwal_menit, 0) AS total_jadwal_menit,
        DATE_FORMAT(sj_agg.sesi_terdekat_at, '%Y-%m-%dT%H:%i:%sZ') AS sesi_terdekat_at
     FROM tugas_pribadi tp
     LEFT JOIN (
       SELECT
         tugas_id,
         SUM(GREATEST(0, TIMESTAMPDIFF(SECOND, mulai_at, COALESCE(selesai_at, UTC_TIMESTAMP())) - total_jeda_detik)) AS total_fokus_detik,
         COUNT(*) AS jumlah_sesi_fokus
       FROM fokus_sesi
       WHERE user_id = ? AND status = 'selesai' AND tipe = 'fokus' AND tugas_id IS NOT NULL
       GROUP BY tugas_id
     ) fs_agg ON fs_agg.tugas_id = tp.id
     LEFT JOIN (
       SELECT
         tugas_id,
         SUM(CASE WHEN status = 'terjadwal' THEN 1 ELSE 0 END) AS jadwal_mendatang_count,
         SUM(CASE WHEN status IN ('terjadwal', 'selesai') THEN durasi_menit ELSE 0 END) AS total_jadwal_menit,
         MIN(CASE WHEN status = 'terjadwal' AND mulai_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 MINUTE) THEN mulai_at ELSE NULL END) AS sesi_terdekat_at
       FROM sesi_jadwal
       WHERE user_id = ?
       GROUP BY tugas_id
     ) sj_agg ON sj_agg.tugas_id = tp.id
     ${where}
     ORDER BY
       CASE tp.status WHEN 'sedang_dikerjakan' THEN 0 WHEN 'belum_mulai' THEN 1 ELSE 2 END,
       tp.deadline_at IS NULL ASC,
       tp.deadline_at ASC,
       tp.created_at DESC`,
    [userId, userId, ...params]
  );
  return rows;
};

export const getUserTaskById = async (taskId, userId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
        tp.id,
        tp.user_id,
        tp.kategori,
        tp.judul,
        tp.deskripsi,
        tp.prioritas,
        tp.status,
        DATE_FORMAT(tp.deadline_at, '%Y-%m-%dT%H:%i:%sZ') AS deadline_at,
        tp.estimasi_menit,
        DATE_FORMAT(tp.target_mulai, '%Y-%m-%dT%H:%i:%sZ') AS target_mulai,
        DATE_FORMAT(tp.completed_at, '%Y-%m-%dT%H:%i:%sZ') AS completed_at
     FROM tugas_pribadi tp
     WHERE tp.id = ? AND tp.user_id = ?
     LIMIT 1`,
    [taskId, userId]
  );
  return rows[0] || null;
};

export const createUserTask = async (userId, payload, db = pool) => {
  const [result] = await db.query(
    `INSERT INTO tugas_pribadi
      (user_id, kategori, judul, deskripsi, prioritas, status, deadline_at, estimasi_menit, target_mulai)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.kategori || 'Belajar Mandiri',
      payload.judul,
      payload.deskripsi || null,
      payload.prioritas || 'sedang',
      payload.status || 'belum_mulai',
      toUtcMysqlDatetime(payload.deadline_at),
      payload.estimasi_menit ?? null,
      toUtcMysqlDatetime(payload.target_mulai),
    ]
  );
  return getUserTaskById(result.insertId, userId, db);
};

export const updateUserTask = async (taskId, userId, fields, db = pool) => {
  const allowed = [
    'kategori',
    'judul',
    'deskripsi',
    'prioritas',
    'status',
    'deadline_at',
    'estimasi_menit',
    'target_mulai',
    'completed_at',
  ];
  const dateCols = new Set(['deadline_at', 'target_mulai', 'completed_at']);
  const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
  if (keys.length === 0) return getUserTaskById(taskId, userId, db);

  const clauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) =>
    dateCols.has(k) ? toUtcMysqlDatetime(fields[k]) : fields[k] === '' ? null : fields[k]
  );
  values.push(taskId, userId);

  await db.query(`UPDATE tugas_pribadi SET ${clauses} WHERE id = ? AND user_id = ?`, values);
  return getUserTaskById(taskId, userId, db);
};

export const deleteUserTask = async (taskId, userId, db = pool) => {
  const [result] = await db.query('DELETE FROM tugas_pribadi WHERE id = ? AND user_id = ?', [
    taskId,
    userId,
  ]);
  return result.affectedRows > 0;
};

// ============================================================================
// SESI JADWAL ("KAPAN DIKERJAKAN")
// ============================================================================

export const listUserSchedules = async (userId, { fromUtc, toUtc, tugasId, status } = {}, db = pool) => {
  const clauses = ['sj.user_id = ?'];
  const params = [userId];

  if (fromUtc) {
    clauses.push('sj.mulai_at >= ?');
    params.push(toUtcMysqlDatetime(fromUtc));
  }
  if (toUtc) {
    clauses.push('sj.mulai_at <= ?');
    params.push(toUtcMysqlDatetime(toUtc));
  }
  if (tugasId) {
    clauses.push('sj.tugas_id = ?');
    params.push(tugasId);
  }
  if (status) {
    clauses.push('sj.status = ?');
    params.push(status);
  }

  const [rows] = await db.query(
    `SELECT
        sj.id,
        sj.user_id,
        sj.tugas_id,
        DATE_FORMAT(sj.mulai_at, '%Y-%m-%dT%H:%i:%sZ') AS mulai_at,
        sj.durasi_menit,
        sj.status,
        sj.created_at,
        tp.judul AS judul_tugas,
        tp.kategori,
        tp.prioritas AS prioritas_tugas,
        tp.status AS status_tugas,
        tp.estimasi_menit,
        DATE_FORMAT(tp.deadline_at, '%Y-%m-%dT%H:%i:%sZ') AS deadline_at
     FROM sesi_jadwal sj
     INNER JOIN tugas_pribadi tp ON tp.id = sj.tugas_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY sj.mulai_at ASC`,
    params
  );
  return rows;
};

export const getScheduleById = async (scheduleId, userId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
        sj.id,
        sj.user_id,
        sj.tugas_id,
        DATE_FORMAT(sj.mulai_at, '%Y-%m-%dT%H:%i:%sZ') AS mulai_at,
        sj.durasi_menit,
        sj.status,
        tp.judul AS judul_tugas,
        tp.kategori,
        tp.status AS status_tugas,
        DATE_FORMAT(tp.deadline_at, '%Y-%m-%dT%H:%i:%sZ') AS deadline_at
     FROM sesi_jadwal sj
     INNER JOIN tugas_pribadi tp ON tp.id = sj.tugas_id
     WHERE sj.id = ? AND sj.user_id = ?
     LIMIT 1`,
    [scheduleId, userId]
  );
  return rows[0] || null;
};

export const createScheduleSessions = async (userId, tugasId, sessions, db = pool) => {
  const insertedIds = [];
  for (const s of sessions) {
    const [res] = await db.query(
      `INSERT INTO sesi_jadwal (user_id, tugas_id, mulai_at, durasi_menit, status)
       VALUES (?, ?, ?, ?, 'terjadwal')`,
      [userId, tugasId, toUtcMysqlDatetime(s.mulai_at), s.durasi_menit]
    );
    insertedIds.push(res.insertId);
  }
  return insertedIds;
};

export const updateScheduleSession = async (scheduleId, userId, fields, db = pool) => {
  const allowed = ['mulai_at', 'durasi_menit', 'status'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
  if (keys.length === 0) return getScheduleById(scheduleId, userId, db);

  const clauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (k === 'mulai_at' ? toUtcMysqlDatetime(fields[k]) : fields[k]));
  values.push(scheduleId, userId);

  await db.query(`UPDATE sesi_jadwal SET ${clauses} WHERE id = ? AND user_id = ?`, values);
  return getScheduleById(scheduleId, userId, db);
};

export const deleteScheduleSession = async (scheduleId, userId, db = pool) => {
  const [res] = await db.query('DELETE FROM sesi_jadwal WHERE id = ? AND user_id = ?', [
    scheduleId,
    userId,
  ]);
  return res.affectedRows > 0;
};

export const getNextScheduledSessionForUser = async (userId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
        sj.id,
        sj.tugas_id,
        DATE_FORMAT(sj.mulai_at, '%Y-%m-%dT%H:%i:%sZ') AS mulai_at,
        sj.durasi_menit,
        sj.status,
        tp.judul AS judul_tugas,
        tp.kategori,
        DATE_FORMAT(tp.deadline_at, '%Y-%m-%dT%H:%i:%sZ') AS deadline_at
     FROM sesi_jadwal sj
     INNER JOIN tugas_pribadi tp ON tp.id = sj.tugas_id
     WHERE sj.user_id = ?
       AND sj.status = 'terjadwal'
       AND DATE_ADD(sj.mulai_at, INTERVAL sj.durasi_menit MINUTE) >= UTC_TIMESTAMP()
     ORDER BY sj.mulai_at ASC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

// ============================================================================
// TIMER FOKUS (fokus_sesi)
// ============================================================================

const FOCUS_SESSION_SELECT = `
  SELECT
    fs.id,
    fs.user_id,
    fs.tugas_id,
    fs.sesi_jadwal_id,
    fs.tipe,
    fs.status,
    DATE_FORMAT(fs.mulai_at, '%Y-%m-%dT%H:%i:%sZ') AS mulai_at,
    fs.durasi_rencana_detik,
    fs.total_jeda_detik,
    DATE_FORMAT(fs.jeda_sejak, '%Y-%m-%dT%H:%i:%sZ') AS jeda_sejak,
    DATE_FORMAT(fs.selesai_at, '%Y-%m-%dT%H:%i:%sZ') AS selesai_at,
    fs.catatan,
    fs.siklus_ke,
    tp.judul AS judul_tugas,
    tp.kategori,
    tp.status AS status_tugas,
    DATE_FORMAT(tp.deadline_at, '%Y-%m-%dT%H:%i:%sZ') AS deadline_tugas
  FROM fokus_sesi fs
  LEFT JOIN tugas_pribadi tp ON tp.id = fs.tugas_id
`;

export const getActiveFocusSession = async (userId, db = pool, forUpdate = false) => {
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await db.query(
    `${FOCUS_SESSION_SELECT} WHERE fs.user_id = ? AND fs.status IN ('berjalan', 'dijeda') LIMIT 1${lock}`,
    [userId]
  );
  return rows[0] || null;
};

export const getFocusSessionById = async (sessionId, userId, db = pool, forUpdate = false) => {
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await db.query(
    `${FOCUS_SESSION_SELECT} WHERE fs.id = ? AND fs.user_id = ? LIMIT 1${lock}`,
    [sessionId, userId]
  );
  return rows[0] || null;
};

export const insertFocusSession = async (
  { userId, tugasId, sesiJadwalId, tipe, mulaiAtUtc, durasiRencanaDetik, siklusKe },
  db = pool
) => {
  const [res] = await db.query(
    `INSERT INTO fokus_sesi
      (user_id, tugas_id, sesi_jadwal_id, tipe, status, mulai_at, durasi_rencana_detik, total_jeda_detik, siklus_ke)
     VALUES (?, ?, ?, ?, 'berjalan', ?, ?, 0, ?)`,
    [userId, tugasId || null, sesiJadwalId || null, tipe, toUtcMysqlDatetime(mulaiAtUtc), durasiRencanaDetik, siklusKe]
  );
  return getFocusSessionById(res.insertId, userId, db);
};

export const updateFocusSession = async (sessionId, userId, fields, db = pool) => {
  const allowed = ['status', 'total_jeda_detik', 'jeda_sejak', 'selesai_at', 'catatan'];
  const dateCols = new Set(['jeda_sejak', 'selesai_at']);
  const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
  if (keys.length === 0) return getFocusSessionById(sessionId, userId, db);

  const clauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (dateCols.has(k) ? toUtcMysqlDatetime(fields[k]) : fields[k]));
  values.push(sessionId, userId);

  await db.query(`UPDATE fokus_sesi SET ${clauses} WHERE id = ? AND user_id = ?`, values);
  return getFocusSessionById(sessionId, userId, db);
};

export const listFocusHistory = async (userId, limit = 20, db = pool) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const [rows] = await db.query(
    `${FOCUS_SESSION_SELECT}
     WHERE fs.user_id = ? AND fs.status IN ('selesai', 'dibatalkan')
     ORDER BY COALESCE(fs.selesai_at, fs.mulai_at) DESC
     LIMIT ?`,
    [userId, safeLimit]
  );
  return rows;
};

export const listCompletedFocusForStats = async (userId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
        fs.id,
        fs.tugas_id,
        fs.durasi_rencana_detik,
        fs.total_jeda_detik,
        DATE_FORMAT(fs.mulai_at, '%Y-%m-%dT%H:%i:%sZ') AS mulai_at,
        DATE_FORMAT(fs.selesai_at, '%Y-%m-%dT%H:%i:%sZ') AS selesai_at,
        tp.judul AS judul_tugas,
        tp.kategori,
        tp.estimasi_menit
     FROM fokus_sesi fs
     LEFT JOIN tugas_pribadi tp ON tp.id = fs.tugas_id
     WHERE fs.user_id = ? AND fs.status = 'selesai' AND fs.tipe = 'fokus'
     ORDER BY fs.selesai_at DESC`,
    [userId]
  );
  return rows;
};

// ============================================================================
// WEB PUSH SUBSCRIPTIONS
// ============================================================================

export const upsertPushSubscription = async (
  { userId, endpoint, p256dh, auth, userAgent },
  db = pool
) => {
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_used_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       user_agent = VALUES(user_agent),
       last_used_at = UTC_TIMESTAMP()`,
    [userId, endpoint, p256dh, auth, userAgent ? String(userAgent).slice(0, 255) : null]
  );
};

export const deletePushSubscriptionByEndpoint = async (endpoint, userId = null, db = pool) => {
  if (userId) {
    const [res] = await db.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [
      endpoint,
      userId,
    ]);
    return res.affectedRows > 0;
  }
  const [res] = await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  return res.affectedRows > 0;
};

export const listUserPushSubscriptions = async (userId, db = pool) => {
  const [rows] = await db.query(
    'SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    [userId]
  );
  return rows;
};

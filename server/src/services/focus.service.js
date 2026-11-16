// FILE: server/src/services/focus.service.js
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import {
  addDaysToDateKey,
  getZonedParts,
  resolveTimeZone,
  toUtcMs,
  toUtcMysqlDatetime,
} from '../utils/timezone.js';
import * as focusRepo from '../repositories/focus.repository.js';
import { computeSessionTiming, validateTimerTransition } from './focusTimerLogic.js';
import {
  computeAutoPlanSessions,
  detectScheduleConflictsAndLoad,
  suggestRescheduleSlot,
} from './autoPlanner.service.js';
import {
  syncAllPendingRemindersForUser,
  syncScheduleSessionReminders,
  syncTaskReminders,
} from './reminder.service.js';

const enrichSessionWithTiming = (session, nowUtcMs) => {
  if (!session) return null;
  return {
    ...session,
    timing: computeSessionTiming(session, nowUtcMs),
  };
};

// ============================================================================
// 1. TUGAS PRIBADI (MEMAKAI ULANG tugas_pribadi)
// ============================================================================

export const listTasksService = async (userId, query = {}) => {
  return focusRepo.listUserTasks(userId, { status: query.status });
};

export const createTaskService = async (userId, payload) => {
  if (payload.mata_kuliah_id) {
    const validCourse = await focusRepo.courseExists(payload.mata_kuliah_id);
    if (!validCourse) {
      throw new AppError('Mata kuliah yang dipilih tidak ditemukan.', 404);
    }
  }

  const created = await focusRepo.createUserTask(userId, payload);
  await syncTaskReminders(created.id, userId);
  return focusRepo.getUserTaskById(created.id, userId);
};

export const updateTaskService = async (taskId, userId, payload) => {
  const existing = await focusRepo.getUserTaskById(taskId, userId);
  if (!existing) {
    throw new AppError('Tugas tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }

  if (payload.mata_kuliah_id) {
    const validCourse = await focusRepo.courseExists(payload.mata_kuliah_id);
    if (!validCourse) {
      throw new AppError('Mata kuliah yang dipilih tidak ditemukan.', 404);
    }
  }

  const nextFields = { ...payload };
  if (payload.status === 'selesai' && existing.status !== 'selesai') {
    nextFields.completed_at = new Date().toISOString();
  } else if (payload.status && payload.status !== 'selesai') {
    nextFields.completed_at = null;
  }

  const updated = await focusRepo.updateUserTask(taskId, userId, nextFields);
  await syncTaskReminders(taskId, userId);
  return updated;
};

export const updateTaskStatusService = async (taskId, userId, status) => {
  return updateTaskService(taskId, userId, { status });
};

export const deleteTaskService = async (taskId, userId) => {
  const deleted = await focusRepo.deleteUserTask(taskId, userId);
  if (!deleted) {
    throw new AppError('Tugas tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }
};

// ============================================================================
// 2. PENJADWALAN ("KAPAN DIKERJAKAN") & RENCANA OTOMATIS
// ============================================================================

const markOverdueUserSchedules = async (userId) => {
  await pool.query(
    `UPDATE sesi_jadwal sj
     INNER JOIN tugas_pribadi tp ON tp.id = sj.tugas_id
     SET sj.status = 'terlewat'
     WHERE sj.user_id = ?
       AND sj.status = 'terjadwal'
       AND tp.status <> 'selesai'
       AND DATE_ADD(sj.mulai_at, INTERVAL sj.durasi_menit MINUTE) < UTC_TIMESTAMP()`,
    [userId]
  );
};

export const listSchedulesService = async (userId, query = {}) => {
  await markOverdueUserSchedules(userId);
  const [schedules, settings] = await Promise.all([
    focusRepo.listUserSchedules(userId, {
      fromUtc: query.from,
      toUtc: query.to,
      tugasId: query.tugas_id,
      status: query.status,
    }),
    focusRepo.getOrCreateSettings(userId),
  ]);

  const warningCheck = detectScheduleConflictsAndLoad({
    candidateSessions: schedules.filter((s) => s.status === 'terjadwal'),
    existingSessions: [],
    settings,
  });

  return {
    schedules,
    settings,
    warnings: warningCheck,
  };
};

export const computeAutoPlanService = async (userId, payload) => {
  const task = await focusRepo.getUserTaskById(payload.tugas_id, userId);
  if (!task) {
    throw new AppError('Tugas tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }

  const [existingSessions, settings] = await Promise.all([
    focusRepo.listUserSchedules(userId),
    focusRepo.getOrCreateSettings(userId),
  ]);

  const estimasiMenit = payload.estimasi_menit ?? task.estimasi_menit ?? 60;
  const deadlineUtcMs = toUtcMs(payload.deadline_at ?? task.deadline_at);
  const targetMulaiUtcMs = toUtcMs(payload.target_mulai ?? task.target_mulai);

  return computeAutoPlanSessions({
    nowUtcMs: Date.now(),
    deadlineUtcMs,
    targetMulaiUtcMs,
    estimasiMenit,
    strategy: payload.strategy || 'bagi_rata',
    preferredSessionMinutes: payload.preferred_session_minutes || 50,
    existingSessions,
    settings,
  });
};

export const createScheduleService = async (userId, payload) => {
  const task = await focusRepo.getUserTaskById(payload.tugas_id, userId);
  if (!task) {
    throw new AppError('Tugas tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }

  const [existingSessions, settings] = await Promise.all([
    focusRepo.listUserSchedules(userId),
    focusRepo.getOrCreateSettings(userId),
  ]);

  const warnings = detectScheduleConflictsAndLoad({
    candidateSessions: payload.sessions,
    existingSessions,
    deadlineUtcMs: task.deadline_at,
    settings,
  });

  const connection = await pool.getConnection();
  let insertedIds = [];
  try {
    await connection.beginTransaction();

    if (payload.estimasi_menit !== undefined || payload.target_mulai !== undefined) {
      await focusRepo.updateUserTask(
        task.id,
        userId,
        {
          ...(payload.estimasi_menit !== undefined ? { estimasi_menit: payload.estimasi_menit } : {}),
          ...(payload.target_mulai !== undefined ? { target_mulai: payload.target_mulai } : {}),
        },
        connection
      );
    }

    insertedIds = await focusRepo.createScheduleSessions(userId, task.id, payload.sessions, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  for (const sid of insertedIds) {
    await syncScheduleSessionReminders(sid, userId);
  }

  const createdSessions = [];
  for (const sid of insertedIds) {
    const s = await focusRepo.getScheduleById(sid, userId);
    if (s) createdSessions.push(s);
  }

  return {
    sessions: createdSessions,
    warnings,
  };
};

export const updateScheduleStatusService = async (scheduleId, userId, status) => {
  const existing = await focusRepo.getScheduleById(scheduleId, userId);
  if (!existing) {
    throw new AppError('Sesi jadwal tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }

  const updated = await focusRepo.updateScheduleSession(scheduleId, userId, { status });
  await syncScheduleSessionReminders(scheduleId, userId);
  return updated;
};

export const rescheduleSessionService = async (scheduleId, userId, payload = {}) => {
  const existing = await focusRepo.getScheduleById(scheduleId, userId);
  if (!existing) {
    throw new AppError('Sesi jadwal tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }

  const [allSchedules, settings] = await Promise.all([
    focusRepo.listUserSchedules(userId),
    focusRepo.getOrCreateSettings(userId),
  ]);

  let nextMulaiAt = payload.mulai_at;
  const nextDurasi = payload.durasi_menit || existing.durasi_menit || 50;

  if (payload.auto || !nextMulaiAt) {
    const suggested = suggestRescheduleSlot({
      durationMenit: nextDurasi,
      nowUtcMs: Date.now(),
      existingSessions: allSchedules,
      deadlineUtcMs: existing.deadline_at,
      settings,
      excludeSessionId: scheduleId,
    });
    nextMulaiAt = suggested.mulai_at;
  }

  const warnings = detectScheduleConflictsAndLoad({
    candidateSessions: [{ mulai_at: nextMulaiAt, durasi_menit: nextDurasi }],
    existingSessions: allSchedules,
    deadlineUtcMs: existing.deadline_at,
    settings,
    excludeSessionId: scheduleId,
  });

  const updated = await focusRepo.updateScheduleSession(scheduleId, userId, {
    mulai_at: nextMulaiAt,
    durasi_menit: nextDurasi,
    status: 'terjadwal',
  });
  await syncScheduleSessionReminders(scheduleId, userId);

  return {
    session: updated,
    warnings,
  };
};

export const suggestRescheduleSlotService = async (scheduleId, userId) => {
  const existing = await focusRepo.getScheduleById(scheduleId, userId);
  if (!existing) {
    throw new AppError('Sesi jadwal tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }
  const [allSchedules, settings] = await Promise.all([
    focusRepo.listUserSchedules(userId),
    focusRepo.getOrCreateSettings(userId),
  ]);
  return suggestRescheduleSlot({
    durationMenit: existing.durasi_menit || 50,
    nowUtcMs: Date.now(),
    existingSessions: allSchedules,
    deadlineUtcMs: existing.deadline_at,
    settings,
    excludeSessionId: scheduleId,
  });
};

export const deleteScheduleService = async (scheduleId, userId) => {
  const deleted = await focusRepo.deleteScheduleSession(scheduleId, userId);
  if (!deleted) {
    throw new AppError('Sesi jadwal tidak ditemukan atau Anda tidak memiliki akses.', 404);
  }
};

// ============================================================================
// 3. TIMER FOKUS POMODORO (AKURAT SERVER-DRIVEN & SINGLE ACTIVE SESSION)
// ============================================================================

const finalizeExpiredSessionInTx = async (session, userId, connection) => {
  const timing = computeSessionTiming(session, Date.now());
  const finishedAt = timing.expected_end_at || new Date().toISOString();
  const completed = await focusRepo.updateFocusSession(
    session.id,
    userId,
    {
      status: 'selesai',
      selesai_at: finishedAt,
    },
    connection
  );
  if (session.sesi_jadwal_id && session.tipe === 'fokus') {
    await focusRepo.updateScheduleSession(
      session.sesi_jadwal_id,
      userId,
      { status: 'selesai' },
      connection
    );
  }
  return completed;
};

export const getActiveTimerService = async (userId) => {
  const nowUtcMs = Date.now();
  const settings = await focusRepo.getOrCreateSettings(userId);
  let active = await focusRepo.getActiveFocusSession(userId);
  let autoCompletedSession = null;

  if (active) {
    const timing = computeSessionTiming(active, nowUtcMs);
    if (timing.is_expired) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const locked = await focusRepo.getFocusSessionById(active.id, userId, connection, true);
        if (locked && locked.status === 'berjalan' && computeSessionTiming(locked, nowUtcMs).is_expired) {
          autoCompletedSession = await finalizeExpiredSessionInTx(locked, userId, connection);
          active = null;
        } else {
          active = locked;
        }
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
      if (autoCompletedSession?.sesi_jadwal_id) {
        await syncScheduleSessionReminders(autoCompletedSession.sesi_jadwal_id, userId);
      }
    }
  }

  return {
    activeSession: enrichSessionWithTiming(active, nowUtcMs),
    autoCompletedSession: enrichSessionWithTiming(autoCompletedSession, nowUtcMs),
    settings,
    server_now: new Date(nowUtcMs).toISOString(),
  };
};

export const startTimerService = async (userId, payload) => {
  const settings = await focusRepo.getOrCreateSettings(userId);
  const defaultMinutesByType = {
    fokus: settings.durasi_fokus,
    istirahat_pendek: settings.durasi_istirahat_pendek,
    istirahat_panjang: settings.durasi_istirahat_panjang,
  };
  const durasiMenit = payload.durasi_menit || defaultMinutesByType[payload.tipe] || 25;

  let resolvedTaskId = payload.tugas_id || null;
  const resolvedJadwalId = payload.sesi_jadwal_id || null;

  if (resolvedTaskId) {
    const task = await focusRepo.getUserTaskById(resolvedTaskId, userId);
    if (!task) {
      throw new AppError('Tugas tidak ditemukan atau Anda tidak memiliki akses.', 404);
    }
  }
  if (resolvedJadwalId) {
    const jadwal = await focusRepo.getScheduleById(resolvedJadwalId, userId);
    if (!jadwal) {
      throw new AppError('Sesi jadwal tidak ditemukan atau Anda tidak memiliki akses.', 404);
    }
    if (!resolvedTaskId) resolvedTaskId = jadwal.tugas_id;
  }

  const nowUtcMs = Date.now();
  const connection = await pool.getConnection();
  let created;
  try {
    await connection.beginTransaction();

    const existingActive = await focusRepo.getActiveFocusSession(userId, connection, true);
    if (existingActive) {
      const timing = computeSessionTiming(existingActive, nowUtcMs);
      if (timing.is_expired) {
        await finalizeExpiredSessionInTx(existingActive, userId, connection);
      } else {
        throw new AppError(
          'Anda masih memiliki sesi timer aktif di tab atau perangkat lain. Sinkronkan atau hentikan sesi tersebut terlebih dahulu.',
          409
        );
      }
    }

    created = await focusRepo.insertFocusSession(
      {
        userId,
        tugasId: payload.tipe === 'fokus' ? resolvedTaskId : resolvedTaskId,
        sesiJadwalId: resolvedJadwalId,
        tipe: payload.tipe,
        mulaiAtUtc: new Date(nowUtcMs).toISOString(),
        durasiRencanaDetik: durasiMenit * 60,
        siklusKe: payload.siklus_ke || 1,
      },
      connection
    );

    if (payload.tipe === 'fokus' && resolvedTaskId) {
      const task = await focusRepo.getUserTaskById(resolvedTaskId, userId, connection);
      if (task && task.status === 'belum_mulai') {
        await focusRepo.updateUserTask(
          resolvedTaskId,
          userId,
          { status: 'sedang_dikerjakan' },
          connection
        );
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('Anda masih memiliki sesi timer aktif. Muat ulang untuk menyinkronkan.', 409);
    }
    throw err;
  } finally {
    connection.release();
  }

  return {
    session: enrichSessionWithTiming(created, nowUtcMs),
    server_now: new Date(nowUtcMs).toISOString(),
  };
};

export const pauseTimerService = async (sessionId, userId) => {
  const nowUtcMs = Date.now();
  const connection = await pool.getConnection();
  let updated;
  try {
    await connection.beginTransaction();
    const session = await focusRepo.getFocusSessionById(sessionId, userId, connection, true);
    if (!session) {
      throw new AppError('Sesi fokus tidak ditemukan atau Anda tidak memiliki akses.', 404);
    }

    validateTimerTransition(session.status, 'pause');

    const timing = computeSessionTiming(session, nowUtcMs);
    if (timing.is_expired) {
      updated = await finalizeExpiredSessionInTx(session, userId, connection);
    } else {
      updated = await focusRepo.updateFocusSession(
        sessionId,
        userId,
        {
          status: 'dijeda',
          jeda_sejak: new Date(nowUtcMs).toISOString(),
        },
        connection
      );
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return {
    session: enrichSessionWithTiming(updated, nowUtcMs),
    server_now: new Date(nowUtcMs).toISOString(),
  };
};

export const resumeTimerService = async (sessionId, userId) => {
  const nowUtcMs = Date.now();
  const connection = await pool.getConnection();
  let updated;
  try {
    await connection.beginTransaction();
    const session = await focusRepo.getFocusSessionById(sessionId, userId, connection, true);
    if (!session) {
      throw new AppError('Sesi fokus tidak ditemukan atau Anda tidak memiliki akses.', 404);
    }

    validateTimerTransition(session.status, 'resume');

    const jedaSejakMs = toUtcMs(session.jeda_sejak) || nowUtcMs;
    const addedPause = Math.max(0, Math.floor((nowUtcMs - jedaSejakMs) / 1000));
    const nextTotalPause = Math.max(0, Number(session.total_jeda_detik) || 0) + addedPause;

    updated = await focusRepo.updateFocusSession(
      sessionId,
      userId,
      {
        status: 'berjalan',
        total_jeda_detik: nextTotalPause,
        jeda_sejak: null,
      },
      connection
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return {
    session: enrichSessionWithTiming(updated, nowUtcMs),
    server_now: new Date(nowUtcMs).toISOString(),
  };
};

export const completeTimerService = async (sessionId, userId, payload = {}) => {
  const nowUtcMs = Date.now();
  const connection = await pool.getConnection();
  let updated;
  try {
    await connection.beginTransaction();
    const session = await focusRepo.getFocusSessionById(sessionId, userId, connection, true);
    if (!session) {
      throw new AppError('Sesi fokus tidak ditemukan atau Anda tidak memiliki akses.', 404);
    }

    // Izinkan menyimpan catatan / status tugas bila sesi baru saja auto-complete saat dicek
    if (session.status === 'selesai') {
      updated = await focusRepo.updateFocusSession(
        sessionId,
        userId,
        {
          ...(payload.catatan !== undefined ? { catatan: payload.catatan || null } : {}),
        },
        connection
      );
    } else {
      validateTimerTransition(session.status, 'complete');
      const timing = computeSessionTiming(session, nowUtcMs);
      let nextTotalPause = Math.max(0, Number(session.total_jeda_detik) || 0);
      if (session.status === 'dijeda' && session.jeda_sejak) {
        const addedPause = Math.max(0, Math.floor((nowUtcMs - toUtcMs(session.jeda_sejak)) / 1000));
        nextTotalPause += addedPause;
      }
      const selesaiAt =
        session.status === 'berjalan' && timing.is_expired && timing.expected_end_at
          ? timing.expected_end_at
          : new Date(nowUtcMs).toISOString();

      updated = await focusRepo.updateFocusSession(
        sessionId,
        userId,
        {
          status: 'selesai',
          total_jeda_detik: nextTotalPause,
          jeda_sejak: null,
          selesai_at: selesaiAt,
          catatan: payload.catatan || session.catatan || null,
        },
        connection
      );
    }

    if (session.sesi_jadwal_id && payload.tandai_jadwal_selesai !== false) {
      await focusRepo.updateScheduleSession(
        session.sesi_jadwal_id,
        userId,
        { status: 'selesai' },
        connection
      );
    }

    if (payload.tandai_tugas_selesai && session.tugas_id) {
      await focusRepo.updateUserTask(
        session.tugas_id,
        userId,
        { status: 'selesai', completed_at: new Date(nowUtcMs).toISOString() },
        connection
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  if (payload.tandai_tugas_selesai && updated?.tugas_id) {
    await syncTaskReminders(updated.tugas_id, userId);
  }
  if (updated?.sesi_jadwal_id) {
    await syncScheduleSessionReminders(updated.sesi_jadwal_id, userId);
  }

  return {
    session: enrichSessionWithTiming(updated, nowUtcMs),
    server_now: new Date(nowUtcMs).toISOString(),
  };
};

export const cancelTimerService = async (sessionId, userId) => {
  const nowUtcMs = Date.now();
  const connection = await pool.getConnection();
  let updated;
  try {
    await connection.beginTransaction();
    const session = await focusRepo.getFocusSessionById(sessionId, userId, connection, true);
    if (!session) {
      throw new AppError('Sesi fokus tidak ditemukan atau Anda tidak memiliki akses.', 404);
    }

    validateTimerTransition(session.status, 'cancel');

    let nextTotalPause = Math.max(0, Number(session.total_jeda_detik) || 0);
    if (session.status === 'dijeda' && session.jeda_sejak) {
      nextTotalPause += Math.max(0, Math.floor((nowUtcMs - toUtcMs(session.jeda_sejak)) / 1000));
    }

    updated = await focusRepo.updateFocusSession(
      sessionId,
      userId,
      {
        status: 'dibatalkan',
        total_jeda_detik: nextTotalPause,
        jeda_sejak: null,
        selesai_at: new Date(nowUtcMs).toISOString(),
      },
      connection
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return {
    session: enrichSessionWithTiming(updated, nowUtcMs),
    server_now: new Date(nowUtcMs).toISOString(),
  };
};

export const listTimerHistoryService = async (userId, limit = 20) => {
  return focusRepo.listFocusHistory(userId, limit);
};

// ============================================================================
// 4. PENGATURAN & WEB PUSH
// ============================================================================

export const getSettingsService = async (userId) => {
  return focusRepo.getOrCreateSettings(userId);
};

export const updateSettingsService = async (userId, payload) => {
  const updated = await focusRepo.updateSettings(userId, payload);
  await syncAllPendingRemindersForUser(userId);
  return updated;
};

export const subscribePushService = async (userId, payload, userAgent) => {
  await focusRepo.upsertPushSubscription({
    userId,
    endpoint: payload.endpoint,
    p256dh: payload.keys.p256dh,
    auth: payload.keys.auth,
    userAgent,
  });
};

export const unsubscribePushService = async (userId, endpoint) => {
  await focusRepo.deletePushSubscriptionByEndpoint(endpoint, userId);
};

// ============================================================================
// 5. STATISTIK FOKUS & WIDGET BERANDA
// ============================================================================

/**
 * Menghitung agregasi statistik fokus (hari ini, 7 hari, per mata kuliah, per tugas, streak).
 */
export const computeFocusStatsFromData = (sessions = [], tasks = [], settings = {}, nowUtcMs = Date.now()) => {
  const tz = resolveTimeZone(settings.zona_waktu);
  const todayKey = getZonedParts(nowUtcMs, tz).dateKey;
  const sevenDaysKeys = [];
  for (let i = 6; i >= 0; i -= 1) {
    sevenDaysKeys.push(addDaysToDateKey(todayKey, -i));
  }
  const sevenDaysSet = new Set(sevenDaysKeys);

  const dayMap = new Map(sevenDaysKeys.map((dk) => [dk, { date_key: dk, total_detik: 0, jumlah_sesi: 0 }]));
  const activeDaySet = new Set();
  const courseMap = new Map();
  let todaySeconds = 0;

  for (const s of sessions) {
    const startMs = toUtcMs(s.mulai_at);
    const endMs = toUtcMs(s.selesai_at) || nowUtcMs;
    if (!startMs) continue;

    const timing = computeSessionTiming({ ...s, status: 'selesai' }, endMs);
    const focusSeconds = timing.elapsed_detik;
    const { dateKey } = getZonedParts(endMs, tz);

    if (focusSeconds > 0) {
      activeDaySet.add(dateKey);
    }
    if (dateKey === todayKey) {
      todaySeconds += focusSeconds;
    }
    if (sevenDaysSet.has(dateKey)) {
      const entry = dayMap.get(dateKey);
      entry.total_detik += focusSeconds;
      entry.jumlah_sesi += 1;
    }

    const courseKey = s.mata_kuliah_id ? String(s.mata_kuliah_id) : 'tanpa_matkul';
    if (!courseMap.has(courseKey)) {
      courseMap.set(courseKey, {
        mata_kuliah_id: s.mata_kuliah_id || null,
        matkul_kode: s.matkul_kode || '-',
        matkul_nama: s.matkul_nama || 'Fokus Bebas / Umum',
        total_detik: 0,
        jumlah_sesi: 0,
      });
    }
    const cEntry = courseMap.get(courseKey);
    cEntry.total_detik += focusSeconds;
    cEntry.jumlah_sesi += 1;
  }

  // Hitung streak hari berturut-turut (dimulai dari hari ini, atau kemarin jika hari ini belum ada sesi)
  let streakHari = 0;
  let cursorKey = activeDaySet.has(todayKey) ? todayKey : addDaysToDateKey(todayKey, -1);
  while (activeDaySet.has(cursorKey)) {
    streakHari += 1;
    cursorKey = addDaysToDateKey(cursorKey, -1);
  }

  const harian7Hari = sevenDaysKeys.map((dk) => {
    const item = dayMap.get(dk);
    return {
      date_key: dk,
      total_menit: Math.round(item.total_detik / 60),
      jumlah_sesi: item.jumlah_sesi,
    };
  });

  const tujuhHariMenit = harian7Hari.reduce((acc, d) => acc + d.total_menit, 0);

  const perMatkul = [...courseMap.values()]
    .map((c) => ({
      ...c,
      total_menit: Math.round(c.total_detik / 60),
    }))
    .sort((a, b) => b.total_menit - a.total_menit);

  const perTugas = tasks
    .filter((t) => Number(t.total_fokus_detik) > 0 || Number(t.estimasi_menit) > 0)
    .map((t) => ({
      id: t.id,
      judul: t.judul,
      status: t.status,
      matkul_kode: t.matkul_kode,
      matkul_nama: t.matkul_nama,
      estimasi_menit: t.estimasi_menit ? Number(t.estimasi_menit) : null,
      fokus_menit: Math.round(Number(t.total_fokus_detik || 0) / 60),
      jumlah_sesi_fokus: Number(t.jumlah_sesi_fokus || 0),
    }));

  return {
    zona_waktu: tz,
    hari_ini_menit: Math.round(todaySeconds / 60),
    tujuh_hari_menit: tujuhHariMenit,
    total_sesi_selesai: sessions.length,
    streak_hari: streakHari,
    harian_7_hari: harian7Hari,
    per_matkul: perMatkul,
    per_tugas: perTugas,
  };
};

export const getFocusStatsService = async (userId) => {
  const [sessions, tasks, settings] = await Promise.all([
    focusRepo.listCompletedFocusForStats(userId),
    focusRepo.listUserTasks(userId),
    focusRepo.getOrCreateSettings(userId),
  ]);
  return computeFocusStatsFromData(sessions, tasks, settings, Date.now());
};

export const getNextSessionWidgetService = async (userId) => {
  await markOverdueUserSchedules(userId);
  const [timerState, nextSchedule] = await Promise.all([
    getActiveTimerService(userId),
    focusRepo.getNextScheduledSessionForUser(userId),
  ]);

  return {
    activeSession: timerState.activeSession,
    nextSchedule,
    server_now: timerState.server_now,
  };
};

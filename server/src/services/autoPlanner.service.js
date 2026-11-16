// FILE: server/src/services/autoPlanner.service.js
import {
  addDaysToDateKey,
  dateKeyAndMinutesToUtcMs,
  getZonedParts,
  parseHmToMinutes,
  resolveTimeZone,
  toUtcMs,
} from '../utils/timezone.js';

const MINUTE_MS = 60 * 1000;

const roundUpToInterval = (ms, stepMinutes = 5) => {
  const stepMs = stepMinutes * MINUTE_MS;
  return Math.ceil(ms / stepMs) * stepMs;
};

const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Memecah estimasi waktu pengerjaan ke beberapa chunk sesi yang nyaman dikerjakan.
 */
export const splitEstimateIntoChunks = (estimasiMenit, preferredSessionMinutes = 50) => {
  const total = Math.max(15, Math.round(Number(estimasiMenit) || 50));
  const chunkMax = Math.max(15, Math.min(180, Math.round(Number(preferredSessionMinutes) || 50)));
  const chunks = [];
  let remaining = total;
  while (remaining > 0) {
    if (remaining <= chunkMax) {
      chunks.push(remaining);
      break;
    }
    const after = remaining - chunkMax;
    if (after < 15 && chunks.length >= 0 && chunkMax + after <= 90) {
      chunks.push(remaining);
      break;
    }
    chunks.push(chunkMax);
    remaining -= chunkMax;
  }
  return chunks;
};

const buildOccupiedState = (existingSessions = [], tz, excludeSessionId = null) => {
  const intervals = [];
  const dailyMinutes = new Map();

  for (const s of existingSessions) {
    if (excludeSessionId && Number(s.id) === Number(excludeSessionId)) continue;
    if (!['terjadwal', 'selesai'].includes(s.status)) continue;
    const startMs = toUtcMs(s.mulai_at);
    const dur = Number(s.durasi_menit) || 0;
    if (startMs === null || dur <= 0) continue;

    intervals.push({
      id: s.id,
      tugas_id: s.tugas_id,
      judul_tugas: s.judul_tugas || s.judul || null,
      startMs,
      endMs: startMs + dur * MINUTE_MS,
      durasi_menit: dur,
    });

    const { dateKey } = getZonedParts(startMs, tz);
    dailyMinutes.set(dateKey, (dailyMinutes.get(dateKey) || 0) + dur);
  }

  intervals.sort((a, b) => a.startMs - b.startMs);
  return { intervals, dailyMinutes };
};

const getActiveWindowForDateKey = (dateKey, startActiveMin, endActiveMin, tz) => {
  const effectiveStartMin = startActiveMin;
  const effectiveEndMin = endActiveMin > startActiveMin ? endActiveMin : 22 * 60;
  return {
    windowStartMs: dateKeyAndMinutesToUtcMs(dateKey, effectiveStartMin, tz),
    windowEndMs: dateKeyAndMinutesToUtcMs(dateKey, effectiveEndMin, tz),
  };
};

/**
 * Mencari slot kosong pertama dalam rentang jam aktif pada tanggal tertentu yang muat untuk durasi sesi.
 */
const findSlotOnDay = ({
  dateKey,
  durationMin,
  minStartMs,
  maxEndMs = null,
  startActiveMin,
  endActiveMin,
  breakGapMin,
  intervals,
  tz,
}) => {
  const { windowStartMs, windowEndMs } = getActiveWindowForDateKey(
    dateKey,
    startActiveMin,
    endActiveMin,
    tz
  );
  const hardEndMs = maxEndMs !== null ? Math.min(windowEndMs, maxEndMs) : windowEndMs;
  let candidateStart = roundUpToInterval(Math.max(windowStartMs, minStartMs), 5);
  const durationMs = durationMin * MINUTE_MS;

  while (candidateStart + durationMs <= hardEndMs) {
    const candidateEnd = candidateStart + durationMs;
    const blocker = intervals.find((iv) => intervalsOverlap(candidateStart, candidateEnd, iv.startMs, iv.endMs));
    if (!blocker) {
      return { startMs: candidateStart, endMs: candidateEnd };
    }
    candidateStart = roundUpToInterval(blocker.endMs + breakGapMin * MINUTE_MS, 5);
  }

  return null;
};

/**
 * Merancang saran pembagian sesi kerja secara deterministik (tanpa menyimpan ke database).
 * Mendukung strategi:
 * - 'bagi_rata': menyebar sesi merata ke hari-hari tersedia
 * - 'dekat_deadline': memadatkan sesi mendekati tanggal deadline
 */
export const computeAutoPlanSessions = ({
  nowUtcMs = Date.now(),
  deadlineUtcMs = null,
  targetMulaiUtcMs = null,
  estimasiMenit = 60,
  strategy = 'bagi_rata',
  preferredSessionMinutes = 50,
  breakGapMinutes = 10,
  existingSessions = [],
  settings = {},
}) => {
  const tz = resolveTimeZone(settings.zona_waktu);
  const startActiveMin = parseHmToMinutes(settings.jam_aktif_mulai, 8 * 60);
  const endActiveMin = parseHmToMinutes(settings.jam_aktif_selesai, 22 * 60);
  const maxDailyLoad = Math.max(30, Number(settings.batas_beban_harian_menit) || 240);

  const earliestStartMs = roundUpToInterval(
    Math.max(nowUtcMs + 15 * MINUTE_MS, targetMulaiUtcMs || 0),
    5
  );
  const effectiveDeadlineMs = toUtcMs(deadlineUtcMs);

  const startLocal = getZonedParts(earliestStartMs, tz);
  const deadlineLocal = effectiveDeadlineMs ? getZonedParts(effectiveDeadlineMs, tz) : null;

  const totalHorizonDays = 14;
  const candidateDateKeys = [];
  if (deadlineLocal && effectiveDeadlineMs > earliestStartMs) {
    let cursor = startLocal.dateKey;
    for (let i = 0; i < 30; i += 1) {
      candidateDateKeys.push(cursor);
      if (cursor === deadlineLocal.dateKey) break;
      cursor = addDaysToDateKey(cursor, 1);
    }
  } else {
    for (let i = 0; i < totalHorizonDays; i += 1) {
      candidateDateKeys.push(addDaysToDateKey(startLocal.dateKey, i));
    }
  }

  // Fallback jika deadline sangat dekat atau sudah lewat: tetap sediakan horizon 7 hari ke depan
  const extendedDateKeys = [...candidateDateKeys];
  while (extendedDateKeys.length < totalHorizonDays) {
    extendedDateKeys.push(addDaysToDateKey(extendedDateKeys[extendedDateKeys.length - 1], 1));
  }

  const chunks = splitEstimateIntoChunks(estimasiMenit, preferredSessionMinutes);
  const { intervals, dailyMinutes } = buildOccupiedState(existingSessions, tz);

  // Tentukan urutan hari sesuai strategi
  const primaryDays =
    strategy === 'dekat_deadline' ? [...candidateDateKeys].reverse() : [...candidateDateKeys];

  const planned = [];
  let rrIndex = 0;

  for (const chunkMin of chunks) {
    let placed = null;
    let usedDayKey = null;

    const tryDays = (days, enforceDeadlineBound, enforceDailyLimit) => {
      for (let step = 0; step < days.length; step += 1) {
        const idx = strategy === 'bagi_rata' ? (rrIndex + step) % days.length : step;
        const dk = days[idx];
        const currentDaily = dailyMinutes.get(dk) || 0;
        if (enforceDailyLimit && currentDaily + chunkMin > maxDailyLoad) {
          continue;
        }
        const dayMaxEnd =
          enforceDeadlineBound && effectiveDeadlineMs && deadlineLocal && dk === deadlineLocal.dateKey
            ? effectiveDeadlineMs
            : null;
        if (enforceDeadlineBound && effectiveDeadlineMs && deadlineLocal && dk > deadlineLocal.dateKey) {
          continue;
        }

        const slot = findSlotOnDay({
          dateKey: dk,
          durationMin: chunkMin,
          minStartMs: dk === startLocal.dateKey ? earliestStartMs : 0,
          maxEndMs: dayMaxEnd,
          startActiveMin,
          endActiveMin,
          breakGapMin: breakGapMinutes,
          intervals,
          tz,
        });

        if (slot) {
          if (strategy === 'bagi_rata') {
            rrIndex = (idx + 1) % days.length;
          }
          return { slot, dateKey: dk };
        }
      }
      return null;
    };

    // Pass 1: Hormati batas deadline & batas beban harian
    const p1 = tryDays(primaryDays, true, true);
    if (p1) {
      placed = p1.slot;
      usedDayKey = p1.dateKey;
    }

    // Pass 2: Jika hari sebelum deadline penuh, longgarkan batas beban harian tapi tetap sebelum deadline
    if (!placed) {
      const p2 = tryDays(primaryDays, true, false);
      if (p2) {
        placed = p2.slot;
        usedDayKey = p2.dateKey;
      }
    }

    // Pass 3: Jika tetap tidak muat sebelum deadline (atau deadline lewat), jadwalkan ke slot aktif terdekat
    if (!placed) {
      const p3 = tryDays(extendedDateKeys, false, true) || tryDays(extendedDateKeys, false, false);
      if (p3) {
        placed = p3.slot;
        usedDayKey = p3.dateKey;
      }
    }

    if (placed) {
      const nextDailyTotal = (dailyMinutes.get(usedDayKey) || 0) + chunkMin;
      dailyMinutes.set(usedDayKey, nextDailyTotal);
      intervals.push({
        startMs: placed.startMs,
        endMs: placed.endMs,
        durasi_menit: chunkMin,
      });
      intervals.sort((a, b) => a.startMs - b.startMs);

      const warnings = [];
      if (effectiveDeadlineMs && placed.endMs > effectiveDeadlineMs) {
        warnings.push('melewati_deadline');
      }
      if (nextDailyTotal > maxDailyLoad) {
        warnings.push('beban_harian_berlebih');
      }

      planned.push({
        mulai_at: new Date(placed.startMs).toISOString(),
        selesai_at: new Date(placed.endMs).toISOString(),
        durasi_menit: chunkMin,
        date_key: usedDayKey,
        warnings,
      });
    }
  }

  planned.sort((a, b) => Date.parse(a.mulai_at) - Date.parse(b.mulai_at));

  const pastDeadlineCount = planned.filter((s) => s.warnings.includes('melewati_deadline')).length;
  const overloadDays = [...dailyMinutes.entries()]
    .filter(([, total]) => total > maxDailyLoad)
    .map(([dateKey, totalMenit]) => ({ date_key: dateKey, total_menit: totalMenit, batas_menit: maxDailyLoad }));

  return {
    sessions: planned,
    summary: {
      total_sesi: planned.length,
      total_menit: planned.reduce((acc, s) => acc + s.durasi_menit, 0),
      strategy,
      zona_waktu: tz,
      batas_beban_harian_menit: maxDailyLoad,
    },
    warnings: {
      melewati_deadline: pastDeadlineCount > 0,
      jumlah_melewati_deadline: pastDeadlineCount,
      beban_harian_berlebih: overloadDays.length > 0,
      overload_days: overloadDays,
    },
  };
};

/**
 * Mendeteksi bentrok jadwal, beban berlebih harian, dan sesi setelah deadline (non-blocking warnings).
 */
export const detectScheduleConflictsAndLoad = ({
  candidateSessions = [],
  existingSessions = [],
  deadlineUtcMs = null,
  settings = {},
  excludeSessionId = null,
}) => {
  const tz = resolveTimeZone(settings.zona_waktu);
  const maxDailyLoad = Math.max(30, Number(settings.batas_beban_harian_menit) || 240);
  const effectiveDeadlineMs = toUtcMs(deadlineUtcMs);
  const { intervals, dailyMinutes } = buildOccupiedState(existingSessions, tz, excludeSessionId);

  const conflicts = [];
  const pastDeadlineWarnings = [];
  const dailyTotalsAfter = new Map(dailyMinutes);

  const normalizedCandidates = candidateSessions
    .map((s, idx) => {
      const startMs = toUtcMs(s.mulai_at);
      const dur = Number(s.durasi_menit) || 0;
      return { idx, startMs, endMs: startMs + dur * MINUTE_MS, dur };
    })
    .filter((c) => c.startMs !== null && c.dur > 0);

  for (const cand of normalizedCandidates) {
    // 1. Cek melewati deadline
    if (effectiveDeadlineMs && cand.endMs > effectiveDeadlineMs) {
      pastDeadlineWarnings.push({
        index: cand.idx,
        mulai_at: new Date(cand.startMs).toISOString(),
        message: 'Sesi kerja ini selesai melewati batas deadline tugas.',
      });
    }

    // 2. Cek bentrok dengan sesi existing
    for (const iv of intervals) {
      if (intervalsOverlap(cand.startMs, cand.endMs, iv.startMs, iv.endMs)) {
        conflicts.push({
          index: cand.idx,
          with_session_id: iv.id,
          with_task_title: iv.judul_tugas,
          start_at: new Date(iv.startMs).toISOString(),
          end_at: new Date(iv.endMs).toISOString(),
          message: `Bentrok dengan sesi "${iv.judul_tugas || 'Tugas lain'}".`,
        });
      }
    }

    // 3. Cek bentrok antar kandidat baru dalam satu submit
    for (const other of normalizedCandidates) {
      if (cand.idx < other.idx && intervalsOverlap(cand.startMs, cand.endMs, other.startMs, other.endMs)) {
        conflicts.push({
          index: cand.idx,
          with_candidate_index: other.idx,
          message: `Sesi ke-${cand.idx + 1} dan sesi ke-${other.idx + 1} saling bertumpukan waktunya.`,
        });
      }
    }

    // 4. Akumulasi beban harian
    const { dateKey } = getZonedParts(cand.startMs, tz);
    dailyTotalsAfter.set(dateKey, (dailyTotalsAfter.get(dateKey) || 0) + cand.dur);
  }

  const dailyLoadWarnings = [];
  for (const cand of normalizedCandidates) {
    const { dateKey } = getZonedParts(cand.startMs, tz);
    const totalMenit = dailyTotalsAfter.get(dateKey) || 0;
    if (totalMenit > maxDailyLoad && !dailyLoadWarnings.some((w) => w.date_key === dateKey)) {
      dailyLoadWarnings.push({
        date_key: dateKey,
        total_menit: totalMenit,
        batas_menit: maxDailyLoad,
        message: `Total jadwal kerja pada ${dateKey} mencapai ${totalMenit} menit (melebihi batas ${maxDailyLoad} menit/hari).`,
      });
    }
  }

  return {
    conflicts,
    pastDeadlineWarnings,
    dailyLoadWarnings,
    hasWarnings: conflicts.length > 0 || pastDeadlineWarnings.length > 0 || dailyLoadWarnings.length > 0,
  };
};

/**
 * Menyarankan slot jadwal ulang terdekat yang bebas bentrok di dalam jam aktif user.
 */
export const suggestRescheduleSlot = ({
  durationMenit = 50,
  nowUtcMs = Date.now(),
  existingSessions = [],
  deadlineUtcMs = null,
  settings = {},
  excludeSessionId = null,
}) => {
  const result = computeAutoPlanSessions({
    nowUtcMs,
    deadlineUtcMs,
    targetMulaiUtcMs: nowUtcMs,
    estimasiMenit: durationMenit,
    strategy: 'bagi_rata',
    preferredSessionMinutes: durationMenit,
    existingSessions: existingSessions.filter((s) =>
      excludeSessionId ? Number(s.id) !== Number(excludeSessionId) : true
    ),
    settings,
  });

  if (result.sessions.length > 0) {
    return result.sessions[0];
  }

  const fallbackStart = roundUpToInterval(nowUtcMs + 30 * MINUTE_MS, 5);
  return {
    mulai_at: new Date(fallbackStart).toISOString(),
    selesai_at: new Date(fallbackStart + durationMenit * MINUTE_MS).toISOString(),
    durasi_menit: durationMenit,
    warnings: [],
  };
};

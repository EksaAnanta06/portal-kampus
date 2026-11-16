// FILE: server/src/services/focusTimerLogic.js
import { AppError } from '../utils/AppError.js';
import { toUtcMs } from '../utils/timezone.js';

export const ALLOWED_TIMER_ACTIONS = {
  pause: ['berjalan'],
  resume: ['dijeda'],
  complete: ['berjalan', 'dijeda'],
  cancel: ['berjalan', 'dijeda'],
};

const ACTION_ERROR_MESSAGES = {
  pause: 'Sesi hanya dapat dijeda saat sedang berjalan.',
  resume: 'Sesi hanya dapat dilanjutkan jika berstatus dijeda.',
  complete: 'Sesi hanya dapat diselesaikan saat sedang berjalan atau dijeda.',
  cancel: 'Sesi hanya dapat dibatalkan saat sedang berjalan atau dijeda.',
};

/**
 * Memvalidasi transisi state timer Pomodoro berdasarkan status saat ini.
 */
export const validateTimerTransition = (currentStatus, action) => {
  const allowed = ALLOWED_TIMER_ACTIONS[action];
  if (!allowed || !allowed.includes(currentStatus)) {
    throw new AppError(
      ACTION_ERROR_MESSAGES[action] || `Transisi aksi "${action}" tidak valid untuk status "${currentStatus}".`,
      400
    );
  }
};

/**
 * Menghitung waktu berjalan, jeda, dan sisa waktu timer murni dari selisih timestamp UTC
 * agar bebas drift saat tab berada di background atau perangkat tidur.
 */
export const computeSessionTiming = (session, nowUtcMs = Date.now()) => {
  if (!session) return null;

  const mulaiAtMs = toUtcMs(session.mulai_at);
  const jedaSejakMs = toUtcMs(session.jeda_sejak);
  const selesaiAtMs = toUtcMs(session.selesai_at);
  const durasiRencanaDetik = Math.max(0, Number(session.durasi_rencana_detik) || 0);
  const storedPauseSeconds = Math.max(0, Number(session.total_jeda_detik) || 0);

  if (mulaiAtMs === null) {
    return {
      elapsed_detik: 0,
      sisa_detik: durasiRencanaDetik,
      effective_jeda_detik: storedPauseSeconds,
      is_expired: false,
      expected_end_at: null,
    };
  }

  let effectiveEndRefMs = nowUtcMs;
  let activePauseSeconds = 0;

  if (session.status === 'dijeda' && jedaSejakMs !== null) {
    activePauseSeconds = Math.max(0, Math.floor((nowUtcMs - jedaSejakMs) / 1000));
    effectiveEndRefMs = jedaSejakMs;
  } else if ((session.status === 'selesai' || session.status === 'dibatalkan') && selesaiAtMs !== null) {
    effectiveEndRefMs = selesaiAtMs;
  }

  const rawElapsedSeconds = Math.max(0, Math.floor((effectiveEndRefMs - mulaiAtMs) / 1000));
  const elapsedSeconds = Math.max(0, rawElapsedSeconds - storedPauseSeconds);
  const cappedElapsedSeconds = Math.min(durasiRencanaDetik, elapsedSeconds);
  const remainingSeconds =
    session.status === 'selesai' || session.status === 'dibatalkan'
      ? 0
      : Math.max(0, durasiRencanaDetik - elapsedSeconds);

  const expectedEndMs =
    session.status === 'berjalan'
      ? mulaiAtMs + (durasiRencanaDetik + storedPauseSeconds) * 1000
      : null;

  return {
    elapsed_detik: cappedElapsedSeconds,
    sisa_detik: remainingSeconds,
    effective_jeda_detik: storedPauseSeconds + activePauseSeconds,
    is_expired: session.status === 'berjalan' && remainingSeconds <= 0,
    expected_end_ms: expectedEndMs,
    expected_end_at: expectedEndMs ? new Date(expectedEndMs).toISOString() : null,
  };
};

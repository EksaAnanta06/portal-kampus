// FILE: client/src/utils/focusTimerMath.js

export const formatTimerClock = (totalSeconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Menghitung sisa detik berdasarkan timestamp UTC server (bebas drift setInterval).
 */
export const computeClientRemainingSeconds = (session, serverOffsetMs = 0, clientNowMs = Date.now()) => {
  if (!session || !session.mulai_at) return 0;
  if (session.status === 'selesai' || session.status === 'dibatalkan') return 0;

  const durasi = Math.max(0, Number(session.durasi_rencana_detik) || 0);
  const mulaiMs = Date.parse(session.mulai_at);
  const storedPause = Math.max(0, Number(session.total_jeda_detik) || 0);
  if (!Number.isFinite(mulaiMs)) return durasi;

  const nowServerMs = clientNowMs + serverOffsetMs;
  const refEndMs =
    session.status === 'dijeda' && session.jeda_sejak ? Date.parse(session.jeda_sejak) : nowServerMs;

  const elapsed = Math.max(0, Math.floor((refEndMs - mulaiMs) / 1000) - storedPause);
  return Math.max(0, durasi - elapsed);
};

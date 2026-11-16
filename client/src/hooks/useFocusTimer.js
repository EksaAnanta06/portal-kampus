// FILE: client/src/hooks/useFocusTimer.js
import { useEffect, useMemo } from 'react';
import useAuthStore from '../store/useAuthStore';
import useFocusTimerStore, { formatTimerClock } from '../store/useFocusTimerStore';
import { ASSIGNMENT_HUB_ROLES } from '../utils/constants';

/**
 * Hook global tunggal untuk membaca dan mengendalikan Timer Fokus lintas halaman.
 */
export function useFocusTimer() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasAccess = Boolean(accessToken && user && ASSIGNMENT_HUB_ROLES.includes(user.role));

  const activeSession = useFocusTimerStore((s) => s.activeSession);
  const completionPromptSession = useFocusTimerStore((s) => s.completionPromptSession);
  const settings = useFocusTimerStore((s) => s.settings);
  const remainingSeconds = useFocusTimerStore((s) => s.remainingSeconds);
  const loading = useFocusTimerStore((s) => s.loading);
  const actionLoading = useFocusTimerStore((s) => s.actionLoading);
  const initialized = useFocusTimerStore((s) => s.initialized);
  const cycleCount = useFocusTimerStore((s) => s.cycleCount);

  const syncWithServer = useFocusTimerStore((s) => s.syncWithServer);
  const clearTimerState = useFocusTimerStore((s) => s.clearTimerState);
  const startSession = useFocusTimerStore((s) => s.startSession);
  const pauseSession = useFocusTimerStore((s) => s.pauseSession);
  const resumeSession = useFocusTimerStore((s) => s.resumeSession);
  const skipOrFinishEarly = useFocusTimerStore((s) => s.skipOrFinishEarly);
  const cancelSession = useFocusTimerStore((s) => s.cancelSession);
  const submitCompletionPrompt = useFocusTimerStore((s) => s.submitCompletionPrompt);
  const dismissCompletionPrompt = useFocusTimerStore((s) => s.dismissCompletionPrompt);
  const updateLocalSettings = useFocusTimerStore((s) => s.updateLocalSettings);

  useEffect(() => {
    if (hasAccess && !initialized) {
      syncWithServer({ silent: false });
    } else if (!hasAccess && initialized) {
      clearTimerState();
    }
  }, [hasAccess, initialized, syncWithServer, clearTimerState]);

  const progressPercent = useMemo(() => {
    if (!activeSession?.durasi_rencana_detik) return 0;
    const total = activeSession.durasi_rencana_detik;
    const elapsed = Math.max(0, total - remainingSeconds);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [activeSession, remainingSeconds]);

  // Pengumuman screen reader berkala (tiap 5 menit dan detik penting akhir) agar tidak berisik tiap detik
  const ariaAnnouncement = useMemo(() => {
    if (!activeSession) return '';
    if (activeSession.status === 'dijeda') {
      return `Timer dijeda pada ${Math.ceil(remainingSeconds / 60)} menit tersisa.`;
    }
    if (remainingSeconds === 60) return 'Tersisa 1 menit.';
    if (remainingSeconds === 30) return 'Tersisa 30 detik.';
    if (remainingSeconds === 0) return 'Waktu sesi fokus telah habis.';
    if (remainingSeconds > 60 && remainingSeconds % 300 === 0) {
      return `Tersisa ${remainingSeconds / 60} menit.`;
    }
    return '';
  }, [activeSession, remainingSeconds]);

  return {
    hasAccess,
    activeSession,
    completionPromptSession,
    settings,
    remainingSeconds,
    formattedTime: formatTimerClock(remainingSeconds),
    progressPercent,
    ariaAnnouncement,
    loading,
    actionLoading,
    initialized,
    cycleCount,
    syncWithServer,
    startSession,
    pauseSession,
    resumeSession,
    skipOrFinishEarly,
    cancelSession,
    submitCompletionPrompt,
    dismissCompletionPrompt,
    updateLocalSettings,
  };
}

export default useFocusTimer;

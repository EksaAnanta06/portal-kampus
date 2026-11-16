// FILE: client/src/store/useFocusTimerStore.js
import { create } from 'zustand';
import { focusApi } from '../api/focus.api';
import { getErrorMessage } from '../api/axiosInstance';
import { toast } from './useThemeStore';
import { TIMER_MODE_LABELS } from '../utils/constants';
import { computeClientRemainingSeconds, formatTimerClock } from '../utils/focusTimerMath';

export { computeClientRemainingSeconds, formatTimerClock };

const DEFAULT_DOC_TITLE = 'Portal Kampus UNAS PASIM Bandung';
const SYNC_STORAGE_KEY = 'pasim-focus-timer-sync';

// Audio chime ringan via Web Audio API tanpa aset audio eksternal
const playCompletionChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 880]; // D5 -> A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.18);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + idx * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.18 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.18);
      osc.stop(ctx.currentTime + idx * 0.18 + 0.48);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // Abaikan jika browser memblokir autoplay audio
  }
};

const notifySessionFinished = (session, settings) => {
  if (settings?.suara_aktif !== false) {
    playCompletionChime();
  }
  if (settings?.getar_aktif !== false && typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([220, 100, 220]);
    } catch {
      // Abaikan jika tidak didukung
    }
  }
  if (typeof window !== 'undefined' && 'Notification' in window && window.Notification?.permission === 'granted') {
    try {
      const label = TIMER_MODE_LABELS[session?.tipe] || 'Fokus';
      const title = `${label} Selesai!`;
      const body = session?.judul_tugas
        ? `Sesi ${label} untuk "${session.judul_tugas}" telah selesai.`
        : `Sesi ${label} telah berakhir. Saatnya mengambil jeda atau mencatat progres.`;
      new window.Notification(title, { body, icon: '/logo-pasim.png' });
    } catch {
      // Fallback aman bila constructor Notification dibatasi pada Android WebView
    }
  }
};

const broadcastSyncSignal = () => {
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, String(Date.now()));
  } catch {
    // Abaikan di mode private/sandbox
  }
};

let globalTickInterval = null;
let wakeLockSentinel = null;
let listenersBound = false;
let finishingSessionId = null;
let syncPromise = null;

const releaseWakeLock = async () => {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Abaikan
    } finally {
      wakeLockSentinel = null;
    }
  }
};

const ensureWakeLock = async () => {
  if (
    typeof document === 'undefined' ||
    document.visibilityState !== 'visible' ||
    typeof navigator === 'undefined' ||
    !('wakeLock' in navigator) ||
    wakeLockSentinel
  ) {
    return;
  }
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener?.('release', () => {
      wakeLockSentinel = null;
    });
  } catch {
    wakeLockSentinel = null;
  }
};

const updateDocumentTitle = (session, remainingSeconds) => {
  if (typeof document === 'undefined') return;
  if (!session || (session.status !== 'berjalan' && session.status !== 'dijeda')) {
    if (document.title !== DEFAULT_DOC_TITLE) {
      document.title = DEFAULT_DOC_TITLE;
    }
    return;
  }
  const modeLabel = TIMER_MODE_LABELS[session.tipe] || 'Fokus';
  const pausePrefix = session.status === 'dijeda' ? '[Jeda] ' : '';
  const taskSuffix = session.judul_tugas ? `: ${session.judul_tugas}` : '';
  document.title = `${pausePrefix}(${formatTimerClock(remainingSeconds)}) ${modeLabel}${taskSuffix}`;
};

const useFocusTimerStore = create((set, get) => ({
  activeSession: null,
  completionPromptSession: null,
  settings: null,
  serverOffsetMs: 0,
  remainingSeconds: 0,
  loading: false,
  actionLoading: false,
  initialized: false,
  cycleCount: 1,
  lastContextTaskId: null,
  lastContextScheduleId: null,

  _applyServerPayload: ({ session, autoCompletedSession, settings, serverNow }, options = {}) => {
    const serverMs = serverNow ? Date.parse(serverNow) : null;
    const offset = Number.isFinite(serverMs) ? serverMs - Date.now() : get().serverOffsetMs;
    const nextSettings = settings || get().settings;
    const rem = computeClientRemainingSeconds(session, offset);

    set((state) => ({
      activeSession: session || null,
      settings: nextSettings,
      serverOffsetMs: offset,
      remainingSeconds: rem,
      initialized: true,
      cycleCount: session?.siklus_ke || state.cycleCount,
      lastContextTaskId: session?.tugas_id ?? state.lastContextTaskId,
      lastContextScheduleId: session?.sesi_jadwal_id ?? state.lastContextScheduleId,
      ...(autoCompletedSession ? { completionPromptSession: autoCompletedSession } : {}),
    }));

    updateDocumentTitle(session, rem);
    if (session?.status === 'berjalan') {
      ensureWakeLock();
      get()._ensureTicker();
    } else {
      releaseWakeLock();
      if (!session) get()._stopTicker();
    }

    if (autoCompletedSession && !options.silentFinish) {
      notifySessionFinished(autoCompletedSession, nextSettings);
    }
  },

  _ensureTicker: () => {
    if (!listenersBound && typeof window !== 'undefined') {
      listenersBound = true;
      const handleVisibilityOrFocus = () => {
        const state = get();
        if (state.activeSession?.status === 'berjalan') {
          if (document.visibilityState === 'visible') {
            ensureWakeLock();
          }
          state.tick();
        }
      };
      const handleStorage = (e) => {
        if (e.key === SYNC_STORAGE_KEY && get().initialized) {
          get().syncWithServer({ silent: true });
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
      window.addEventListener('focus', handleVisibilityOrFocus);
      window.addEventListener('storage', handleStorage);
    }

    if (globalTickInterval) return;
    globalTickInterval = setInterval(() => {
      get().tick();
    }, 250);
  },

  _stopTicker: () => {
    if (globalTickInterval) {
      clearInterval(globalTickInterval);
      globalTickInterval = null;
    }
  },

  tick: () => {
    const { activeSession, serverOffsetMs, remainingSeconds } = get();
    if (!activeSession || activeSession.status !== 'berjalan') {
      updateDocumentTitle(activeSession, remainingSeconds);
      if (!activeSession) get()._stopTicker();
      return;
    }

    const nextRem = computeClientRemainingSeconds(activeSession, serverOffsetMs);
    if (nextRem !== remainingSeconds) {
      set({ remainingSeconds: nextRem });
      updateDocumentTitle(activeSession, nextRem);
    }

    if (nextRem <= 0 && finishingSessionId !== activeSession.id) {
      finishingSessionId = activeSession.id;
      get()._handleNaturalFinish(activeSession);
    }
  },

  _handleNaturalFinish: async (session) => {
    const settings = get().settings;
    try {
      const res = await focusApi.completeTimer(session.id, {
        tandai_jadwal_selesai: session.tipe === 'fokus',
      });
      const completed = res.data?.session || { ...session, status: 'selesai' };
      notifySessionFinished(completed, settings);
      broadcastSyncSignal();

      set((state) => ({
        activeSession: null,
        remainingSeconds: 0,
        completionPromptSession: completed.tipe === 'fokus' ? completed : null,
        cycleCount:
          completed.tipe === 'fokus'
            ? completed.siklus_ke || state.cycleCount
            : state.cycleCount,
      }));
      updateDocumentTitle(null, 0);
      releaseWakeLock();
      get()._stopTicker();

      // Jika sesi istirahat selesai & auto_start aktif, langsung mulai sesi fokus berikutnya
      if (completed.tipe !== 'fokus' && settings?.auto_start) {
        const nextCycle = (completed.siklus_ke || 1) + 1;
        await get().startSession({
          tipe: 'fokus',
          tugas_id: completed.tugas_id || get().lastContextTaskId,
          siklus_ke: nextCycle,
        });
      } else if (completed.tipe !== 'fokus') {
        toast.info('Waktu istirahat selesai! Siap untuk sesi fokus berikutnya.');
      }
    } catch {
      // Fallback: sinkronisasi ulang dari server bila sudah di-complete tab lain
      await get().syncWithServer({ silent: true });
    } finally {
      finishingSessionId = null;
    }
  },

  syncWithServer: async ({ silent = false } = {}) => {
    if (syncPromise) return syncPromise;
    if (!silent) set({ loading: true });
    syncPromise = (async () => {
      try {
        const res = await focusApi.getActiveTimer();
        get()._applyServerPayload(
          {
            session: res.data?.activeSession || null,
            autoCompletedSession: res.data?.autoCompletedSession || null,
            settings: res.data?.settings || null,
            serverNow: res.data?.server_now,
          },
          { silentFinish: false }
        );
        return res.data;
      } catch {
        set({ initialized: true });
        return null;
      } finally {
        syncPromise = null;
        if (!silent) set({ loading: false });
      }
    })();
    return syncPromise;
  },

  startSession: async (payload = {}) => {
    set({ actionLoading: true });
    try {
      const res = await focusApi.startTimer(payload);
      get()._applyServerPayload({
        session: res.data?.session,
        serverNow: res.data?.server_now,
      });
      broadcastSyncSignal();
      return res.data?.session;
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.info('Sesi timer sedang berjalan di tab/perangkat lain — menyinkronkan...');
        await get().syncWithServer({ silent: true });
        return null;
      }
      toast.error(getErrorMessage(err, 'Gagal memulai sesi timer.'));
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  pauseSession: async () => {
    const active = get().activeSession;
    if (!active) return;
    set({ actionLoading: true });
    try {
      const res = await focusApi.pauseTimer(active.id);
      get()._applyServerPayload({
        session: res.data?.session,
        serverNow: res.data?.server_now,
      });
      broadcastSyncSignal();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menjeda timer.'));
      await get().syncWithServer({ silent: true });
    } finally {
      set({ actionLoading: false });
    }
  },

  resumeSession: async () => {
    const active = get().activeSession;
    if (!active) return;
    set({ actionLoading: true });
    try {
      const res = await focusApi.resumeTimer(active.id);
      get()._applyServerPayload({
        session: res.data?.session,
        serverNow: res.data?.server_now,
      });
      broadcastSyncSignal();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal melanjutkan timer.'));
      await get().syncWithServer({ silent: true });
    } finally {
      set({ actionLoading: false });
    }
  },

  skipOrFinishEarly: async () => {
    const active = get().activeSession;
    if (!active) return null;
    set({ actionLoading: true });
    try {
      const res = await focusApi.completeTimer(active.id, {
        tandai_jadwal_selesai: active.tipe === 'fokus',
      });
      const completed = res.data?.session;
      set({
        activeSession: null,
        remainingSeconds: 0,
        completionPromptSession: completed?.tipe === 'fokus' ? completed : null,
      });
      updateDocumentTitle(null, 0);
      releaseWakeLock();
      get()._stopTicker();
      broadcastSyncSignal();
      return completed;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyelesaikan sesi timer.'));
      return null;
    } finally {
      set({ actionLoading: false });
    }
  },

  cancelSession: async () => {
    const active = get().activeSession;
    if (!active) return;
    set({ actionLoading: true });
    try {
      await focusApi.cancelTimer(active.id);
      set({ activeSession: null, remainingSeconds: 0 });
      updateDocumentTitle(null, 0);
      releaseWakeLock();
      get()._stopTicker();
      broadcastSyncSignal();
      toast.info('Sesi timer dihentikan.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menghentikan timer.'));
    } finally {
      set({ actionLoading: false });
    }
  },

  submitCompletionPrompt: async ({ catatan, tandai_tugas_selesai }) => {
    const promptSession = get().completionPromptSession;
    if (!promptSession) return;
    set({ actionLoading: true });
    try {
      await focusApi.completeTimer(promptSession.id, {
        catatan: catatan || null,
        tandai_tugas_selesai: Boolean(tandai_tugas_selesai),
      });
      const settings = get().settings;
      const siklusThreshold = Math.max(2, Number(settings?.siklus_sebelum_panjang) || 4);
      const currentCycle = Number(promptSession.siklus_ke) || get().cycleCount || 1;
      const nextBreakType =
        currentCycle % siklusThreshold === 0 ? 'istirahat_panjang' : 'istirahat_pendek';

      set({
        completionPromptSession: null,
        cycleCount: currentCycle,
      });

      toast.success(
        tandai_tugas_selesai
          ? 'Progres disimpan dan tugas ditandai selesai!'
          : 'Catatan progres sesi fokus tersimpan.'
      );

      if (settings?.auto_start) {
        await get().startSession({
          tipe: nextBreakType,
          tugas_id: tandai_tugas_selesai ? null : promptSession.tugas_id,
          siklus_ke: currentCycle,
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan progres sesi.'));
    } finally {
      set({ actionLoading: false });
    }
  },

  dismissCompletionPrompt: async () => {
    const promptSession = get().completionPromptSession;
    const settings = get().settings;
    set({ completionPromptSession: null });
    if (promptSession && settings?.auto_start) {
      const siklusThreshold = Math.max(2, Number(settings.siklus_sebelum_panjang) || 4);
      const currentCycle = Number(promptSession.siklus_ke) || 1;
      const nextBreakType =
        currentCycle % siklusThreshold === 0 ? 'istirahat_panjang' : 'istirahat_pendek';
      await get()
        .startSession({
          tipe: nextBreakType,
          tugas_id: promptSession.tugas_id,
          siklus_ke: currentCycle,
        })
        .catch(() => {});
    }
  },

  updateLocalSettings: (nextSettings) => {
    set({ settings: nextSettings });
  },

  clearTimerState: () => {
    finishingSessionId = null;
    releaseWakeLock();
    if (globalTickInterval) {
      clearInterval(globalTickInterval);
      globalTickInterval = null;
    }
    updateDocumentTitle(null, 0);
    set({
      activeSession: null,
      completionPromptSession: null,
      remainingSeconds: 0,
      initialized: false,
      settings: null,
    });
  },
}));

export default useFocusTimerStore;

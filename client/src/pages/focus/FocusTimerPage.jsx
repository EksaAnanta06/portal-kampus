// FILE: client/src/pages/focus/FocusTimerPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { focusApi } from '../../api/focus.api';
import useFocusTimer from '../../hooks/useFocusTimer';
import useFocusTimerStore, { formatTimerClock } from '../../store/useFocusTimerStore';
import { toast } from '../../store/useThemeStore';
import { ensureNativeBackgroundPush } from '../../services/nativePushSync';
import {
  isNativePlatform,
  getNativeNotificationStatus,
  enableNativeNotifications,
  openExactAlarmSettings,
} from '../../platform';
import { TIMER_MODE_LABELS } from '../../utils/constants';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FocusSettingsModal from '../../components/focus/FocusSettingsModal';

const MODES = [
  { value: 'fokus', label: 'Fokus' },
  { value: 'istirahat_pendek', label: 'Istirahat Pendek' },
  { value: 'istirahat_panjang', label: 'Istirahat Panjang' },
];

export default function FocusTimerPage() {
  const [searchParams] = useSearchParams();
  const queryTaskId = searchParams.get('taskId') || '';
  const queryScheduleId = searchParams.get('scheduleId') || '';

  const {
    activeSession,
    settings,
    remainingSeconds,
    formattedTime,
    progressPercent,
    ariaAnnouncement,
    loading,
    actionLoading,
    cycleCount,
    startSession,
    pauseSession,
    resumeSession,
    skipOrFinishEarly,
    cancelSession,
    updateLocalSettings,
  } = useFocusTimer();

  const [selectedMode, setSelectedMode] = useState('fokus');
  const [selectedTaskId, setSelectedTaskId] = useState(queryTaskId);
  const [selectedScheduleId, setSelectedScheduleId] = useState(queryScheduleId);
  const [tasks, setTasks] = useState([]);
  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const isNative = isNativePlatform();
  const [nativeNotif, setNativeNotif] = useState({
    checked: !isNative,
    enabled: true,
    permission: 'granted',
    exactAlarm: 'granted',
    loading: false,
  });

  const refreshNativeNotifStatus = useCallback(async () => {
    if (!isNative) return;
    const status = await getNativeNotificationStatus();
    setNativeNotif({
      checked: true,
      enabled: Boolean(status.enabled),
      permission: status.permission || 'prompt',
      exactAlarm: status.exactAlarm || 'granted',
      loading: false,
    });
  }, [isNative]);

  useEffect(() => {
    if (!isNative || settingsOpen) return;
    refreshNativeNotifStatus();
  }, [isNative, settingsOpen, refreshNativeNotifStatus]);

  useEffect(() => {
    if (!isNative || typeof document === 'undefined') return undefined;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNativeNotifStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isNative, refreshNativeNotifStatus]);

  useEffect(() => {
    let active = true;
    Promise.all([focusApi.getTasks(), focusApi.getSchedules()])
      .then(([tasksRes, schedRes]) => {
        if (!active) return;
        const activeTasks = (tasksRes.data || []).filter((t) => t.status !== 'selesai');
        const activeScheds = (schedRes.data?.schedules || []).filter(
          (s) => s.status === 'terjadwal'
        );
        setTasks(activeTasks);
        setScheduledSessions(activeScheds);
        if (queryScheduleId) {
          const matchedSched = activeScheds.find(
            (s) => String(s.id) === String(queryScheduleId)
          );
          if (matchedSched?.tugas_id) {
            setSelectedTaskId(String(matchedSched.tugas_id));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setTasksLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [queryScheduleId]);

  useEffect(() => {
    if (queryTaskId) setSelectedTaskId(queryTaskId);
  }, [queryTaskId]);

  useEffect(() => {
    if (queryScheduleId) setSelectedScheduleId(queryScheduleId);
  }, [queryScheduleId]);

  const currentMode = activeSession?.tipe || selectedMode;
  const isBreak = currentMode !== 'fokus';
  const totalCycleGoal = Number(settings?.siklus_sebelum_panjang) || 4;
  const displayedCycle = activeSession?.siklus_ke || cycleCount || 1;

  const idleDurationSeconds = useMemo(() => {
    const minsByType = {
      fokus: Number(settings?.durasi_fokus) || 25,
      istirahat_pendek: Number(settings?.durasi_istirahat_pendek) || 5,
      istirahat_panjang: Number(settings?.durasi_istirahat_panjang) || 15,
    };
    return (minsByType[currentMode] || 25) * 60;
  }, [settings, currentMode]);

  const displayedClock = activeSession ? formattedTime : formatTimerClock(idleDurationSeconds);
  const ringPercent = activeSession ? progressPercent : 0;

  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (ringPercent / 100) * circumference;

  const selectedTaskLabel = useMemo(() => {
    if (activeSession?.judul_tugas) return activeSession.judul_tugas;
    if (selectedScheduleId) {
      const sched = scheduledSessions.find((s) => String(s.id) === String(selectedScheduleId));
      if (sched?.judul_tugas) return sched.judul_tugas;
    }
    if (!selectedTaskId) return 'Fokus Bebas (Tanpa Tugas)';
    const found = tasks.find((t) => String(t.id) === String(selectedTaskId));
    return found ? found.judul : 'Tugas Dipilih';
  }, [activeSession, selectedScheduleId, scheduledSessions, selectedTaskId, tasks]);

  const handleSelectSchedule = (schedId) => {
    setSelectedScheduleId(schedId);
    if (!schedId) return;
    const matched = scheduledSessions.find((s) => String(s.id) === String(schedId));
    if (matched?.tugas_id) {
      setSelectedTaskId(String(matched.tugas_id));
    }
  };

  const handleSelectTask = (taskId) => {
    setSelectedTaskId(taskId);
    if (selectedScheduleId) {
      const matched = scheduledSessions.find((s) => String(s.id) === String(selectedScheduleId));
      if (!matched || String(matched.tugas_id) !== String(taskId)) {
        setSelectedScheduleId('');
      }
    }
  };

  const handleEnableNativeNotif = async () => {
    setNativeNotif((prev) => ({ ...prev, loading: true }));
    try {
      await enableNativeNotifications({ sendConfirmation: true });
      await refreshNativeNotifStatus();
      useFocusTimerStore.getState().syncNativeNotifications();
      ensureNativeBackgroundPush({ forceNew: true }).catch(() => {});
      toast.success('Notifikasi Pomodoro Android aktif!');
    } catch (err) {
      setNativeNotif((prev) => ({ ...prev, loading: false }));
      toast.error(err?.message || 'Gagal mengaktifkan notifikasi Android.');
    }
  };

  const handleOpenExactAlarm = async () => {
    setNativeNotif((prev) => ({ ...prev, loading: true }));
    try {
      await openExactAlarmSettings();
    } finally {
      await refreshNativeNotifStatus();
    }
  };

  const handlePrimaryAction = async () => {
    if (!activeSession) {
      if (isNative && !nativeNotif.enabled && nativeNotif.permission === 'prompt') {
        try {
          await enableNativeNotifications({ sendConfirmation: false });
          ensureNativeBackgroundPush({ forceNew: true }).catch(() => {});
          await refreshNativeNotifStatus();
        } catch {
          await refreshNativeNotifStatus();
        }
      }
      await startSession({
        tipe: selectedMode,
        tugas_id: selectedTaskId ? Number(selectedTaskId) : null,
        sesi_jadwal_id: selectedScheduleId ? Number(selectedScheduleId) : null,
        siklus_ke: displayedCycle,
      });
      return;
    }
    if (activeSession.status === 'berjalan') {
      await pauseSession();
    } else if (activeSession.status === 'dijeda') {
      await resumeSession();
    }
  };

  if (loading && !tasksLoaded) {
    return (
      <div className="mx-auto max-w-xl py-10 space-y-6 text-center">
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="circular" width={240} height={240} className="mx-auto" />
        <Skeleton variant="rounded" height={48} width={200} className="mx-auto" />
      </div>
    );
  }

  const ringStrokeClass = isBreak
    ? 'stroke-teal-500 dark:stroke-teal-400'
    : 'stroke-emerald-600 dark:stroke-emerald-400';

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-xl flex-col justify-between py-2 sm:py-4">
      {/* Screen-reader live announcer berkala (bukan setiap detik) */}
      <span className="sr-only" aria-live="polite">
        {ariaAnnouncement}
      </span>

      {/* Top Bar Minimal */}
      <div className="flex items-center justify-between gap-2">
        <Button
          component={Link}
          to="/rencana"
          size="small"
          color="inherit"
          startIcon={<CalendarMonthRoundedIcon fontSize="small" />}
          className="!min-h-[44px] !text-slate-600 dark:!text-slate-300"
        >
          Rencana & Tugas
        </Button>

        <Tooltip title="Pengaturan Timer & Pengingat">
          <IconButton
            onClick={() => setSettingsOpen(true)}
            aria-label="Pengaturan Timer Fokus"
            className="!min-h-[44px] !min-w-[44px]"
          >
            <SettingsRoundedIcon />
          </IconButton>
        </Tooltip>
      </div>

      {isNative && nativeNotif.checked && !nativeNotif.enabled && (
        <Alert
          severity="warning"
          className="mt-3 !rounded-2xl !items-center"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={nativeNotif.loading}
              onClick={handleEnableNativeNotif}
              className="!font-bold shrink-0"
            >
              {nativeNotif.loading ? 'Proses...' : 'Aktifkan'}
            </Button>
          }
        >
          Notifikasi Android belum aktif. Aktifkan agar alarm Pomodoro tampil di panel HP.
        </Alert>
      )}

      {isNative && nativeNotif.checked && nativeNotif.enabled && nativeNotif.exactAlarm === 'denied' && (
        <Alert
          severity="info"
          className="mt-3 !rounded-2xl !items-center"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={nativeNotif.loading}
              onClick={handleOpenExactAlarm}
              className="!font-bold shrink-0"
            >
              Izinkan Alarm
            </Button>
          }
        >
          Aktifkan izin &ldquo;Alarm & pengingat&rdquo; agar notifikasi selesai tepat waktu di background.
        </Alert>
      )}

      {/* Pusat Timer Tenang */}
      <div className="card-surface my-4 flex flex-col items-center justify-center px-5 py-8 sm:px-8 sm:py-10 text-center">
        {/* Pilihan Mode */}
        <div
          role="tablist"
          aria-label="Mode Timer Fokus"
          className="inline-flex flex-wrap justify-center gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-navy"
        >
          {MODES.map((m) => {
            const active = currentMode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={Boolean(activeSession)}
                onClick={() => setSelectedMode(m.value)}
                className={`min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Lingkaran Progres & Angka Besar */}
        <div className="relative my-6 sm:my-7 flex h-52 w-52 sm:h-64 sm:w-64 items-center justify-center">
          <svg
            viewBox="0 0 256 256"
            className="h-full w-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="128"
              cy="128"
              r={radius}
              fill="none"
              strokeWidth="10"
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            <circle
              cx="128"
              cy="128"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={`${ringStrokeClass} transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {TIMER_MODE_LABELS[currentMode] || 'Fokus'}
              {activeSession?.status === 'dijeda' ? ' · Dijeda' : ''}
            </span>
            <div
              className="mt-1 text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              aria-label={`Sisa waktu ${displayedClock}`}
            >
              {displayedClock}
            </div>
            <span className="mt-2 rounded-full bg-emerald-50 px-3 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Siklus ke-{displayedCycle} / {totalCycleGoal}
            </span>
          </div>
        </div>

        {/* Tugas & Sesi Terjadwal yang Dikerjakan */}
        <div className="w-full max-w-sm space-y-2.5">
          {activeSession ? (
            <div className="rounded-xl bg-emerald-50/70 px-4 py-2.5 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 truncate">
              {selectedTaskLabel}
            </div>
          ) : (
            <>
              {scheduledSessions.length > 0 && (
                <TextField
                  select
                  label="Mulai dari Sesi Terjadwal (Opsional)"
                  value={selectedScheduleId}
                  onChange={(e) => handleSelectSchedule(e.target.value)}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">Pilih manual dari daftar tugas</MenuItem>
                  {scheduledSessions.map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.judul_tugas} ({s.durasi_menit} mnt)
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                select
                label="Tugas yang Dikerjakan"
                value={selectedTaskId}
                onChange={(e) => handleSelectTask(e.target.value)}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="">Tanpa Tugas (Fokus Bebas)</MenuItem>
                {tasks.map((t) => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    {t.kategori ? `[${t.kategori}] ` : ''}
                    {t.judul}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
        </div>

        {/* Kontrol Utama & Sekunder */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
          <Button
            variant="contained"
            color="success"
            size="large"
            disabled={actionLoading}
            onClick={handlePrimaryAction}
            startIcon={
              activeSession?.status === 'berjalan' ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />
            }
            className="!min-h-[48px] w-full sm:w-auto sm:!min-w-[168px] !rounded-2xl !text-base"
          >
            {!activeSession
              ? 'Mulai'
              : activeSession.status === 'berjalan'
              ? 'Jeda'
              : 'Lanjutkan'}
          </Button>

          {activeSession && (
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                color="inherit"
                disabled={actionLoading}
                onClick={skipOrFinishEarly}
                startIcon={<SkipNextRoundedIcon />}
                className="!min-h-[44px]"
              >
                Lewati
              </Button>
              <Button
                variant="text"
                color="error"
                disabled={actionLoading}
                onClick={() => setConfirmCancelOpen(true)}
                startIcon={<StopRoundedIcon />}
                className="!min-h-[44px]"
              >
                Hentikan
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="m-0 text-center text-xs text-slate-400">
        Timer disinkronkan dengan server: tetap akurat meski pindah halaman atau layar mati.
      </p>

      <ConfirmDialog
        open={confirmCancelOpen}
        title="Hentikan Sesi Timer?"
        message="Sesi yang dihentikan sebelum selesai tidak akan dihitung sebagai sesi selesai di statistik."
        confirmText="Ya, Hentikan"
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={async () => {
          setConfirmCancelOpen(false);
          await cancelSession();
        }}
      />

      <FocusSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSettings={settings}
        onSaved={(nextSettings) => updateLocalSettings(nextSettings)}
      />
    </div>
  );
}

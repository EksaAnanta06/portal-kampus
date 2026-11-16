// FILE: client/src/pages/focus/FocusTimerPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { formatTimerClock } from '../../store/useFocusTimerStore';
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
  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  useEffect(() => {
    let active = true;
    focusApi
      .getTasks()
      .then((res) => {
        if (!active) return;
        setTasks((res.data || []).filter((t) => t.status !== 'selesai'));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setTasksLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (queryTaskId) setSelectedTaskId(queryTaskId);
  }, [queryTaskId]);

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
    if (!selectedTaskId) return 'Fokus Bebas (Tanpa Tugas)';
    const found = tasks.find((t) => String(t.id) === String(selectedTaskId));
    return found ? found.judul : 'Tugas Dipilih';
  }, [activeSession, selectedTaskId, tasks]);

  const handlePrimaryAction = async () => {
    if (!activeSession) {
      await startSession({
        tipe: selectedMode,
        tugas_id: selectedTaskId ? Number(selectedTaskId) : null,
        sesi_jadwal_id: queryScheduleId && !selectedTaskId ? Number(queryScheduleId) : queryScheduleId ? Number(queryScheduleId) : null,
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

  const ringStrokeClass = isBreak ? 'stroke-emerald-600 dark:stroke-emerald-400' : 'stroke-pasim dark:stroke-pasim-300';

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
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-navy-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Lingkaran Progres & Angka Besar */}
        <div className="relative my-7 flex h-60 w-60 sm:h-64 sm:w-64 items-center justify-center">
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

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {TIMER_MODE_LABELS[currentMode] || 'Fokus'}
              {activeSession?.status === 'dijeda' ? ' · Dijeda' : ''}
            </span>
            <div
              className="mt-1 text-5xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              aria-label={`Sisa waktu ${displayedClock}`}
            >
              {displayedClock}
            </div>
            <span className="mt-2 rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Siklus ke-{displayedCycle} / {totalCycleGoal}
            </span>
          </div>
        </div>

        {/* Tugas yang Dikerjakan */}
        <div className="w-full max-w-sm space-y-2">
          {activeSession ? (
            <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:bg-navy dark:text-slate-200 truncate">
              {selectedTaskLabel}
            </div>
          ) : (
            <TextField
              select
              label="Tugas yang Dikerjakan"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
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
          )}
        </div>

        {/* Kontrol Utama & Sekunder */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
          <Button
            variant="contained"
            color={isBreak ? 'success' : 'primary'}
            size="large"
            disabled={actionLoading}
            onClick={handlePrimaryAction}
            startIcon={
              activeSession?.status === 'berjalan' ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />
            }
            className="!min-h-[48px] !min-w-[168px] !rounded-2xl !text-base"
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

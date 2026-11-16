// FILE: client/src/components/focus/MiniFocusTimerBar.jsx
import { Link, useLocation } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import useFocusTimer from '../../hooks/useFocusTimer';
import { TIMER_MODE_LABELS } from '../../utils/constants';

export default function MiniFocusTimerBar() {
  const { pathname } = useLocation();
  const {
    hasAccess,
    activeSession,
    formattedTime,
    progressPercent,
    actionLoading,
    pauseSession,
    resumeSession,
  } = useFocusTimer();

  // Jangan tampilkan mini bar jika tidak aktif atau sedang berada di halaman Fokus utama
  if (!hasAccess || !activeSession || pathname.startsWith('/fokus')) {
    return null;
  }

  const isPaused = activeSession.status === 'dijeda';
  const modeLabel = TIMER_MODE_LABELS[activeSession.tipe] || 'Fokus';

  return (
    <div
      role="region"
      aria-label="Mini Timer Fokus"
      className="fixed left-3 right-3 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-5 lg:w-[340px] z-30 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-navy-800/95"
    >
      <LinearProgress
        variant="determinate"
        value={progressPercent}
        color={activeSession.tipe === 'fokus' ? 'success' : 'info'}
        sx={{ height: 3 }}
      />
      <div className="flex items-center justify-between gap-2.5 px-3 py-2">
        <Link
          to="/fokus"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <TimerRoundedIcon fontSize="small" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formattedTime}
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {isPaused ? `${modeLabel} · Dijeda` : modeLabel}
              </span>
            </div>
            <p className="m-0 truncate text-xs text-slate-500 dark:text-slate-400">
              {activeSession.judul_tugas || 'Sesi fokus bebas'}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip title={isPaused ? 'Lanjutkan Timer' : 'Jeda Timer'}>
            <IconButton
              size="small"
              onClick={isPaused ? resumeSession : pauseSession}
              disabled={actionLoading}
              aria-label={isPaused ? 'Lanjutkan Timer' : 'Jeda Timer'}
              className="!min-h-[44px] !min-w-[44px] !text-emerald-600 dark:!text-emerald-300"
            >
              {isPaused ? <PlayArrowRoundedIcon /> : <PauseRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Buka Layar Fokus">
            <IconButton
              component={Link}
              to="/fokus"
              size="small"
              aria-label="Buka Layar Fokus"
              className="!min-h-[44px] !min-w-[44px] !text-slate-500 dark:!text-slate-300"
            >
              <OpenInFullRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

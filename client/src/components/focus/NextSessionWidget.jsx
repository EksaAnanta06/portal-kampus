// FILE: client/src/components/focus/NextSessionWidget.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { focusApi } from '../../api/focus.api';
import { formatDateTime } from '../../utils/formatDate';
import useAuthStore from '../../store/useAuthStore';
import { ASSIGNMENT_HUB_ROLES } from '../../utils/constants';
import useFocusTimer from '../../hooks/useFocusTimer';

export default function NextSessionWidget() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const canAccess = Boolean(accessToken && user && ASSIGNMENT_HUB_ROLES.includes(user.role));

  const { activeSession, formattedTime, startSession, actionLoading } = useFocusTimer();
  const [nextSchedule, setNextSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    let active = true;
    focusApi
      .getNextSessionWidget()
      .then((res) => {
        if (active) setNextSchedule(res.data?.nextSchedule || null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canAccess]);

  if (!canAccess) return null;

  if (loading) {
    return (
      <div className="card-surface p-4 flex items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <Skeleton width="35%" />
          <Skeleton width="65%" />
        </div>
        <Skeleton variant="rounded" width={110} height={40} />
      </div>
    );
  }

  const handleStartFromSchedule = async () => {
    if (!nextSchedule) {
      navigate('/fokus');
      return;
    }
    try {
      await startSession({
        tipe: 'fokus',
        tugas_id: nextSchedule.tugas_id,
        sesi_jadwal_id: nextSchedule.id,
      });
      navigate('/fokus');
    } catch {
      navigate('/fokus');
    }
  };

  return (
    <div className="card-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-l-4 border-l-pasim">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pasim-50 text-pasim dark:bg-pasim-900/30 dark:text-pasim-300">
          <TimerRoundedIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
              {activeSession ? 'Timer Fokus Aktif' : 'Sesi Berikutnya'}
            </span>
            {activeSession ? (
              <Chip size="small" color="primary" label={`Sisa ${formattedTime}`} className="!h-5 !text-[11px]" />
            ) : nextSchedule ? (
              <Chip
                size="small"
                variant="outlined"
                label={`${nextSchedule.durasi_menit} menit`}
                className="!h-5 !text-[11px]"
              />
            ) : null}
          </div>

          {activeSession ? (
            <>
              <h3 className="m-0 mt-1 text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {activeSession.judul_tugas || 'Sesi fokus sedang berjalan'}
              </h3>
              <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Ketuk tombol di samping untuk membuka layar Fokus penuh.
              </p>
            </>
          ) : nextSchedule ? (
            <>
              <h3 className="m-0 mt-1 text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {nextSchedule.judul_tugas}
              </h3>
              <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(nextSchedule.mulai_at)}
                {nextSchedule.matkul_nama ? ` · ${nextSchedule.matkul_nama}` : ''}
              </p>
            </>
          ) : (
            <>
              <h3 className="m-0 mt-1 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Belum ada sesi kerja terjadwal
              </h3>
              <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Jadwalkan waktu pengerjaan tugas Anda atau mulai sesi fokus cepat.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {activeSession ? (
          <Button
            component={Link}
            to="/fokus"
            variant="contained"
            startIcon={<TimerRoundedIcon />}
            className="!min-h-[44px] w-full sm:w-auto"
          >
            Buka Timer
          </Button>
        ) : nextSchedule ? (
          <Button
            variant="contained"
            startIcon={<PlayArrowRoundedIcon />}
            disabled={actionLoading}
            onClick={handleStartFromSchedule}
            className="!min-h-[44px] w-full sm:w-auto"
          >
            Mulai
          </Button>
        ) : (
          <Button
            component={Link}
            to="/rencana"
            variant="outlined"
            startIcon={<CalendarMonthRoundedIcon />}
            className="!min-h-[44px] w-full sm:w-auto"
          >
            Atur Rencana
          </Button>
        )}
      </div>
    </div>
  );
}

// FILE: client/src/pages/focus/StudyPlannerPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon from '@mui/icons-material/CalendarViewWeekRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { focusApi } from '../../api/focus.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import {
  SCHEDULE_STATUS_META,
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
} from '../../utils/constants';
import { formatDateTime, formatShortDate, formatTime } from '../../utils/formatDate';
import useFocusTimer from '../../hooks/useFocusTimer';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import TaskFormModal from '../../components/focus/TaskFormModal';
import ScheduleTaskSheet from '../../components/focus/ScheduleTaskSheet';
import RescheduleDialog from '../../components/focus/RescheduleDialog';
import FocusSettingsModal from '../../components/focus/FocusSettingsModal';
import FocusStatsTab from '../../components/focus/FocusStatsTab';

const PRIORITY_COLOR_MAP = TASK_PRIORITIES.reduce((acc, p) => {
  acc[p.value] = p.color;
  return acc;
}, {});

const getDateKeyInZone = (input, timeZone = 'Asia/Jakarta') => {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

const addDaysKey = (dateKey, delta) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
};

const formatDayHeading = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt);
};

export default function StudyPlannerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { startSession, settings: timerSettings, updateLocalSettings } = useFocusTimer();

  const initialTab = Number(searchParams.get('tab')) || 0;
  const [tab, setTab] = useState(initialTab);
  const [planView, setPlanView] = useState('list'); // 'list' | 'week'
  const [dayFilter, setDayFilter] = useState('minggu_ini'); // 'hari_ini' | 'besok' | 'minggu_ini' | 'semua'

  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [warnings, setWarnings] = useState(null);
  const [settings, setSettings] = useState(timerSettings);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  // Modals & Menus
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [schedulingTask, setSchedulingTask] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'task' | 'schedule', id, label }
  const [deleting, setDeleting] = useState(false);

  const [taskMenuAnchor, setTaskMenuAnchor] = useState(null);
  const [taskMenuTarget, setTaskMenuTarget] = useState(null);
  const [schedMenuAnchor, setSchedMenuAnchor] = useState(null);
  const [schedMenuTarget, setSchedMenuTarget] = useState(null);

  const timeZone = settings?.zona_waktu || 'Asia/Jakarta';

  const loadPlannerData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, schedRes] = await Promise.all([
        focusApi.getTasks(),
        focusApi.getSchedules(),
      ]);
      setTasks(tasksRes.data || []);
      setSchedules(schedRes.data?.schedules || []);
      setWarnings(schedRes.data?.warnings || null);
      if (schedRes.data?.settings) setSettings(schedRes.data.settings);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memuat data rencana dan tugas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await focusApi.getStats();
      setStats(res.data || null);
    } catch {
      // Abaikan diam-diam saat error ringan
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlannerData();
    const onRefresh = () => {
      loadPlannerData();
      if (tab === 2) loadStats();
    };
    window.addEventListener('pasim-focus-data-updated', onRefresh);
    return () => window.removeEventListener('pasim-focus-data-updated', onRefresh);
  }, [loadPlannerData, loadStats, tab]);

  useEffect(() => {
    if (tab === 2 && !stats) {
      loadStats();
    }
  }, [tab, stats, loadStats]);

  // Buka otomatis dialog jadwal ulang bila datang dari klik notifikasi "?reschedule=<id>"
  useEffect(() => {
    const reschedId = searchParams.get('reschedule');
    if (reschedId && schedules.length > 0) {
      const found = schedules.find((s) => String(s.id) === String(reschedId));
      if (found) setRescheduleTarget(found);
      searchParams.delete('reschedule');
      setSearchParams(searchParams, { replace: true });
    }
  }, [schedules, searchParams, setSearchParams]);

  const todayKey = useMemo(() => getDateKeyInZone(new Date(), timeZone), [timeZone]);
  const tomorrowKey = useMemo(() => addDaysKey(todayKey, 1), [todayKey]);
  const weekEndKey = useMemo(() => addDaysKey(todayKey, 6), [todayKey]);

  const weekDateKeys = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysKey(todayKey, i)),
    [todayKey]
  );

  const missedCount = useMemo(
    () => schedules.filter((s) => s.status === 'terlewat').length,
    [schedules]
  );

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const dk = getDateKeyInZone(s.mulai_at, timeZone);
      if (dayFilter === 'hari_ini') return dk === todayKey || s.status === 'terlewat';
      if (dayFilter === 'besok') return dk === tomorrowKey;
      if (dayFilter === 'minggu_ini') return (dk >= todayKey && dk <= weekEndKey) || s.status === 'terlewat';
      return true;
    });
  }, [schedules, dayFilter, todayKey, tomorrowKey, weekEndKey, timeZone]);

  const schedulesByDay = useMemo(() => {
    const map = new Map();
    for (const s of filteredSchedules) {
      const dk = getDateKeyInZone(s.mulai_at, timeZone);
      if (!map.has(dk)) map.set(dk, []);
      map.get(dk).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSchedules, timeZone]);

  const handleStartFocusFromTask = async (task, schedule = null) => {
    try {
      await startSession({
        tipe: 'fokus',
        tugas_id: task.id,
        sesi_jadwal_id: schedule?.id || null,
      });
      navigate('/fokus');
    } catch {
      navigate(`/fokus?taskId=${task.id}`);
    }
  };

  const refreshAfterMutation = useCallback(async () => {
    setStats(null);
    await loadPlannerData();
  }, [loadPlannerData]);

  const handleQuickScheduleStatus = async (schedId, status) => {
    setSchedMenuAnchor(null);
    try {
      await focusApi.updateScheduleStatus(schedId, status);
      toast.success('Status sesi diperbarui.');
      await refreshAfterMutation();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memperbarui status sesi.'));
    }
  };

  const handleQuickTaskStatus = async (taskId, status) => {
    setTaskMenuAnchor(null);
    try {
      await focusApi.updateTaskStatus(taskId, status);
      toast.success('Status tugas diperbarui.');
      await refreshAfterMutation();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memperbarui status tugas.'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.type === 'task') {
        await focusApi.deleteTask(confirmDelete.id);
        toast.success('Tugas dihapus.');
      } else {
        await focusApi.deleteSchedule(confirmDelete.id);
        toast.success('Sesi jadwal dihapus.');
      }
      setConfirmDelete(null);
      await refreshAfterMutation();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menghapus data.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden">
      {/* Hero Banner Hijau (serasi dengan Materi Perpustakaan) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-700 to-sky-700 p-5 text-white shadow-xl sm:p-7 md:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-50">
              <CalendarMonthRoundedIcon sx={{ fontSize: 14 }} />
              Perencana & Fokus Mandiri
            </span>
            <h1 className="m-0 text-xl font-black tracking-tight text-white sm:text-2xl md:text-3xl">
              Rencana Belajar & Tugas
            </h1>
            <p className="m-0 max-w-xl text-xs text-emerald-100 sm:text-sm">
              Pisahkan batas waktu <strong>Deadline</strong> dengan jadwal <strong>Kapan Dikerjakan</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
              className="!min-h-[44px] !rounded-xl !bg-white !px-4 !font-bold !text-emerald-700 hover:!bg-emerald-50 !shadow-sm"
            >
              Tambah Tugas
            </Button>
            <Tooltip title="Buka Timer Fokus">
              <Button
                variant="outlined"
                startIcon={<TimerRoundedIcon />}
                onClick={() => navigate('/fokus')}
                className="!min-h-[44px] !rounded-xl !border-white/30 !bg-white/15 !px-4 !font-bold !text-white hover:!bg-white/25"
              >
                Timer Fokus
              </Button>
            </Tooltip>
            <Tooltip title="Pengaturan Fokus & Pengingat">
              <IconButton
                onClick={() => setSettingsOpen(true)}
                aria-label="Pengaturan Fokus & Pengingat"
                className="!min-h-[44px] !min-w-[44px] !rounded-xl !border !border-white/30 !bg-white/15 !text-white hover:!bg-white/25"
              >
                <SettingsRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </section>

      {/* Peringatan Sesi Terlewat / Beban */}
      {missedCount > 0 && (
        <Alert
          severity="warning"
          className="!rounded-2xl"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setTab(0)}
              className="!min-h-[36px] !font-bold"
            >
              Lihat
            </Button>
          }
        >
          Ada <strong>{missedCount} sesi kerja</strong> yang terlewat. Anda dapat memilih "Jadwalkan Ulang" untuk mencari slot kosong berikutnya.
        </Alert>
      )}

      {warnings?.dailyLoadWarnings?.length > 0 && (
        <Alert severity="info" className="!rounded-2xl !text-xs sm:!text-sm">
          {warnings.dailyLoadWarnings[0].message}
        </Alert>
      )}

      {/* Tabs Utama */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs
          value={tab}
          onChange={(_e, val) => setTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          textColor="inherit"
          sx={{
            '& .MuiTab-root.Mui-selected': { color: '#059669', fontWeight: 800 },
            '.dark & .MuiTab-root.Mui-selected': { color: '#34d399' },
            '& .MuiTabs-indicator': { backgroundColor: '#059669' },
          }}
        >
          <Tab label={`Rencana Kerja (${schedules.filter((s) => s.status === 'terjadwal').length})`} />
          <Tab label={`Tugas Pribadi (${tasks.filter((t) => t.status !== 'selesai').length})`} />
          <Tab label="Statistik Fokus" />
        </Tabs>
      </div>

      {/* TAB 0: RENCANA KERJA (DAFTAR HARIAN + KALENDER MINGGUAN) */}
      {tab === 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'hari_ini', label: 'Hari Ini' },
                { key: 'besok', label: 'Besok' },
                { key: 'minggu_ini', label: 'Minggu Ini' },
                { key: 'semua', label: 'Semua' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setDayFilter(f.key)}
                  className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition ${
                    dayFilter === f.key
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-navy-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-navy-800">
              <Button
                size="small"
                variant={planView === 'list' ? 'contained' : 'text'}
                color={planView === 'list' ? 'success' : 'inherit'}
                startIcon={<FormatListBulletedRoundedIcon fontSize="small" />}
                onClick={() => setPlanView('list')}
                className="!min-h-[38px]"
              >
                Daftar
              </Button>
              <Button
                size="small"
                variant={planView === 'week' ? 'contained' : 'text'}
                color={planView === 'week' ? 'success' : 'inherit'}
                startIcon={<CalendarViewWeekRoundedIcon fontSize="small" />}
                onClick={() => setPlanView('week')}
                className="!min-h-[38px]"
              >
                Mingguan
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={88} />
              ))}
            </div>
          ) : planView === 'week' ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDateKeys.map((dk) => {
                const items = schedules.filter(
                  (s) => getDateKeyInZone(s.mulai_at, timeZone) === dk
                );
                const isToday = dk === todayKey;
                return (
                  <div
                    key={dk}
                    className={`card-surface p-3 space-y-2 ${
                      isToday ? 'ring-2 ring-emerald-500/60 dark:ring-emerald-400/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                        {formatDayHeading(dk)}
                      </span>
                      {isToday && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Hari Ini
                        </span>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <p className="m-0 py-3 text-[11px] text-slate-400">Kosong</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item) => {
                          const meta = SCHEDULE_STATUS_META[item.status] || SCHEDULE_STATUS_META.terjadwal;
                          return (
                            <div
                              key={item.id}
                              className="rounded-xl border border-slate-200 p-2 text-xs space-y-1 dark:border-slate-700"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {formatTime(item.mulai_at)}
                                </span>
                                <Chip size="small" color={meta.color} label={meta.label} className="!h-4 !text-[10px]" />
                              </div>
                              <div className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-2">
                                {item.judul_tugas}
                              </div>
                              <div className="text-[11px] text-slate-400">{item.durasi_menit} mnt</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : schedulesByDay.length === 0 ? (
            <EmptyState
              icon={<CalendarMonthRoundedIcon fontSize="large" />}
              title="Belum ada sesi terjadwal"
              description="Belum ada sesi terjadwal. Mulai dengan menjadwalkan satu tugas dari tab Tugas Pribadi."
              action={
                <Button variant="contained" color="success" onClick={() => setTab(1)} className="!min-h-[44px]">
                  Buka Tugas Pribadi
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {schedulesByDay.map(([dk, items]) => (
                <div key={dk} className="space-y-2.5">
                  <h3 className="m-0 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    {dk === todayKey ? `Hari Ini · ${formatDayHeading(dk)}` : dk === tomorrowKey ? `Besok · ${formatDayHeading(dk)}` : formatDayHeading(dk)}
                  </h3>
                  <div className="space-y-2.5">
                    {items.map((item) => {
                      const meta = SCHEDULE_STATUS_META[item.status] || SCHEDULE_STATUS_META.terjadwal;
                      return (
                        <div
                          key={item.id}
                          className="card-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-800 dark:bg-navy dark:text-slate-200">
                                <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
                                {formatTime(item.mulai_at)} WIB · {item.durasi_menit} mnt
                              </span>
                              <Chip size="small" color={meta.color} label={meta.label} className="!h-5 !text-[11px]" />
                              {item.kategori && (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  {item.kategori}
                                </span>
                              )}
                            </div>
                            <h4 className="m-0 text-sm sm:text-base font-bold text-slate-900 dark:text-white break-words">
                              {item.judul_tugas}
                            </h4>
                            {item.deadline_at && (
                              <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                                Deadline: {formatDateTime(item.deadline_at)}
                              </p>
                            )}
                          </div>

                          <div className="w-full sm:w-auto flex items-center gap-2 shrink-0">
                            {item.status === 'terjadwal' && (
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<PlayArrowRoundedIcon />}
                                onClick={() =>
                                  handleStartFocusFromTask({ id: item.tugas_id }, item)
                                }
                                className="!min-h-[44px] flex-1 sm:flex-none"
                              >
                                Mulai
                              </Button>
                            )}
                            {item.status === 'terlewat' && (
                              <Button
                                variant="contained"
                                color="warning"
                                size="small"
                                startIcon={<EventRepeatRoundedIcon />}
                                onClick={() => setRescheduleTarget(item)}
                                className="!min-h-[44px] flex-1 sm:flex-none"
                              >
                                Jadwalkan Ulang
                              </Button>
                            )}
                            <IconButton
                              aria-label="Aksi lainnya"
                              onClick={(e) => {
                                setSchedMenuAnchor(e.currentTarget);
                                setSchedMenuTarget(item);
                              }}
                              className="!min-h-[44px] !min-w-[44px]"
                            >
                              <MoreVertRoundedIcon />
                            </IconButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: TUGAS PRIBADI */}
      {tab === 1 && (
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={120} />)
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<CalendarMonthRoundedIcon fontSize="large" />}
              title="Belum ada tugas pribadi"
              description="Tambahkan tugas kuliah atau belajar pribadi, lalu jadwalkan kapan Anda akan mengerjakannya."
              action={
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => {
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                  className="!min-h-[44px]"
                >
                  Tambah Tugas Pertama
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tasks.map((t) => {
                const spentMenit = Math.round(Number(t.total_fokus_detik || 0) / 60);
                const estMenit = Number(t.estimasi_menit || 0);
                const progressPct = estMenit > 0 ? Math.min(100, Math.round((spentMenit / estMenit) * 100)) : 0;
                const isDone = t.status === 'selesai';

                return (
                  <div key={t.id} className="card-surface p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Chip
                            size="small"
                            color={PRIORITY_COLOR_MAP[t.prioritas] || 'default'}
                            label={t.prioritas}
                            className="!h-5 !text-[10px] capitalize"
                          />
                          <Chip
                            size="small"
                            color={isDone ? 'success' : 'default'}
                            variant={isDone ? 'filled' : 'outlined'}
                            label={TASK_STATUS_LABELS[t.status] || t.status}
                            className="!h-5 !text-[10px]"
                          />
                          {t.kategori && (
                            <span className="text-[11px] font-bold text-slate-400">
                              {t.kategori}
                            </span>
                          )}
                        </div>
                        <IconButton
                          size="small"
                          aria-label="Menu tugas"
                          onClick={(e) => {
                            setTaskMenuAnchor(e.currentTarget);
                            setTaskMenuTarget(t);
                          }}
                          className="!min-h-[40px] !min-w-[40px]"
                        >
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>

                      <h3
                        className={`m-0 text-base font-extrabold break-words ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {t.judul}
                      </h3>

                      {/* Pemisahan Jelas: DEADLINE vs JADWAL KERJA */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-navy">
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Deadline (Selesai)
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.deadline_at ? formatDateTime(t.deadline_at) : 'Tidak ditentukan'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Jadwal Kerja ({t.jadwal_mendatang_count || 0} sesi)
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.sesi_terdekat_at
                              ? `${formatShortDate(t.sesi_terdekat_at)}, ${formatTime(t.sesi_terdekat_at)} WIB`
                              : 'Belum dijadwalkan'}
                          </span>
                        </div>
                      </div>

                      {estMenit > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Progres Fokus</span>
                            <span className="font-bold">
                              {spentMenit} / {estMenit} menit
                            </span>
                          </div>
                          <LinearProgress
                            variant="determinate"
                            value={progressPct}
                            color="success"
                            sx={{ height: 5, borderRadius: 4 }}
                          />
                        </div>
                      )}
                    </div>

                    {!isDone && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outlined"
                          color="success"
                          size="small"
                          startIcon={<CalendarMonthRoundedIcon />}
                          onClick={() => setSchedulingTask(t)}
                          className="!min-h-[44px] flex-1"
                        >
                          Jadwalkan
                        </Button>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          startIcon={<PlayArrowRoundedIcon />}
                          onClick={() => handleStartFocusFromTask(t)}
                          className="!min-h-[44px] flex-1"
                        >
                          Fokus
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STATISTIK FOKUS */}
      {tab === 2 && <FocusStatsTab stats={stats} loading={statsLoading} />}

      {/* Menu Sekunder Sesi Jadwal */}
      <Menu
        anchorEl={schedMenuAnchor}
        open={Boolean(schedMenuAnchor)}
        onClose={() => setSchedMenuAnchor(null)}
      >
        {schedMenuTarget?.status !== 'selesai' && (
          <MenuItem onClick={() => handleQuickScheduleStatus(schedMenuTarget.id, 'selesai')}>
            <ListItemIcon>
              <CheckCircleOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            Tandai Selesai
          </MenuItem>
        )}
        {schedMenuTarget?.status === 'terjadwal' && (
          <MenuItem onClick={() => handleQuickScheduleStatus(schedMenuTarget.id, 'dilewati')}>
            <ListItemIcon>
              <SkipNextRoundedIcon fontSize="small" />
            </ListItemIcon>
            Lewati Sesi
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            const target = schedMenuTarget;
            setSchedMenuAnchor(null);
            setRescheduleTarget(target);
          }}
        >
          <ListItemIcon>
            <EventRepeatRoundedIcon fontSize="small" />
          </ListItemIcon>
          Jadwalkan Ulang
        </MenuItem>
        <MenuItem
          onClick={() => {
            const target = schedMenuTarget;
            setSchedMenuAnchor(null);
            setConfirmDelete({
              type: 'schedule',
              id: target.id,
              label: `Hapus sesi jadwal untuk "${target.judul_tugas}"?`,
            });
          }}
          className="!text-red-600"
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" className="text-red-600" />
          </ListItemIcon>
          Hapus Sesi
        </MenuItem>
      </Menu>

      {/* Menu Sekunder Tugas */}
      <Menu
        anchorEl={taskMenuAnchor}
        open={Boolean(taskMenuAnchor)}
        onClose={() => setTaskMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            const t = taskMenuTarget;
            setTaskMenuAnchor(null);
            setEditingTask(t);
            setTaskModalOpen(true);
          }}
        >
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          Edit Tugas
        </MenuItem>
        {taskMenuTarget?.status !== 'selesai' ? (
          <MenuItem onClick={() => handleQuickTaskStatus(taskMenuTarget.id, 'selesai')}>
            <ListItemIcon>
              <CheckCircleOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            Tandai Selesai
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleQuickTaskStatus(taskMenuTarget.id, 'sedang_dikerjakan')}>
            <ListItemIcon>
              <PlayArrowRoundedIcon fontSize="small" />
            </ListItemIcon>
            Aktifkan Kembali
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            const t = taskMenuTarget;
            setTaskMenuAnchor(null);
            setConfirmDelete({
              type: 'task',
              id: t.id,
              label: `Hapus tugas "${t.judul}" beserta seluruh sesi jadwalnya?`,
            });
          }}
          className="!text-red-600"
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" className="text-red-600" />
          </ListItemIcon>
          Hapus Tugas
        </MenuItem>
      </Menu>

      {/* Modals & Bottom Sheets */}
      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        initialTask={editingTask}
        onSaved={refreshAfterMutation}
      />

      <ScheduleTaskSheet
        open={Boolean(schedulingTask)}
        onClose={() => setSchedulingTask(null)}
        task={schedulingTask}
        onScheduled={refreshAfterMutation}
      />

      <RescheduleDialog
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        session={rescheduleTarget}
        onRescheduled={refreshAfterMutation}
      />

      <FocusSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSettings={settings}
        onSaved={(nextSettings) => {
          setSettings(nextSettings);
          updateLocalSettings(nextSettings);
          refreshAfterMutation();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Konfirmasi Hapus"
        message={confirmDelete?.label || 'Data yang dihapus tidak dapat dikembalikan.'}
        confirmText="Hapus"
        loading={deleting}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

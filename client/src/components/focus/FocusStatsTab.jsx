// FILE: client/src/components/focus/FocusStatsTab.jsx
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DateRangeRoundedIcon from '@mui/icons-material/DateRangeRounded';
import EmptyState from '../common/EmptyState';

const formatDurationLabel = (menit = 0) => {
  const m = Math.max(0, Math.round(Number(menit) || 0));
  if (m < 60) return `${m} mnt`;
  const jam = Math.floor(m / 60);
  const sisa = m % 60;
  return sisa > 0 ? `${jam}j ${sisa}m` : `${jam} jam`;
};

const shortDayLabel = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(dt);
};

export default function FocusStatsTab({ stats, loading }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={90} />
          ))}
        </div>
        <Skeleton variant="rounded" height={200} />
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        icon={<TimerRoundedIcon fontSize="large" />}
        title="Statistik Fokus Belum Tersedia"
        description="Mulai satu sesi fokus untuk melacak waktu belajar Anda."
      />
    );
  }

  const maxDailyMenit = Math.max(25, ...(stats.harian_7_hari || []).map((d) => d.total_menit));

  return (
    <div className="space-y-6">
      {/* KPI Ringan (4 Kartu) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-surface p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Fokus Hari Ini
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatDurationLabel(stats.hari_ini_menit)}
            </div>
          </div>
          <TimerRoundedIcon className="text-pasim dark:text-pasim-300 shrink-0" />
        </div>

        <div className="card-surface p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              7 Hari Terakhir
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatDurationLabel(stats.tujuh_hari_menit)}
            </div>
          </div>
          <DateRangeRoundedIcon className="text-sky-600 dark:text-sky-400 shrink-0" />
        </div>

        <div className="card-surface p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sesi Selesai
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {stats.total_sesi_selesai || 0}
            </div>
          </div>
          <CheckCircleRoundedIcon className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        </div>

        <div className="card-surface p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Streak Harian
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {stats.streak_hari || 0} hari
            </div>
          </div>
          <LocalFireDepartmentRoundedIcon className="text-amber-500 shrink-0" />
        </div>
      </div>

      {/* Grafik Batang 7 Hari Terakhir */}
      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-sm font-extrabold text-slate-900 dark:text-white">
            Aktivitas Fokus 7 Hari Terakhir
          </h3>
          <span className="text-xs text-slate-400">{stats.zona_waktu}</span>
        </div>

        <div className="grid grid-cols-7 items-end gap-2 h-36 pt-4">
          {(stats.harian_7_hari || []).map((day) => {
            const pct = Math.max(4, Math.round((day.total_menit / maxDailyMenit) * 100));
            return (
              <div key={day.date_key} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {day.total_menit > 0 ? `${day.total_menit}m` : ''}
                </span>
                <div className="w-full max-w-[36px] flex-1 flex items-end rounded-lg bg-slate-100 dark:bg-navy overflow-hidden">
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      day.total_menit > 0 ? 'bg-pasim dark:bg-pasim-400' : 'bg-transparent'
                    }`}
                    style={{ height: day.total_menit > 0 ? `${pct}%` : '0%' }}
                    title={`${day.date_key}: ${day.total_menit} menit (${day.jumlah_sesi} sesi)`}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {shortDayLabel(day.date_key)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid 2 Kolom: Per Mata Kuliah & Per Tugas */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card-surface p-5 space-y-3">
          <h3 className="m-0 text-sm font-extrabold text-slate-900 dark:text-white">
            Waktu Fokus per Mata Kuliah
          </h3>
          {!stats.per_matkul || stats.per_matkul.length === 0 ? (
            <p className="text-xs text-slate-400 m-0 py-4">Belum ada catatan sesi fokus selesai.</p>
          ) : (
            <div className="space-y-3">
              {stats.per_matkul.map((c) => (
                <div key={`${c.mata_kuliah_id || 'umum'}`} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {c.matkul_kode && c.matkul_kode !== '-' ? `${c.matkul_kode} · ` : ''}
                      {c.matkul_nama}
                    </div>
                    <div className="text-[11px] text-slate-400">{c.jumlah_sesi} sesi selesai</div>
                  </div>
                  <span className="text-xs font-extrabold text-pasim dark:text-pasim-300 shrink-0">
                    {formatDurationLabel(c.total_menit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-surface p-5 space-y-3">
          <h3 className="m-0 text-sm font-extrabold text-slate-900 dark:text-white">
            Fokus Dihabiskan vs Estimasi Tugas
          </h3>
          {!stats.per_tugas || stats.per_tugas.length === 0 ? (
            <p className="text-xs text-slate-400 m-0 py-4">Belum ada tugas dengan estimasi atau sesi fokus.</p>
          ) : (
            <div className="space-y-3">
              {stats.per_tugas.map((t) => {
                const ratio =
                  t.estimasi_menit && t.estimasi_menit > 0
                    ? Math.min(100, Math.round((t.fokus_menit / t.estimasi_menit) * 100))
                    : t.fokus_menit > 0
                    ? 100
                    : 0;
                return (
                  <div key={t.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {t.judul}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-500 dark:text-slate-400">
                        {t.fokus_menit}
                        {t.estimasi_menit ? ` / ${t.estimasi_menit}` : ''} mnt
                      </span>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={ratio}
                      color={t.status === 'selesai' ? 'success' : 'primary'}
                      sx={{ height: 6, borderRadius: 4 }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

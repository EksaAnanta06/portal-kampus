// FILE: client/src/components/focus/ScheduleTaskSheet.jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { focusApi } from '../../api/focus.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import { formatDateTime, toDateInput, toDateTimeLocalInput } from '../../utils/formatDate';

const pad2 = (n) => String(n).padStart(2, '0');

const toLocalPartsFromIso = (isoStr) => {
  const d = isoStr ? new Date(isoStr) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(d.getTime())) {
    return { date: toDateInput(new Date()), time: '09:00' };
  }
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
};

const localDateAndTimeToIso = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
};

const createRowFromIso = (isoStr, durasiMenit = 50) => {
  const parts = toLocalPartsFromIso(isoStr);
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: parts.date,
    time: parts.time,
    durasi_menit: durasiMenit,
    warnings: [],
  };
};

export default function ScheduleTaskSheet({ open, onClose, task, onScheduled }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [estimasiJam, setEstimasiJam] = useState(1);
  const [estimasiMenitSisa, setEstimasiMenitSisa] = useState(30);
  const [targetMulaiLocal, setTargetMulaiLocal] = useState('');
  const [strategy, setStrategy] = useState('bagi_rata');
  const [preferredDur, setPreferredDur] = useState(50);
  const [rows, setRows] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    const totalEst = Number(task.estimasi_menit) || 60;
    setEstimasiJam(Math.floor(totalEst / 60));
    setEstimasiMenitSisa(totalEst % 60);
    setTargetMulaiLocal(task.target_mulai ? toDateTimeLocalInput(task.target_mulai) : '');
    setRows([createRowFromIso(null, Math.min(50, totalEst))]);
  }, [open, task]);

  if (!task) return null;

  const totalEstimasiMenit = Math.max(
    15,
    (Number(estimasiJam) || 0) * 60 + (Number(estimasiMenitSisa) || 0)
  );

  const deadlineMs = task.deadline_at ? Date.parse(task.deadline_at) : null;

  const targetMulaiIso = targetMulaiLocal
    ? (() => {
        const [dPart, tPart] = targetMulaiLocal.split('T');
        return localDateAndTimeToIso(dPart, tPart);
      })()
    : null;

  const handleAutoPlan = async () => {
    setPlanning(true);
    try {
      const res = await focusApi.autoPlan({
        tugas_id: task.id,
        estimasi_menit: totalEstimasiMenit,
        target_mulai: targetMulaiIso,
        strategy,
        preferred_session_minutes: Number(preferredDur) || 50,
      });
      const plan = res.data;
      if (!plan?.sessions || plan.sessions.length === 0) {
        toast.warning('Belum ditemukan slot kosong. Silakan tambah sesi manual.');
        return;
      }
      setRows(
        plan.sessions.map((s) => ({
          ...createRowFromIso(s.mulai_at, s.durasi_menit),
          warnings: s.warnings || [],
        }))
      );
      if (plan.warnings?.melewati_deadline) {
        toast.warning('Sebagian saran sesi melewati deadline karena keterbatasan slot aktif.');
      } else if (plan.warnings?.beban_harian_berlebih) {
        toast.warning('Sebagian hari melampaui batas beban harian Anda. Anda tetap bisa menyesuaikannya.');
      } else {
        toast.success(`${plan.sessions.length} saran sesi siap ditinjau sebelum disimpan.`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menghitung rencana otomatis.'));
    } finally {
      setPlanning(false);
    }
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createRowFromIso(null, 50)]);
  };

  const handleRemoveRow = (key) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleUpdateRow = (key, field, value) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const hasLocalPastDeadline = rows.some((r) => {
    if (!deadlineMs) return false;
    const startIso = localDateAndTimeToIso(r.date, r.time);
    if (!startIso) return false;
    const endMs = Date.parse(startIso) + (Number(r.durasi_menit) || 0) * 60 * 1000;
    return endMs > deadlineMs;
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (rows.length === 0) {
      toast.warning('Tambahkan minimal satu sesi kerja.');
      return;
    }

    const sessionsPayload = [];
    for (const r of rows) {
      const iso = localDateAndTimeToIso(r.date, r.time);
      if (!iso) {
        toast.warning('Lengkapi tanggal dan jam mulai pada setiap sesi.');
        return;
      }
      sessionsPayload.push({
        mulai_at: iso,
        durasi_menit: Math.max(10, Number(r.durasi_menit) || 50),
      });
    }

    setSaving(true);
    try {
      const res = await focusApi.createSchedules({
        tugas_id: task.id,
        estimasi_menit: totalEstimasiMenit,
        target_mulai: targetMulaiIso,
        sessions: sessionsPayload,
      });

      const serverWarnings = res.data?.warnings;
      if (serverWarnings?.hasWarnings) {
        const notes = [];
        if (serverWarnings.conflicts?.length) notes.push(`${serverWarnings.conflicts.length} sesi bentrok`);
        if (serverWarnings.pastDeadlineWarnings?.length) notes.push('ada sesi melewati deadline');
        if (serverWarnings.dailyLoadWarnings?.length) notes.push('beban harian melebihi batas');
        toast.warning(`Jadwal disimpan dengan peringatan: ${notes.join(', ')}.`);
      } else {
        toast.success(`${sessionsPayload.length} sesi kerja berhasil dijadwalkan!`);
      }

      onScheduled?.(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan jadwal sesi kerja.'));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Konteks Tugas & Deadline */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-navy">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tugas yang Dijadwalkan
            </span>
            <h4 className="m-0 text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {task.judul}
            </h4>
          </div>
          {task.deadline_at ? (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={`Deadline: ${formatDateTime(task.deadline_at)}`}
              className="!text-[11px]"
            />
          ) : (
            <Chip size="small" label="Tanpa Deadline" className="!text-[11px]" />
          )}
        </div>
      </div>

      {/* Estimasi & Target Mulai Paling Lambat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TextField
          label="Estimasi (Jam)"
          type="number"
          inputProps={{ min: 0, max: 100 }}
          value={estimasiJam}
          onChange={(e) => setEstimasiJam(e.target.value)}
        />
        <TextField
          label="Estimasi (Menit)"
          type="number"
          inputProps={{ min: 0, max: 59 }}
          value={estimasiMenitSisa}
          onChange={(e) => setEstimasiMenitSisa(e.target.value)}
        />
        <div className="col-span-2">
          <TextField
            label="Target Mulai Paling Lambat (Opsional)"
            type="datetime-local"
            value={targetMulaiLocal}
            onChange={(e) => setTargetMulaiLocal(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </div>
      </div>

      {/* Kotak Rencanakan Otomatis */}
      <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-3.5 space-y-3 dark:border-emerald-800/60 dark:bg-emerald-950/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            Rencanakan Otomatis (Berdasarkan Jam Aktif & Slot Kosong)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <TextField
            select
            label="Pola Pembagian"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          >
            <MenuItem value="bagi_rata">Bagi Rata Harian</MenuItem>
            <MenuItem value="dekat_deadline">Tumpuk Dekat Deadline</MenuItem>
          </TextField>
          <TextField
            select
            label="Durasi per Sesi"
            value={preferredDur}
            onChange={(e) => setPreferredDur(e.target.value)}
          >
            <MenuItem value={25}>25 menit (1 Pomodoro)</MenuItem>
            <MenuItem value={50}>50 menit (Standar)</MenuItem>
            <MenuItem value={60}>60 menit</MenuItem>
            <MenuItem value={90}>90 menit (Blok Panjang)</MenuItem>
          </TextField>
          <Button
            type="button"
            variant="outlined"
            color="success"
            startIcon={<AutoAwesomeRoundedIcon />}
            onClick={handleAutoPlan}
            disabled={planning}
            className="!min-h-[44px]"
          >
            {planning ? 'Menghitung...' : 'Buat Saran Sesi'}
          </Button>
        </div>
      </div>

      {hasLocalPastDeadline && (
        <Alert severity="warning" className="!rounded-xl !text-xs">
          Peringatan: Ada sesi kerja yang berakhir setelah deadline tugas. Anda masih dapat menyimpannya jika memang dibutuhkan.
        </Alert>
      )}

      {/* Daftar Sesi Kerja yang Akan Disimpan */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Sesi Kerja ("Kapan Dikerjakan") ({rows.length})
          </span>
          <Button
            type="button"
            size="small"
            color="success"
            startIcon={<AddRoundedIcon />}
            onClick={handleAddRow}
            className="!min-h-[36px]"
          >
            Tambah Sesi
          </Button>
        </div>

        <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div
              key={row.key}
              className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
            >
              <div className="col-span-12 sm:col-span-5">
                <TextField
                  type="date"
                  label={`Tanggal #${idx + 1}`}
                  value={row.date}
                  onChange={(e) => handleUpdateRow(row.key, 'date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <TextField
                  type="time"
                  label="Mulai"
                  value={row.time}
                  onChange={(e) => handleUpdateRow(row.key, 'time', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <TextField
                  type="number"
                  label="Menit"
                  inputProps={{ min: 10, max: 480 }}
                  value={row.durasi_menit}
                  onChange={(e) => handleUpdateRow(row.key, 'durasi_menit', e.target.value)}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end sm:justify-center">
                <IconButton
                  type="button"
                  size="small"
                  color="error"
                  onClick={() => handleRemoveRow(row.key)}
                  aria-label="Hapus baris sesi"
                  disabled={rows.length === 1}
                  className="!min-h-[44px] !min-w-[44px]"
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
        <Button type="button" color="inherit" onClick={onClose} disabled={saving} className="!min-h-[44px]">
          Batal
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="success"
          startIcon={<EventAvailableRoundedIcon />}
          disabled={saving}
          className="!min-h-[44px]"
        >
          {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        transitionDuration={{ enter: 180, exit: 0 }}
        ModalProps={{ keepMounted: false, closeAfterTransition: false }}
        PaperProps={{
          className:
            'max-h-[92dvh] rounded-t-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-white dark:bg-navy-800',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-base font-extrabold">Jadwalkan Pengerjaan</h3>
          <IconButton onClick={onClose} aria-label="Tutup" className="!min-h-[44px] !min-w-[44px]">
            <CloseRoundedIcon />
          </IconButton>
        </div>
        <div className="overflow-y-auto pr-1">{content}</div>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center justify-between !font-extrabold">
        <span>Jadwalkan Pengerjaan Tugas</span>
        <IconButton onClick={onClose} size="small" aria-label="Tutup">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{content}</DialogContent>
    </Dialog>
  );
}

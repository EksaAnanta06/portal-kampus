// FILE: client/src/components/focus/TaskFormModal.jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { focusApi } from '../../api/focus.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import { TASK_PRIORITIES } from '../../utils/constants';
import { toDateTimeLocalInput } from '../../utils/formatDate';

const localInputToIso = (val) => {
  if (!val) return null;
  const [datePart, timePart = '00:00'] = val.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
};

export default function TaskFormModal({ open, onClose, initialTask = null, courses = [], onSaved }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [form, setForm] = useState({
    judul: '',
    mata_kuliah_id: '',
    prioritas: 'sedang',
    deadline_local: '',
    estimasi_menit: 60,
    target_mulai_local: '',
    deskripsi: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialTask) {
      setForm({
        judul: initialTask.judul || '',
        mata_kuliah_id: initialTask.mata_kuliah_id ? String(initialTask.mata_kuliah_id) : '',
        prioritas: initialTask.prioritas || 'sedang',
        deadline_local: initialTask.deadline_at ? toDateTimeLocalInput(initialTask.deadline_at) : '',
        estimasi_menit: initialTask.estimasi_menit || '',
        target_mulai_local: initialTask.target_mulai ? toDateTimeLocalInput(initialTask.target_mulai) : '',
        deskripsi: initialTask.deskripsi || '',
      });
    } else {
      setForm({
        judul: '',
        mata_kuliah_id: '',
        prioritas: 'sedang',
        deadline_local: '',
        estimasi_menit: 60,
        target_mulai_local: '',
        deskripsi: '',
      });
    }
  }, [open, initialTask]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.judul.trim().length < 2) {
      toast.warning('Judul tugas minimal 2 karakter.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        judul: form.judul.trim(),
        mata_kuliah_id: form.mata_kuliah_id ? Number(form.mata_kuliah_id) : null,
        prioritas: form.prioritas,
        deadline_at: localInputToIso(form.deadline_local),
        estimasi_menit: form.estimasi_menit ? Number(form.estimasi_menit) : null,
        target_mulai: localInputToIso(form.target_mulai_local),
        deskripsi: form.deskripsi.trim() || null,
      };

      const res = initialTask
        ? await focusApi.updateTask(initialTask.id, payload)
        : await focusApi.createTask(payload);

      toast.success(initialTask ? 'Tugas diperbarui.' : 'Tugas pribadi ditambahkan.');
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan tugas.'));
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <TextField
        label="Judul Tugas *"
        placeholder="Misal: Laporan Praktikum Struktur Data"
        value={form.judul}
        onChange={(e) => setForm({ ...form, judul: e.target.value })}
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField
          select
          label="Mata Kuliah (Opsional)"
          value={form.mata_kuliah_id}
          onChange={(e) => setForm({ ...form, mata_kuliah_id: e.target.value })}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">Umum / Tanpa Mata Kuliah</MenuItem>
          {courses.map((c) => (
            <MenuItem key={c.id} value={String(c.id)}>
              {c.kode ? `${c.kode} — ${c.nama}` : c.nama}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Prioritas"
          value={form.prioritas}
          onChange={(e) => setForm({ ...form, prioritas: e.target.value })}
        >
          {TASK_PRIORITIES.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField
          label="Deadline (Kapan Harus Selesai)"
          type="datetime-local"
          value={form.deadline_local}
          onChange={(e) => setForm({ ...form, deadline_local: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="Estimasi Durasi (Menit)"
          type="number"
          inputProps={{ min: 5, max: 6000 }}
          value={form.estimasi_menit}
          onChange={(e) => setForm({ ...form, estimasi_menit: e.target.value })}
        />
      </div>

      <TextField
        label="Target Mulai Paling Lambat (Opsional)"
        type="datetime-local"
        value={form.target_mulai_local}
        onChange={(e) => setForm({ ...form, target_mulai_local: e.target.value })}
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        label="Catatan / Detail Tugas (Opsional)"
        multiline
        minRows={2}
        value={form.deskripsi}
        onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
      />

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
        <Button type="button" color="inherit" onClick={onClose} disabled={saving} className="!min-h-[44px]">
          Batal
        </Button>
        <Button type="submit" variant="contained" disabled={saving} className="!min-h-[44px]">
          {saving ? 'Menyimpan...' : initialTask ? 'Simpan Perubahan' : 'Simpan Tugas'}
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
        PaperProps={{
          className:
            'max-h-[90dvh] rounded-t-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-white dark:bg-navy-800',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-base font-extrabold">
            {initialTask ? 'Edit Tugas Pribadi' : 'Tambah Tugas Pribadi'}
          </h3>
          <IconButton onClick={onClose} aria-label="Tutup" className="!min-h-[44px] !min-w-[44px]">
            <CloseRoundedIcon />
          </IconButton>
        </div>
        <div className="overflow-y-auto pr-1">{body}</div>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center justify-between !font-extrabold">
        <span>{initialTask ? 'Edit Tugas Pribadi' : 'Tambah Tugas Pribadi'}</span>
        <IconButton onClick={onClose} size="small" aria-label="Tutup">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{body}</DialogContent>
    </Dialog>
  );
}

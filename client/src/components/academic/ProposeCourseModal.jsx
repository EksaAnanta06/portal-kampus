// FILE: client/src/components/academic/ProposeCourseModal.jsx
import { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import PostAddRoundedIcon from '@mui/icons-material/PostAddRounded';
import materialApi from '../../api/material.api';
import { toast } from '../../store/useThemeStore';

export default function ProposeCourseModal({ open, onClose, prodiList = [], onSuccess }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const buildInitialForm = useCallback(
    () => ({
      prodi_id: prodiList[0]?.id || '',
      kode: '',
      nama: '',
      sks: 3,
      semester_rekomendasi: 1,
      deskripsi: '',
    }),
    [prodiList]
  );

  const [form, setForm] = useState(buildInitialForm);
  const [submitting, setSubmitting] = useState(false);

  // Sinkronisasi & reset form saat modal dibuka/ditutup
  useEffect(() => {
    if (!open) {
      setForm(buildInitialForm());
      return;
    }
    if (prodiList.length > 0 && !form.prodi_id) {
      setForm((prev) => ({ ...prev, prodi_id: prodiList[0].id }));
    }
  }, [prodiList, open, buildInitialForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.prodi_id || !form.kode.trim() || !form.nama.trim()) {
      toast.warning('Silakan lengkapi program studi, kode, dan nama mata kuliah.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await materialApi.createCourse(form);
      toast.success(res.message || 'Mata kuliah berhasil diusulkan!');
      setForm(buildInitialForm());
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengusulkan mata kuliah.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ className: '!rounded-none sm:!rounded-3xl' }}
    >
      <DialogTitle className="!font-black !text-base sm:!text-lg !text-emerald-700 dark:!text-emerald-400 !flex !items-center !gap-2">
        <PostAddRoundedIcon />
        <span>Usulkan Mata Kuliah Baru ke Katalog</span>
      </DialogTitle>
      <DialogContent dividers className="space-y-4">
        <div className="rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60 leading-relaxed">
          Belum menemukan mata kuliah Anda di perpustakaan? Usulkan mata kuliah baru di sini. Usulan akan ditinjau Admin/Moderator sebelum aktif di katalog.
        </div>

        <form id="propose-course-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Program Studi: *
            </label>
            <TextField
              select
              fullWidth
              size="small"
              value={form.prodi_id}
              onChange={(e) => setForm({ ...form, prodi_id: e.target.value })}
              required
            >
              {prodiList.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.kode} - {p.nama} ({p.jenjang || 'S1'})
                </MenuItem>
              ))}
            </TextField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kode Mata Kuliah: *
              </label>
              <TextField
                fullWidth
                size="small"
                placeholder="Contoh: IF3205"
                value={form.kode}
                onChange={(e) => setForm({ ...form, kode: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                SKS: *
              </label>
              <TextField
                type="number"
                fullWidth
                size="small"
                value={form.sks}
                onChange={(e) => setForm({ ...form, sks: e.target.value })}
                inputProps={{ min: 1, max: 6 }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Mata Kuliah: *
            </label>
            <TextField
              fullWidth
              size="small"
              placeholder="Contoh: Cloud Computing & Microservices"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Semester Rekomendasi (Kurikulum 1 - 8): *
            </label>
            <TextField
              select
              fullWidth
              size="small"
              value={form.semester_rekomendasi}
              onChange={(e) => setForm({ ...form, semester_rekomendasi: e.target.value })}
              required
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <MenuItem key={sem} value={sem}>
                  Semester {sem}
                </MenuItem>
              ))}
            </TextField>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Deskripsi Singkat Silabus (Opsional):
            </label>
            <textarea
              rows={2}
              placeholder="Pokok bahasan utama mata kuliah ini..."
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-navy dark:text-slate-200"
            />
          </div>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={submitting}>
          Batal
        </Button>
        <Button
          type="submit"
          form="propose-course-form"
          variant="contained"
          color="success"
          disabled={submitting}
          sx={{ borderRadius: 2 }}
        >
          {submitting ? 'Mengirim...' : 'Kirim Usulan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

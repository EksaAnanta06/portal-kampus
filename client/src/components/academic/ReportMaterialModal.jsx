// FILE: client/src/components/academic/ReportMaterialModal.jsx
import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import materialApi from '../../api/material.api';
import { toast } from '../../store/useThemeStore';
import { MATERIAL_REPORT_REASONS } from '../../utils/constants';

export default function ReportMaterialModal({ open, onClose, materialId, materialTitle }) {
  const [alasan, setAlasan] = useState(MATERIAL_REPORT_REASONS[0].value);
  const [deskripsi, setDeskripsi] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setAlasan(MATERIAL_REPORT_REASONS[0].value);
      setDeskripsi('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await materialApi.reportMaterial(materialId, { alasan, deskripsi: deskripsi.trim() });
      toast.success('Laporan Anda telah berhasil dikirim ke moderator. Terima kasih atas kepedulian Anda!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim laporan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ className: '!rounded-3xl' }}>
      <DialogTitle className="!font-black !text-base sm:!text-lg !text-red-600 dark:!text-red-400 !flex !items-center !gap-2">
        <FlagRoundedIcon />
        <span>Laporkan Materi Pembelajaran</span>
      </DialogTitle>
      <DialogContent dividers className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Anda melaporkan materi: <strong className="text-slate-800 dark:text-white">{materialTitle}</strong>
        </p>

        <form id="report-material-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Alasan Pelaporan: *
            </label>
            <TextField
              select
              fullWidth
              size="small"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              required
            >
              {MATERIAL_REPORT_REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Penjelasan Detail (Opsional):
            </label>
            <textarea
              rows={3}
              placeholder="Jelaskan bagian yang melanggar atau berikan tautan sumber asli bukti hak cipta..."
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs sm:text-sm text-slate-800 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-navy dark:text-slate-200"
            />
          </div>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={submitting} sx={{ minHeight: 40 }}>
          Batal
        </Button>
        <Button
          type="submit"
          form="report-material-form"
          variant="contained"
          color="error"
          disabled={submitting}
          sx={{ borderRadius: 2, minHeight: 40 }}
        >
          {submitting ? 'Mengirim...' : 'Kirim Laporan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// FILE: client/src/components/focus/RescheduleDialog.jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { focusApi } from '../../api/focus.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import { formatDateTime, toDateTimeLocalInput } from '../../utils/formatDate';

const localInputToIso = (val) => {
  if (!val) return null;
  const [dPart, tPart = '09:00'] = val.split('T');
  const [y, m, d] = dPart.split('-').map(Number);
  const [hh, mm] = tPart.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
};

export default function RescheduleDialog({ open, onClose, session, onRescheduled }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [suggestedSlot, setSuggestedSlot] = useState(null);
  const [mulaiLocal, setMulaiLocal] = useState('');
  const [durasiMenit, setDurasiMenit] = useState(50);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    setDurasiMenit(session.durasi_menit || 50);
    setLoadingSuggestion(true);
    focusApi
      .suggestRescheduleSlot(session.id)
      .then((res) => {
        setSuggestedSlot(res.data || null);
        if (res.data?.mulai_at) {
          setMulaiLocal(toDateTimeLocalInput(res.data.mulai_at));
        }
      })
      .catch(() => {
        setSuggestedSlot(null);
      })
      .finally(() => setLoadingSuggestion(false));
  }, [open, session]);

  if (!session) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mulaiIso = localInputToIso(mulaiLocal);
    if (!mulaiIso) {
      toast.warning('Pilih tanggal dan jam mulai pengganti.');
      return;
    }

    setSaving(true);
    try {
      const res = await focusApi.rescheduleSession(session.id, {
        mulai_at: mulaiIso,
        durasi_menit: Math.max(10, Number(durasiMenit) || 50),
      });
      toast.success('Sesi berhasil dijadwalkan ulang.');
      onRescheduled?.(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menjadwalkan ulang sesi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUseAutoSlot = async () => {
    setSaving(true);
    try {
      const res = await focusApi.rescheduleSession(session.id, {
        auto: true,
        durasi_menit: Math.max(10, Number(durasiMenit) || 50),
      });
      toast.success('Sesi dijadwalkan ke slot kosong terdekat.');
      onRescheduled?.(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menjadwalkan ulang.'));
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-navy">
        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
          {session.judul_tugas}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          Jadwal sebelumnya: {formatDateTime(session.mulai_at)}
        </div>
      </div>

      {loadingSuggestion ? (
        <p className="text-xs text-slate-500">Mencari slot bebas bentrok berikutnya...</p>
      ) : suggestedSlot ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
            Saran Slot Kosong Terdekat:
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-300">
            {formatDateTime(suggestedSlot.mulai_at)} ({suggestedSlot.durasi_menit} menit)
          </div>
          <Button
            type="button"
            size="small"
            variant="contained"
            color="success"
            disabled={saving}
            startIcon={<AutoAwesomeRoundedIcon />}
            onClick={handleUseAutoSlot}
            className="!min-h-[40px]"
          >
            Pakai Slot Saran Ini
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField
          label="Atau Pilih Waktu Manual"
          type="datetime-local"
          value={mulaiLocal}
          onChange={(e) => setMulaiLocal(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Durasi (Menit)"
          type="number"
          inputProps={{ min: 10, max: 480 }}
          value={durasiMenit}
          onChange={(e) => setDurasiMenit(e.target.value)}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
        <Button type="button" color="inherit" onClick={onClose} disabled={saving} className="!min-h-[44px]">
          Batal
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="success"
          disabled={saving}
          className="!min-h-[44px]"
        >
          Simpan Jadwal Baru
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
            'rounded-t-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-white dark:bg-navy-800',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-base font-extrabold">Jadwalkan Ulang Sesi</h3>
          <IconButton onClick={onClose} aria-label="Tutup" className="!min-h-[44px] !min-w-[44px]">
            <CloseRoundedIcon />
          </IconButton>
        </div>
        {body}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center justify-between !font-extrabold">
        <span>Jadwalkan Ulang Sesi</span>
        <IconButton onClick={onClose} size="small" aria-label="Tutup">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{body}</DialogContent>
    </Dialog>
  );
}

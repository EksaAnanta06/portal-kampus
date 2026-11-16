// FILE: client/src/components/focus/FocusSettingsModal.jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { focusApi } from '../../api/focus.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import {
  getCurrentPushSubscription,
  isIosDevice,
  isStandalonePwa,
  isWebPushSupported,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from '../../utils/pushNotifications';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Jakarta', label: 'WIB (Asia/Jakarta)' },
  { value: 'Asia/Makassar', label: 'WITA (Asia/Makassar)' },
  { value: 'Asia/Jayapura', label: 'WIT (Asia/Jayapura)' },
  { value: 'UTC', label: 'UTC' },
];

export default function FocusSettingsModal({ open, onClose, initialSettings, onSaved }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [form, setForm] = useState({
    durasi_fokus: 25,
    durasi_istirahat_pendek: 5,
    durasi_istirahat_panjang: 15,
    siklus_sebelum_panjang: 4,
    auto_start: false,
    suara_aktif: true,
    getar_aktif: true,
    batas_beban_harian_menit: 240,
    jam_aktif_mulai: '08:00',
    jam_aktif_selesai: '22:00',
    jam_tenang_aktif: true,
    jam_tenang_mulai: '22:00',
    jam_tenang_selesai: '07:00',
    zona_waktu: 'Asia/Jakarta',
    ingatkan_sesi_akan_mulai: true,
    offset_sesi_menit: 10,
    ingatkan_sesi_mulai: true,
    ingatkan_deadline_h3: true,
    ingatkan_deadline_h1: true,
    ingatkan_deadline_3jam: true,
    ingatkan_sesi_terlewat: true,
    email_pengingat_aktif: false,
  });

  const [saving, setSaving] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialSettings) {
      setForm((prev) => ({ ...prev, ...initialSettings }));
    } else {
      focusApi
        .getSettings()
        .then((res) => {
          if (res.data) setForm((prev) => ({ ...prev, ...res.data }));
        })
        .catch(() => {});
    }

    getCurrentPushSubscription()
      .then((sub) => setPushSubscribed(Boolean(sub)))
      .catch(() => setPushSubscribed(false));
  }, [open, initialSettings]);

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromWebPush();
        setPushSubscribed(false);
        toast.info('Notifikasi Web Push di perangkat ini dimatikan.');
      } else {
        await subscribeToWebPush();
        setPushSubscribed(true);
        toast.success('Notifikasi Web Push aktif untuk perangkat ini!');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Gagal mengatur Web Push.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        durasi_fokus: Number(form.durasi_fokus),
        durasi_istirahat_pendek: Number(form.durasi_istirahat_pendek),
        durasi_istirahat_panjang: Number(form.durasi_istirahat_panjang),
        siklus_sebelum_panjang: Number(form.siklus_sebelum_panjang),
        batas_beban_harian_menit: Number(form.batas_beban_harian_menit),
        offset_sesi_menit: Number(form.offset_sesi_menit),
      };
      const res = await focusApi.updateSettings(payload);
      toast.success('Pengaturan fokus & pengingat tersimpan.');
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menyimpan pengaturan.'));
    } finally {
      setSaving(false);
    }
  };

  const iosNotInstalled = isIosDevice() && !isStandalonePwa();

  const body = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bagian 1: Timer Pomodoro */}
      <div className="space-y-3">
        <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">
          Durasi Timer (Menit)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TextField
            label="Fokus"
            type="number"
            inputProps={{ min: 5, max: 120 }}
            value={form.durasi_fokus}
            onChange={(e) => setForm({ ...form, durasi_fokus: e.target.value })}
          />
          <TextField
            label="Istirahat Pendek"
            type="number"
            inputProps={{ min: 1, max: 45 }}
            value={form.durasi_istirahat_pendek}
            onChange={(e) => setForm({ ...form, durasi_istirahat_pendek: e.target.value })}
          />
          <TextField
            label="Istirahat Panjang"
            type="number"
            inputProps={{ min: 5, max: 90 }}
            value={form.durasi_istirahat_panjang}
            onChange={(e) => setForm({ ...form, durasi_istirahat_panjang: e.target.value })}
          />
          <TextField
            label="Siklus / Panjang"
            type="number"
            inputProps={{ min: 2, max: 10 }}
            value={form.siklus_sebelum_panjang}
            onChange={(e) => setForm({ ...form, siklus_sebelum_panjang: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.auto_start)}
                onChange={(e) => setForm({ ...form, auto_start: e.target.checked })}
              />
            }
            label={<span className="text-sm">Auto-start sesi berikutnya</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.suara_aktif)}
                onChange={(e) => setForm({ ...form, suara_aktif: e.target.checked })}
              />
            }
            label={<span className="text-sm">Suara selesai</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.getar_aktif)}
                onChange={(e) => setForm({ ...form, getar_aktif: e.target.checked })}
              />
            }
            label={<span className="text-sm">Getar di mobile</span>}
          />
        </div>
      </div>

      <Divider />

      {/* Bagian 2: Jam Aktif, Beban Harian & Zona Waktu */}
      <div className="space-y-3">
        <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">
          Jam Aktif & Beban Belajar
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            select
            label="Zona Waktu"
            value={form.zona_waktu}
            onChange={(e) => setForm({ ...form, zona_waktu: e.target.value })}
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Batas Beban Harian (Menit)"
            type="number"
            inputProps={{ min: 30, max: 720 }}
            value={form.batas_beban_harian_menit}
            onChange={(e) => setForm({ ...form, batas_beban_harian_menit: e.target.value })}
          />
          <TextField
            label="Jam Aktif Mulai"
            type="time"
            value={form.jam_aktif_mulai}
            onChange={(e) => setForm({ ...form, jam_aktif_mulai: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Jam Aktif Selesai"
            type="time"
            value={form.jam_aktif_selesai}
            onChange={(e) => setForm({ ...form, jam_aktif_selesai: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </div>
      </div>

      <Divider />

      {/* Bagian 3: Jam Tenang & Jenis Pengingat */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Jam Tenang (Quiet Hours) & Pengingat
          </h4>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={Boolean(form.jam_tenang_aktif)}
                onChange={(e) => setForm({ ...form, jam_tenang_aktif: e.target.checked })}
              />
            }
            label={<span className="text-xs font-semibold">Aktifkan Jam Tenang</span>}
          />
        </div>

        {form.jam_tenang_aktif && (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Jam Tenang Mulai"
              type="time"
              value={form.jam_tenang_mulai}
              onChange={(e) => setForm({ ...form, jam_tenang_mulai: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Jam Tenang Selesai"
              type="time"
              value={form.jam_tenang_selesai}
              onChange={(e) => setForm({ ...form, jam_tenang_selesai: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <TextField
            label="Ingatkan Sebelum Sesi (Menit)"
            type="number"
            inputProps={{ min: 1, max: 120 }}
            value={form.offset_sesi_menit}
            onChange={(e) => setForm({ ...form, offset_sesi_menit: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.ingatkan_sesi_akan_mulai)}
                onChange={(e) => setForm({ ...form, ingatkan_sesi_akan_mulai: e.target.checked })}
              />
            }
            label={<span className="text-xs sm:text-sm">Sebelum sesi dimulai</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.ingatkan_sesi_mulai)}
                onChange={(e) => setForm({ ...form, ingatkan_sesi_mulai: e.target.checked })}
              />
            }
            label={<span className="text-xs sm:text-sm">Saat sesi dimulai</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.ingatkan_sesi_terlewat)}
                onChange={(e) => setForm({ ...form, ingatkan_sesi_terlewat: e.target.checked })}
              />
            }
            label={<span className="text-xs sm:text-sm">Sesi terlewat</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.ingatkan_deadline_h3)}
                onChange={(e) => setForm({ ...form, ingatkan_deadline_h3: e.target.checked })}
              />
            }
            label={<span className="text-xs sm:text-sm">Deadline H-3</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.ingatkan_deadline_h1)}
                onChange={(e) => setForm({ ...form, ingatkan_deadline_h1: e.target.checked })}
              />
            }
            label={<span className="text-xs sm:text-sm">Deadline H-1</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.ingatkan_deadline_3jam)}
                onChange={(e) => setForm({ ...form, ingatkan_deadline_3jam: e.target.checked })}
              />
            }
            label={<span className="text-xs sm:text-sm">Deadline 3 jam sebelum</span>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.email_pengingat_aktif)}
                onChange={(e) => setForm({ ...form, email_pengingat_aktif: e.target.checked })}
              />
            }
            label={<span className="text-xs sm:text-sm">Saluran Email (opsional)</span>}
          />
        </div>
      </div>

      <Divider />

      {/* Bagian 4: Web Push (Notifikasi saat Tab Ditutup) */}
      <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-navy">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
              <NotificationsActiveRoundedIcon fontSize="small" className="text-pasim dark:text-pasim-300" />
              <span>Notifikasi Push Browser (PWA)</span>
            </div>
            <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Terima pengingat sesi & deadline meskipun tab aplikasi sedang ditutup.
            </p>
          </div>
          <Button
            type="button"
            variant={pushSubscribed ? 'outlined' : 'contained'}
            color={pushSubscribed ? 'error' : 'primary'}
            size="small"
            disabled={pushLoading || !isWebPushSupported()}
            onClick={handleTogglePush}
            className="!min-h-[44px]"
          >
            {pushLoading
              ? 'Memproses...'
              : pushSubscribed
              ? 'Matikan Push'
              : 'Aktifkan Push'}
          </Button>
        </div>

        {iosNotInstalled && (
          <Alert severity="info" className="!rounded-xl !text-xs">
            Di iPhone/iPad (Safari), Web Push hanya berfungsi jika Anda memasang portal ini ke Layar Utama (
            <strong>Bagikan → Tambah ke Layar Utama</strong>). Tanpa itu, pengingat tetap tampil di ikon lonceng dalam aplikasi.
          </Alert>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
        <Button type="button" color="inherit" onClick={onClose} disabled={saving} className="!min-h-[44px]">
          Batal
        </Button>
        <Button type="submit" variant="contained" disabled={saving} className="!min-h-[44px]">
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
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
          <h3 className="m-0 text-base font-extrabold">Pengaturan Fokus & Pengingat</h3>
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
        <span>Pengaturan Fokus & Pengingat</span>
        <IconButton onClick={onClose} size="small" aria-label="Tutup">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{body}</DialogContent>
    </Dialog>
  );
}

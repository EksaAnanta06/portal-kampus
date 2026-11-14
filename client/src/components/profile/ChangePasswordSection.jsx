// FILE: client/src/components/profile/ChangePasswordSection.jsx
import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { authApi } from '../../api/auth.api';
import { getErrorMessage } from '../../api/axiosInstance';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';

export default function ChangePasswordSection() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.new_password.length < 8) {
      setError('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setSaving(true);
    try {
      const res = await authApi.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      if (res?.data?.accessToken) {
        setAuth({ accessToken: res.data.accessToken });
      }
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      toast.success(res.message || 'Kata sandi berhasil diperbarui.');
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengubah kata sandi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-surface p-6 sm:p-8">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pasim-50 text-pasim dark:bg-pasim-900/40 dark:text-pasim-300">
          <LockResetRoundedIcon />
        </div>
        <div>
          <h3 className="m-0 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            Keamanan & Ubah Kata Sandi
          </h3>
          <p className="text-muted m-0 mt-1 text-xs sm:text-sm">
            Setelah kata sandi diganti, sesi di perangkat lain akan otomatis keluar untuk menjaga keamanan akun.
          </p>
        </div>
      </div>

      {error && (
        <Alert severity="error" className="!mb-4 !rounded-xl">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          fullWidth
          label="Kata Sandi Saat Ini"
          type={showCurrent ? 'text' : 'password'}
          value={form.current_password}
          onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
          required
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowCurrent((v) => !v)}
                  edge="end"
                  aria-label="Tampilkan kata sandi saat ini"
                >
                  {showCurrent ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            fullWidth
            label="Kata Sandi Baru"
            type={showNew ? 'text' : 'password'}
            value={form.new_password}
            onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
            required
            helperText="Minimal 8 karakter, kombinasikan huruf & angka"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowNew((v) => !v)}
                    edge="end"
                    aria-label="Tampilkan kata sandi baru"
                  >
                    {showNew ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Konfirmasi Kata Sandi Baru"
            type={showNew ? 'text' : 'password'}
            value={form.confirm_password}
            onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
            required
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="outlined"
            color="primary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LockResetRoundedIcon />}
            className="min-h-[44px]"
          >
            {saving ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
          </Button>
        </div>
      </form>
    </div>
  );
}

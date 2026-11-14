// FILE: client/src/pages/auth/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { authApi } from '../../api/auth.api';
import { getErrorMessage, getFieldErrors } from '../../api/axiosInstance';
import { ANGKATAN_YEAR_OPTIONS, PRODI_LIST } from '../../utils/constants';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nim: '',
    full_name: '',
    email: '',
    prodi: PRODI_LIST[0],
    angkatan_year: new Date().getFullYear(),
    role: 'mahasiswa',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (form.password !== form.confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      await authApi.register({ ...payload, angkatan_year: Number(payload.angkatan_year) });
      setRegistered(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Registrasi gagal. Periksa kembali form Anda.'));
      setFieldErrors(getFieldErrors(err));
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="card-surface p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
          <HowToRegRoundedIcon fontSize="large" />
        </div>
        <h2 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white">Pendaftaran Berhasil!</h2>
        <p className="text-muted mb-6 mt-2 text-sm leading-relaxed">
          Akun Anda telah dicatat dengan status <strong>Menunggu Verifikasi</strong>. Admin kemahasiswaan UNAS PASIM
          akan memverifikasi keaktifan NIM Anda sebelum akun dapat dipakai untuk login.
        </p>
        <Button variant="contained" onClick={() => navigate('/login')}>
          Ke Halaman Masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="card-surface p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white">Daftar Akun Portal</h2>
        <p className="text-muted mb-0 mt-1.5 text-sm">
          Khusus mahasiswa aktif dan alumni Universitas Nasional Pasim Bandung.
        </p>
      </div>

      {error && (
        <Alert severity="error" className="!mb-5">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <TextField
          label="NIM (Nomor Induk Mahasiswa)"
          value={form.nim}
          onChange={(e) => setForm((f) => ({ ...f, nim: e.target.value.trim().toUpperCase() }))}
          error={Boolean(fieldErrors.nim)}
          helperText={fieldErrors.nim || 'Contoh: 020123014'}
          required
        />

        <TextField
          label="Nama Lengkap"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          error={Boolean(fieldErrors.full_name)}
          helperText={fieldErrors.full_name}
          required
        />

        <TextField
          type="email"
          label="Alamat Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim().toLowerCase() }))}
          error={Boolean(fieldErrors.email)}
          helperText={fieldErrors.email || 'Email aktif untuk konfirmasi & reset password'}
          required
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            select
            label="Program Studi"
            value={form.prodi}
            onChange={(e) => setForm((f) => ({ ...f, prodi: e.target.value }))}
            required
          >
            {PRODI_LIST.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Tahun Masuk / Angkatan"
            value={form.angkatan_year}
            onChange={(e) => setForm((f) => ({ ...f, angkatan_year: Number(e.target.value) }))}
            required
          >
            {ANGKATAN_YEAR_OPTIONS.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <TextField
          select
          label="Status Sivitas"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        >
          <MenuItem value="mahasiswa">Mahasiswa Aktif</MenuItem>
          <MenuItem value="alumni">Alumni</MenuItem>
        </TextField>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            type={showPassword ? 'text' : 'password'}
            label="Password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password || 'Minimal 8 karakter'}
            required
          />

          <TextField
            type={showPassword ? 'text' : 'password'}
            label="Konfirmasi Password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small">
                    {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </div>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <HowToRegRoundedIcon />}
          className="!mt-2"
        >
          {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
        </Button>
      </form>

      <div className="text-muted mt-6 text-center text-sm">
        Sudah memiliki akun?{' '}
        <Link to="/login" className="font-bold text-pasim hover:underline dark:text-pasim-300">
          Masuk di sini
        </Link>
      </div>
    </div>
  );
}

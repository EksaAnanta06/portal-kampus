// FILE: client/src/pages/auth/RegisterPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { authApi } from '../../api/auth.api';
import { API_BASE_URL, getErrorMessage, getFieldErrors } from '../../api/axiosInstance';
import { ANGKATAN_YEAR_OPTIONS, PRODI_LIST } from '../../utils/constants';
import { startGoogleOAuth } from '../../platform';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const googleToken = searchParams.get('google_token') || '';

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
  const [googleRedirectLoading, setGoogleRedirectLoading] = useState(false);
  const [googleProfileLoading, setGoogleProfileLoading] = useState(Boolean(googleToken));
  const [googleProfile, setGoogleProfile] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (!googleToken) {
      setGoogleProfile(null);
      setGoogleProfileLoading(false);
      return undefined;
    }

    let active = true;
    setGoogleProfileLoading(true);
    setError('');
    authApi
      .getGoogleRegistrationProfile(googleToken)
      .then((res) => {
        if (!active) return;
        const profile = res.data;
        setGoogleProfile(profile);
        setForm((prev) => ({
          ...prev,
          full_name: prev.full_name || profile.full_name || '',
          email: profile.email || prev.email,
        }));
      })
      .catch((err) => {
        if (!active) return;
        setGoogleProfile(null);
        setError(
          getErrorMessage(
            err,
            'Sesi pendaftaran Google sudah kedaluwarsa. Silakan ulangi daftar dengan Google.'
          )
        );
        setSearchParams({}, { replace: true });
      })
      .finally(() => {
        if (active) setGoogleProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [googleToken, setSearchParams]);

  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleRedirectLoading(true);
    try {
      await startGoogleOAuth({ apiBaseUrl: API_BASE_URL, redirectPath: '/' });
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal membuka autentikasi Google.'));
    } finally {
      setGoogleRedirectLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!googleProfile) {
      if (form.password !== form.confirmPassword) {
        setError('Konfirmasi password tidak cocok.');
        return;
      }
      if (form.password.length < 8) {
        setError('Password minimal 8 karakter.');
        return;
      }
    }

    setLoading(true);
    try {
      if (googleProfile && googleToken) {
        await authApi.completeGoogleRegistration({
          token: googleToken,
          nim: form.nim,
          full_name: form.full_name,
          prodi: form.prodi,
          angkatan_year: Number(form.angkatan_year),
          role: form.role,
        });
      } else {
        const { confirmPassword, ...payload } = form;
        await authApi.register({ ...payload, angkatan_year: Number(payload.angkatan_year) });
      }
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
        <h2 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white">
          {googleProfile ? 'Lengkapi Profil Kampus' : 'Daftar Akun Portal'}
        </h2>
        <p className="text-muted mb-0 mt-1.5 text-sm">
          {googleProfile
            ? 'Email Google Anda terverifikasi. Lengkapi NIM dan data prodi untuk verifikasi Admin.'
            : 'Khusus mahasiswa aktif dan alumni Universitas Nasional Pasim Bandung.'}
        </p>
      </div>

      {googleProfileLoading && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <CircularProgress size={18} />
          <span>Memuat profil akun Google...</span>
        </div>
      )}

      {googleProfile && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800/60 dark:bg-emerald-950/30">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={googleProfile.avatar_url || undefined} sx={{ width: 38, height: 38 }}>
              {(googleProfile.full_name || 'G')[0]}
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {googleProfile.full_name}
              </div>
              <div className="truncate text-xs text-emerald-700 dark:text-emerald-300">
                {googleProfile.email} · Terverifikasi Google
              </div>
            </div>
          </div>
          <Button
            size="small"
            variant="text"
            onClick={() => setSearchParams({}, { replace: true })}
            className="shrink-0"
          >
            Ganti Akun
          </Button>
        </div>
      )}

      {error && (
        <Alert severity="error" className="!mb-5">
          {error}
        </Alert>
      )}

      {!googleProfile && !googleProfileLoading && (
        <>
          <GoogleSignInButton
            label="Daftar Cepat dengan Google"
            loading={googleRedirectLoading}
            disabled={loading}
            onClick={handleGoogleSignUp}
          />
          <Divider className="!my-5 text-xs text-slate-400">atau daftar dengan email & NIM</Divider>
        </>
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
          onChange={(e) => {
            if (!googleProfile) {
              setForm((f) => ({ ...f, email: e.target.value.trim().toLowerCase() }));
            }
          }}
          error={Boolean(fieldErrors.email)}
          helperText={
            googleProfile
              ? 'Email terverifikasi otomatis melalui akun Google Anda'
              : fieldErrors.email || 'Email aktif untuk konfirmasi & reset password'
          }
          InputProps={googleProfile ? { readOnly: true } : undefined}
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

        {!googleProfile && (
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
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || googleProfileLoading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <HowToRegRoundedIcon />}
          className="!mt-2"
        >
          {loading
            ? 'Mendaftarkan...'
            : googleProfile
            ? 'Selesaikan Pendaftaran Google'
            : 'Daftar Sekarang'}
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

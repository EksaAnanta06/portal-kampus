// FILE: client/src/pages/auth/ForgotResetPasswordPage.jsx
import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { authApi } from '../../api/auth.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';

export default function ForgotResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  // Mode: jika ada token di URL maka mode 'reset', jika tidak maka mode 'forgot'
  const isResetMode = Boolean(tokenFromUrl);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [devTokenInfo, setDevTokenInfo] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setForgotSubmitted(true);
      if (res.data?.dev_reset_token) {
        setDevTokenInfo(res.data);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memproses permintaan reset password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    if (password.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        token: tokenFromUrl,
        password,
      });
      toast.success(res.message);
      setResetSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mereset password. Token mungkin sudah kedaluwarsa.'));
    } finally {
      setLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div className="card-surface p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircleRoundedIcon fontSize="large" />
        </div>
        <h2 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white">Password Berhasil Diubah!</h2>
        <p className="text-muted mb-6 mt-2 text-sm leading-relaxed">
          Silakan gunakan password baru Anda untuk masuk ke sistem Portal Kampus UNAS PASIM.
        </p>
        <Button variant="contained" onClick={() => navigate('/login')}>
          Masuk Sekarang
        </Button>
      </div>
    );
  }

  if (isResetMode) {
    return (
      <div className="card-surface p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white">Buat Password Baru</h2>
          <p className="text-muted mb-0 mt-1.5 text-sm">
            Masukkan password baru yang aman (minimal 8 karakter).
          </p>
        </div>

        {error && (
          <Alert severity="error" className="!mb-5">
            {error}
          </Alert>
        )}

        <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
          <TextField
            type={showPassword ? 'text' : 'password'}
            label="Password Baru"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
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

          <TextField
            type={showPassword ? 'text' : 'password'}
            label="Konfirmasi Password Baru"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LockResetRoundedIcon />}
            className="!mt-2"
          >
            {loading ? 'Menyimpan...' : 'Perbarui Password'}
          </Button>
        </form>

        <div className="text-muted mt-6 text-center text-sm">
          Kembali ke{' '}
          <Link to="/login" className="font-bold text-pasim hover:underline dark:text-pasim-300">
            Halaman Masuk
          </Link>
        </div>
      </div>
    );
  }

  if (forgotSubmitted) {
    return (
      <div className="card-surface p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pasim-50 text-pasim dark:bg-pasim-900/30 dark:text-pasim-300">
          <MarkEmailReadRoundedIcon fontSize="large" />
        </div>
        <h2 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white">Cek Email Anda</h2>
        <p className="text-muted mb-6 mt-2 text-sm leading-relaxed">
          Jika alamat email <strong>{email}</strong> terdaftar di sistem kami, instruksi dan tautan reset password
          telah dikirimkan. Tautan hanya berlaku selama 30 menit.
        </p>

        {devTokenInfo && (
          <div className="mb-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-left text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
            <span className="font-bold">Mode Pengujian Lokal (SMTP Mock):</span>
            <div className="mt-1 break-all">
              Token: <code>{devTokenInfo.dev_reset_token}</code>
            </div>
            <div className="mt-2">
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                component={Link}
                to={`/reset-password?token=${devTokenInfo.dev_reset_token}`}
              >
                Gunakan Tautan Reset Ini Langsung
              </Button>
            </div>
          </div>
        )}

        <Button variant="outlined" component={Link} to="/login">
          Kembali ke Halaman Masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="card-surface p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white">Lupa Password</h2>
        <p className="text-muted mb-0 mt-1.5 text-sm">
          Masukkan alamat email yang terdaftar di akun Portal Kampus Anda.
        </p>
      </div>

      {error && (
        <Alert severity="error" className="!mb-5">
          {error}
        </Alert>
      )}

      <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
        <TextField
          type="email"
          label="Alamat Email Terdaftar"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@pasim.ac.id"
          autoFocus
          required
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LockResetRoundedIcon />}
          className="!mt-2"
        >
          {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
        </Button>
      </form>

      <div className="text-muted mt-6 text-center text-sm">
        Ingat password Anda?{' '}
        <Link to="/login" className="font-bold text-pasim hover:underline dark:text-pasim-300">
          Masuk di sini
        </Link>
      </div>
    </div>
  );
}

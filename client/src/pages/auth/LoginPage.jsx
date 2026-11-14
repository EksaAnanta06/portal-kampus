// FILE: client/src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const fromState = location.state?.from;
  const from = fromState
    ? `${fromState.pathname || '/'}${fromState.search || ''}`
    : '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await login(form);
      toast.success(res.message);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Login gagal. Periksa kembali NIM/Email dan password Anda.'));
    }
  };

  const fillDemo = (identifier) => {
    setForm({ identifier, password: 'Pasim123!' });
  };

  return (
    <div className="card-surface p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl bg-white/95 dark:bg-slate-900/95">
      {/* Header Logo Kampus PASIM di Tampilan Mobile */}
      <div className="flex items-center gap-3 mb-5 sm:hidden pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pasim-50 dark:bg-pasim-900/60 p-2 border border-pasim-100 dark:border-pasim-800/60 shadow-sm">
          <img
            src="/logo-pasim.png"
            alt="Logo UNAS PASIM"
            className="h-full w-full object-contain filter drop-shadow"
          />
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-pasim dark:text-pasim-300 block">
            Universitas Nasional Pasim
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate block">
            Kampus Dakota Bandung
          </span>
        </div>
      </div>

      <div className="mb-6">
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Sistem Autentikasi Terpadu
        </span>
        <h2 className="m-0 mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">Masuk ke Portal</h2>
        <p className="text-muted mb-0 mt-1.5 text-xs sm:text-sm">
          Gunakan NIM atau Email terdaftar serta password akun Anda.
        </p>
      </div>

      {error && (
        <Alert severity="error" className="!mb-5">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email atau NIM"
          value={form.identifier}
          onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
          placeholder="020123014 atau nama@pasim.ac.id"
          autoFocus
          required
        />

        <div>
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
          <div className="mt-1 text-right">
            <Link
              to="/lupa-password"
              className="text-xs font-semibold text-pasim hover:underline dark:text-pasim-300"
            >
              Lupa password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <LoginRoundedIcon />}
          className="!mt-2"
        >
          {isLoading ? 'Memeriksa...' : 'Masuk'}
        </Button>
      </form>

      {/* Shortcut Akun Demo */}
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-white">Akun Demo Cepat</span>
          <span className="text-[10px] text-muted font-mono">Pasim123!</span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Button
            size="small"
            variant="outlined"
            onClick={() => fillDemo('rizky.mhs@pasim.ac.id')}
            className="!text-xs !py-1.5 font-semibold"
          >
            Demo Mahasiswa
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => fillDemo('dinda.alumni@pasim.ac.id')}
            className="!text-xs !py-1.5 font-semibold"
          >
            Demo Alumni
          </Button>
        </div>
        </div>
      )}

      <div className="text-muted mt-6 text-center text-sm">
        Belum memiliki akun?{' '}
        <Link to="/register" className="font-bold text-pasim hover:underline dark:text-pasim-300">
          Daftar sekarang
        </Link>
      </div>
    </div>
  );
}

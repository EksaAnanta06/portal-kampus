// FILE: client/src/pages/auth/GoogleAuthCallbackPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';

// Mencegah eksekusi ganda di React 18 StrictMode untuk kode single-use
const inFlightExchanges = new Map();

export default function GoogleAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginWithGoogleCode = useAuthStore((s) => s.loginWithGoogleCode);

  const exchangeCode = searchParams.get('exchange') || '';
  const statusParam = searchParams.get('status') || '';
  const regToken = searchParams.get('reg_token') || '';
  const messageParam = searchParams.get('message') || '';
  const redirectParam = searchParams.get('redirect') || '/';

  const [viewState, setViewState] = useState({
    phase: exchangeCode ? 'loading' : statusParam === 'pending' ? 'pending' : 'error',
    message:
      messageParam ||
      (statusParam === 'pending'
        ? 'Akun Anda sedang menunggu verifikasi NIM oleh Admin Kampus UNAS PASIM.'
        : 'Autentikasi Google gagal diproses.'),
  });

  useEffect(() => {
    if (statusParam === 'needs_registration' && regToken) {
      navigate(`/register?google_token=${encodeURIComponent(regToken)}`, { replace: true });
      return undefined;
    }

    if (!exchangeCode) {
      return undefined;
    }

    let cancelled = false;
    let exchangePromise = inFlightExchanges.get(exchangeCode);
    if (!exchangePromise) {
      exchangePromise = loginWithGoogleCode(exchangeCode);
      inFlightExchanges.set(exchangeCode, exchangePromise);
      setTimeout(() => {
        inFlightExchanges.delete(exchangeCode);
      }, 15000);
    }

    exchangePromise
      .then((res) => {
        if (cancelled) return;
        toast.success(res.message || 'Berhasil masuk dengan akun Google.');
        const target = res.data?.redirectPath || redirectParam || '/';
        navigate(target.startsWith('/') ? target : '/', { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setViewState({
          phase: 'error',
          message: getErrorMessage(err, 'Kode otorisasi Google sudah kedaluwarsa atau tidak valid.'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [exchangeCode, statusParam, regToken, redirectParam, loginWithGoogleCode, navigate]);

  if (viewState.phase === 'loading' || (statusParam === 'needs_registration' && regToken)) {
    return (
      <div className="card-surface p-8 text-center rounded-2xl sm:rounded-3xl">
        <CircularProgress color="primary" size={36} />
        <h2 className="m-0 mt-4 text-lg font-extrabold text-slate-900 dark:text-white">
          Menyelesaikan Login Google
        </h2>
        <p className="text-muted m-0 mt-1.5 text-sm">
          Mohon tunggu sebentar, sedang memverifikasi sesi akun Portal Pasim Anda...
        </p>
      </div>
    );
  }

  if (viewState.phase === 'pending') {
    return (
      <div className="card-surface p-6 sm:p-8 text-center rounded-2xl sm:rounded-3xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
          <HourglassTopRoundedIcon fontSize="large" />
        </div>
        <h2 className="m-0 text-xl font-extrabold text-slate-900 dark:text-white">
          Menunggu Verifikasi Admin
        </h2>
        <p className="text-muted mb-6 mt-2 text-sm leading-relaxed">{viewState.message}</p>
        <Button component={Link} to="/login" variant="contained" fullWidth>
          Kembali ke Halaman Masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="card-surface p-6 sm:p-8 rounded-2xl sm:rounded-3xl">
      <h2 className="m-0 mb-3 text-xl font-extrabold text-slate-900 dark:text-white">
        Login Google Belum Berhasil
      </h2>
      <Alert severity="error" className="!mb-5">
        {viewState.message}
      </Alert>
      <div className="flex flex-col gap-2">
        <Button component={Link} to="/login" variant="contained" fullWidth>
          Kembali ke Halaman Masuk
        </Button>
        <Button component={Link} to="/register" variant="outlined" fullWidth>
          Daftar Akun Portal Pasim
        </Button>
      </div>
    </div>
  );
}

// FILE: client/src/components/common/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import useAuthStore from '../../store/useAuthStore';

export function AuthLoading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3">
      <CircularProgress />
      <span className="text-muted text-sm">Memeriksa sesi login...</span>
    </div>
  );
}

/**
 * Hanya untuk pengguna yang sudah login. Jika belum, diarahkan ke /login
 * dengan menyimpan halaman asal di `state.from`.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!isInitialized) return <AuthLoading />;

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}

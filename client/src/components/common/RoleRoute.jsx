// FILE: client/src/components/common/RoleRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { AuthLoading } from './ProtectedRoute';
import EmptyState from './EmptyState';
import Button from '@mui/material/Button';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { Link } from 'react-router-dom';

/**
 * Membatasi akses berdasarkan role, contoh: <RoleRoute roles={['admin', 'moderator']} />
 */
export default function RoleRoute({ roles = [], children }) {
  const location = useLocation();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!isInitialized) return <AuthLoading />;

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EmptyState
          icon={<LockRoundedIcon fontSize="large" />}
          title="Akses Ditolak"
          description="Anda tidak memiliki izin untuk membuka halaman ini."
          action={
            <Button component={Link} to="/" variant="contained">
              Kembali ke Beranda
            </Button>
          }
        />
      </div>
    );
  }

  return children ?? <Outlet />;
}

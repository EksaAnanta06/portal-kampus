// FILE: client/src/layouts/AdminLayout.jsx
import { useState, useEffect, Suspense } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import FlakyRoundedIcon from '@mui/icons-material/FlakyRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { BrandLogo } from '../components/common/BrandLogo';
import { ThemeToggleButton } from '../components/common/ThemeToggleButton';
import useAuthStore, { selectIsAdmin } from '../store/useAuthStore';
import { toast } from '../store/useThemeStore';
import { getOptimizedImageUrl } from '../hooks/useCloudinaryUrl';
import { ROLE_LABELS, getInitials } from '../utils/constants';

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-pasim text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore(selectIsAdmin);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Otomatis tutup drawer mobile jika rute halaman berpindah
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    toast.info('Anda telah keluar.');
    navigate('/');
  };

  const navItems = [
    { to: '/admin', end: true, label: 'Dashboard', icon: <DashboardRoundedIcon fontSize="small" /> },
    { to: '/admin/moderasi', label: 'Antrean Moderasi', icon: <FlakyRoundedIcon fontSize="small" /> },
    { to: '/admin/galeri', label: 'Kelola Foto & Angkatan', icon: <CollectionsBookmarkRoundedIcon fontSize="small" /> },
    { to: '/admin/materi', label: 'Kelola Materi & Kurikulum', icon: <MenuBookRoundedIcon fontSize="small" /> },
    ...(isAdmin
      ? [
          { to: '/admin/pengguna', label: 'Verifikasi NIM & User', icon: <HowToRegRoundedIcon fontSize="small" /> },
          { to: '/admin/info-kampus', label: 'Kelola Berita & Event', icon: <EditNoteRoundedIcon fontSize="small" /> },
        ]
      : []),
  ];

  const renderSidebar = (onClose) => (
    <div className="flex h-full flex-col p-4 bg-white dark:bg-navy-800">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="min-w-0 flex-1 truncate" onClick={onClose}>
          <BrandLogo />
        </div>
        {onClose && (
          <IconButton
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="Tutup Menu"
            className="shrink-0 !min-h-[44px] !min-w-[44px] !text-slate-600 hover:!text-slate-900 dark:!text-slate-300 dark:hover:!text-white hover:!bg-slate-100 dark:hover:!bg-slate-800 !p-2"
            size="medium"
          >
            <CloseRoundedIcon sx={{ fontSize: 24 }} />
          </IconButton>
        )}
      </div>

      <div className="my-3 flex items-center gap-3 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800/80">
        <Avatar src={getOptimizedImageUrl(user?.avatar_url, { width: 80, height: 80 })} sx={{ width: 40, height: 40 }}>
          {getInitials(user?.full_name)}
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{user?.full_name}</div>
          <div className="flex items-center gap-1.5">
            <Chip size="small" label={ROLE_LABELS[user?.role]} color={user?.role === 'admin' ? 'error' : 'warning'} />
          </div>
        </div>
      </div>

      <Divider className="!my-2" />

      <nav className="flex flex-col gap-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={navLinkClass}
            onClick={onClose}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-4">
        <Button component={Link} to="/" fullWidth variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={onClose}>
          Ke Portal Publik
        </Button>
        <Button fullWidth color="error" startIcon={<LogoutRoundedIcon />} onClick={handleLogout}>
          Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh overflow-x-clip bg-slate-100 dark:bg-navy">
      {/* Sidebar desktop */}
      <aside className="hidden w-72 shrink-0 border-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-navy-800">
        {renderSidebar(null)}
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          disableScrollLock
          transitionDuration={{ enter: 180, exit: 0 }}
          ModalProps={{ keepMounted: false, closeAfterTransition: false }}
          BackdropProps={{
            transitionDuration: { enter: 180, exit: 0 },
            className: '!bg-black/35 backdrop-blur-[1px]',
          }}
          PaperProps={{ className: 'w-72 max-w-[85vw] bg-white dark:bg-navy-800 shadow-2xl' }}
        >
          {renderSidebar(() => setMobileOpen(false))}
        </Drawer>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <AppBar position="sticky" color="inherit" elevation={0} className="!border-b !border-slate-200 !bg-white/95 backdrop-blur-md dark:!border-slate-800 dark:!bg-navy-800/95">
          <Toolbar className="gap-2 px-3 sm:px-6 !min-h-[58px] sm:!min-h-[64px]">
            <IconButton className="lg:!hidden !min-h-[44px] !min-w-[44px]" edge="start" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <MenuRoundedIcon />
            </IconButton>
            <span className="text-sm font-extrabold text-slate-900 sm:text-base dark:text-white truncate">
              Panel Pengelola PASIM
            </span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggleButton />
            </div>
          </Toolbar>
        </AppBar>

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Suspense
              fallback={
                <div className="flex min-h-[50vh] w-full items-center justify-center">
                  <CircularProgress color="primary" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

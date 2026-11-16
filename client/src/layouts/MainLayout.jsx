// FILE: client/src/layouts/MainLayout.jsx
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
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import { BrandLogo } from '../components/common/BrandLogo';
import { ThemeToggleButton } from '../components/common/ThemeToggleButton';
import GlobalSearchModal from '../components/common/GlobalSearchModal';
import NotificationMenu from '../components/common/NotificationMenu';
import MiniFocusTimerBar from '../components/focus/MiniFocusTimerBar';
import FocusCompletionDialog from '../components/focus/FocusCompletionDialog';
import useAuthStore, { selectIsStaff } from '../store/useAuthStore';
import useThemeStore, { toast } from '../store/useThemeStore';
import usePokerStore from '../store/usePokerStore';
import { getOptimizedImageUrl } from '../hooks/useCloudinaryUrl';
import { ASSIGNMENT_HUB_ROLES, ROLE_LABELS, getInitials } from '../utils/constants';
import { FEATURE_POKER_ENV_ENABLED } from '../api/poker.api';

const navLinkClass = (accent = 'pasim') => ({ isActive }) =>
  `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition duration-150 ${
    isActive
      ? accent === 'emerald'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 font-bold'
        : 'bg-pasim text-white shadow-md shadow-pasim/25 font-bold'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
  }`;

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const isStaff = useAuthStore(selectIsStaff);
  const canAccessFocusPlanner = Boolean(isLoggedIn && ASSIGNMENT_HUB_ROLES.includes(user?.role));
  const pokerEnabled = usePokerStore((s) => s.featureEnabled) && FEATURE_POKER_ENV_ENABLED;
  const logout = useAuthStore((s) => s.logout);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  // Keyboard shortcut Ctrl/Cmd + K untuk search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Otomatis tutup drawer menu mobile setiap kali rute atau tab berpindah
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const handleLogout = async () => {
    setUserMenuAnchor(null);
    setMobileOpen(false);
    await logout();
    toast.info('Anda telah keluar dari akun.');
    navigate('/');
  };

  const navItems = [
    { to: '/', end: true, label: 'Dashboard Utama', icon: <DashboardRoundedIcon fontSize="small" /> },
    { to: '/angkatan', label: 'Galeri Angkatan', icon: <CollectionsBookmarkRoundedIcon fontSize="small" /> },
    { to: '/pengumuman', label: 'Warta & Pengumuman', icon: <CampaignRoundedIcon fontSize="small" /> },
    { to: '/agenda', label: 'Agenda Kampus', icon: <EventAvailableRoundedIcon fontSize="small" /> },
    ...(isLoggedIn
      ? [
          { to: '/direktori', label: 'Direktori Mahasiswa & Alumni', icon: <GroupsRoundedIcon fontSize="small" /> },
          { to: '/akademik/materi', label: 'Materi Perpustakaan', icon: <MenuBookRoundedIcon fontSize="small" />, accent: 'emerald' },
        ]
      : []),
    ...(canAccessFocusPlanner
      ? [
          { to: '/rencana', label: 'Rencana & Tugas', icon: <TaskAltRoundedIcon fontSize="small" />, accent: 'emerald' },
          { to: '/fokus', label: 'Timer Fokus', icon: <TimerRoundedIcon fontSize="small" />, accent: 'emerald' },
        ]
      : []),
  ];

  const renderSidebar = (onClose) => (
    <div className="flex h-full flex-col p-4 bg-white dark:bg-navy-800">
      {/* Brand Header & Tombol Tutup X yang Responsif */}
      <div className="flex items-center justify-between gap-2 px-2 py-3">
        <div className="min-w-0 flex-1 truncate">
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

      <Divider className="!my-3 dark:!border-slate-800" />

      {/* User Quick Info Box (Jika Login) */}
      {isLoggedIn ? (
        <div className="my-2 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/70 p-3 border border-slate-200/80 dark:border-slate-700/60 dark:from-navy dark:to-navy-800">
          <Avatar
            src={getOptimizedImageUrl(user?.avatar_url, { width: 80, height: 80 })}
            sx={{ width: 42, height: 42, bgcolor: 'primary.main', fontSize: 14 }}
          >
            {getInitials(user?.full_name)}
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{user?.full_name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-muted truncate text-[11px] font-medium">{user?.nim}</span>
              <Chip
                size="small"
                label={ROLE_LABELS[user?.role] || user?.role}
                color={user?.role === 'admin' ? 'error' : user?.role === 'moderator' ? 'warning' : 'primary'}
                className="!text-[10px] !h-4"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="my-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3.5 text-center dark:border-slate-700/80 dark:bg-navy/50">
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-relaxed">
            Masuk untuk mengakses galeri eksklusif dan direktori alumni.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              component={Link}
              to="/login"
              variant="contained"
              size="small"
              fullWidth
              startIcon={<LoginRoundedIcon fontSize="small" />}
              onClick={onClose}
            >
              Masuk
            </Button>
            <Button
              component={Link}
              to="/register"
              variant="outlined"
              size="small"
              fullWidth
              onClick={onClose}
            >
              Daftar
            </Button>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <div className="mt-4 px-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Navigasi Portal</span>
      </div>

      <nav className="mt-2 flex flex-col gap-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              navLinkClass(item.accent)({
                isActive: isActive || (item.to === '/rencana' && location.pathname === '/tugas'),
              })
            }
            onClick={onClose}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        {isStaff && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                isActive
                  ? 'bg-amber-600 text-white shadow-md font-bold'
                  : 'text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40'
              }`
            }
            onClick={onClose}
          >
            <AdminPanelSettingsRoundedIcon fontSize="small" />
            <span>Panel Pengelola</span>
          </NavLink>
        )}

        {isLoggedIn && pokerEnabled && (
          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Hiburan / Game
            </span>
            <NavLink
              to="/poker"
              className={navLinkClass('emerald')}
              onClick={onClose}
            >
              <CasinoRoundedIcon fontSize="small" />
              <span>Capsa Banting (Big 2)</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* Footer Nav Sidebar */}
      <div className="mt-auto space-y-2 pt-6">
        {isLoggedIn ? (
          <>
            <Button
              component={Link}
              to="/profil"
              fullWidth
              variant="outlined"
              startIcon={<PersonRoundedIcon fontSize="small" />}
              onClick={onClose}
            >
              Profil Saya
            </Button>
            <Button
              fullWidth
              color="error"
              startIcon={<LogoutRoundedIcon fontSize="small" />}
              onClick={handleLogout}
            >
              Keluar
            </Button>
          </>
        ) : null}

        <div className="pt-2 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} UNAS PASIM Bandung
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh overflow-x-clip bg-slate-50 dark:bg-navy">
      {/* 1. SIDEBAR DESKTOP (Dashboard Sidebar) */}
      <aside className="hidden w-72 shrink-0 border-0 border-r border-slate-200/90 bg-white lg:block dark:border-slate-800 dark:bg-navy-800">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          {renderSidebar(null)}
        </div>
      </aside>

      {/* 2. DRAWER MOBILE */}
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

      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header Bar */}
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          className="!border-b !border-slate-200/90 !bg-white/95 backdrop-blur-md dark:!border-slate-800 dark:!bg-navy-800/95 z-20"
        >
          <Toolbar className="gap-2 px-3 sm:px-6 !min-h-[58px] sm:!min-h-[64px]">
            <IconButton
              className="lg:!hidden !min-h-[44px] !min-w-[44px]"
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka Menu"
            >
              <MenuRoundedIcon />
            </IconButton>

            {/* Quick Global Search Bar */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs sm:text-sm text-slate-500 transition hover:border-pasim-300 ml-1 sm:ml-4 flex-1 max-w-[200px] sm:max-w-sm dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400"
            >
              <SearchRoundedIcon fontSize="small" />
              <span className="truncate hidden sm:inline">Cari foto, agenda, nama sivitas...</span>
              <span className="sm:hidden text-xs truncate">Cari di portal...</span>
              <kbd className="ml-auto hidden rounded border border-slate-300 px-1.5 py-0.5 text-[10px] md:inline dark:border-slate-600">
                Ctrl K
              </kbd>
            </button>

            {/* Top Right Actions */}
            <div className="flex items-center gap-0.5 sm:gap-2">
              <ThemeToggleButton />

              {isLoggedIn ? (
                <>
                  <NotificationMenu />
                  <Tooltip title="Akun saya">
                    <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} className="!p-1">
                      <Avatar
                        src={getOptimizedImageUrl(user?.avatar_url, { width: 80, height: 80 })}
                        alt={user?.full_name}
                        sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 11 }}
                      >
                        {getInitials(user?.full_name)}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={() => setUserMenuAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    PaperProps={{ className: 'min-w-[240px] !rounded-2xl mt-2' }}
                  >
                    <div className="px-4 pb-3 pt-2">
                      <div className="truncate font-bold text-sm">{user?.full_name}</div>
                      <div className="text-muted truncate text-xs">
                        {user?.nim} · {ROLE_LABELS[user?.role] || user?.role}
                      </div>
                    </div>
                    <Divider />
                    <MenuItem
                      onClick={() => {
                        setUserMenuAnchor(null);
                        navigate('/profil');
                      }}
                    >
                      <ListItemIcon>
                        <PersonRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      Profil Saya
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setUserMenuAnchor(null);
                        navigate('/akademik/materi');
                      }}
                    >
                      <ListItemIcon>
                        <MenuBookRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      Materi Perpustakaan
                    </MenuItem>
                    {canAccessFocusPlanner && (
                      <MenuItem
                        onClick={() => {
                          setUserMenuAnchor(null);
                          navigate('/rencana');
                        }}
                      >
                        <ListItemIcon>
                          <TaskAltRoundedIcon fontSize="small" />
                        </ListItemIcon>
                        Rencana & Tugas
                      </MenuItem>
                    )}
                    {canAccessFocusPlanner && (
                      <MenuItem
                        onClick={() => {
                          setUserMenuAnchor(null);
                          navigate('/fokus');
                        }}
                      >
                        <ListItemIcon>
                          <TimerRoundedIcon fontSize="small" />
                        </ListItemIcon>
                        Timer Fokus
                      </MenuItem>
                    )}
                    {isStaff && (
                      <MenuItem
                        onClick={() => {
                          setUserMenuAnchor(null);
                          navigate('/admin');
                        }}
                      >
                        <ListItemIcon>
                          <AdminPanelSettingsRoundedIcon fontSize="small" />
                        </ListItemIcon>
                        Panel Pengelola
                      </MenuItem>
                    )}
                    <Divider />
                    <MenuItem onClick={handleLogout} className="!text-red-600">
                      <ListItemIcon>
                        <LogoutRoundedIcon fontSize="small" className="text-red-600" />
                      </ListItemIcon>
                      Keluar
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <Button component={Link} to="/login" size="small" color="inherit" className="!text-xs sm:!text-sm !px-2">
                    Masuk
                  </Button>
                </div>
              )}
            </div>
          </Toolbar>
        </AppBar>

        {/* Dashboard Main View */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16 w-full max-w-full overflow-x-hidden">
          <div className="mx-auto max-w-7xl w-full min-w-0">
            <Suspense
              fallback={
                <div className="flex min-h-[50vh] w-full items-center justify-center">
                  <CircularProgress color="success" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>

        {/* 4. MOBILE BOTTOM NAVIGATION (Khusus Tampilan Smartphone) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-lg px-1.5 sm:px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-navy-800/95 shadow-lg">
          <div className="flex items-center justify-around gap-0.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                  isActive
                    ? 'text-pasim dark:text-pasim-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`
              }
            >
              <DashboardRoundedIcon sx={{ fontSize: 20 }} />
              <span>Beranda</span>
            </NavLink>

            <NavLink
              to="/angkatan"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                  isActive
                    ? 'text-pasim dark:text-pasim-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`
              }
            >
              <CollectionsBookmarkRoundedIcon sx={{ fontSize: 20 }} />
              <span>Galeri</span>
            </NavLink>

            {isLoggedIn && (
              <NavLink
                to="/akademik/materi"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`
                }
              >
                <MenuBookRoundedIcon sx={{ fontSize: 20 }} />
                <span>Materi</span>
              </NavLink>
            )}

            {!canAccessFocusPlanner && (
              <>
                <NavLink
                  to="/pengumuman"
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                      isActive
                        ? 'text-pasim dark:text-pasim-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`
                  }
                >
                  <CampaignRoundedIcon sx={{ fontSize: 20 }} />
                  <span>Warta</span>
                </NavLink>

                <NavLink
                  to="/agenda"
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                      isActive
                        ? 'text-pasim dark:text-pasim-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`
                  }
                >
                  <EventAvailableRoundedIcon sx={{ fontSize: 20 }} />
                  <span>Agenda</span>
                </NavLink>
              </>
            )}

            {canAccessFocusPlanner && (
              <NavLink
                to="/rencana"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                    isActive || location.pathname === '/tugas'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`
                }
              >
                <TaskAltRoundedIcon sx={{ fontSize: 20 }} />
                <span>Rencana</span>
              </NavLink>
            )}

            {canAccessFocusPlanner && (
              <NavLink
                to="/fokus"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`
                }
              >
                <TimerRoundedIcon sx={{ fontSize: 20 }} />
                <span>Fokus</span>
              </NavLink>
            )}

            {!isLoggedIn && (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] text-[10px] font-bold py-1 px-1.5 sm:px-2 rounded-lg transition ${
                    isActive
                      ? 'text-pasim dark:text-pasim-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`
                }
              >
                <LoginRoundedIcon sx={{ fontSize: 20 }} />
                <span>Masuk</span>
              </NavLink>
            )}
          </div>
        </div>
      </div>

      <MiniFocusTimerBar />
      <FocusCompletionDialog />
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

// FILE: client/src/components/common/Navbar.jsx
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import useAuthStore, { selectIsStaff } from '../../store/useAuthStore';
import useThemeStore, { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { ROLE_LABELS, getInitials } from '../../utils/constants';
import GlobalSearchModal from './GlobalSearchModal';
import NotificationMenu from './NotificationMenu';

const NAV_LINKS = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/angkatan', label: 'Galeri Angkatan' },
  { to: '/pengumuman', label: 'Pengumuman' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/direktori', label: 'Direktori' },
];

export function BrandLogo({ compact = false, light = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src="/logo-pasim.png"
        alt="Logo UNAS PASIM"
        className="h-10 w-10 object-contain drop-shadow-sm transition-transform hover:scale-105"
      />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className={`text-[15px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
            Portal Kampus
          </span>
          <span className={`text-[11px] font-bold tracking-wider ${light ? 'text-pasim-100' : 'text-pasim dark:text-pasim-300'}`}>
            UNAS PASIM BANDUNG
          </span>
        </span>
      )}
    </Link>
  );
}

export function ThemeToggleButton() {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  return (
    <Tooltip title={mode === 'dark' ? 'Mode Terang' : 'Mode Gelap'}>
      <IconButton onClick={toggleMode} color="inherit" aria-label="Ganti tema">
        {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    </Tooltip>
  );
}

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-pasim-50 text-pasim dark:bg-pasim-900/40 dark:text-pasim-200'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const isStaff = useAuthStore(selectIsStaff);
  const logout = useAuthStore((s) => s.logout);

  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Shortcut Ctrl/Cmd + K untuk pencarian global
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

  const handleLogout = async () => {
    setUserMenuAnchor(null);
    setDrawerOpen(false);
    await logout();
    toast.info('Anda telah keluar dari akun.');
    navigate('/');
  };

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        className={`!border-b !border-solid transition-all ${
          scrolled
            ? '!border-slate-200 !bg-white/85 backdrop-blur-md dark:!border-slate-800 dark:!bg-navy/85'
            : '!border-transparent !bg-white dark:!bg-navy'
        }`}
      >
        <Toolbar className="container-page !min-h-[68px] gap-2">
          <IconButton className="lg:!hidden" edge="start" onClick={() => setDrawerOpen(true)} aria-label="Menu">
            <MenuRoundedIcon />
          </IconButton>

          <BrandLogo />

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden cursor-pointer items-center gap-2 rounded-xl border border-solid border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition hover:border-pasim-300 md:flex dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
            >
              <SearchRoundedIcon fontSize="small" />
              <span>Cari...</span>
              <kbd className="ml-4 rounded border border-solid border-slate-300 px-1.5 text-[10px] dark:border-slate-600">Ctrl K</kbd>
            </button>
            <IconButton className="md:!hidden" onClick={() => setSearchOpen(true)} aria-label="Cari">
              <SearchRoundedIcon />
            </IconButton>

            <ThemeToggleButton />

            {isLoggedIn ? (
              <>
                <NotificationMenu />
                <Tooltip title="Akun saya">
                  <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} className="!ml-1 !p-1">
                    <Avatar
                      src={getOptimizedImageUrl(user?.avatar_url, { width: 80, height: 80 })}
                      alt={user?.full_name}
                      sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}
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
                    <div className="truncate font-bold">{user?.full_name}</div>
                    <div className="text-muted truncate text-xs">
                      {user?.nim} · {ROLE_LABELS[user?.role]}
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
                  {isStaff && (
                    <MenuItem
                      onClick={() => {
                        setUserMenuAnchor(null);
                        navigate('/admin');
                      }}
                    >
                      <ListItemIcon>
                        <DashboardRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      Panel Admin
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
              <div className="ml-1 hidden items-center gap-2 sm:flex">
                <Button component={Link} to="/login" color="inherit">
                  Masuk
                </Button>
                <Button component={Link} to="/register" variant="contained">
                  Daftar
                </Button>
              </div>
            )}
          </div>
        </Toolbar>
      </AppBar>

      {/* ---------- Drawer mobile ---------- */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ className: 'w-[290px]' }}>
        <div className="flex items-center justify-between px-4 py-4">
          <BrandLogo />
          <IconButton onClick={() => setDrawerOpen(false)}>
            <CloseRoundedIcon />
          </IconButton>
        </div>
        <Divider />
        <nav className="flex flex-col gap-1 p-3">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass} onClick={() => setDrawerOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          {isStaff && (
            <NavLink to="/admin" className={navLinkClass} onClick={() => setDrawerOpen(false)}>
              Panel Admin
            </NavLink>
          )}
        </nav>
        <div className="mt-auto p-4">
          {isLoggedIn ? (
            <Button fullWidth variant="outlined" color="error" startIcon={<LogoutRoundedIcon />} onClick={handleLogout}>
              Keluar
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button component={Link} to="/login" variant="outlined" onClick={() => setDrawerOpen(false)}>
                Masuk
              </Button>
              <Button component={Link} to="/register" variant="contained" onClick={() => setDrawerOpen(false)}>
                Daftar Akun
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

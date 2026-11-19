// FILE: client/src/App.jsx
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleRoute from './components/common/RoleRoute';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import useAuthStore from './store/useAuthStore';
import { ASSIGNMENT_HUB_ROLES } from './utils/constants';
import { registerPortalServiceWorker } from './utils/pushNotifications';
import UpdateBanner from './components/pwa/UpdateBanner';
import InstallPromptBanner from './components/pwa/InstallPromptBanner';
import { syncStatusBarTheme, initBackButtonListener } from './platform';

// Halaman di-lazy-load agar bundle awal kecil
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotResetPasswordPage = lazy(() => import('./pages/auth/ForgotResetPasswordPage'));
const loadAngkatanListPage = () => import('./pages/gallery/AngkatanListPage');
const AngkatanListPage = lazy(loadAngkatanListPage);
const AngkatanDetailPage = lazy(() => import('./pages/gallery/AngkatanDetailPage'));
const AnnouncementsPage = lazy(() => import('./pages/campus/AnnouncementsPage'));
const EventsPage = lazy(() => import('./pages/campus/EventsPage'));
const DirectoryPage = lazy(() => import('./pages/campus/DirectoryPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const ModerationQueuePage = lazy(() => import('./pages/admin/ModerationQueuePage'));
const ManageGalleryPage = lazy(() => import('./pages/admin/ManageGalleryPage'));
const UserVerificationPage = lazy(() => import('./pages/admin/UserVerificationPage'));
const ManageCampusInfoPage = lazy(() => import('./pages/admin/ManageCampusInfoPage'));
const ManageMaterialsPage = lazy(() => import('./pages/admin/ManageMaterialsPage'));
const loadMaterialsLibraryPage = () => import('./pages/academic/MaterialsLibraryPage');
const MaterialsLibraryPage = lazy(loadMaterialsLibraryPage);
const CourseMaterialsPage = lazy(() => import('./pages/academic/CourseMaterialsPage'));
const MaterialDetailPage = lazy(() => import('./pages/academic/MaterialDetailPage'));
const loadFocusTimerPage = () => import('./pages/focus/FocusTimerPage');
const FocusTimerPage = lazy(loadFocusTimerPage);
const loadStudyPlannerPage = () => import('./pages/focus/StudyPlannerPage');
const StudyPlannerPage = lazy(loadStudyPlannerPage);
const PokerLobbyPage = lazy(() => import('./pages/poker/PokerLobbyPage'));
const PokerRoomPage = lazy(() => import('./pages/poker/PokerRoomPage'));
const PokerComponentPreviewPage = import.meta.env.DEV
  ? lazy(() => import('./pages/poker/PokerComponentPreviewPage'))
  : null;
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <CircularProgress color="primary" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth);
  const location = useLocation();
  const navigate = useNavigate();

  // Inisialisasi platform native (status bar & back button)
  useEffect(() => {
    syncStatusBarTheme('dark', '#0f172a');
    const cleanupBack = initBackButtonListener({
      navigate,
      getCurrentPath: () => window.location.pathname,
    });
    return () => {
      cleanupBack();
    };
  }, [navigate]);

  // Pulihkan sesi dari cookie refresh token saat aplikasi dibuka & preload rute utama saat idle
  useEffect(() => {
    initAuth();
    registerPortalServiceWorker().catch(() => {});

    // Pastikan di lingkungan native Capacitor tidak ada service worker lama yang membekukan asset WebView
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.Capacitor?.isNativePlatform()) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      }).catch(() => {});
    }

    const preloadRoutes = () => {
      Promise.allSettled([
        loadMaterialsLibraryPage(),
        loadStudyPlannerPage(),
        loadFocusTimerPage(),
        loadAngkatanListPage(),
      ]);
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preloadRoutes, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timerId = window.setTimeout(preloadRoutes, 1200);
    return () => window.clearTimeout(timerId);
  }, [initAuth]);

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <ScrollToTop />
      <UpdateBanner />
      <InstallPromptBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ---------- Halaman publik & member ---------- */}
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="angkatan" element={<AngkatanListPage />} />
            <Route path="angkatan/:yearOrId" element={<AngkatanDetailPage />} />
            <Route path="pengumuman" element={<AnnouncementsPage />} />
            <Route path="pengumuman/:slugOrId" element={<AnnouncementsPage />} />
            <Route path="agenda" element={<EventsPage />} />
            {import.meta.env.DEV && PokerComponentPreviewPage && (
              <Route path="poker/_preview" element={<PokerComponentPreviewPage />} />
            )}

            <Route element={<ProtectedRoute />}>
              <Route path="direktori" element={<DirectoryPage />} />
              <Route path="profil" element={<ProfilePage />} />
              {/* Modul A: Perpustakaan Materi (Peer-to-Peer) */}
              <Route path="akademik/materi" element={<MaterialsLibraryPage />} />
              <Route path="akademik/materi/matkul/:courseId" element={<CourseMaterialsPage />} />
              <Route path="akademik/materi/detail/:materialId" element={<MaterialDetailPage />} />

              {/* Penjadwalan Tugas, Timer Fokus & Statistik (Hak Akses Assignment Hub) */}
              <Route element={<RoleRoute roles={ASSIGNMENT_HUB_ROLES} />}>
                <Route path="rencana" element={<StudyPlannerPage />} />
                <Route path="tugas" element={<StudyPlannerPage />} />
                <Route path="fokus" element={<FocusTimerPage />} />
              </Route>

              {/* Hiburan Kampus: Poker Chip Virtual (Tanpa Uang Asli) */}
              <Route path="poker" element={<PokerLobbyPage />} />
              <Route path="poker/:roomId" element={<PokerRoomPage />} />
            </Route>
          </Route>

          {/* ---------- Autentikasi ---------- */}
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="lupa-password" element={<ForgotResetPasswordPage />} />
            <Route path="reset-password" element={<ForgotResetPasswordPage />} />
          </Route>

          {/* ---------- Panel Admin & Moderator ---------- */}
          <Route element={<RoleRoute roles={['admin', 'moderator']} />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="moderasi" element={<ModerationQueuePage />} />
              <Route path="galeri" element={<ManageGalleryPage />} />
              <Route path="materi" element={<ManageMaterialsPage />} />
              <Route element={<RoleRoute roles={['admin']} />}>
                <Route path="pengguna" element={<UserVerificationPage />} />
                <Route path="info-kampus" element={<ManageCampusInfoPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

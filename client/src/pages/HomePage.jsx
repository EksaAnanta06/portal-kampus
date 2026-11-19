// FILE: client/src/pages/HomePage.jsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { campusApi } from '../api/campus.api';
import { galleryApi } from '../api/gallery.api';
import { FEATURE_POKER_ENV_ENABLED } from '../api/poker.api';
import PhotoMasonryGrid from '../components/gallery/PhotoMasonryGrid';
import AngkatanCard from '../components/gallery/AngkatanCard';
import NextSessionWidget from '../components/focus/NextSessionWidget';
import useAuthStore from '../store/useAuthStore';
import usePokerStore from '../store/usePokerStore';
import { CATEGORY_LABELS } from '../utils/constants';
import { formatShortDate, formatEventRange, getDateParts } from '../utils/formatDate';
import { getOptimizedImageUrl } from '../hooks/useCloudinaryUrl';

const PhotoLightboxModal = lazy(() => import('../components/gallery/PhotoLightboxModal'));
const EditAngkatanDialog = lazy(() => import('../components/gallery/EditAngkatanDialog'));
const UploadPhotoDialog = lazy(() => import('../components/gallery/UploadPhotoDialog'));
const EventDetailModal = lazy(() => import('../components/campus/EventDetailModal'));

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const pokerEnabled = usePokerStore((s) => s.featureEnabled) && FEATURE_POKER_ENV_ENABLED;

  const [data, setData] = useState({
    stats: null,
    recentPhotos: [],
    announcements: [],
    events: [],
  });
  const [angkatanList, setAngkatanList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lightbox & Edit State
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [angkatanToEdit, setAngkatanToEdit] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleEventUpdated = (patch) => {
    setData((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === patch.id ? { ...e, ...patch } : e)),
    }));
    setSelectedEvent((curr) => (curr && curr.id === patch.id ? { ...curr, ...patch } : curr));
  };

  useEffect(() => {
    let active = true;
    Promise.all([campusApi.getHome(), galleryApi.getAngkatanList()])
      .then(([homeRes, angkatanRes]) => {
        if (!active) return;
        if (homeRes?.data && typeof homeRes.data === 'object') {
          setData(homeRes.data);
        }
        if (Array.isArray(angkatanRes?.data)) {
          setAngkatanList(angkatanRes.data);
        }
      })
      .catch((err) => {
        console.error('Gagal memuat beranda dashboard:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleOpenPhoto = (photo) => {
    setSelectedPhotoId(photo.id);
    setLightboxOpen(true);
  };

  const handlePhotoUpdated = (updatedPatch) => {
    setData((prev) => ({
      ...prev,
      recentPhotos: prev.recentPhotos.map((p) =>
        p.id === updatedPatch.id ? { ...p, ...updatedPatch } : p
      ),
    }));
  };

  const handlePhotoDeleted = (deletedId) => {
    setData((prev) => ({
      ...prev,
      recentPhotos: prev.recentPhotos.filter((p) => p.id !== deletedId),
    }));
  };

  const stats = data?.stats && typeof data.stats === 'object' ? data.stats : {};
  const announcements = Array.isArray(data?.announcements) ? data.announcements : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const recentPhotos = Array.isArray(data?.recentPhotos) ? data.recentPhotos : [];

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden">
      {/* 1. DASHBOARD WELCOME BANNER (DENGAN LOGO RESMI PASIM & LAYOUT SESUAI PREVIEW SCREENSHOT) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-pasim-800 via-pasim-900 to-navy p-5 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          {/* Main Info Box */}
          <div className="flex flex-col gap-3.5 sm:gap-4 min-w-0 flex-1">
            {/* Baris 1: Logo Kampus (Kiri) & Badges (Kanan bertumpuk) */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2.5 backdrop-blur-md shadow-lg border border-white/20">
                <img
                  src="/logo-pasim.png"
                  alt="Logo UNAS PASIM"
                  className="h-full w-full object-contain filter drop-shadow"
                />
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gold-light border border-gold/40 backdrop-blur-sm">
                  Universitas Nasional Pasim
                </span>
                {isLoggedIn && (
                  <Chip
                    size="small"
                    icon={<VerifiedUserRoundedIcon className="!text-white !text-sm" />}
                    label="Terverifikasi"
                    className="!bg-emerald-600/90 !text-white !text-[10px] sm:!text-[11px] !font-bold !h-6"
                  />
                )}
              </div>
            </div>

            {/* Baris 2: Heading & Deskripsi (Full width di bawah logo pada mobile) */}
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white m-0">
                {isLoggedIn ? `Selamat Datang, ${user?.full_name?.split(' ')[0] || 'Sivitas'}!` : 'Portal Kampus Pasim'}
              </h1>
              <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-300 leading-relaxed mb-0">
                Pusat dokumentasi kenangan angkatan, warta akademik terpadu, dan direktori jejaring sivitas akademika Kampus Dakota Bandung.
              </p>
            </div>
          </div>

          {/* Quick Action Button (Bertumpuk full width di mobile, inline di desktop) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
            {isLoggedIn ? (
              <Button
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<CloudUploadRoundedIcon />}
                onClick={() => setUploadDialogOpen(true)}
                className="!font-bold shadow-lg shadow-gold/20 !w-full sm:!w-auto !py-2.5 sm:!py-2"
              >
                Unggah Foto Kenangan
              </Button>
            ) : (
              <Button
                component={Link}
                to="/login"
                variant="contained"
                color="secondary"
                size="large"
                className="!font-bold shadow-lg !w-full sm:!w-auto !py-2.5 sm:!py-2"
              >
                Masuk ke Akun
              </Button>
            )}
            <Button
              component={Link}
              to="/angkatan"
              variant="outlined"
              size="large"
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
              startIcon={<CollectionsBookmarkRoundedIcon />}
              className="!w-full sm:!w-auto !py-2.5 sm:!py-2 hover:!bg-white/10"
            >
              Semua Angkatan
            </Button>
            {isLoggedIn && pokerEnabled && (
              <Button
                component={Link}
                to="/poker"
                variant="outlined"
                size="large"
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
                startIcon={<CasinoRoundedIcon />}
                className="!w-full sm:!w-auto !py-2.5 sm:!py-2 hover:!bg-white/10"
              >
                Capsa Banting
              </Button>
            )}
          </div>
        </div>

        {/* Ambient Glows */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-64 w-64 rounded-full bg-pasim-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
      </div>

      {/* Widget Beranda Tunggal: Sesi Fokus / Jadwal Terdekat */}
      <NextSessionWidget />

      {/* 2. STATISTIC METRIC CARDS */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <div className="card-surface p-3.5 sm:p-5 flex items-center justify-between">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">Galeri Angkatan</span>
            <div className="mt-0.5 sm:mt-1 text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? <Skeleton width={40} /> : stats.total_angkatan || 0}
            </div>
            <span className="text-[10px] sm:text-[11px] text-pasim dark:text-pasim-300 font-medium truncate block">Tahun 2022 – 2025</span>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-pasim-50 text-pasim dark:bg-pasim-900/30 dark:text-pasim-300">
            <CollectionsBookmarkRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
          </div>
        </div>

        <div className="card-surface p-3.5 sm:p-5 flex items-center justify-between">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">Foto Kenangan</span>
            <div className="mt-0.5 sm:mt-1 text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? <Skeleton width={40} /> : stats.approved_photos || 0}
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate block">Terverifikasi</span>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
            <PhotoLibraryRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
          </div>
        </div>

        <div className="card-surface p-3.5 sm:p-5 flex items-center justify-between">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">Mahasiswa</span>
            <div className="mt-0.5 sm:mt-1 text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? <Skeleton width={40} /> : stats.total_mahasiswa || 0}
            </div>
            <span className="text-[10px] sm:text-[11px] text-sky-600 dark:text-sky-400 font-medium truncate block">Sivitas PASIM</span>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
            <GroupsRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
          </div>
        </div>

        <div className="card-surface p-3.5 sm:p-5 flex items-center justify-between">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate block">Alumni</span>
            <div className="mt-0.5 sm:mt-1 text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? <Skeleton width={40} /> : stats.total_alumni || 0}
            </div>
            <span className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate block">Jejaring Karir</span>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
            <SchoolRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
          </div>
        </div>
      </div>

      {/* 3. GRID 2 KOLOM: WARTA & AGENDA KAMPUS */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3 w-full max-w-full overflow-hidden">
        {/* Kolom Kiri: Warta & Pengumuman (2 Kolom Lebar) */}
        <div className="lg:col-span-2 space-y-3.5 sm:space-y-4 min-w-0 w-full">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CampaignRoundedIcon className="text-pasim dark:text-pasim-300 shrink-0" />
              <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 dark:text-white m-0 truncate">
                Warta & Pengumuman Resmi
              </h2>
            </div>
            <Button
              component={Link}
              to="/pengumuman"
              size="small"
              className="shrink-0 whitespace-nowrap !text-xs sm:!text-sm"
              endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
            >
              Lihat Semua
            </Button>
          </div>

          <div className="card-surface divide-y divide-slate-100 p-1 sm:p-2 dark:divide-slate-800 overflow-hidden">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 sm:p-4 space-y-2">
                  <Skeleton width="30%" />
                  <Skeleton width="80%" height={24} />
                  <Skeleton width="60%" />
                </div>
              ))
            ) : announcements.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">Belum ada pengumuman kampus.</div>
            ) : (
              announcements.map((item) => (
                <Link
                  key={item.id}
                  to={`/pengumuman/${item.slug}`}
                  className="group block p-3.5 sm:p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl min-w-0"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-xs min-w-0">
                    <Chip
                      size="small"
                      label={CATEGORY_LABELS[item.category] || item.category}
                      className="!font-semibold"
                    />
                    {Boolean(item.is_pinned) && (
                      <Chip size="small" label="Penting" color="error" variant="outlined" />
                    )}
                    <span className="text-muted ml-auto text-[11px] sm:text-xs shrink-0">{formatShortDate(item.published_at)}</span>
                  </div>
                  <h3 className="mb-1 mt-2 text-sm sm:text-base font-bold text-slate-900 transition group-hover:text-pasim dark:text-white dark:group-hover:text-pasim-300 break-words line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-muted line-clamp-2 text-xs sm:text-sm leading-relaxed mb-0 break-words">
                    {item.excerpt}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Kolom Kanan: Agenda Kampus Mendatang (1 Kolom) */}
        <div className="space-y-3.5 sm:space-y-4 min-w-0 w-full">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <EventAvailableRoundedIcon className="text-pasim dark:text-pasim-300 shrink-0" />
              <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 dark:text-white m-0 truncate">
                Agenda Kampus
              </h2>
            </div>
            <Button
              component={Link}
              to="/agenda"
              size="small"
              className="shrink-0 whitespace-nowrap !text-xs sm:!text-sm"
              endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
            >
              Kalender
            </Button>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-surface p-3.5 sm:p-4 flex gap-3">
                  <Skeleton variant="rectangular" width={48} height={48} />
                  <div className="flex-1 space-y-1">
                    <Skeleton width="70%" />
                    <Skeleton width="40%" />
                  </div>
                </div>
              ))
            ) : events.length === 0 ? (
              <div className="card-surface p-6 text-center text-sm text-slate-400">Tidak ada agenda mendatang.</div>
            ) : (
              events.map((ev) => {
                const dateParts = getDateParts(ev.start_date);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedEvent(ev)}
                    className="w-full text-left card-surface flex items-start gap-3 p-3.5 sm:p-4 transition hover:border-pasim-300 min-w-0 overflow-hidden cursor-pointer group hover:shadow-md"
                    title="Klik untuk melihat detail agenda kegiatan"
                  >
                    {ev.banner_url ? (
                      <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                        <img
                          src={getOptimizedImageUrl(ev.banner_url, { width: 120, height: 120, crop: 'fill' })}
                          alt={ev.title}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-pasim-50 text-pasim dark:bg-pasim-900/30 dark:text-pasim-300">
                        <span className="text-[10px] font-bold uppercase leading-none">{dateParts.month}</span>
                        <span className="text-base sm:text-lg font-black leading-none">{dateParts.day}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="m-0 line-clamp-1 text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-pasim dark:group-hover:text-pasim-300 transition break-words">
                        {ev.title}
                      </h3>
                      <div className="text-muted mt-1 flex items-center gap-1 text-[11px] sm:text-xs">
                        <LocationOnRoundedIcon sx={{ fontSize: 13 }} className="shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
                        <span className="font-semibold text-pasim dark:text-pasim-300 truncate">
                          {formatEventRange(ev.start_date, ev.end_date)}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400 shrink-0">
                          {Number(ev.like_count) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <FavoriteRoundedIcon sx={{ fontSize: 11 }} className="text-red-500" />
                              {ev.like_count}
                            </span>
                          )}
                          {Number(ev.comment_count) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 11 }} />
                              {ev.comment_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. KOLEKSI GALERI PER ANGKATAN */}
      <div className="space-y-3.5 sm:space-y-4 min-w-0 w-full">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CollectionsBookmarkRoundedIcon className="text-pasim dark:text-pasim-300 shrink-0" />
            <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 dark:text-white m-0 truncate">
              Galeri Kenangan Per Angkatan
            </h2>
          </div>
          <Button
            component={Link}
            to="/angkatan"
            size="small"
            className="shrink-0 whitespace-nowrap !text-xs sm:!text-sm"
            endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
          >
            Lihat Semua
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card-surface overflow-hidden">
                  <Skeleton variant="rectangular" height={190} />
                  <div className="p-4 space-y-2">
                    <Skeleton width="40%" />
                    <Skeleton width="70%" />
                  </div>
                </div>
              ))
            : angkatanList.slice(0, 4).map((item) => (
                <AngkatanCard
                  key={item.id}
                  angkatan={item}
                  onEdit={(a) => setAngkatanToEdit(a)}
                />
              ))}
        </div>
      </div>

      {/* 5. FOTO TERBARU (MASONRY FEED) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhotoLibraryRoundedIcon className="text-pasim dark:text-pasim-300" />
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white m-0">
              Dokumentasi Foto Terbaru
            </h2>
          </div>
        </div>

        <PhotoMasonryGrid
          photos={recentPhotos}
          loading={loading}
          onPhotoClick={handleOpenPhoto}
          showAngkatan
        />
      </div>

      <Suspense fallback={null}>
        {/* Lightbox Modal */}
        {lightboxOpen && (
          <PhotoLightboxModal
            open={lightboxOpen}
            photoId={selectedPhotoId}
            photos={recentPhotos}
            onClose={() => setLightboxOpen(false)}
            onNavigate={(id) => setSelectedPhotoId(id)}
            onPhotoUpdated={handlePhotoUpdated}
            onPhotoDeleted={handlePhotoDeleted}
          />
        )}

        {/* Upload Dialog */}
        {uploadDialogOpen && angkatanList.length > 0 && (
          <UploadPhotoDialog
            open={uploadDialogOpen}
            onClose={() => setUploadDialogOpen(false)}
            angkatanList={angkatanList}
            onSuccess={async () => {
              try {
                const res = await campusApi.getHome();
                setData(res.data);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        )}

        {/* Edit Angkatan Dialog (Admin & Moderator) */}
        {Boolean(angkatanToEdit) && (
          <EditAngkatanDialog
            open={Boolean(angkatanToEdit)}
            angkatan={angkatanToEdit}
            onClose={() => setAngkatanToEdit(null)}
            onSuccess={async () => {
              try {
                const [angkatanRes, homeRes] = await Promise.all([
                  galleryApi.getAngkatanList(),
                  campusApi.getHome(),
                ]);
                setAngkatanList(angkatanRes.data || []);
                setData(homeRes.data);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        )}

        {/* Modal Detail Agenda & Komentar */}
        {Boolean(selectedEvent) && (
          <EventDetailModal
            open={Boolean(selectedEvent)}
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onEventUpdated={handleEventUpdated}
          />
        )}
      </Suspense>
    </div>
  );
}

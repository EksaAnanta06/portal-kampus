// FILE: client/src/pages/campus/EventsPage.jsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { campusApi } from '../../api/campus.api';
import { getErrorMessage } from '../../api/axiosInstance';
import EmptyState from '../../components/common/EmptyState';
import EventDetailModal from '../../components/campus/EventDetailModal';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { formatEventRange, getDateParts, isPast } from '../../utils/formatDate';

export default function EventsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken && s.user));

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  // Modal Detail & Komentar
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    campusApi
      .getEvents({ upcoming: upcomingOnly })
      .then((res) => setEvents(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [upcomingOnly]);

  const handleOpenDetail = (ev) => {
    setSelectedEvent(ev);
    setDetailModalOpen(true);
  };

  const handleEventUpdated = (patch) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === patch.id ? { ...e, ...patch } : e))
    );
    setSelectedEvent((curr) => (curr && curr.id === patch.id ? { ...curr, ...patch } : curr));
  };

  const handleCardLike = async (e, ev) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      toast.info('Silakan masuk terlebih dahulu untuk menyukai agenda.');
      navigate('/login', { state: { from: location } });
      return;
    }

    const wasLiked = Boolean(Number(ev.is_liked_by_me));
    const newCount = Number(ev.like_count || 0) + (wasLiked ? -1 : 1);

    // Optimistic
    handleEventUpdated({ id: ev.id, is_liked_by_me: wasLiked ? 0 : 1, like_count: newCount });

    try {
      const res = await campusApi.toggleEventLike(ev.id);
      handleEventUpdated({
        id: ev.id,
        is_liked_by_me: res.data.liked ? 1 : 0,
        like_count: res.data.like_count,
      });
    } catch (err) {
      handleEventUpdated({ id: ev.id, is_liked_by_me: wasLiked ? 1 : 0, like_count: Number(ev.like_count || 0) });
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
            Agenda Sivitas Akademika
          </span>
          <h1 className="section-title mt-1">Kegiatan & Acara Kampus</h1>
          <p className="text-muted mb-0 mt-2 text-sm max-w-xl">
            Ikuti berbagai seminar nasional, workshop teknologi, bazaar kewirausahaan, pameran seni, dan reuni akbar UNAS PASIM.
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <Button
            fullWidth
            variant={upcomingOnly ? 'contained' : 'outlined'}
            onClick={() => setUpcomingOnly(!upcomingOnly)}
            startIcon={<CalendarMonthRoundedIcon />}
          >
            {upcomingOnly ? 'Hanya Agenda Mendatang' : 'Tampilkan Semua Agenda'}
          </Button>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-surface p-4 sm:p-6 space-y-3">
                <Skeleton width="30%" />
                <Skeleton height={28} />
                <Skeleton count={2} />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="Tidak Ada Agenda"
            description={upcomingOnly ? 'Belum ada agenda mendatang dalam waktu dekat.' : 'Belum ada data kegiatan kampus.'}
          />
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => {
              const dateParts = getDateParts(ev.start_date);
              const past = isPast(ev.end_date);
              const isLiked = Boolean(Number(ev.is_liked_by_me));

              return (
                <div
                  key={ev.id}
                  className={`card-surface group flex flex-col p-6 transition duration-300 hover:shadow-xl hover:border-pasim-400/50 ${
                    past ? 'opacity-85' : ''
                  }`}
                >
                  {/* Poster / Banner Acara jika ada */}
                  {ev.banner_url && (
                    <div
                      onClick={() => handleOpenDetail(ev)}
                      className="relative -mx-6 -mt-6 mb-4 h-44 cursor-pointer overflow-hidden rounded-t-2xl bg-slate-900"
                    >
                      <img
                        src={getOptimizedImageUrl(ev.banner_url, { width: 800, crop: 'limit' })}
                        alt={ev.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute top-3 right-3">
                        {past ? (
                          <Chip size="small" label="Selesai" className="shadow" />
                        ) : (
                          <Chip size="small" label="Mendatang" color="success" className="font-bold shadow" />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Badge Tanggal Kalender */}
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-pasim-50 to-pasim-100 text-pasim shadow-inner dark:from-pasim-900/40 dark:to-pasim-800/40 dark:text-pasim-200">
                      <span className="text-[11px] font-bold uppercase leading-none">{dateParts.month}</span>
                      <span className="text-2xl font-black leading-none">{dateParts.day}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      {!ev.banner_url && (
                        <div className="flex items-center gap-2">
                          {past ? (
                            <Chip size="small" label="Selesai" />
                          ) : (
                            <Chip size="small" label="Mendatang" color="success" />
                          )}
                        </div>
                      )}
                      <h3
                        onClick={() => handleOpenDetail(ev)}
                        className="mb-0 mt-1 text-lg font-bold text-slate-900 hover:text-pasim cursor-pointer dark:text-white dark:hover:text-pasim-300 transition"
                      >
                        {ev.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-muted line-clamp-3 text-sm leading-relaxed my-4">
                    {ev.description}
                  </p>

                  <div className="mt-auto space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <CalendarMonthRoundedIcon sx={{ fontSize: 16 }} className="text-pasim dark:text-pasim-300 shrink-0" />
                      <span className="font-semibold">{formatEventRange(ev.start_date, ev.end_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LocationOnRoundedIcon sx={{ fontSize: 16 }} className="text-pasim dark:text-pasim-300 shrink-0" />
                      <span className="truncate">{ev.location}</span>
                    </div>
                    {ev.organizer && (
                      <div className="flex items-center gap-2">
                        <GroupsRoundedIcon sx={{ fontSize: 16 }} className="text-pasim dark:text-pasim-300 shrink-0" />
                        <span className="truncate">Oleh {ev.organizer}</span>
                      </div>
                    )}
                  </div>

                  {ev.registration_link && !past && (
                    <div className="mt-3 pt-1">
                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        href={ev.registration_link}
                        target="_blank"
                        rel="noreferrer"
                        endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                      >
                        Daftar / Registrasi
                      </Button>
                    </div>
                  )}

                  {/* Bar Interaksi: Like & Komentar */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex items-center gap-1">
                      <IconButton
                        size="small"
                        onClick={(e) => handleCardLike(e, ev)}
                        color={isLiked ? 'error' : 'default'}
                        title={isLiked ? 'Batal menyukai' : 'Sukai agenda'}
                        className="!p-1.5"
                      >
                        {isLiked ? (
                          <FavoriteRoundedIcon className="text-red-500 text-lg" />
                        ) : (
                          <FavoriteBorderRoundedIcon className="text-lg" />
                        )}
                      </IconButton>
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(ev)}
                        className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 hover:text-pasim dark:text-slate-200"
                        title="Klik untuk melihat detail & yang menyukai"
                      >
                        {Number(ev.like_count) || 0} Suka
                      </button>
                    </div>

                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      startIcon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleOpenDetail(ev)}
                      sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600 }}
                    >
                      {Number(ev.comment_count) || 0} Komentar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Detail & Komentar Agenda */}
      <EventDetailModal
        open={detailModalOpen}
        event={selectedEvent}
        onClose={() => setDetailModalOpen(false)}
        onEventUpdated={handleEventUpdated}
      />
    </div>
  );
}

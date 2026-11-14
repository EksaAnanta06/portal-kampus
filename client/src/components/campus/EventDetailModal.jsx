// FILE: client/src/components/campus/EventDetailModal.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { campusApi } from '../../api/campus.api';
import { getErrorMessage } from '../../api/axiosInstance';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { ROLE_LABELS, STAFF_ROLES, getInitials } from '../../utils/constants';
import { formatEventRange, formatRelative, isPast } from '../../utils/formatDate';

export default function EventDetailModal({
  open,
  event,
  onClose,
  onEventUpdated,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const isStaff = Boolean(user && (STAFF_ROLES.includes(user.role) || user.role === 'admin'));

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Edit comment
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingEditComment, setSavingEditComment] = useState(false);

  // Likers Modal
  const [likersOpen, setLikersOpen] = useState(false);
  const [likersList, setLikersList] = useState([]);
  const [loadingLikers, setLoadingLikers] = useState(false);

  // Liking action
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!open || !event?.id) return;
    setLoadingComments(true);
    campusApi
      .getEventComments(event.id)
      .then((res) => setComments(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoadingComments(false));
  }, [open, event?.id]);

  if (!event) return null;

  const past = isPast(event.end_date);
  const isLiked = Boolean(Number(event.is_liked_by_me));

  const requireLogin = () => {
    toast.info('Silakan masuk terlebih dahulu untuk berinteraksi.');
    navigate('/login', { state: { from: location } });
  };

  const handleLike = async () => {
    if (!isLoggedIn) return requireLogin();
    if (liking) return;
    setLiking(true);
    const wasLiked = isLiked;
    const newCount = Number(event.like_count || 0) + (wasLiked ? -1 : 1);
    const patch = { id: event.id, is_liked_by_me: wasLiked ? 0 : 1, like_count: newCount };
    onEventUpdated?.(patch);

    try {
      const res = await campusApi.toggleEventLike(event.id);
      onEventUpdated?.({
        id: event.id,
        is_liked_by_me: res.data.liked ? 1 : 0,
        like_count: res.data.like_count,
      });
    } catch (err) {
      // Rollback
      onEventUpdated?.({
        id: event.id,
        is_liked_by_me: wasLiked ? 1 : 0,
        like_count: Number(event.like_count || 0),
      });
      toast.error(getErrorMessage(err));
    } finally {
      setLiking(false);
    }
  };

  const handleOpenLikers = async () => {
    setLikersOpen(true);
    setLoadingLikers(true);
    try {
      const res = await campusApi.getEventLikers(event.id);
      setLikersList(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingLikers(false);
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) return requireLogin();
    const content = commentText.trim();
    if (!content) return;
    setSendingComment(true);
    try {
      const res = await campusApi.addEventComment(event.id, content);
      setComments((prev) => [...prev, res.data]);
      setCommentText('');
      onEventUpdated?.({
        id: event.id,
        comment_count: Number(event.comment_count || 0) + 1,
      });
      toast.success('Komentar berhasil dikirim.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSendingComment(false);
    }
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = async (commentId) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) {
      toast.warning('Komentar tidak boleh kosong.');
      return;
    }
    setSavingEditComment(true);
    try {
      const res = await campusApi.updateEventComment(event.id, commentId, trimmed);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, content: res.data.content, updated_at: res.data.updated_at }
            : c
        )
      );
      setEditingCommentId(null);
      setEditingCommentText('');
      toast.success('Komentar berhasil diperbarui.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingEditComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await campusApi.deleteEventComment(event.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onEventUpdated?.({
        id: event.id,
        comment_count: Math.max(0, Number(event.comment_count || 1) - 1),
      });
      toast.success('Komentar dihapus.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        PaperProps={{
          className: '!rounded-2xl overflow-hidden max-h-[92vh]',
        }}
      >
        {/* Header Dialog */}
        <DialogTitle className="flex items-center justify-between !py-3 !px-5 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <CalendarMonthRoundedIcon className="text-pasim dark:text-pasim-300" fontSize="small" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              Detail Agenda & Diskusi
            </span>
          </div>
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent className="!p-0 overflow-y-auto">
          {/* Banner Image jika ada */}
          {event.banner_url ? (
            <div className="relative w-full aspect-video sm:aspect-[21/9] max-h-72 bg-slate-900 overflow-hidden">
              <img
                src={getOptimizedImageUrl(event.banner_url, { width: 1200, crop: 'limit' })}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                <Chip
                  size="small"
                  label={past ? 'Selesai' : 'Mendatang'}
                  color={past ? 'default' : 'success'}
                  className="font-bold shadow"
                />
                {event.organizer && (
                  <span className="text-xs text-white/90 drop-shadow font-medium">
                    Oleh: {event.organizer}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="h-4 bg-gradient-to-r from-pasim-600 via-pasim-500 to-amber-500" />
          )}

          <div className="p-5 sm:p-6 space-y-5">
            {/* Judul & Info Utama */}
            <div>
              {!event.banner_url && (
                <div className="mb-2">
                  <Chip
                    size="small"
                    label={past ? 'Selesai' : 'Mendatang'}
                    color={past ? 'default' : 'success'}
                    className="font-bold"
                  />
                </div>
              )}
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0 leading-snug">
                {event.title}
              </h2>
            </div>

            {/* Meta Info: Tanggal, Lokasi, Penyelenggara */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <CalendarMonthRoundedIcon className="text-pasim dark:text-pasim-300 shrink-0" fontSize="small" />
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Waktu Pelaksanaan</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatEventRange(event.start_date, event.end_date)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <LocationOnRoundedIcon className="text-pasim dark:text-pasim-300 shrink-0" fontSize="small" />
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Tempat / Lokasi</div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {event.location}
                  </div>
                </div>
              </div>

              {event.organizer && (
                <div className="flex items-center gap-2.5 sm:col-span-2">
                  <GroupsRoundedIcon className="text-pasim dark:text-pasim-300 shrink-0" fontSize="small" />
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Penyelenggara Kegiatan</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {event.organizer}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Deskripsi Lengkap */}
            <div>
              <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                Deskripsi Kegiatan
              </h4>
              <p className="m-0 whitespace-pre-line text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-200">
                {event.description}
              </p>
            </div>

            {/* Tombol Pendaftaran */}
            {event.registration_link && !past && (
              <div className="pt-1">
                <Button
                  fullWidth
                  variant="contained"
                  href={event.registration_link}
                  target="_blank"
                  rel="noreferrer"
                  endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                  sx={{ py: 1.2, fontWeight: 700 }}
                >
                  Buka Tautan Pendaftaran / Info Registrasi
                </Button>
              </div>
            )}

            {/* Bar Interaksi: Like & Komentar */}
            <div className="flex items-center justify-between border-0 border-y border-slate-200 py-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <IconButton
                  onClick={handleLike}
                  disabled={liking}
                  size="small"
                  color={isLiked ? 'error' : 'default'}
                  title={isLiked ? 'Batal menyukai' : 'Sukai agenda ini'}
                  className="!p-1.5"
                >
                  {isLiked ? (
                    <FavoriteRoundedIcon className="text-red-500 text-xl" />
                  ) : (
                    <FavoriteBorderRoundedIcon className="text-xl" />
                  )}
                </IconButton>
                <button
                  type="button"
                  onClick={handleOpenLikers}
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs sm:text-sm font-semibold text-slate-700 hover:text-pasim hover:underline dark:text-slate-200 dark:hover:text-pasim-300"
                  title="Klik untuk melihat siapa saja yang menyukai agenda ini"
                >
                  {Number(event.like_count) || 0} Suka
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 pr-2">
                <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                <span>{comments.length} Komentar</span>
              </div>
            </div>

            {/* Form Tulis Komentar */}
            <form onSubmit={handleSendComment} className="flex items-end gap-2 pt-1">
              {isLoggedIn ? (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Tulis tanggapan atau pertanyaan tentang kegiatan ini..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                    multiline
                    maxRows={4}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) handleSendComment(e);
                    }}
                  />
                  <IconButton
                    type="submit"
                    color="primary"
                    disabled={!commentText.trim() || sendingComment}
                    className="!p-2.5"
                  >
                    {sendingComment ? <CircularProgress size={20} /> : <SendRoundedIcon />}
                  </IconButton>
                </>
              ) : (
                <Button fullWidth variant="outlined" onClick={requireLogin}>
                  Masuk untuk menyukai & berkomentar pada agenda ini
                </Button>
              )}
            </form>

            {/* Daftar Komentar */}
            <div className="space-y-4 pt-2">
              {loadingComments && comments.length === 0 && (
                <>
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                </>
              )}
              {!loadingComments && comments.length === 0 && (
                <p className="text-muted m-0 py-6 text-center text-sm">
                  Belum ada komentar untuk agenda ini. Mulai diskusinya sekarang!
                </p>
              )}
              {comments.map((c) => {
                const isCommentOwner = user && user.id === c.user_id;
                const canDelete = isCommentOwner || isStaff;
                const canEdit = isCommentOwner || isStaff;
                const isEditingThis = editingCommentId === c.id;
                const wasEdited =
                  c.updated_at &&
                  new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 1000;

                return (
                  <div key={c.id} className="group flex gap-3">
                    <Avatar
                      src={getOptimizedImageUrl(c.user_avatar, { width: 64, height: 64 })}
                      sx={{ width: 34, height: 34, fontSize: 13 }}
                    >
                      {getInitials(c.user_name)}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      {isEditingThis ? (
                        <div className="rounded-2xl border border-pasim/40 bg-slate-50 p-2.5 dark:bg-slate-800/80">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                            Edit Komentar:
                          </div>
                          <TextField
                            fullWidth
                            multiline
                            size="small"
                            rows={2}
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value.slice(0, 500))}
                            disabled={savingEditComment}
                            sx={{
                              '& .MuiInputBase-root': { fontSize: '0.875rem' },
                            }}
                          />
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <Button
                              size="small"
                              color="inherit"
                              onClick={handleCancelEditComment}
                              disabled={savingEditComment}
                              sx={{ textTransform: 'none', fontSize: 12 }}
                            >
                              Batal
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleSaveEditComment(c.id)}
                              disabled={savingEditComment || !editingCommentText.trim()}
                              sx={{ textTransform: 'none', fontSize: 12 }}
                            >
                              {savingEditComment ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="rounded-2xl bg-slate-100 px-3.5 py-2.5 dark:bg-slate-800">
                            <div className="flex flex-wrap items-center gap-x-2 text-sm">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {c.user_name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {ROLE_LABELS[c.user_role] || c.user_role}
                                {c.user_angkatan ? ` ${c.user_angkatan}` : ''}
                              </span>
                            </div>
                            <p className="m-0 mt-1 whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-200">
                              {c.content}
                            </p>
                          </div>
                          <div className="mt-1 flex items-center gap-3 pl-3 text-[11px] text-slate-400">
                            <span>{formatRelative(c.created_at)}</span>
                            {wasEdited && <span className="italic text-slate-400">(diedit)</span>}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleStartEditComment(c)}
                                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-slate-400 hover:text-pasim dark:hover:text-pasim-300"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-slate-400 hover:text-red-500"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Likers (Daftar Orang yang Menyukai Agenda) */}
      <Dialog
        open={likersOpen}
        onClose={() => setLikersOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ className: '!rounded-2xl' }}
      >
        <DialogTitle className="flex items-center justify-between !py-3 !px-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FavoriteRoundedIcon className="text-red-500" fontSize="small" />
            <span className="text-base font-bold">Disukai oleh</span>
          </div>
          <IconButton size="small" onClick={() => setLikersOpen(false)}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent className="!p-0 max-h-[380px] overflow-y-auto">
          {loadingLikers ? (
            <div className="flex items-center justify-center p-8">
              <CircularProgress size={30} />
            </div>
          ) : likersList.length === 0 ? (
            <p className="text-muted m-0 p-6 text-center text-sm">Belum ada yang menyukai agenda ini.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {likersList.map((liker) => (
                <div
                  key={liker.id || liker.user_id}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={getOptimizedImageUrl(liker.user_avatar, { width: 64, height: 64 })}
                      sx={{ width: 38, height: 38, fontSize: 14 }}
                    >
                      {getInitials(liker.user_name)}
                    </Avatar>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {liker.user_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span className="font-medium text-pasim dark:text-pasim-300">
                          {ROLE_LABELS[liker.user_role] || liker.user_role}
                        </span>
                        {liker.user_angkatan && <span>• Angkatan {liker.user_angkatan}</span>}
                        {liker.user_prodi && (
                          <span className="truncate max-w-[120px]">• {liker.user_prodi}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                    {formatRelative(liker.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

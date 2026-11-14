// FILE: client/src/components/gallery/PhotoLightboxModal.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { galleryApi } from '../../api/gallery.api';
import { getErrorMessage } from '../../api/axiosInstance';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import {
  PHOTO_STATUS_COLORS,
  PHOTO_STATUS_LABELS,
  REPORT_REASONS,
  ROLE_LABELS,
  STAFF_ROLES,
  getInitials,
} from '../../utils/constants';
import { formatDate, formatRelative } from '../../utils/formatDate';
import ConfirmDialog from '../common/ConfirmDialog';

/**
 * Props:
 *  - open, photoId, onClose
 *  - photos: daftar foto di grid (untuk navigasi prev/next)
 *  - onNavigate(id)
 *  - onPhotoUpdated(photoPartial)  -> sinkronkan grid (like, caption, status)
 *  - onPhotoDeleted(id)
 */
export default function PhotoLightboxModal({
  open,
  photoId,
  photos = [],
  onClose,
  onNavigate,
  onPhotoUpdated,
  onPhotoDeleted,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));

  const [photo, setPhoto] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [liking, setLiking] = useState(false);

  // State untuk melihat daftar orang yang menyukai foto
  const [likersOpen, setLikersOpen] = useState(false);
  const [likersList, setLikersList] = useState([]);
  const [loadingLikers, setLoadingLikers] = useState(false);

  // State untuk edit komentar
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingEditComment, setSavingEditComment] = useState(false);

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ caption: '', tags: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'inappropriate', description: '' });
  const [reporting, setReporting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [moderating, setModerating] = useState(false);

  const currentIndex = useMemo(() => photos.findIndex((p) => p.id === photoId), [photos, photoId]);
  const prevPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;
  const nextPhoto = currentIndex >= 0 && currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null;

  const isOwner = Boolean(user && photo && user.id === photo.uploader_id);
  const canManage = isOwner || isStaff;

  const loadDetail = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setImgLoaded(false);
    try {
      const res = await galleryApi.getPhotoDetail(id);
      setPhoto(res.data.photo);
      setComments(res.data.comments || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat detail foto.'));
      setPhoto(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && photoId) {
      // Tampilkan data dari grid lebih dulu (optimistic) sambil memuat detail
      const fromList = photos.find((p) => p.id === photoId);
      if (fromList) setPhoto(fromList);
      loadDetail(photoId);
    }
    if (!open) {
      setPhoto(null);
      setComments([]);
      setCommentText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photoId, loadDetail]);

  // Navigasi keyboard
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowLeft' && prevPhoto) onNavigate?.(prevPhoto.id);
      if (e.key === 'ArrowRight' && nextPhoto) onNavigate?.(nextPhoto.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, prevPhoto, nextPhoto, onNavigate]);

  const requireLogin = () => {
    toast.info('Silakan masuk terlebih dahulu untuk berinteraksi.');
    navigate('/login', { state: { from: location } });
  };

  const handleLike = async () => {
    if (!isLoggedIn) return requireLogin();
    if (!photo || liking) return;
    setLiking(true);
    const wasLiked = Boolean(Number(photo.is_liked_by_me));
    // Optimistic update
    setPhoto((p) => ({ ...p, is_liked_by_me: wasLiked ? 0 : 1, like_count: Number(p.like_count) + (wasLiked ? -1 : 1) }));
    try {
      const res = await galleryApi.toggleLike(photo.id);
      const patch = { id: photo.id, is_liked_by_me: res.data.liked ? 1 : 0, like_count: res.data.like_count };
      setPhoto((p) => ({ ...p, ...patch }));
      onPhotoUpdated?.(patch);
    } catch (err) {
      setPhoto((p) => ({ ...p, is_liked_by_me: wasLiked ? 1 : 0, like_count: Number(p.like_count) + (wasLiked ? 1 : -1) }));
      toast.error(getErrorMessage(err));
    } finally {
      setLiking(false);
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) return requireLogin();
    const content = commentText.trim();
    if (!content) return;
    setSendingComment(true);
    try {
      const res = await galleryApi.addComment(photo.id, content);
      setComments((prev) => [...prev, res.data]);
      setCommentText('');
      const patch = { id: photo.id, comment_count: Number(photo.comment_count || 0) + 1 };
      setPhoto((p) => ({ ...p, ...patch }));
      onPhotoUpdated?.(patch);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSendingComment(false);
    }
  };

  const handleOpenLikers = async () => {
    if (!photo?.id) return;
    setLikersOpen(true);
    setLoadingLikers(true);
    try {
      const res = await galleryApi.getPhotoLikers(photo.id);
      setLikersList(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingLikers(false);
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
    if (trimmed.length > 500) {
      toast.warning('Komentar maksimal 500 karakter.');
      return;
    }
    setSavingEditComment(true);
    try {
      const res = await galleryApi.updateComment(photo.id, commentId, trimmed);
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
      await galleryApi.deleteComment(photo.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      const patch = { id: photo.id, comment_count: Math.max(0, Number(photo.comment_count || 1) - 1) };
      setPhoto((p) => ({ ...p, ...patch }));
      onPhotoUpdated?.(patch);
      toast.success('Komentar dihapus.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openEdit = () => {
    setMenuAnchor(null);
    setEditForm({ caption: photo.caption || '', tags: photo.tags || '' });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editForm.caption.trim().length < 3) {
      toast.warning('Caption minimal 3 karakter.');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await galleryApi.updatePhoto(photo.id, {
        caption: editForm.caption.trim(),
        tags: editForm.tags.trim() || null,
      });
      setPhoto((p) => ({ ...p, ...res.data }));
      onPhotoUpdated?.({ id: photo.id, caption: res.data.caption, tags: res.data.tags });
      setEditOpen(false);
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await galleryApi.deletePhoto(photo.id);
      toast.success('Foto berhasil dihapus.');
      setDeleteOpen(false);
      onPhotoDeleted?.(photo.id);
      onClose?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleReport = async () => {
    setReporting(true);
    try {
      const res = await galleryApi.reportPhoto(photo.id, {
        reason: reportForm.reason,
        description: reportForm.description.trim() || null,
      });
      toast.success(res.message);
      setReportOpen(false);
      setReportForm({ reason: 'inappropriate', description: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReporting(false);
    }
  };

  const handleModerate = async (status) => {
    setModerating(true);
    try {
      const res = await galleryApi.moderatePhoto(photo.id, {
        status,
        rejection_reason: status === 'rejected' ? rejectReason.trim() || null : null,
      });
      setPhoto((p) => ({ ...p, ...res.data }));
      onPhotoUpdated?.({ id: photo.id, status: res.data.status, rejection_reason: res.data.rejection_reason });
      setRejectOpen(false);
      setRejectReason('');
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setModerating(false);
    }
  };

  const tags = (photo?.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const isLiked = Boolean(Number(photo?.is_liked_by_me));

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={isMobile}
        maxWidth={false}
        PaperProps={{
          className: `overflow-hidden ${isMobile ? '!rounded-none' : '!m-4 h-[92dvh] w-[min(1280px,96vw)] !max-w-none !rounded-2xl'}`,
        }}
      >
        <div className="flex h-full min-h-0 flex-col md:flex-row">
          {/* ---------- Area gambar ---------- */}
          <div className="relative flex min-h-[42dvh] flex-1 items-center justify-center bg-black md:min-h-0">
            {photo?.url && (
              <img
                key={photo.id}
                src={getOptimizedImageUrl(photo.url, { width: 1600, crop: 'limit' })}
                alt={photo.caption}
                onLoad={() => setImgLoaded(true)}
                className={`max-h-[48dvh] w-auto max-w-full object-contain transition-opacity duration-300 md:max-h-full ${
                  imgLoaded ? 'opacity-100' : 'opacity-40'
                }`}
              />
            )}
            {!imgLoaded && (
              <CircularProgress className="!absolute" sx={{ color: 'rgba(255,255,255,0.7)' }} />
            )}

            <IconButton
              onClick={onClose}
              className="!absolute left-3 top-3 !min-h-[44px] !min-w-[44px] !bg-black/50 !text-white hover:!bg-black/70"
              aria-label="Tutup"
            >
              <CloseRoundedIcon />
            </IconButton>

            {prevPhoto && (
              <IconButton
                onClick={() => onNavigate?.(prevPhoto.id)}
                className="!absolute left-3 top-1/2 -translate-y-1/2 !min-h-[44px] !min-w-[44px] !bg-black/50 !text-white hover:!bg-black/70"
                aria-label="Sebelumnya"
              >
                <ChevronLeftRoundedIcon fontSize="large" />
              </IconButton>
            )}
            {nextPhoto && (
              <IconButton
                onClick={() => onNavigate?.(nextPhoto.id)}
                className="!absolute right-3 top-1/2 -translate-y-1/2 !min-h-[44px] !min-w-[44px] !bg-black/50 !text-white hover:!bg-black/70"
                aria-label="Berikutnya"
              >
                <ChevronRightRoundedIcon fontSize="large" />
              </IconButton>
            )}

            {photos.length > 1 && currentIndex >= 0 && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                {currentIndex + 1} / {photos.length}
              </span>
            )}
          </div>

          {/* ---------- Panel info & komentar ---------- */}
          <aside className="flex w-full flex-1 min-h-0 flex-col bg-white md:flex-initial md:w-[400px] md:shrink-0 dark:bg-navy-800">
            {error && !photo ? (
              <div className="p-6 text-center text-sm text-red-600">{error}</div>
            ) : (
              <>
                {/* Header uploader */}
                <div className="flex items-center gap-3 border-0 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                  {photo ? (
                    <Avatar src={getOptimizedImageUrl(photo.uploader_avatar, { width: 80, height: 80 })} sx={{ width: 42, height: 42 }}>
                      {getInitials(photo.uploader_name)}
                    </Avatar>
                  ) : (
                    <Skeleton variant="circular" width={42} height={42} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{photo?.uploader_name || <Skeleton width={120} />}</div>
                    <div className="text-muted truncate text-xs">
                      {photo?.uploader_prodi}
                      {photo?.created_at ? ` · ${formatRelative(photo.created_at)}` : ''}
                    </div>
                  </div>
                  {photo && isLoggedIn && (
                    <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="Opsi foto">
                      <MoreVertRoundedIcon />
                    </IconButton>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {photo?.status && photo.status !== 'approved' && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
                      <Chip size="small" label={PHOTO_STATUS_LABELS[photo.status]} color={PHOTO_STATUS_COLORS[photo.status]} />
                      {photo.rejection_reason && (
                        <p className="mb-0 mt-2 text-slate-700 dark:text-slate-300">Alasan: {photo.rejection_reason}</p>
                      )}
                      {isStaff && photo.status === 'pending' && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckRoundedIcon />}
                            disabled={moderating}
                            onClick={() => handleModerate('approved')}
                          >
                            Setujui
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<BlockRoundedIcon />}
                            disabled={moderating}
                            onClick={() => setRejectOpen(true)}
                          >
                            Tolak
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="m-0 whitespace-pre-line text-[15px] leading-relaxed">
                    {photo?.caption || (
                      <>
                        <Skeleton variant="text" />
                        <Skeleton variant="text" width="75%" />
                      </>
                    )}
                  </div>

                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <span key={t} className="rounded-full bg-pasim-50 px-2.5 py-0.5 text-xs font-semibold text-pasim dark:bg-pasim-900/30 dark:text-pasim-200">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {photo && (
                    <div className="text-muted mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <Link
                        to={`/angkatan/${photo.angkatan_year}`}
                        onClick={onClose}
                        className="flex items-center gap-1 font-semibold text-pasim hover:underline dark:text-pasim-300"
                      >
                        Angkatan {photo.angkatan_year}
                        <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                      </Link>
                      {photo.album_name && <span>Album: {photo.album_name}</span>}
                      {photo.taken_date && (
                        <span className="flex items-center gap-1">
                          <EventRoundedIcon sx={{ fontSize: 13 }} /> {formatDate(photo.taken_date)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Aksi */}
                  {photo?.status === 'approved' && (
                    <div className="mt-4 flex items-center justify-between border-0 border-y border-slate-200 py-2 dark:border-slate-700">
                      <div className="flex items-center gap-1.5">
                        <IconButton
                          onClick={handleLike}
                          disabled={liking}
                          size="small"
                          color={isLiked ? 'error' : 'default'}
                          title={isLiked ? 'Batal menyukai' : 'Sukai foto'}
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
                          className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 hover:text-pasim hover:underline dark:text-slate-200 dark:hover:text-pasim-300"
                          title="Klik untuk melihat siapa saja yang menyukai foto ini"
                        >
                          {Number(photo.like_count) || 0} Suka
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pr-2">
                        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        <span>{comments.length} Komentar</span>
                      </div>
                    </div>
                  )}

                  {/* Komentar */}
                  <div className="mt-4 space-y-4">
                    {loading && comments.length === 0 && (
                      <>
                        <Skeleton height={48} />
                        <Skeleton height={48} />
                      </>
                    )}
                    {!loading && comments.length === 0 && photo?.status === 'approved' && (
                      <p className="text-muted m-0 py-4 text-center text-sm">Belum ada komentar. Jadilah yang pertama!</p>
                    )}
                    {comments.map((c) => {
                      const isCommentOwner = user && user.id === c.user_id;
                      const canDelete = isCommentOwner || isStaff;
                      const canEdit = isCommentOwner || isStaff;
                      const isEditingThis = editingCommentId === c.id;
                      const wasEdited = c.updated_at && new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 1000;

                      return (
                        <div key={c.id} className="group flex gap-3">
                          <Avatar
                            src={getOptimizedImageUrl(c.user_avatar, { width: 64, height: 64 })}
                            sx={{ width: 32, height: 32, fontSize: 13 }}
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
                                <div className="rounded-2xl bg-slate-100 px-3.5 py-2 dark:bg-slate-800">
                                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                                    <span className="font-bold">{c.user_name}</span>
                                    <span className="text-[11px] text-slate-400">
                                      {ROLE_LABELS[c.user_role]}
                                      {c.user_angkatan ? ` ${c.user_angkatan}` : ''}
                                    </span>
                                  </div>
                                  <p className="m-0 mt-0.5 whitespace-pre-line break-words text-sm">{c.content}</p>
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

                {/* Form komentar */}
                {photo?.status === 'approved' && (
                  <form onSubmit={handleSendComment} className="flex items-end gap-2 border-0 border-t border-slate-200 p-3 dark:border-slate-700">
                    {isLoggedIn ? (
                      <>
                        <TextField
                          placeholder="Tulis komentar..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                          multiline
                          maxRows={4}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) handleSendComment(e);
                          }}
                        />
                        <IconButton type="submit" color="primary" disabled={!commentText.trim() || sendingComment}>
                          {sendingComment ? <CircularProgress size={20} /> : <SendRoundedIcon />}
                        </IconButton>
                      </>
                    ) : (
                      <Button fullWidth variant="outlined" onClick={requireLogin}>
                        Masuk untuk menyukai & berkomentar
                      </Button>
                    )}
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      </Dialog>

      {/* ---------- Menu opsi ---------- */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {canManage && (
          <MenuItem onClick={openEdit}>
            <ListItemIcon>
              <EditRoundedIcon fontSize="small" />
            </ListItemIcon>
            Edit caption & tag
          </MenuItem>
        )}
        {canManage && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDeleteOpen(true);
            }}
            className="!text-red-600"
          >
            <ListItemIcon>
              <DeleteOutlineRoundedIcon fontSize="small" className="text-red-600" />
            </ListItemIcon>
            Hapus foto
          </MenuItem>
        )}
        {!isOwner && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setReportOpen(true);
            }}
          >
            <ListItemIcon>
              <FlagRoundedIcon fontSize="small" />
            </ListItemIcon>
            Laporkan foto
          </MenuItem>
        )}
      </Menu>

      {/* ---------- Dialog edit ---------- */}
      <Dialog open={editOpen} onClose={() => !savingEdit && setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Informasi Foto</DialogTitle>
        <DialogContent className="!pt-2">
          <div className="flex flex-col gap-4 pt-1">
            <TextField
              label="Caption"
              multiline
              minRows={3}
              value={editForm.caption}
              onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value.slice(0, 1000) }))}
              helperText={`${editForm.caption.length}/1000`}
            />
            <TextField
              label="Tag (pisahkan dengan koma)"
              value={editForm.tags}
              onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value.slice(0, 255) }))}
              placeholder="ospek, informatika, 2024"
            />
          </div>
        </DialogContent>
        <DialogActions className="!px-6 !pb-5">
          <Button color="inherit" onClick={() => setEditOpen(false)} disabled={savingEdit}>
            Batal
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={savingEdit}>
            {savingEdit ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- Dialog laporan ---------- */}
      <Dialog open={reportOpen} onClose={() => !reporting && setReportOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Laporkan Foto</DialogTitle>
        <DialogContent>
          <p className="text-muted mt-0 text-sm">Laporan Anda akan ditinjau oleh tim moderator kampus.</p>
          <div className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                  reportForm.reason === r.value
                    ? 'border-pasim bg-pasim-50 dark:border-pasim-400 dark:bg-pasim-900/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reportForm.reason === r.value}
                  onChange={() => setReportForm((f) => ({ ...f, reason: r.value }))}
                  className="accent-pasim"
                />
                {r.label}
              </label>
            ))}
            <TextField
              className="!mt-2"
              label="Keterangan tambahan (opsional)"
              multiline
              minRows={2}
              value={reportForm.description}
              onChange={(e) => setReportForm((f) => ({ ...f, description: e.target.value.slice(0, 500) }))}
            />
          </div>
        </DialogContent>
        <DialogActions className="!px-6 !pb-5">
          <Button color="inherit" onClick={() => setReportOpen(false)} disabled={reporting}>
            Batal
          </Button>
          <Button variant="contained" color="error" onClick={handleReport} disabled={reporting}>
            {reporting ? 'Mengirim...' : 'Kirim Laporan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- Dialog tolak (moderasi) ---------- */}
      <Dialog open={rejectOpen} onClose={() => !moderating && setRejectOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Tolak Foto</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            className="!mt-2"
            label="Alasan penolakan"
            multiline
            minRows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value.slice(0, 255))}
            placeholder="Contoh: Foto buram / tidak sesuai angkatan"
          />
        </DialogContent>
        <DialogActions className="!px-6 !pb-5">
          <Button color="inherit" onClick={() => setRejectOpen(false)} disabled={moderating}>
            Batal
          </Button>
          <Button variant="contained" color="error" onClick={() => handleModerate('rejected')} disabled={moderating}>
            Tolak Foto
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Hapus foto ini?"
        message="Foto beserta like dan komentarnya akan dihapus permanen dari galeri dan Cloudinary."
        confirmText="Hapus Permanen"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />

      {/* ---------- Dialog Likers (Daftar Penyuka Foto) ---------- */}
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
            <p className="text-muted m-0 p-6 text-center text-sm">Belum ada yang menyukai foto ini.</p>
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
                        {liker.user_prodi && <span className="truncate max-w-[120px]">• {liker.user_prodi}</span>}
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

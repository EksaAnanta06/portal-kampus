// FILE: client/src/pages/academic/MaterialDetailPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import ReportMaterialModal from '../../components/academic/ReportMaterialModal';
import YoutubePlayer from '../../components/academic/YoutubePlayer';
import PdfViewerModal from '../../components/academic/PdfViewerModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  ALLOWED_DOC_ACCEPT,
  ALLOWED_DOC_EXTENSIONS,
  ALLOWED_DOC_MIMES,
  MATERIAL_STATUS_LABELS,
  MATERIAL_TYPE_LABELS,
  MAX_DOC_FILE_SIZE,
  MAX_DOC_FILE_SIZE_MB,
} from '../../utils/constants';
import { extractYoutubeVideoId } from '../../utils/youtube';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const MODERATION_DIALOG_TITLES = {
  approved: 'Setujui & Publikasikan Materi',
  rejected: 'Tolak Pengajuan Materi',
  takedown: 'Takedown Materi dari Publik',
};

export default function MaterialDetailPage() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [material, setMaterial] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [openReport, setOpenReport] = useState(false);
  const [openPdfModal, setOpenPdfModal] = useState(false);

  // Versioning Upload
  const [showVersionUpload, setShowVersionUpload] = useState(false);
  const [versionFile, setVersionFile] = useState(null);
  const [changelogNote, setChangelogNote] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Koleksi Bookmark
  const [collections, setCollections] = useState([]);
  const [bookmarkAnchorEl, setBookmarkAnchorEl] = useState(null);

  // Dialog konfirmasi & moderasi
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState(false);
  const [commentToDeleteId, setCommentToDeleteId] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [moderationDialog, setModerationDialog] = useState({ open: false, status: '', note: '' });
  const [submittingModeration, setSubmittingModeration] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const isOwner = material?.uploaded_by === user?.id;

  const fetchDetail = useCallback(async (signal) => {
    try {
      setLoading(true);
      const [res, cRes] = await Promise.all([
        materialApi.getMaterialDetail(materialId, signal ? { signal } : {}),
        materialApi.getComments(materialId, signal ? { signal } : {}),
      ]);
      if (signal?.aborted) return;
      setMaterial(res.data);
      setComments(cRes.data || []);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      toast.error(err.response?.data?.message || 'Gagal memuat materi.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [materialId]);

  const fetchCollections = useCallback(async (signal) => {
    try {
      const res = await materialApi.getUserCollections(signal ? { signal } : {});
      if (!signal?.aborted) setCollections(res.data || []);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setCollections([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    fetchCollections(controller.signal);
    return () => controller.abort();
  }, [fetchDetail, fetchCollections]);

  // Vote Bermanfaat
  const handleToggleVote = async () => {
    try {
      const res = await materialApi.toggleVote(materialId);
      setMaterial((prev) => ({
        ...prev,
        has_voted: res.data?.voted,
        helpful_votes: res.data?.voted
          ? (prev.helpful_votes || 0) + 1
          : Math.max(0, (prev.helpful_votes || 1) - 1),
      }));
      toast.success(res.message);
    } catch {
      toast.error('Gagal memberi vote.');
    }
  };

  // Bookmark ke Koleksi
  const handleSaveToCollection = async (collectionId) => {
    try {
      const res = await materialApi.toggleCollectionItem(collectionId, { materi_id: Number(materialId) });
      toast.success(res.message);
      setBookmarkAnchorEl(null);
      await fetchDetail();
    } catch {
      toast.error('Gagal menyimpan ke koleksi.');
    }
  };

  // Catat unduhan saat tautan berkas diklik
  const handleTrackDownload = () => {
    materialApi
      .recordDownload(materialId)
      .then((res) => {
        setMaterial((prev) =>
          prev
            ? {
                ...prev,
                download_count: res.data?.download_count ?? (prev.download_count || 0) + 1,
              }
            : prev
        );
      })
      .catch(() => {});
  };

  // Tambah Komentar
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setSubmittingComment(true);
      await materialApi.addComment(materialId, { konten: newComment.trim() });
      setNewComment('');
      const cRes = await materialApi.getComments(materialId);
      setComments(cRes.data || []);
      toast.success('Komentar berhasil dikirim.');
    } catch {
      toast.error('Gagal mengirim komentar.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Hapus Komentar
  const handleConfirmDeleteComment = async () => {
    if (!commentToDeleteId) return;
    try {
      setDeletingComment(true);
      await materialApi.deleteComment(commentToDeleteId);
      setComments((prev) => prev.filter((c) => c.id !== commentToDeleteId));
      setCommentToDeleteId(null);
      toast.success('Komentar dihapus.');
    } catch {
      toast.error('Gagal menghapus komentar.');
    } finally {
      setDeletingComment(false);
    }
  };

  // Validasi Berkas Revisi
  const handleVersionFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setVersionFile(null);
      return;
    }
    const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    const validExt = ALLOWED_DOC_EXTENSIONS.includes(ext);
    const validMime = !file.type || ALLOWED_DOC_MIMES.includes(file.type);
    if (!validExt || !validMime) {
      toast.warning('Format berkas revisi tidak didukung.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_DOC_FILE_SIZE) {
      toast.warning(`Ukuran berkas maksimal ${MAX_DOC_FILE_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }
    setVersionFile(file);
  };

  // Upload Versi Baru
  const handleUploadNewVersion = async (e) => {
    e.preventDefault();
    if (!versionFile) {
      toast.warning('Silakan pilih berkas revisi baru.');
      return;
    }
    try {
      setUploadingVersion(true);
      setUploadProgress(0);
      const data = new FormData();
      data.append('file', versionFile);
      data.append('changelog_note', changelogNote.trim());
      const res = await materialApi.uploadNewVersion(materialId, data, (pct) => setUploadProgress(pct));
      toast.success(res.message || 'Versi baru materi berhasil diunggah!');
      setShowVersionUpload(false);
      setVersionFile(null);
      setChangelogNote('');
      await fetchDetail();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah versi baru.');
    } finally {
      setUploadingVersion(false);
      setUploadProgress(0);
    }
  };

  // Moderasi ACC / Tolak / Takedown
  const handleOpenModeration = (status) => {
    setModerationDialog({ open: true, status, note: '' });
  };

  const handleSubmitModeration = async () => {
    const { status, note } = moderationDialog;
    if ((status === 'rejected' || status === 'takedown') && !note.trim()) {
      toast.warning('Mohon sertakan catatan alasan moderasi.');
      return;
    }
    try {
      setSubmittingModeration(true);
      await materialApi.moderateMaterial(materialId, { status, note: note.trim() });
      toast.success(`Status materi diubah menjadi ${MATERIAL_STATUS_LABELS[status] || status}.`);
      setModerationDialog({ open: false, status: '', note: '' });
      await fetchDetail();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses moderasi.');
    } finally {
      setSubmittingModeration(false);
    }
  };

  // Hapus Materi
  const handleConfirmDeleteMaterial = async () => {
    try {
      setDeletingMaterial(true);
      await materialApi.deleteMaterial(materialId);
      toast.success('Materi berhasil dihapus.');
      setConfirmDeleteMaterial(false);
      navigate(`/akademik/materi/matkul/${material.mata_kuliah_id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus materi.');
    } finally {
      setDeletingMaterial(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto min-h-dvh max-w-4xl px-4 py-8 space-y-4">
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto min-h-dvh max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Materi tidak ditemukan</h2>
        <Link to="/akademik/materi" className="mt-4 inline-block text-emerald-600 font-semibold underline">
          Kembali ke Perpustakaan
        </Link>
      </div>
    );
  }

  // Cari file PDF pertama untuk preview in-page
  const pdfFile = material.files?.find(
    (f) => f.file_format === 'pdf' || f.file_name?.toLowerCase().endsWith('.pdf')
  );
  const resolvedYoutubeId = material.youtube_video_id || extractYoutubeVideoId(material.youtube_url);
  const statusLabel = MATERIAL_STATUS_LABELS[material.status] || material.status?.toUpperCase();
  const typeLabel = MATERIAL_TYPE_LABELS[material.tipe_materi] || material.tipe_materi;

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      {/* Back Button */}
      <div className="mb-5">
        <Link
          to={`/akademik/materi/matkul/${material.mata_kuliah_id}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
          <span>Kembali ke Koleksi {material.mata_kuliah_kode}</span>
        </Link>
      </div>

      {/* Banner Moderasi Status */}
      {material.status !== 'approved' && (
        <div
          className={`mb-6 rounded-2xl p-4 border text-xs leading-relaxed ${
            material.status === 'pending'
              ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
              : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
          }`}
        >
          <strong>Status Materi: {statusLabel}</strong>
          {material.moderation_note && <p className="mt-1">Catatan: {material.moderation_note}</p>}
        </div>
      )}

      {/* Header Materi */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>
              {material.mata_kuliah_kode} - {material.mata_kuliah_nama} (Sem {material.semester_rekomendasi})
            </span>
          </div>

          <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {typeLabel}
          </span>
        </div>

        <h1 className="mt-3 text-xl font-black text-slate-900 dark:text-white sm:text-3xl break-words">
          {material.judul}
        </h1>

        {material.deskripsi && (
          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {material.deskripsi}
          </p>
        )}

        {/* Metadata Konteks */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 pt-3 dark:border-slate-800">
          {material.dosen_pengampu_teks && (
            <span>
              Dosen: <strong className="text-slate-700 dark:text-slate-200">{material.dosen_pengampu_teks}</strong>
            </span>
          )}
          {material.tahun_akademik && (
            <span>
              Tahun: <strong className="text-slate-700 dark:text-slate-200">{material.tahun_akademik}</strong>
            </span>
          )}
          {material.sumber_kredit && (
            <span>
              Sumber: <strong className="text-slate-700 dark:text-slate-200">{material.sumber_kredit}</strong>
            </span>
          )}
          <span>
            Unduhan: <strong className="text-slate-700 dark:text-slate-200">{material.download_count || 0}x</strong>
          </span>
        </div>

        {/* Info Kontributor Card */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-200 dark:bg-navy dark:border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={material.uploader_avatar} sx={{ width: 44, height: 44 }} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {material.uploader_nama}
                </span>
                {material.is_kakak_tingkat && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <WorkspacePremiumRoundedIcon sx={{ fontSize: 12 }} />
                    {material.uploader_role === 'alumni' ? 'Alumni' : 'Kakak Tingkat'}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {material.uploader_role === 'alumni'
                  ? 'Alumni Pasim'
                  : `Mahasiswa Angkatan ${material.angkatan_kontributor || material.uploader_angkatan || '-'}`}
              </span>
            </div>
          </div>

          {/* Action Interaksi */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleVote}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-sm ${
                material.has_voted
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-navy-800 dark:border-slate-700 dark:text-slate-200'
              }`}
            >
              <ThumbUpAltRoundedIcon sx={{ fontSize: 16 }} />
              <span>
                {material.has_voted ? 'Bermanfaat' : 'Tandai Bermanfaat'} ({material.helpful_votes || 0})
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => setBookmarkAnchorEl(e.currentTarget)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-navy-800 dark:border-slate-700 dark:text-slate-200 shadow-sm"
            >
              {material.is_bookmarked ? (
                <BookmarkRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <BookmarkBorderRoundedIcon sx={{ fontSize: 16 }} />
              )}
              <span>Koleksi</span>
            </button>

            <Menu
              anchorEl={bookmarkAnchorEl}
              open={Boolean(bookmarkAnchorEl)}
              onClose={() => setBookmarkAnchorEl(null)}
              PaperProps={{ className: '!rounded-2xl min-w-[220px]' }}
            >
              <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400">
                Simpan ke Koleksi Saya
              </div>
              {collections.length === 0 ? (
                <MenuItem disabled className="!text-xs">
                  Belum ada folder koleksi.
                </MenuItem>
              ) : (
                collections.map((col) => (
                  <MenuItem
                    key={col.id}
                    onClick={() => handleSaveToCollection(col.id)}
                    className="!text-xs !font-semibold !min-h-[40px]"
                  >
                    📁 {col.nama}
                  </MenuItem>
                ))
              )}
            </Menu>

            <button
              type="button"
              onClick={() => setOpenReport(true)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:bg-navy-800 dark:border-slate-700 dark:hover:bg-red-950/40 shadow-sm"
            >
              <FlagRoundedIcon sx={{ fontSize: 16 }} />
              <span>Laporkan</span>
            </button>

            {/* Moderasi Admin / Moderator */}
            {isStaff && (
              <div className="flex flex-wrap items-center gap-1.5">
                {material.status !== 'approved' && (
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => handleOpenModeration('approved')}
                    startIcon={<CheckCircleRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{ borderRadius: 2, fontSize: 11, minHeight: 40 }}
                  >
                    ACC
                  </Button>
                )}
                {material.status === 'pending' && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => handleOpenModeration('rejected')}
                    startIcon={<CancelRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{ borderRadius: 2, fontSize: 11, minHeight: 40 }}
                  >
                    Tolak
                  </Button>
                )}
                {material.status !== 'takedown' && (
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => handleOpenModeration('takedown')}
                    startIcon={<BlockRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{ borderRadius: 2, fontSize: 11, minHeight: 40 }}
                  >
                    Takedown
                  </Button>
                )}
              </div>
            )}

            {/* Hapus oleh Pemilik / Staff */}
            {(isOwner || isStaff) && (
              <IconButton
                onClick={() => setConfirmDeleteMaterial(true)}
                className="!min-h-[44px] !min-w-[44px] text-slate-400 hover:text-red-600"
                title="Hapus Materi"
                aria-label="Hapus Materi"
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* Embed Player YouTube */}
      {resolvedYoutubeId && (
        <div className="mt-6 sm:mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Video Pembahasan Materi
          </h3>
          <YoutubePlayer
            videoId={resolvedYoutubeId}
            videoUrl={material.youtube_url}
            title={material.judul}
          />
        </div>
      )}

      {/* Pratinjau PDF In-Page */}
      {pdfFile && (
        <div className="mt-6 sm:mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Pratinjau Dokumen PDF
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenPdfModal(true)}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <OpenInFullRoundedIcon sx={{ fontSize: 15 }} />
                <span>Layar Penuh</span>
              </button>
              <a
                href={pdfFile.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center px-2 text-xs font-bold text-slate-500 hover:text-emerald-600 hover:underline dark:text-slate-400"
              >
                Tab Baru ↗
              </a>
            </div>
          </div>
          <div className="h-[55dvh] sm:h-[600px] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <iframe
              src={`${pdfFile.file_url}#toolbar=0`}
              title="PDF Viewer"
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}

      {/* Berkas Lampiran Materi & Riwayat Versi */}
      <div className="mt-6 sm:mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Berkas Lampiran ({material.files?.length || 0})
          </h3>
          {(isOwner || isStaff) && material.status !== 'takedown' && (
            <button
              type="button"
              onClick={() => setShowVersionUpload(!showVersionUpload)}
              className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
            >
              <CloudUploadRoundedIcon sx={{ fontSize: 16 }} />
              <span>Unggah Revisi / Versi Baru</span>
            </button>
          )}
        </div>

        {/* Form Upload Revisi Versi Baru */}
        {showVersionUpload && (
          <form
            onSubmit={handleUploadNewVersion}
            className="mb-4 rounded-2xl border border-emerald-300 bg-emerald-50/50 p-4 space-y-3 dark:border-emerald-800 dark:bg-emerald-950/20"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Unggah Berkas Revisi Baru (Maks {MAX_DOC_FILE_SIZE_MB} MB)
              </h4>
              {!isStaff && material.status === 'approved' && (
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  Revisi akan masuk antrean moderasi ulang
                </span>
              )}
            </div>
            <input
              type="file"
              accept={ALLOWED_DOC_ACCEPT}
              onChange={handleVersionFileChange}
              className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-xl file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-emerald-800"
              required
            />
            <TextField
              fullWidth
              size="small"
              placeholder="Catatan perubahan (changelog)..."
              value={changelogNote}
              onChange={(e) => setChangelogNote(e.target.value)}
            />
            {uploadingVersion && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-emerald-600">
                  <span>{uploadProgress >= 100 ? 'Memproses & menyimpan ke cloud...' : 'Mengunggah revisi...'}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <LinearProgress
                  variant={uploadProgress >= 100 ? 'indeterminate' : 'determinate'}
                  value={uploadProgress}
                  color="success"
                  className="!rounded-full"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button size="small" onClick={() => setShowVersionUpload(false)} color="inherit" disabled={uploadingVersion}>
                Batal
              </Button>
              <Button
                size="small"
                type="submit"
                variant="contained"
                color="success"
                disabled={uploadingVersion}
              >
                {uploadingVersion ? 'Mengunggah...' : 'Simpan Versi'}
              </Button>
            </div>
          </form>
        )}

        {/* Daftar Berkas */}
        <div className="space-y-2">
          {material.files?.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-navy"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">📄</span>
                <div className="min-w-0">
                  <h5 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {f.file_name}
                  </h5>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ukuran: {formatBytes(f.file_size)} • Format: {f.file_format?.toUpperCase()}
                  </span>
                </div>
              </div>

              <a
                href={f.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download
                onClick={handleTrackDownload}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <DownloadRoundedIcon sx={{ fontSize: 16 }} />
                <span>Unduh</span>
              </a>
            </div>
          ))}
        </div>

        {/* Riwayat Versi Singkat */}
        {material.versions && material.versions.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              <HistoryRoundedIcon sx={{ fontSize: 16 }} />
              <span>Riwayat Versi Materi</span>
            </h4>
            <div className="space-y-1.5">
              {material.versions.map((v) => (
                <div
                  key={v.id}
                  className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3"
                >
                  <span className="min-w-0 truncate">
                    v{v.version_num} • {v.file_name} ({v.changelog_note || 'Pembaruan berkas'})
                  </span>
                  <a
                    href={v.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleTrackDownload}
                    className="shrink-0 text-emerald-600 font-semibold hover:underline"
                  >
                    Unduh
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bagian Komentar & Tanya Jawab */}
      <div className="mt-6 sm:mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Tanya Jawab & Diskusi ({comments.length})
        </h3>

        {/* Input Komentar */}
        <form onSubmit={handleAddComment} className="flex gap-2 mb-6">
          <TextField
            fullWidth
            size="small"
            placeholder="Tanyakan bagian yang belum dipahami atau beri masukan..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            color="success"
            disabled={submittingComment || !newComment.trim()}
            aria-label="Kirim komentar"
            sx={{ borderRadius: 2, flexShrink: 0, minWidth: 44, minHeight: 40 }}
          >
            <SendRoundedIcon sx={{ fontSize: 16 }} />
          </Button>
        </form>

        {/* List Komentar */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada pertanyaan atau diskusi pada materi ini. Tanyakan hal pertama Anda!
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-navy flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Avatar src={c.user_avatar} sx={{ width: 32, height: 32 }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {c.user_nama}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        ({c.user_role === 'alumni' ? 'Alumni' : `Angkatan ${c.user_angkatan || '-'}`})
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                      {c.konten}
                    </p>
                  </div>
                </div>

                {(c.user_id === user?.id || isStaff) && (
                  <IconButton
                    size="small"
                    onClick={() => setCommentToDeleteId(c.id)}
                    className="!min-h-[40px] !min-w-[40px] text-slate-400 hover:text-red-500 shrink-0"
                    aria-label="Hapus komentar"
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Pratinjau PDF Layar Penuh */}
      {pdfFile && (
        <PdfViewerModal
          open={openPdfModal}
          onClose={() => setOpenPdfModal(false)}
          fileUrl={pdfFile.file_url}
          title={pdfFile.file_name || material.judul}
        />
      )}

      {/* Modal Laporkan Materi */}
      <ReportMaterialModal
        open={openReport}
        onClose={() => setOpenReport(false)}
        materialId={materialId}
        materialTitle={material.judul}
      />

      {/* Dialog Moderasi Materi */}
      <Dialog
        open={moderationDialog.open}
        onClose={() => !submittingModeration && setModerationDialog({ open: false, status: '', note: '' })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <DialogTitle className="!font-bold !text-base">
          {MODERATION_DIALOG_TITLES[moderationDialog.status] || 'Moderasi Materi'}
        </DialogTitle>
        <DialogContent className="!pt-2">
          <TextField
            fullWidth
            multiline
            minRows={3}
            size="small"
            label="Catatan Moderasi"
            placeholder={
              moderationDialog.status === 'approved'
                ? 'Opsional, misalnya catatan apresiasi...'
                : 'Wajib jelaskan alasan penolakan atau takedown...'
            }
            value={moderationDialog.note}
            onChange={(e) => setModerationDialog((prev) => ({ ...prev, note: e.target.value }))}
          />
        </DialogContent>
        <DialogActions className="!px-6 !pb-5">
          <Button
            onClick={() => setModerationDialog({ open: false, status: '', note: '' })}
            color="inherit"
            disabled={submittingModeration}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmitModeration}
            variant="contained"
            color={moderationDialog.status === 'approved' ? 'success' : 'error'}
            disabled={submittingModeration}
          >
            {submittingModeration ? 'Memproses...' : 'Konfirmasi'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Konfirmasi Hapus Materi */}
      <ConfirmDialog
        open={confirmDeleteMaterial}
        title="Hapus Materi Permanen?"
        message="Semua berkas lampiran dan diskusi pada materi ini akan dihapus permanen."
        confirmText="Hapus Materi"
        color="error"
        loading={deletingMaterial}
        onClose={() => !deletingMaterial && setConfirmDeleteMaterial(false)}
        onConfirm={handleConfirmDeleteMaterial}
      />

      {/* Konfirmasi Hapus Komentar */}
      <ConfirmDialog
        open={Boolean(commentToDeleteId)}
        title="Hapus Komentar?"
        message="Komentar yang dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        color="error"
        loading={deletingComment}
        onClose={() => !deletingComment && setCommentToDeleteId(null)}
        onConfirm={handleConfirmDeleteComment}
      />
    </div>
  );
}

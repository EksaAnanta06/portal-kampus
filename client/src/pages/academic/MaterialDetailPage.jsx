// FILE: client/src/pages/academic/MaterialDetailPage.jsx
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
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
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import ReportMaterialModal from '../../components/academic/ReportMaterialModal';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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

  // Versioning Upload
  const [showVersionUpload, setShowVersionUpload] = useState(false);
  const [versionFile, setVersionFile] = useState(null);
  const [changelogNote, setChangelogNote] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // Koleksi Bookmark
  const [collections, setCollections] = useState([]);
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const isOwner = material?.uploaded_by === user?.id;

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await materialApi.getMaterialDetail(materialId);
      setMaterial(res.data);
      const cRes = await materialApi.getComments(materialId);
      setComments(cRes.data || []);
    } catch (err) {
      toast.error('Gagal memuat materi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    try {
      const res = await materialApi.getUserCollections();
      setCollections(res.data || []);
    } catch {
      setCollections([]);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchCollections();
  }, [materialId]);

  // Vote Bermanfaat
  const handleToggleVote = async () => {
    try {
      const res = await materialApi.toggleVote(materialId);
      setMaterial((prev) => ({
        ...prev,
        has_voted: res.data?.voted,
        helpful_votes: res.data?.voted ? (prev.helpful_votes || 0) + 1 : Math.max(0, (prev.helpful_votes || 1) - 1),
      }));
      toast.success(res.message);
    } catch (err) {
      toast.error('Gagal memberi vote.');
    }
  };

  // Bookmark ke Koleksi
  const handleSaveToCollection = async (collectionId) => {
    try {
      const res = await materialApi.toggleCollectionItem(collectionId, { materi_id: materialId });
      toast.success(res.message);
      setShowBookmarkMenu(false);
      await fetchDetail();
    } catch (err) {
      toast.error('Gagal menyimpan ke koleksi.');
    }
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
    } catch (err) {
      toast.error('Gagal mengirim komentar.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Hapus Komentar
  const handleDeleteComment = async (commentId) => {
    try {
      await materialApi.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success('Komentar dihapus.');
    } catch (err) {
      toast.error('Gagal menghapus komentar.');
    }
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
      const data = new FormData();
      data.append('file', versionFile);
      data.append('changelog_note', changelogNote);
      await materialApi.uploadNewVersion(materialId, data);
      toast.success('Versi baru materi berhasil diunggah!');
      setShowVersionUpload(false);
      setVersionFile(null);
      setChangelogNote('');
      await fetchDetail();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah versi baru.');
    } finally {
      setUploadingVersion(false);
    }
  };

  // Moderasi ACC / Tolak / Takedown
  const handleModerate = async (status) => {
    const note = window.prompt(`Catatan moderasi untuk status ${status}:`, '');
    if (note === null) return;
    try {
      await materialApi.moderateMaterial(materialId, { status, note });
      toast.success(`Materi berhasil di-${status}!`);
      await fetchDetail();
    } catch (err) {
      toast.error('Gagal memproses moderasi.');
    }
  };

  // Hapus Materi
  const handleDeleteMaterial = async () => {
    if (!window.confirm('Yakin ingin menghapus materi ini secara permanen?')) return;
    try {
      await materialApi.deleteMaterial(materialId);
      toast.success('Materi berhasil dihapus.');
      navigate(`/akademik/materi/matkul/${material.mata_kuliah_id}`);
    } catch (err) {
      toast.error('Gagal menghapus materi.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-4xl px-4 py-8 space-y-4">
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold">Materi tidak ditemukan</h2>
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

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          to={`/akademik/materi/matkul/${material.mata_kuliah_id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
          <span>Kembali ke Koleksi {material.mata_kuliah_kode}</span>
        </Link>
      </div>

      {/* Banner Moderasi Status */}
      {material.status !== 'approved' && (
        <div className={`mb-6 rounded-2xl p-4 border text-xs leading-relaxed ${
          material.status === 'pending'
            ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
            : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
        }`}>
          <strong>Status Materi: {material.status.toUpperCase()}</strong>
          {material.moderation_note && <p className="mt-1">Catatan: {material.moderation_note}</p>}
        </div>
      )}

      {/* Header Materi */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>
              {material.mata_kuliah_kode} - {material.mata_kuliah_nama} (Sem {material.semester_rekomendasi})
            </span>
          </div>

          <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {material.tipe_materi}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
          {material.judul}
        </h1>

        {material.deskripsi && (
          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {material.deskripsi}
          </p>
        )}

        {/* Metadata Konteks */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400 border-t border-slate-100 pt-3 dark:border-slate-800">
          {material.dosen_pengampu_teks && (
            <span>👨‍🏫 Konteks Dosen: <strong className="text-slate-600 dark:text-slate-200">{material.dosen_pengampu_teks}</strong></span>
          )}
          {material.tahun_akademik && (
            <span>📅 Tahun: <strong className="text-slate-600 dark:text-slate-200">{material.tahun_akademik}</strong></span>
          )}
          {material.sumber_kredit && (
            <span>🏷️ Sumber: <strong className="text-slate-600 dark:text-slate-200">{material.sumber_kredit}</strong></span>
          )}
        </div>

        {/* Info Kontributor Card */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-200 dark:bg-navy dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Avatar src={material.uploader_avatar} sx={{ width: 44, height: 44 }} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {material.uploader_nama}
                </span>
                {material.is_kakak_tingkat && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <WorkspacePremiumRoundedIcon sx={{ fontSize: 12 }} />
                    {material.uploader_role === 'alumni' ? 'Alumni' : 'Kakak Tingkat'}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {material.uploader_role === 'alumni' ? 'Alumni Pasim' : `Mahasiswa Angkatan ${material.uploader_angkatan || '-'}`}
              </span>
            </div>
          </div>

          {/* Action Interaksi */}
          <div className="flex flex-wrap items-center gap-2 relative">
            {/* Tombol Bermanfaat */}
            <button
              onClick={handleToggleVote}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-sm ${
                material.has_voted
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-navy-800 dark:border-slate-700 dark:text-slate-200'
              }`}
            >
              <ThumbUpAltRoundedIcon sx={{ fontSize: 16 }} />
              <span>{material.has_voted ? 'Bermanfaat' : 'Tandai Bermanfaat'} ({material.helpful_votes || 0})</span>
            </button>

            {/* Tombol Koleksi Saya */}
            <button
              onClick={() => setShowBookmarkMenu(!showBookmarkMenu)}
              className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-navy-800 dark:border-slate-700 dark:text-slate-200 shadow-sm"
            >
              {material.is_bookmarked ? (
                <BookmarkRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <BookmarkBorderRoundedIcon sx={{ fontSize: 16 }} />
              )}
              <span>Koleksi</span>
            </button>

            {/* Menu Dropdown Simpan ke Koleksi */}
            {showBookmarkMenu && (
              <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-navy-800">
                <span className="block px-3 py-1.5 text-[10px] font-black uppercase text-slate-400">
                  Simpan ke Koleksi Saya:
                </span>
                {collections.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Belum ada folder koleksi.</p>
                ) : (
                  collections.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => handleSaveToCollection(col.id)}
                      className="w-full text-left rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-navy-700"
                    >
                      📁 {col.nama}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Tombol Laporkan */}
            <button
              onClick={() => setOpenReport(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:bg-navy-800 dark:border-slate-700 dark:hover:bg-red-950/40 shadow-sm"
            >
              <FlagRoundedIcon sx={{ fontSize: 16 }} />
              <span>Laporkan</span>
            </button>

            {/* Moderasi Admin / Moderator */}
            {isStaff && (
              <div className="flex items-center gap-1 ml-1">
                {material.status !== 'approved' && (
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => handleModerate('approved')}
                    startIcon={<CheckCircleRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{ borderRadius: 1.5, fontSize: 11 }}
                  >
                    ACC
                  </Button>
                )}
                {material.status !== 'takedown' && (
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => handleModerate('takedown')}
                    startIcon={<BlockRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{ borderRadius: 1.5, fontSize: 11 }}
                  >
                    Takedown
                  </Button>
                )}
              </div>
            )}

            {/* Hapus oleh Pemilik / Staff */}
            {(isOwner || isStaff) && (
              <button
                onClick={handleDeleteMaterial}
                className="text-slate-400 hover:text-red-600 p-1.5 transition ml-1"
                title="Hapus Materi"
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embed Player YouTube jika ada */}
      {material.youtube_video_id && (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            🎬 Video Pembahasan Materi
          </h3>
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${material.youtube_video_id}`}
              title={material.judul}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Pratinjau PDF In-Page jika ada berkas PDF */}
      {pdfFile && (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              📖 Pratinjau Dokumen PDF
            </h3>
            <a
              href={pdfFile.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-600 hover:underline"
            >
              Buka Layar Penuh ↗
            </a>
          </div>
          <div className="h-[600px] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <iframe
              src={`${pdfFile.file_url}#toolbar=0`}
              title="PDF Viewer"
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}

      {/* Berkas Lampiran Materi & Riwayat Versi */}
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            📁 Berkas Lampiran ({material.files?.length || 0})
          </h3>
          {(isOwner || isStaff) && (
            <button
              onClick={() => setShowVersionUpload(!showVersionUpload)}
              className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
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
            <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              Unggah Berkas Revisi Baru
            </h4>
            <input
              type="file"
              onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
              className="text-xs text-slate-500 file:mr-2 file:rounded-xl file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-800"
              required
            />
            <TextField
              fullWidth
              size="small"
              placeholder="Catatan perubahan (changelog)..."
              value={changelogNote}
              onChange={(e) => setChangelogNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="small" onClick={() => setShowVersionUpload(false)} color="inherit">
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
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-navy"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📄</span>
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                    {f.file_name}
                  </h5>
                  <span className="text-[10px] text-slate-400">
                    Ukuran: {formatBytes(f.file_size)} • Format: {f.file_format?.toUpperCase()}
                  </span>
                </div>
              </div>

              <a
                href={f.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
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
                <div key={v.id} className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>
                    v{v.version_num} • {v.file_name} ({v.changelog_note || 'Pembaruan berkas'})
                  </span>
                  <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-semibold hover:underline">
                    Unduh
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bagian Komentar & Tanya Jawab */}
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          💬 Tanya Jawab & Diskusi ({comments.length})
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
            sx={{ borderRadius: 2, shrink: 0 }}
          >
            <SendRoundedIcon sx={{ fontSize: 16 }} />
          </Button>
        </form>

        {/* List Komentar */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Belum ada pertanyaan atau diskusi pada materi ini. Tanyakan hal pertama Anda!
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-navy flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <Avatar src={c.user_avatar} sx={{ width: 32, height: 32 }} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {c.user_nama}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({c.user_role === 'alumni' ? 'Alumni' : `Angkatan ${c.user_angkatan || '-'}`})
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {c.konten}
                    </p>
                  </div>
                </div>

                {(c.user_id === user?.id || isStaff) && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Laporkan Materi */}
      <ReportMaterialModal
        open={openReport}
        onClose={() => setOpenReport(false)}
        materialId={materialId}
        materialTitle={material.judul}
      />
    </div>
  );
}

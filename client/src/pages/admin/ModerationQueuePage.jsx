// FILE: client/src/pages/admin/ModerationQueuePage.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { galleryApi } from '../../api/gallery.api';
import { materialApi } from '../../api/material.api';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import EmptyState from '../../components/common/EmptyState';
import PhotoLightboxModal from '../../components/gallery/PhotoLightboxModal';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { REPORT_REASON_LABELS, getInitials } from '../../utils/constants';
import { formatDateTime, formatRelative } from '../../utils/formatDate';

export default function ModerationQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'reports' ? 'reports' : 'photos';

  const [activeTab, setActiveTab] = useState(initialTab);

  // Tab Foto Pending
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // Tab Laporan Foto
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Tab Materi Kuliah Pending
  const [pendingMaterials, setPendingMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Tab Usulan Mata Kuliah Pending
  const [pendingCourses, setPendingCourses] = useState([]);

  // Lightbox
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Modal Penolakan Foto
  const [rejectDialog, setRejectDialog] = useState({ open: false, photoId: null, reason: '' });
  const [processing, setProcessing] = useState(false);

  const fetchPendingPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const res = await galleryApi.getPhotos({ status: 'pending', limit: 40 });
      setPendingPhotos(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await galleryApi.getReports('open');
      setReports(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchPendingMaterials = async () => {
    setLoadingMaterials(true);
    try {
      const res = await materialApi.getPendingMaterials();
      setPendingMaterials(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const fetchPendingCourses = async () => {
    try {
      const res = await materialApi.getCourses({ status: 'pending', all: true });
      setPendingCourses(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPendingPhotos();
    fetchReports();
    fetchPendingMaterials();
    fetchPendingCourses();
  }, []);

  const handleTabChange = (_e, val) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  // Moderasi Approve
  const handleApprovePhoto = async (photoId) => {
    try {
      await galleryApi.moderatePhoto(photoId, { status: 'approved' });
      toast.success('Foto disetujui dan kini tayang di galeri publik.');
      setPendingPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Moderasi Reject
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await galleryApi.moderatePhoto(rejectDialog.photoId, {
        status: 'rejected',
        rejection_reason: rejectDialog.reason.trim() || undefined,
      });
      toast.success('Foto berhasil ditolak.');
      setPendingPhotos((prev) => prev.filter((p) => p.id !== rejectDialog.photoId));
      setRejectDialog({ open: false, photoId: null, reason: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  // Selesaikan Laporan
  const handleResolveReport = async (reportId, status = 'resolved') => {
    try {
      await galleryApi.resolveReport(reportId, status);
      toast.success(`Laporan ditandai ${status === 'resolved' ? 'selesai' : 'diabaikan'}.`);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Moderasi Materi Pembelajaran
  const handleApproveMaterial = async (materialId) => {
    try {
      await materialApi.moderateMaterial(materialId, { status: 'approved' });
      toast.success('Materi berhasil disetujui (ACC) dan kini tayang di perpustakaan.');
      setPendingMaterials((prev) => prev.filter((m) => m.id !== materialId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRejectMaterial = async (materialId) => {
    const note = window.prompt('Alasan penolakan materi (opsional):');
    if (note === null) return;

    try {
      await materialApi.moderateMaterial(materialId, { status: 'rejected', note });
      toast.success('Materi telah ditolak.');
      setPendingMaterials((prev) => prev.filter((m) => m.id !== materialId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Moderasi Usulan Mata Kuliah
  const handleApproveCourse = async (courseId, status = 'approved') => {
    try {
      await materialApi.approveProposedCourse(courseId, { status });
      toast.success(`Usulan mata kuliah berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}.`);
      setPendingCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Kurasi Konten Sivitas
        </span>
        <h1 className="section-title mt-1">Antrean Moderasi Galeri</h1>
        <p className="text-muted mb-0 mt-2 text-sm">
          Periksa kesesuaian unggahan dokumentasi mahasiswa dan tindak lanjuti laporan konten yang tidak sesuai.
        </p>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab value="photos" label={`Foto Menunggu Moderasi (${pendingPhotos.length})`} />
          <Tab
            value="materials"
            label={`Materi & Usulan MK (${pendingMaterials.length + pendingCourses.length})`}
          />
          <Tab value="reports" label={`Laporan Pelanggaran (${reports.length})`} />
        </Tabs>
      </div>

      {/* 1. TAB FOTO PENDING */}
      {activeTab === 'photos' && (
        <div>
          {loadingPhotos ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card-surface p-4 space-y-3">
                  <div className="aspect-video bg-slate-200 animate-pulse rounded-xl" />
                  <div className="h-4 bg-slate-200 animate-pulse rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : pendingPhotos.length === 0 ? (
            <EmptyState
              title="Antrean Bersih"
              description="Tidak ada foto yang sedang menunggu persetujuan moderator saat ini."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pendingPhotos.map((p) => (
                <div key={p.id} className="card-surface flex flex-col overflow-hidden">
                  <div
                    onClick={() => {
                      setSelectedPhotoId(p.id);
                      setLightboxOpen(true);
                    }}
                    className="group relative aspect-video cursor-pointer overflow-hidden bg-slate-100 dark:bg-slate-800"
                  >
                    <img
                      src={getOptimizedImageUrl(p.url, { width: 600, height: 350 })}
                      alt={p.caption}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                      Angkatan {p.angkatan_year}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar
                        src={getOptimizedImageUrl(p.uploader_avatar, { width: 64, height: 64 })}
                        sx={{ width: 28, height: 28, fontSize: 12 }}
                      >
                        {getInitials(p.uploader_name)}
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">{p.uploader_name}</div>
                        <div className="text-muted truncate text-[10px]">{p.uploader_nim}</div>
                      </div>
                      <span className="text-muted text-[10px]">{formatRelative(p.created_at)}</span>
                    </div>

                    <p className="text-muted line-clamp-2 text-sm leading-relaxed mb-4">
                      {p.caption}
                    </p>

                    <div className="mt-auto flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        onClick={() => handleApprovePhoto(p.id)}
                      >
                        Setujui
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<BlockRoundedIcon />}
                        onClick={() =>
                          setRejectDialog({ open: true, photoId: p.id, reason: '' })
                        }
                      >
                        Tolak
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. TAB LAPORAN KONTEN */}
      {activeTab === 'reports' && (
        <div>
          {loadingReports ? (
            <div className="space-y-3">
              <div className="h-20 bg-slate-200 animate-pulse rounded-2xl" />
              <div className="h-20 bg-slate-200 animate-pulse rounded-2xl" />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              title="Tidak Ada Laporan Terbuka"
              description="Semua laporan pelanggaran foto telah ditindaklanjuti oleh tim."
            />
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="card-surface flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={getOptimizedImageUrl(r.photo_url, { width: 120, height: 120 })}
                      alt="laporan foto"
                      onClick={() => {
                        setSelectedPhotoId(r.photo_id);
                        setLightboxOpen(true);
                      }}
                      className="h-20 w-20 cursor-pointer rounded-xl object-cover shrink-0 shadow-sm"
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip
                          size="small"
                          color="error"
                          label={REPORT_REASON_LABELS[r.reason] || r.reason}
                          className="!font-bold"
                        />
                        <span className="text-muted text-xs">
                          Dilaporkan oleh <strong>{r.reporter_name}</strong> ({r.reporter_nim})
                        </span>
                        <span className="text-muted text-xs">· {formatDateTime(r.created_at)}</span>
                      </div>

                      {r.description && (
                        <p className="mb-0 mt-2 text-sm text-slate-800 dark:text-slate-200">
                          Catatan pelapor: "{r.description}"
                        </p>
                      )}

                      <p className="text-muted mb-0 mt-1 line-clamp-1 text-xs">
                        Caption Foto: "{r.photo_caption}"
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleOutlineRoundedIcon />}
                      onClick={() => handleResolveReport(r.id, 'resolved')}
                    >
                      Selesai
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={() => handleResolveReport(r.id, 'dismissed')}
                    >
                      Abaikan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB MATERI KULIAH & USULAN MK PENDING */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {/* Bagian Usulan Mata Kuliah Baru jika ada */}
          {pendingCourses.length > 0 && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="flex items-center gap-2 mb-3 text-sky-800 dark:text-sky-300 font-bold text-sm">
                <SchoolRoundedIcon sx={{ fontSize: 20 }} />
                <span>Usulan Mata Kuliah Baru Mahasiswa ({pendingCourses.length})</span>
              </div>
              <div className="space-y-3">
                {pendingCourses.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl bg-white p-4 border border-slate-200 dark:bg-navy-800 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span>{c.kode} • {c.sks} SKS</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {c.prodi_nama || 'Program Studi'} • Semester {c.semester_rekomendasi}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {c.nama}
                      </h4>
                      {c.deskripsi && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {c.deskripsi}
                        </p>
                      )}
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Diusulkan oleh: <strong>{c.proposer_nama || 'Mahasiswa'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        onClick={() => handleApproveCourse(c.id, 'approved')}
                      >
                        Setujui MK
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<BlockRoundedIcon />}
                        onClick={() => handleApproveCourse(c.id, 'rejected')}
                      >
                        Tolak
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingMaterials ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card-surface p-5 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : pendingMaterials.length === 0 && pendingCourses.length === 0 ? (
            <EmptyState
              title="Tidak ada antrean materi pending"
              description="Semua materi pembelajaran dan usulan mata kuliah mahasiswa telah disetujui."
            />
          ) : (
            <div className="space-y-4">
              {pendingMaterials.map((item) => (
                <div
                  key={item.id}
                  className="card-surface p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-200 dark:border-slate-800 rounded-2xl"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <MenuBookRoundedIcon sx={{ fontSize: 14 }} />
                        {item.mata_kuliah_nama} ({item.mata_kuliah_kode})
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {item.prodi_kode || 'Semua Prodi'} • Sem {item.semester_rekomendasi || 1}
                      </span>
                      <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        Tipe: {item.tipe_materi || item.tipe}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {item.judul}
                    </h3>

                    {item.deskripsi && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                        {item.deskripsi}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <span>
                        Pengunggah:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {item.uploader_nama || item.uploader_name}
                        </strong>{' '}
                        ({item.uploader_role === 'alumni' ? 'Alumni' : 'Mahasiswa'}{item.uploader_nim ? ` • NIM ${item.uploader_nim}` : ''})
                      </span>
                      <span>•</span>
                      <span>Diunggah: {formatDateTime(item.created_at)}</span>
                      <span>•</span>
                      <Link
                        to={`/akademik/materi/detail/${item.id}`}
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                      >
                        <span>Lihat Halaman Materi</span>
                        <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                      </Link>
                    </div>
                  </div>

                  {/* Tombol Aksi Moderasi */}
                  <div className="flex shrink-0 items-center gap-2 pt-2 md:pt-0">
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckRoundedIcon />}
                      onClick={() => handleApproveMaterial(item.id)}
                    >
                      Setujui (ACC)
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<BlockRoundedIcon />}
                      onClick={() => handleRejectMaterial(item.id)}
                    >
                      Tolak
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog Tolak Foto */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => !processing && setRejectDialog({ open: false, photoId: null, reason: '' })}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={handleRejectSubmit}>
          <DialogTitle className="font-bold">Tolak Foto Unggahan</DialogTitle>
          <DialogContent className="!pt-2">
            <p className="text-muted text-xs mt-0">
              Pengunggah foto akan menerima notifikasi beserta alasan penolakan ini.
            </p>
            <TextField
              label="Alasan Penolakan"
              placeholder="Contoh: Kualitas foto terlalu buram / tidak sesuai kegiatan"
              multiline
              minRows={2}
              value={rejectDialog.reason}
              onChange={(e) =>
                setRejectDialog((d) => ({ ...d, reason: e.target.value.slice(0, 255) }))
              }
              required
              autoFocus
            />
          </DialogContent>
          <DialogActions className="!px-6 !pb-5">
            <Button
              color="inherit"
              disabled={processing}
              onClick={() => setRejectDialog({ open: false, photoId: null, reason: '' })}
            >
              Batal
            </Button>
            <Button type="submit" variant="contained" color="error" disabled={processing}>
              {processing ? 'Menolak...' : 'Konfirmasi Tolak'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Lightbox Preview */}
      <PhotoLightboxModal
        open={lightboxOpen}
        photoId={selectedPhotoId}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

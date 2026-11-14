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
import {
  MATERIAL_REPORT_REASON_LABELS,
  MATERIAL_TYPE_LABELS,
  REPORT_REASON_LABELS,
  getInitials,
} from '../../utils/constants';
import { formatDateTime, formatRelative } from '../../utils/formatDate';

const VALID_TABS = ['photos', 'materials', 'reports'];

export default function ModerationQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = VALID_TABS.includes(requestedTab) ? requestedTab : 'photos';

  const [activeTab, setActiveTab] = useState(initialTab);

  // Tab Foto Pending
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // Tab Laporan Foto & Laporan Materi
  const [reports, setReports] = useState([]);
  const [materialReports, setMaterialReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Tab Materi Kuliah Pending
  const [pendingMaterials, setPendingMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Tab Usulan Mata Kuliah Pending
  const [pendingCourses, setPendingCourses] = useState([]);

  // Lightbox
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Modal Penolakan Foto & Materi
  const [rejectDialog, setRejectDialog] = useState({ open: false, photoId: null, reason: '' });
  const [rejectMaterialDialog, setRejectMaterialDialog] = useState({
    open: false,
    materialId: null,
    title: '',
    note: '',
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== activeTab) {
      setActiveTab(paramTab);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    const cfg = { signal: controller.signal };

    setLoadingPhotos(true);
    setLoadingReports(true);
    setLoadingMaterials(true);

    galleryApi
      .getPhotos({ status: 'pending', limit: 40 }, cfg)
      .then((res) => {
        if (!controller.signal.aborted) setPendingPhotos(res.data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPhotos(false);
      });

    Promise.allSettled([
      galleryApi.getReports('open', cfg),
      materialApi.getReports({ status: 'pending', limit: 20 }, cfg),
    ])
      .then(([gRes, mRes]) => {
        if (controller.signal.aborted) return;
        if (gRes.status === 'fulfilled') setReports(gRes.value.data || []);
        if (mRes.status === 'fulfilled') setMaterialReports(mRes.value.data || []);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingReports(false);
      });

    materialApi
      .getPendingMaterials({}, cfg)
      .then((res) => {
        if (!controller.signal.aborted) setPendingMaterials(res.data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingMaterials(false);
      });

    materialApi
      .getCourses({ status: 'pending', all: true }, cfg)
      .then((res) => {
        if (!controller.signal.aborted) setPendingCourses(res.data || []);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const handleTabChange = (_e, val) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  // Moderasi Approve Foto
  const handleApprovePhoto = async (photoId) => {
    try {
      await galleryApi.moderatePhoto(photoId, { status: 'approved' });
      toast.success('Foto disetujui dan kini tayang di galeri publik.');
      setPendingPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Moderasi Reject Foto
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

  // Selesaikan Laporan Foto
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

  const handleRejectMaterialSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await materialApi.moderateMaterial(rejectMaterialDialog.materialId, {
        status: 'rejected',
        note: rejectMaterialDialog.note.trim(),
      });
      toast.success('Materi telah ditolak.');
      setPendingMaterials((prev) => prev.filter((m) => m.id !== rejectMaterialDialog.materialId));
      setRejectMaterialDialog({ open: false, materialId: null, title: '', note: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  // Moderasi Usulan Mata Kuliah
  const handleApproveCourse = async (courseId, status = 'approved') => {
    try {
      await materialApi.approveProposedCourse(courseId, { status });
      toast.success(
        `Usulan mata kuliah berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}.`
      );
      setPendingCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const totalReportsCount = reports.length + materialReports.length;

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Kurasi Konten Sivitas
        </span>
        <h1 className="section-title mt-1">Antrean Moderasi Galeri & Materi</h1>
        <p className="text-muted mb-0 mt-2 text-sm">
          Periksa kesesuaian unggahan dokumentasi mahasiswa, materi perkuliahan, dan tindak lanjuti laporan pelanggaran.
        </p>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab value="photos" label={`Foto Pending (${pendingPhotos.length})`} />
          <Tab
            value="materials"
            label={`Materi & Usulan MK (${pendingMaterials.length + pendingCourses.length})`}
          />
          <Tab value="reports" label={`Laporan Pelanggaran (${totalReportsCount})`} />
        </Tabs>
      </div>

      {/* 1. TAB FOTO PENDING */}
      {activeTab === 'photos' && (
        <div>
          {loadingPhotos ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card-surface p-4 space-y-3">
                  <div className="aspect-video bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded w-3/4" />
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
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold m-0">{p.uploader_name}</p>
                        <p className="text-muted text-[11px] m-0">{formatRelative(p.created_at)}</p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 mb-4 flex-1">
                      {p.caption || <span className="italic text-slate-400">Tanpa caption</span>}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        onClick={() => handleApprovePhoto(p.id)}
                        sx={{ minHeight: 40 }}
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
                        sx={{ minHeight: 40 }}
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

      {/* 2. TAB LAPORAN PELANGGARAN */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Sub-section Laporan Materi jika ada */}
          {materialReports.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 sm:p-5 dark:border-red-900/60 dark:bg-red-950/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-red-800 dark:text-red-300">
                  Laporan Pelanggaran Materi Perkuliahan ({materialReports.length})
                </span>
                <Link
                  to="/admin/materi?tab=reports"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                >
                  <span>Kelola di Panel Materi</span>
                  <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                </Link>
              </div>
              <div className="space-y-2">
                {materialReports.map((mr) => (
                  <div
                    key={mr.id}
                    className="rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                        {MATERIAL_REPORT_REASON_LABELS[mr.alasan] || mr.alasan}
                      </span>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {mr.materi_judul} ({mr.mata_kuliah_nama})
                      </p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Pelapor: {mr.reporter_nama || '-'} • {formatDateTime(mr.created_at)}
                      </span>
                    </div>
                    <Link
                      to="/admin/materi?tab=reports"
                      className="text-xs font-bold text-emerald-600 hover:underline shrink-0"
                    >
                      Tinjau ↗
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Laporan Foto Galeri */}
          {loadingReports ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-surface p-5 h-28 animate-pulse" />
              ))}
            </div>
          ) : reports.length === 0 && materialReports.length === 0 ? (
            <EmptyState
              title="Tidak ada laporan terbuka"
              description="Semua laporan pelanggaran konten galeri dan materi telah selesai ditinjau."
            />
          ) : reports.length === 0 ? null : (
            <div className="space-y-4">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="card-surface p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
                    <img
                      src={getOptimizedImageUrl(r.photo_url, { width: 200, height: 150 })}
                      alt="Reported photo"
                      onClick={() => {
                        setSelectedPhotoId(r.photo_id);
                        setLightboxOpen(true);
                      }}
                      className="h-24 w-full sm:w-28 rounded-xl object-cover shrink-0 cursor-pointer hover:opacity-80"
                    />
                    <div className="min-w-0">
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
                      sx={{ minHeight: 40 }}
                    >
                      Selesai
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={() => handleResolveReport(r.id, 'dismissed')}
                      sx={{ minHeight: 40 }}
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
          {pendingCourses.length > 0 && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:p-5 dark:border-sky-900/60 dark:bg-sky-950/20">
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
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span>
                          {c.kode} • {c.sks} SKS
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
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
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                        Diusulkan oleh: <strong>{c.proposer_nama || 'Mahasiswa'}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        onClick={() => handleApproveCourse(c.id, 'approved')}
                        sx={{ minHeight: 40 }}
                      >
                        Setujui MK
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<BlockRoundedIcon />}
                        onClick={() => handleApproveCourse(c.id, 'rejected')}
                        sx={{ minHeight: 40 }}
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
                  className="card-surface p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-200 dark:border-slate-800 rounded-2xl"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <MenuBookRoundedIcon sx={{ fontSize: 14 }} />
                        {item.mata_kuliah_nama} ({item.mata_kuliah_kode})
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {item.prodi_kode || 'Semua Prodi'} • Sem {item.semester_rekomendasi || 1}
                      </span>
                      <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        {MATERIAL_TYPE_LABELS[item.tipe_materi] || item.tipe_materi || item.tipe}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white break-words">
                      {item.judul}
                    </h3>

                    {item.deskripsi && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                        {item.deskripsi}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <span>
                        Pengunggah:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {item.uploader_nama || item.uploader_name}
                        </strong>{' '}
                        ({item.uploader_role === 'alumni' ? 'Alumni' : 'Mahasiswa'}
                        {item.uploader_nim ? ` • NIM ${item.uploader_nim}` : ''})
                      </span>
                      <span>• Diunggah: {formatDateTime(item.created_at)}</span>
                      <Link
                        to={`/akademik/materi/detail/${item.id}`}
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                      >
                        <span>Lihat Halaman Materi</span>
                        <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                      </Link>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 pt-2 md:pt-0">
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckRoundedIcon />}
                      onClick={() => handleApproveMaterial(item.id)}
                      sx={{ minHeight: 40 }}
                    >
                      Setujui (ACC)
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<BlockRoundedIcon />}
                      onClick={() =>
                        setRejectMaterialDialog({
                          open: true,
                          materialId: item.id,
                          title: item.judul,
                          note: '',
                        })
                      }
                      sx={{ minHeight: 40 }}
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
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <form onSubmit={handleRejectSubmit}>
          <DialogTitle className="!font-bold !text-base">Tolak Foto Unggahan</DialogTitle>
          <DialogContent className="!pt-2 space-y-3">
            <p className="text-muted text-xs m-0">
              Pengunggah foto akan menerima notifikasi beserta alasan penolakan ini.
            </p>
            <TextField
              fullWidth
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

      {/* Dialog Tolak Materi */}
      <Dialog
        open={rejectMaterialDialog.open}
        onClose={() =>
          !processing &&
          setRejectMaterialDialog({ open: false, materialId: null, title: '', note: '' })
        }
        fullWidth
        maxWidth="xs"
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <form onSubmit={handleRejectMaterialSubmit}>
          <DialogTitle className="!font-bold !text-base">Tolak Materi Pembelajaran</DialogTitle>
          <DialogContent className="!pt-2 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 m-0">
              Materi: <strong>{rejectMaterialDialog.title}</strong>
            </p>
            <TextField
              fullWidth
              label="Alasan Penolakan (Opsional)"
              placeholder="Contoh: Berkas tidak dapat dibaca / kurang relevan..."
              multiline
              minRows={2}
              value={rejectMaterialDialog.note}
              onChange={(e) =>
                setRejectMaterialDialog((d) => ({ ...d, note: e.target.value.slice(0, 500) }))
              }
              autoFocus
            />
          </DialogContent>
          <DialogActions className="!px-6 !pb-5">
            <Button
              color="inherit"
              disabled={processing}
              onClick={() =>
                setRejectMaterialDialog({ open: false, materialId: null, title: '', note: '' })
              }
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

// FILE: client/src/pages/admin/ManageMaterialsPage.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import { materialApi } from '../../api/material.api';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatDateTime } from '../../utils/formatDate';

const MATERIAL_TYPES = {
  ringkasan_catatan: '📝 Ringkasan & Catatan',
  slide: '📊 Slide Presentasi',
  modul: '📖 Modul Praktikum',
  soal_latihan: '🎯 Soal Latihan',
  video: '🎬 Video Pembahasan',
  kode_referensi: '💻 Kode Referensi',
  tips_belajar: '💡 Tips Belajar',
  lainnya: '📁 Berkas Lainnya',
};

const STATUS_BADGES = {
  approved: { label: 'Aktif Tayang', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  pending: { label: 'Menunggu Izin (Pending)', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  rejected: { label: 'Ditolak', color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  takedown: { label: 'Diturunkan (Takedown)', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800' },
};

export default function ManageMaterialsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'materials';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Common Academic Catalog
  const [prodiList, setProdiList] = useState([]);
  const [allCourses, setAllCourses] = useState([]);

  // Tab 1: Materi & Izin Tayang
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterProdi, setFilterProdi] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [searchMaterial, setSearchMaterial] = useState('');

  // Dialog Alasan Penolakan / Takedown
  const [moderateDialog, setModerateDialog] = useState({
    open: false,
    materialId: null,
    materialTitle: '',
    status: '', // 'rejected' atau 'takedown'
    note: '',
  });

  // Dialog Hapus Materi
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    materialId: null,
    materialTitle: '',
  });

  // Tab 2: Katalog Mata Kuliah & Usulan
  const [courses, setCourses] = useState([]);
  const [pendingCourses, setPendingCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseFilterProdi, setCourseFilterProdi] = useState('');
  const [courseFilterSemester, setCourseFilterSemester] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  // Dialog Form Tambah / Edit Mata Kuliah
  const [courseDialog, setCourseDialog] = useState({
    open: false,
    isEdit: false,
    id: null,
    form: {
      kode: '',
      nama: '',
      sks: 3,
      prodi_id: 1,
      semester_rekomendasi: 1,
      deskripsi: '',
      status: 'approved',
    },
  });

  // Dialog Hapus Mata Kuliah
  const [deleteCourseDialog, setDeleteCourseDialog] = useState({
    open: false,
    id: null,
    nama: '',
  });

  // Tab 3: Laporan Pelanggaran Konten
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportActionDialog, setReportActionDialog] = useState({
    open: false,
    reportId: null,
    action: '', // 'takedown' atau 'dismissed'
    takedownNote: '',
  });

  // Tab 4: Kurasi Paket Belajar Semester
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [newPackageDialog, setNewPackageDialog] = useState(false);
  const [newPackageForm, setNewPackageForm] = useState({
    prodi_id: 1,
    semester: 1,
    judul: '',
    deskripsi: '',
    material_ids: [],
  });

  // Load Initial Academic Catalogs
  const fetchCatalogs = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        materialApi.getProdiList(),
        materialApi.getCourses({ all: true, status: '' }),
      ]);
      setProdiList(pRes.data || []);
      setAllCourses(cRes.data || []);
    } catch (err) {
      console.error('Gagal memuat katalog:', err);
    }
  };

  // Fetch Materi Perkuliahan
  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const res = await materialApi.getMaterials({
        status: filterStatus || null,
        prodiId: filterProdi || null,
        semester: filterSemester || null,
        search: searchMaterial || '',
      });
      setMaterials(res.data || []);
    } catch (err) {
      toast.error('Gagal memuat daftar materi perkuliahan.');
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Fetch Katalog Mata Kuliah & Usulan
  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      const [cRes, pRes] = await Promise.all([
        materialApi.getCourses({
          prodiId: courseFilterProdi || null,
          semester: courseFilterSemester || null,
          search: courseSearch || '',
          all: true,
          status: 'approved',
        }),
        materialApi.getCourses({ status: 'pending', all: true }),
      ]);
      setCourses(cRes.data || []);
      setPendingCourses(pRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Fetch Laporan Konten
  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await materialApi.getReports();
      setReports(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  // Fetch Paket Belajar Semester
  const fetchPackages = async () => {
    try {
      setLoadingPackages(true);
      const res = await materialApi.getLearningPackages();
      setPackages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'materials') fetchMaterials();
    if (activeTab === 'courses') fetchCourses();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'packages') fetchPackages();
  }, [activeTab, filterStatus, filterProdi, filterSemester, searchMaterial, courseFilterProdi, courseFilterSemester, courseSearch]);

  const handleTabChange = (_e, val) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  // ============================================================================
  // HANDLERS PERIZINAN MATERI (MODERASI)
  // ============================================================================
  const handleApproveMaterial = async (materialId) => {
    try {
      await materialApi.moderateMaterial(materialId, { status: 'approved' });
      toast.success('Izin tayang materi disetujui (ACC). Materi kini dapat diakses publik.');
      await fetchMaterials();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleModerateSubmit = async (e) => {
    e.preventDefault();
    const { materialId, status, note } = moderateDialog;
    try {
      await materialApi.moderateMaterial(materialId, { status, note });
      toast.success(
        status === 'takedown'
          ? 'Materi telah dicabut/diturunkan (Takedown).'
          : 'Materi telah ditolak.'
      );
      setModerateDialog({ open: false, materialId: null, materialTitle: '', status: '', note: '' });
      await fetchMaterials();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteMaterialConfirm = async () => {
    try {
      await materialApi.deleteMaterial(deleteDialog.materialId);
      toast.success('Materi berhasil dihapus permanen.');
      setDeleteDialog({ open: false, materialId: null, materialTitle: '' });
      await fetchMaterials();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ============================================================================
  // HANDLERS KATALOG MATA KULIAH
  // ============================================================================
  const handleApproveCourse = async (courseId, status = 'approved') => {
    try {
      await materialApi.approveProposedCourse(courseId, { status });
      toast.success(`Usulan mata kuliah ${status === 'approved' ? 'disetujui' : 'ditolak'}.`);
      await fetchCourses();
      await fetchCatalogs();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenCourseDialog = (course = null) => {
    if (course) {
      setCourseDialog({
        open: true,
        isEdit: true,
        id: course.id,
        form: {
          kode: course.kode,
          nama: course.nama,
          sks: course.sks,
          prodi_id: course.prodi_id || 1,
          semester_rekomendasi: course.semester_rekomendasi || 1,
          deskripsi: course.deskripsi || '',
          status: course.status || 'approved',
        },
      });
    } else {
      setCourseDialog({
        open: true,
        isEdit: false,
        id: null,
        form: {
          kode: '',
          nama: '',
          sks: 3,
          prodi_id: prodiList[0]?.id || 1,
          semester_rekomendasi: 1,
          deskripsi: '',
          status: 'approved',
        },
      });
    }
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    const { isEdit, id, form } = courseDialog;
    try {
      if (isEdit) {
        await materialApi.updateCourse(id, form);
        toast.success('Mata kuliah berhasil diperbarui.');
      } else {
        await materialApi.createCourse(form);
        toast.success('Mata kuliah baru berhasil ditambahkan.');
      }
      setCourseDialog({ ...courseDialog, open: false });
      await fetchCourses();
      await fetchCatalogs();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteCourse = async () => {
    try {
      await materialApi.deleteCourse(deleteCourseDialog.id);
      toast.success('Mata kuliah berhasil dihapus.');
      setDeleteCourseDialog({ open: false, id: null, nama: '' });
      await fetchCourses();
      await fetchCatalogs();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ============================================================================
  // HANDLERS LAPORAN KONTEN MATERI
  // ============================================================================
  const handleReportAction = async (e) => {
    e.preventDefault();
    const { reportId, action, takedownNote } = reportActionDialog;
    try {
      await materialApi.handleReport(reportId, { action, takedownNote });
      toast.success(
        action === 'takedown'
          ? 'Materi berhasil diturunkan dan laporan diselesaikan.'
          : 'Laporan telah diabaikan.'
      );
      setReportActionDialog({ open: false, reportId: null, action: '', takedownNote: '' });
      await fetchReports();
      await fetchMaterials();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ============================================================================
  // HANDLERS PAKET BELAJAR SEMESTER
  // ============================================================================
  const handleCreatePackage = async (e) => {
    e.preventDefault();
    if (!newPackageForm.judul.trim()) {
      toast.warning('Judul paket belajar wajib diisi.');
      return;
    }
    try {
      await materialApi.createLearningPackage(newPackageForm);
      toast.success('Paket belajar semester berhasil dikurasi!');
      setNewPackageDialog(false);
      setNewPackageForm({
        prodi_id: 1,
        semester: 1,
        judul: '',
        deskripsi: '',
        material_ids: [],
      });
      await fetchPackages();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeletePackage = async (id, judul) => {
    if (!window.confirm(`Hapus paket belajar "${judul}"?`)) return;
    try {
      await materialApi.deleteLearningPackage(id);
      toast.success('Paket belajar berhasil dihapus.');
      await fetchPackages();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Hitung Badge Angka Statistik Cepat
  const pendingMatCount = materials.filter((m) => m.status === 'pending').length;
  const pendingRepCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header Halaman Pengelola Materi */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
            Kurikulum & Repositori Akademik
          </span>
          <h1 className="section-title mt-1">Kelola Materi Perkuliahan & Perizinan</h1>
          <p className="text-muted mb-0 mt-1 text-sm">
            Kendalikan izin tayang (ACC), takedown pelanggaran hak cipta, kelola katalog kurikulum mata kuliah, dan paket belajar semester.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/akademik/materi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-navy-800 dark:text-slate-200"
          >
            <span>Buka Perpustakaan Materi</span>
            <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
          </Link>
        </div>
      </div>

      {/* Quick Stat Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Menunggu Izin</span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {pendingMatCount}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <HowToRegRoundedIcon />
          </div>
        </div>

        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Materi</span>
            <div className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              {materials.length}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <MenuBookRoundedIcon />
          </div>
        </div>

        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Usulan MK Baru</span>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
              {pendingCourses.length}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <SchoolRoundedIcon />
          </div>
        </div>

        <div className="card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Laporan Konten</span>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-0.5">
              {pendingRepCount}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
            <FlagRoundedIcon />
          </div>
        </div>
      </div>

      {/* Navigasi Tab Pengelola Materi */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab
            value="materials"
            label={`Izin & Status Materi (${materials.length})`}
          />
          <Tab
            value="courses"
            label={`Katalog Kurikulum & Usulan MK (${courses.length}${pendingCourses.length > 0 ? ` +${pendingCourses.length}` : ''})`}
          />
          <Tab
            value="reports"
            label={`Laporan Pelanggaran (${reports.length})`}
          />
          <Tab
            value="packages"
            label={`Paket Belajar Semester (${packages.length})`}
          />
        </Tabs>
      </div>

      {/* ===================================================================== */}
      {/* 1. TAB IZIN & STATUS MATERI                                           */}
      {/* ===================================================================== */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Bar Filter Status, Prodi, Semester, & Pencarian */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <TextField
                select
                size="small"
                label="Status Perizinan"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-44"
              >
                <MenuItem value="">Semua Status</MenuItem>
                <MenuItem value="pending">⏳ Menunggu Izin</MenuItem>
                <MenuItem value="approved">✅ Aktif Tayang</MenuItem>
                <MenuItem value="rejected">❌ Ditolak</MenuItem>
                <MenuItem value="takedown">🚫 Diturunkan (Takedown)</MenuItem>
              </TextField>

              <TextField
                select
                size="small"
                label="Program Studi"
                value={filterProdi}
                onChange={(e) => setFilterProdi(e.target.value)}
                className="w-44"
              >
                <MenuItem value="">Semua Prodi</MenuItem>
                {prodiList.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.kode} - {p.nama}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Semester"
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="w-32"
              >
                <MenuItem value="">Semua</MenuItem>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <MenuItem key={s} value={s}>
                    Semester {s}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            <div className="w-full md:max-w-xs">
              <TextField
                fullWidth
                size="small"
                placeholder="Cari judul materi / kode MK..."
                value={searchMaterial}
                onChange={(e) => setSearchMaterial(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </div>
          </div>

          {/* Daftar Materi & Tombol Aksi Perizinan */}
          {loadingMaterials ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="card-surface p-5 animate-pulse space-y-2">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : materials.length === 0 ? (
            <EmptyState
              title="Tidak ada materi ditemukan"
              description="Tidak ada materi perkuliahan yang sesuai dengan filter pencarian Anda."
            />
          ) : (
            <div className="space-y-3">
              {materials.map((m) => {
                const badge = STATUS_BADGES[m.status] || STATUS_BADGES.pending;
                return (
                  <div
                    key={m.id}
                    className="card-surface p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {m.mata_kuliah_kode} • Sem {m.semester_rekomendasi}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {MATERIAL_TYPES[m.tipe_materi] || m.tipe_materi}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {m.judul}
                      </h4>

                      {m.deskripsi && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {m.deskripsi}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Pengunggah: {m.uploader_nama || m.uploader_name} ({m.uploader_role === 'alumni' ? 'Alumni' : 'Mahasiswa'}{m.uploader_nim ? ` • ${m.uploader_nim}` : ''})
                        </span>
                        <span>•</span>
                        <span>{formatDateTime(m.created_at)}</span>
                        <span>•</span>
                        <span>📁 {m.total_files || 0} Berkas</span>
                        <span>•</span>
                        <span>👍 {m.helpful_votes || 0} Bermanfaat</span>

                        {m.moderation_note && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-medium">Catatan: "{m.moderation_note}"</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Tombol Perizinan & Kontrol Admin */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 md:pt-0">
                      {/* 1. Beri Izin (Setujui / ACC) */}
                      {m.status !== 'approved' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckRoundedIcon />}
                          onClick={() => handleApproveMaterial(m.id)}
                          sx={{ borderRadius: 1.5, fontSize: 11 }}
                        >
                          Beri Izin (ACC)
                        </Button>
                      )}

                      {/* 2. Tolak Materi */}
                      {m.status === 'pending' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<BlockRoundedIcon />}
                          onClick={() =>
                            setModerateDialog({
                              open: true,
                              materialId: m.id,
                              materialTitle: m.judul,
                              status: 'rejected',
                              note: '',
                            })
                          }
                          sx={{ borderRadius: 1.5, fontSize: 11 }}
                        >
                          Tolak
                        </Button>
                      )}

                      {/* 3. Takedown / Cabut Izin Tayang */}
                      {m.status === 'approved' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<BlockRoundedIcon />}
                          onClick={() =>
                            setModerateDialog({
                              open: true,
                              materialId: m.id,
                              materialTitle: m.judul,
                              status: 'takedown',
                              note: '',
                            })
                          }
                          sx={{ borderRadius: 1.5, fontSize: 11 }}
                        >
                          Takedown
                        </Button>
                      )}

                      {/* 4. Buka Halaman Materi */}
                      <Link
                        to={`/akademik/materi/detail/${m.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                      >
                        <span>Lihat</span>
                        <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                      </Link>

                      {/* 5. Hapus Permanen */}
                      <button
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            materialId: m.id,
                            materialTitle: m.judul,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Hapus Materi Permanen"
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. TAB KATALOG KURIKULUM & USULAN MK                                  */}
      {/* ===================================================================== */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {/* Sub-section: Usulan Mata Kuliah Baru Mahasiswa */}
          {pendingCourses.length > 0 && (
            <div className="rounded-2xl border border-sky-300 bg-sky-50/60 p-5 dark:border-sky-800 dark:bg-sky-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200 font-black text-sm">
                  <SchoolRoundedIcon />
                  <span>Antrean Usulan Mata Kuliah Baru dari Mahasiswa ({pendingCourses.length})</span>
                </div>
                <span className="text-[11px] text-sky-700 dark:text-sky-300">
                  Perlu ditinjau sebelum aktif di katalog
                </span>
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
                        Setujui Usulan
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

          {/* Action Header & Filter Mata Kuliah */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <TextField
                select
                size="small"
                label="Filter Prodi"
                value={courseFilterProdi}
                onChange={(e) => setCourseFilterProdi(e.target.value)}
                className="w-44"
              >
                <MenuItem value="">Semua Prodi</MenuItem>
                {prodiList.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.kode} - {p.nama}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Semester"
                value={courseFilterSemester}
                onChange={(e) => setCourseFilterSemester(e.target.value)}
                className="w-32"
              >
                <MenuItem value="">Semua</MenuItem>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <MenuItem key={s} value={s}>
                    Semester {s}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                placeholder="Cari kode/nama..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-44"
              />
            </div>

            <Button
              variant="contained"
              color="primary"
              startIcon={<AddRoundedIcon />}
              onClick={() => handleOpenCourseDialog()}
              sx={{ borderRadius: 2 }}
            >
              + Tambah Mata Kuliah
            </Button>
          </div>

          {/* Tabel / Grid Mata Kuliah */}
          {loadingCourses ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="card-surface p-5 animate-pulse space-y-2">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="card-surface p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>{c.kode} • {c.sks} SKS</span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {c.prodi_kode || 'TIF'} • Sem {c.semester_rekomendasi}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                      {c.nama}
                    </h4>

                    {c.deskripsi && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {c.deskripsi}
                      </p>
                    )}

                    <div className="mt-3 text-[11px] text-slate-400">
                      📚 {c.total_materials || 0} Materi Pembelajaran Tersedia
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Link
                      to={`/akademik/materi/matkul/${c.id}`}
                      target="_blank"
                      className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <span>Buka Koleksi Materi</span>
                      <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                    </Link>

                    <div className="flex items-center gap-1">
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<EditRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={() => handleOpenCourseDialog(c)}
                        sx={{ fontSize: 11 }}
                      >
                        Edit
                      </Button>
                      <button
                        onClick={() => setDeleteCourseDialog({ open: true, id: c.id, nama: c.nama })}
                        className="p-1 text-slate-400 hover:text-red-600 transition"
                        title="Hapus Mata Kuliah"
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. TAB LAPORAN PELANGGARAN KONTEN MATERI                              */}
      {/* ===================================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {loadingReports ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="card-surface p-5 animate-pulse space-y-2">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              title="Antrean Laporan Bersih"
              description="Tidak ada laporan pelanggaran hak cipta atau konten bermasalah saat ini."
            />
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="card-surface p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2.5 py-0.5 text-[10px] font-bold">
                        Pelanggaran: {r.alasan}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        Status: {r.status.toUpperCase()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Materi: "{r.materi_judul}" ({r.mata_kuliah_nama})
                    </h4>

                    {r.deskripsi && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Catatan pelapor: "{r.deskripsi}"
                      </p>
                    )}

                    <div className="text-[11px] text-slate-400">
                      Dilaporkan oleh: <strong>{r.reporter_nama}</strong> • Diunggah oleh: <strong>{r.uploader_nama}</strong> • {formatDateTime(r.created_at)}
                    </div>
                  </div>

                  {r.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<BlockRoundedIcon />}
                        onClick={() =>
                          setReportActionDialog({
                            open: true,
                            reportId: r.id,
                            action: 'takedown',
                            takedownNote: `Diturunkan karena laporan ${r.alasan}: ${r.deskripsi || ''}`,
                          })
                        }
                      >
                        Takedown Materi
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={() =>
                          setReportActionDialog({
                            open: true,
                            reportId: r.id,
                            action: 'dismissed',
                            takedownNote: '',
                          })
                        }
                      >
                        Abaikan
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. TAB PAKET BELAJAR SEMESTER                                         */}
      {/* ===================================================================== */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kurasi Paket Belajar (Starter Pack)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kumpulan materi pilihan siap unduh dalam bentuk ZIP per program studi & semester.
              </p>
            </div>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddRoundedIcon />}
              onClick={() => setNewPackageDialog(true)}
              sx={{ borderRadius: 2 }}
            >
              + Buat Paket Belajar Baru
            </Button>
          </div>

          {loadingPackages ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="card-surface p-5 animate-pulse space-y-2">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : packages.length === 0 ? (
            <EmptyState
              title="Belum ada paket belajar"
              description="Kurasi paket belajar starter pack untuk membantu persiapan adik kelas."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="card-surface p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>{pkg.prodi_nama || 'Umum'}</span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        Semester {pkg.semester}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                      {pkg.judul}
                    </h4>

                    {pkg.deskripsi && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {pkg.deskripsi}
                      </p>
                    )}

                    <div className="mt-3 text-[11px] text-slate-400">
                      📦 {pkg.total_materials || 0} Materi Pilihan Terkurasi
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      onClick={() => materialApi.downloadPackageZip(pkg.id, pkg.judul)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                    >
                      <FolderZipRoundedIcon sx={{ fontSize: 16 }} />
                      <span>Uji Unduh ZIP</span>
                    </button>

                    <button
                      onClick={() => handleDeletePackage(pkg.id, pkg.judul)}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                      title="Hapus Paket Belajar"
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIALOGS MODAL OPERASIONAL                                             */}
      {/* ===================================================================== */}

      {/* 1. Modal Alasan Tolak / Takedown Materi */}
      <Dialog
        open={moderateDialog.open}
        onClose={() => setModerateDialog({ ...moderateDialog, open: false })}
        maxWidth="xs"
        fullWidth
      >
        <form onSubmit={handleModerateSubmit}>
          <DialogTitle className="!font-bold !text-base">
            {moderateDialog.status === 'takedown' ? 'Takedown Materi' : 'Tolak Materi'}
          </DialogTitle>
          <DialogContent className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Materi: <strong>{moderateDialog.materialTitle}</strong>
            </p>
            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              label="Catatan / Alasan (Opsional)"
              placeholder={
                moderateDialog.status === 'takedown'
                  ? 'Contoh: Melanggar hak cipta buku komersial...'
                  : 'Contoh: Berkas buram atau tidak sesuai kurikulum...'
              }
              value={moderateDialog.note}
              onChange={(e) => setModerateDialog({ ...moderateDialog, note: e.target.value })}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setModerateDialog({ ...moderateDialog, open: false })} color="inherit">
              Batal
            </Button>
            <Button type="submit" variant="contained" color="error">
              {moderateDialog.status === 'takedown' ? 'Konfirmasi Takedown' : 'Konfirmasi Tolak'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* 2. Dialog Hapus Materi Permanen */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Hapus Materi Permanen"
        message={`Apakah Anda yakin ingin menghapus materi "${deleteDialog.materialTitle}" secara permanen? Seluruh lampiran berkas juga akan dihapus.`}
        confirmText="Hapus Permanen"
        onConfirm={handleDeleteMaterialConfirm}
        onClose={() => setDeleteDialog({ open: false, materialId: null, materialTitle: '' })}
      />

      {/* 3. Modal Form Tambah / Edit Mata Kuliah */}
      <Dialog
        open={courseDialog.open}
        onClose={() => setCourseDialog({ ...courseDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSaveCourse}>
          <DialogTitle className="!font-bold !text-base">
            {courseDialog.isEdit ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah Baru'}
          </DialogTitle>
          <DialogContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 mt-1">
              <TextField
                select
                fullWidth
                size="small"
                label="Program Studi"
                value={courseDialog.form.prodi_id}
                onChange={(e) =>
                  setCourseDialog({
                    ...courseDialog,
                    form: { ...courseDialog.form, prodi_id: e.target.value },
                  })
                }
                required
              >
                {prodiList.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.kode} - {p.nama}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                size="small"
                label="Rekomendasi Semester"
                value={courseDialog.form.semester_rekomendasi}
                onChange={(e) =>
                  setCourseDialog({
                    ...courseDialog,
                    form: { ...courseDialog.form, semester_rekomendasi: e.target.value },
                  })
                }
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <MenuItem key={s} value={s}>
                    Semester {s}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <TextField
                fullWidth
                size="small"
                label="Kode MK"
                placeholder="IF1101"
                value={courseDialog.form.kode}
                onChange={(e) =>
                  setCourseDialog({
                    ...courseDialog,
                    form: { ...courseDialog.form, kode: e.target.value },
                  })
                }
                required
              />
              <TextField
                className="col-span-2"
                fullWidth
                size="small"
                label="Nama Mata Kuliah"
                placeholder="Dasar Pemrograman"
                value={courseDialog.form.nama}
                onChange={(e) =>
                  setCourseDialog({
                    ...courseDialog,
                    form: { ...courseDialog.form, nama: e.target.value },
                  })
                }
                required
              />
            </div>

            <TextField
              type="number"
              fullWidth
              size="small"
              label="Bobot SKS"
              value={courseDialog.form.sks}
              onChange={(e) =>
                setCourseDialog({
                  ...courseDialog,
                  form: { ...courseDialog.form, sks: e.target.value },
                })
              }
              required
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              label="Deskripsi Mata Kuliah (Opsional)"
              value={courseDialog.form.deskripsi}
              onChange={(e) =>
                setCourseDialog({
                  ...courseDialog,
                  form: { ...courseDialog.form, deskripsi: e.target.value },
                })
              }
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCourseDialog({ ...courseDialog, open: false })} color="inherit">
              Batal
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Simpan Mata Kuliah
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* 4. Dialog Hapus Mata Kuliah */}
      <ConfirmDialog
        open={deleteCourseDialog.open}
        title="Hapus Mata Kuliah"
        message={`Apakah Anda yakin ingin menghapus mata kuliah "${deleteCourseDialog.nama}" dari katalog kurikulum?`}
        confirmText="Hapus MK"
        onConfirm={handleDeleteCourse}
        onClose={() => setDeleteCourseDialog({ open: false, id: null, nama: '' })}
      />

      {/* 5. Dialog Selesaikan Laporan Konten */}
      <Dialog
        open={reportActionDialog.open}
        onClose={() => setReportActionDialog({ ...reportActionDialog, open: false })}
        maxWidth="xs"
        fullWidth
      >
        <form onSubmit={handleReportAction}>
          <DialogTitle className="!font-bold !text-base">
            {reportActionDialog.action === 'takedown' ? 'Takedown Materi Sesuai Laporan' : 'Abaikan Laporan'}
          </DialogTitle>
          <DialogContent className="space-y-3">
            <p className="text-xs text-slate-500">
              {reportActionDialog.action === 'takedown'
                ? 'Materi akan diturunkan dari publik dan pelapor akan mendapatkan status terselesaikan.'
                : 'Laporan akan ditutup tanpa mengubah status materi.'}
            </p>
            {reportActionDialog.action === 'takedown' && (
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                label="Catatan Tindakan Takedown"
                value={reportActionDialog.takedownNote}
                onChange={(e) =>
                  setReportActionDialog({ ...reportActionDialog, takedownNote: e.target.value })
                }
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setReportActionDialog({ ...reportActionDialog, open: false })} color="inherit">
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              color={reportActionDialog.action === 'takedown' ? 'error' : 'primary'}
            >
              {reportActionDialog.action === 'takedown' ? 'Takedown & Selesaikan' : 'Abaikan Laporan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* 6. Modal Buat Paket Belajar Baru */}
      <Dialog
        open={newPackageDialog}
        onClose={() => setNewPackageDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleCreatePackage}>
          <DialogTitle className="!font-bold !text-base">
            Buat Paket Belajar Semester (Starter Pack)
          </DialogTitle>
          <DialogContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 mt-1">
              <TextField
                select
                fullWidth
                size="small"
                label="Program Studi"
                value={newPackageForm.prodi_id}
                onChange={(e) => setNewPackageForm({ ...newPackageForm, prodi_id: e.target.value })}
                required
              >
                {prodiList.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.kode} - {p.nama}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                size="small"
                label="Semester"
                value={newPackageForm.semester}
                onChange={(e) => setNewPackageForm({ ...newPackageForm, semester: e.target.value })}
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <MenuItem key={s} value={s}>
                    Semester {s}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            <TextField
              fullWidth
              size="small"
              label="Judul Paket Belajar"
              placeholder="Contoh: Starter Pack Semester 1 Teknik Informatika"
              value={newPackageForm.judul}
              onChange={(e) => setNewPackageForm({ ...newPackageForm, judul: e.target.value })}
              required
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              label="Deskripsi Kurasi"
              placeholder="Kumpulan materi pilihan pengantar pemrograman dan matematika dasar..."
              value={newPackageForm.deskripsi}
              onChange={(e) => setNewPackageForm({ ...newPackageForm, deskripsi: e.target.value })}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setNewPackageDialog(false)} color="inherit">
              Batal
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Simpan Paket Belajar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

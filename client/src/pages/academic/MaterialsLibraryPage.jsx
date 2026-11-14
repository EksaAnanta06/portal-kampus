// FILE: client/src/pages/academic/MaterialsLibraryPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import HelpCenterRoundedIcon from '@mui/icons-material/HelpCenterRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import PostAddRoundedIcon from '@mui/icons-material/PostAddRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import UploadMaterialModal from '../../components/academic/UploadMaterialModal';
import MaterialRulesModal from '../../components/academic/MaterialRulesModal';
import LeaderboardModal from '../../components/academic/LeaderboardModal';
import MaterialRequestsDrawer from '../../components/academic/MaterialRequestsDrawer';
import LearningPackagesModal from '../../components/academic/LearningPackagesModal';
import MyCollectionsModal from '../../components/academic/MyCollectionsModal';
import ProposeCourseModal from '../../components/academic/ProposeCourseModal';

const FALLBACK_PRODI = [
  { id: 1, kode: 'TIF', nama: 'Teknik Informatika' },
  { id: 2, kode: 'SI', nama: 'Sistem Informasi' },
  { id: 3, kode: 'MNJ', nama: 'Manajemen' },
  { id: 4, kode: 'AKT', nama: 'Akuntansi' },
  { id: 5, kode: 'KOM', nama: 'Ilmu Komunikasi' },
];

export default function MaterialsLibraryPage() {
  const user = useAuthStore((s) => s.user);

  // Data State
  const [prodiList, setProdiList] = useState(FALLBACK_PRODI);
  const [selectedProdiId, setSelectedProdiId] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloadingCourseId, setDownloadingCourseId] = useState(null);

  // Modal State
  const [openUpload, setOpenUpload] = useState(false);
  const [openRules, setOpenRules] = useState(false);
  const [openLeaderboard, setOpenLeaderboard] = useState(false);
  const [openRequests, setOpenRequests] = useState(false);
  const [openPackages, setOpenPackages] = useState(false);
  const [openCollections, setOpenCollections] = useState(false);
  const [openPropose, setOpenPropose] = useState(false);

  // Fetch Daftar Prodi
  const fetchProdi = async () => {
    try {
      const res = await materialApi.getProdiList();
      const list = res.data || [];
      if (list.length > 0) {
        setProdiList(list);
      }
    } catch {
      // Gunakan fallback prodi jika fetch gagal
    }
  };

  // Fetch Mata Kuliah berdasarkan Prodi & Semester
  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await materialApi.getCourses({
        prodiId: selectedProdiId || null,
        semester: selectedSemester,
        search,
      });
      setCourses(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat katalog mata kuliah.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdi();
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [selectedProdiId, selectedSemester, search]);

  const handleDownloadCourseZip = async (e, course) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setDownloadingCourseId(course.id);
      toast.info(`Menyiapkan arsip ZIP seluruh materi ${course.kode}...`);
      await materialApi.downloadCourseZip(course.id, `${course.kode}_${course.nama}`);
      toast.success('Unduhan arsip ZIP materi berhasil!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Belum ada materi pembelajaran yang disetujui pada mata kuliah ini.');
    } finally {
      setDownloadingCourseId(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner Peer-to-Peer Library */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-700 to-sky-700 p-6 text-white shadow-xl md:p-10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <MenuBookRoundedIcon sx={{ fontSize: 16 }} />
              <span>Perpustakaan & Repositori Pembelajaran Mahasiswa</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
              Perpustakaan Materi Pasim
            </h1>
            <p className="mt-1 text-xs text-emerald-100 sm:text-sm leading-relaxed">
              Tempat kakak tingkat dan alumni Universitas Nasional Pasim membagikan ringkasan, slide presentasi, modul praktikum, dan video pembahasan untuk adik tingkat.
            </p>

            {/* Quick action buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOpenRequests(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/30"
              >
                <HelpCenterRoundedIcon sx={{ fontSize: 16 }} />
                <span>Papan Minta Materi</span>
              </button>
              <button
                onClick={() => setOpenPackages(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/30"
              >
                <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
                <span>Paket Belajar Semester</span>
              </button>
              <button
                onClick={() => setOpenLeaderboard(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/30"
              >
                <EmojiEventsRoundedIcon sx={{ fontSize: 16 }} />
                <span>Papan Peringkat</span>
              </button>
              <button
                onClick={() => setOpenCollections(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/30"
              >
                <BookmarkRoundedIcon sx={{ fontSize: 16 }} />
                <span>Koleksi Saya</span>
              </button>
            </div>
          </div>

          {/* Action Utama: Bagikan Materi */}
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setOpenUpload(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-xs font-bold text-emerald-800 shadow-lg transition-all duration-200 hover:bg-emerald-50 hover:shadow-xl active:scale-95"
            >
              <AddRoundedIcon sx={{ fontSize: 20, color: 'success.main' }} />
              <span>+ Bagikan Materi Baru</span>
            </button>
            <div className="flex items-center justify-center gap-3 text-[11px] text-emerald-100">
              <button onClick={() => setOpenPropose(true)} className="hover:underline flex items-center gap-1">
                <PostAddRoundedIcon sx={{ fontSize: 14 }} /> Usulkan MK Baru
              </button>
              <span>•</span>
              <button onClick={() => setOpenRules(true)} className="hover:underline flex items-center gap-1">
                <GavelRoundedIcon sx={{ fontSize: 14 }} /> Aturan Konten
              </button>
            </div>
          </div>
        </div>

        {/* Decorative blur circle */}
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Navigasi Jenjang & Program Studi Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {prodiList.map((p) => {
          const isSelected = selectedProdiId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProdiId(p.id)}
              className={`rounded-2xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700'
              }`}
            >
              {p.nama} ({p.kode})
            </button>
          );
        })}
      </div>

      {/* Navigasi Semester 1 s.d. 8 & Search */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Pills Semester 1-8 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Semester:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
            const isSelected = selectedSemester === sem;
            return (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem)}
                className={`h-8 min-w-[32px] rounded-xl px-2.5 text-xs font-black transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-navy-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {sem}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="w-full sm:max-w-xs">
          <TextField
            fullWidth
            size="small"
            placeholder="Cari mata kuliah atau kode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />
        </div>
      </div>

      {/* Grid Katalog Mata Kuliah */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-navy-800">
              <Skeleton variant="text" width="40%" height={24} />
              <Skeleton variant="text" width="80%" height={32} sx={{ mt: 1 }} />
              <Skeleton variant="rectangular" height={80} sx={{ mt: 3, borderRadius: 2 }} />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/50 p-12 text-center dark:border-slate-700 dark:bg-navy-800/40">
          <MenuBookRoundedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-white">
            Belum ada mata kuliah di semester {selectedSemester}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {search
              ? 'Tidak ditemukan mata kuliah yang sesuai kata kunci pencarian.'
              : 'Anda dapat mengusulkan mata kuliah baru untuk kurikulum program studi ini.'}
          </p>
          <button
            onClick={() => setOpenPropose(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <PostAddRoundedIcon sx={{ fontSize: 16 }} />
            <span>Usulkan Mata Kuliah Baru</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg dark:border-slate-800 dark:bg-navy-800"
            >
              <div>
                {/* Meta Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5 font-bold">
                    <SchoolRoundedIcon sx={{ fontSize: 16 }} />
                    {item.kode} • {item.sks} SKS
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Semester {item.semester_rekomendasi}
                  </span>
                </div>

                {/* Judul Mata Kuliah */}
                <Link
                  to={`/akademik/materi/matkul/${item.id}`}
                  className="mt-3 block text-lg font-bold text-slate-900 transition hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                >
                  {item.nama}
                </Link>

                {item.deskripsi && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {item.deskripsi}
                  </p>
                )}

                {/* Jumlah Materi */}
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>📚 {item.total_materials || 0} Materi Tersedia</span>
                  {item.total_materials > 0 && (
                    <button
                      onClick={(e) => handleDownloadCourseZip(e, item)}
                      disabled={downloadingCourseId === item.id}
                      className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      <FolderZipRoundedIcon sx={{ fontSize: 16 }} />
                      <span>{downloadingCourseId === item.id ? 'Mengompres...' : 'Unduh ZIP'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                <Link
                  to={`/akademik/materi/matkul/${item.id}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <span>Buka Koleksi Materi</span>
                  <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals & Drawers */}
      <UploadMaterialModal
        open={openUpload}
        onClose={() => setOpenUpload(false)}
        courses={courses}
        onSuccess={fetchCourses}
      />
      <MaterialRulesModal open={openRules} onClose={() => setOpenRules(false)} />
      <LeaderboardModal open={openLeaderboard} onClose={() => setOpenLeaderboard(false)} />
      <MaterialRequestsDrawer open={openRequests} onClose={() => setOpenRequests(false)} courses={courses} />
      <LearningPackagesModal open={openPackages} onClose={() => setOpenPackages(false)} prodiList={prodiList} />
      <MyCollectionsModal open={openCollections} onClose={() => setOpenCollections(false)} />
      <ProposeCourseModal
        open={openPropose}
        onClose={() => setOpenPropose(false)}
        prodiList={prodiList}
        onSuccess={fetchCourses}
      />
    </div>
  );
}

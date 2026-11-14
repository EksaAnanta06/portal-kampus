// FILE: client/src/pages/academic/CourseMaterialsPage.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import UploadMaterialModal from '../../components/academic/UploadMaterialModal';

const MATERIAL_TYPE_LABELS = {
  ringkasan_catatan: '📝 Ringkasan / Catatan',
  slide: '📊 Slide Presentasi',
  modul: '📖 Modul Praktikum',
  soal_latihan: '🎯 Soal Latihan',
  video: '🎬 Video Pembahasan',
  kode_referensi: '💻 Kode Referensi',
  tips_belajar: '💡 Tips Belajar',
  lainnya: '📁 Berkas Lainnya',
};

export default function CourseMaterialsPage() {
  const { courseId } = useParams();
  const user = useAuthStore((s) => s.user);

  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Filter & Search
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [sortOrder, setSortOrder] = useState('terbaru');
  const [openUpload, setOpenUpload] = useState(false);

  const fetchCourseAndMaterials = async () => {
    try {
      setLoading(true);
      const [cRes, mRes] = await Promise.all([
        materialApi.getCourseDetail(courseId),
        materialApi.getMaterials({
          mataKuliahId: courseId,
          tipeMateri: selectedType || null,
          search,
          sort: sortOrder,
        }),
      ]);
      setCourse(cRes.data);
      setMaterials(mRes.data || []);
    } catch (err) {
      toast.error('Gagal memuat materi perkuliahan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseAndMaterials();
  }, [courseId, selectedType, sortOrder, search]);

  const handleDownloadAllZip = async () => {
    try {
      setDownloadingZip(true);
      toast.info('Menyiapkan kompresi streaming arsip ZIP...');
      await materialApi.downloadCourseZip(courseId, `${course?.kode}_${course?.nama}`);
      toast.success('Unduhan arsip ZIP materi berhasil!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunduh arsip materi.');
    } finally {
      setDownloadingZip(false);
    }
  };

  if (!loading && !course) {
    return (
      <div className="mx-auto min-h-screen max-w-4xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold">Mata kuliah tidak ditemukan</h2>
        <Link to="/akademik/materi" className="mt-4 inline-block text-emerald-600 font-semibold underline">
          Kembali ke Repositori Perpustakaan
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          to="/akademik/materi"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
          <span>Kembali ke Perpustakaan Utama</span>
        </Link>
      </div>

      {/* Header Info Mata Kuliah */}
      {course && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800 md:p-8 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <SchoolRoundedIcon sx={{ fontSize: 18 }} />
              <span>
                {course.prodi_nama || 'Program Studi Pasim'} • Semester {course.semester_rekomendasi}
              </span>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {course.sks} SKS
            </span>
          </div>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
                {course.kode} - {course.nama}
              </h1>
              {course.deskripsi && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  {course.deskripsi}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setOpenUpload(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <AddRoundedIcon sx={{ fontSize: 18 }} />
                <span>+ Bagikan Materi</span>
              </button>

              <button
                onClick={handleDownloadAllZip}
                disabled={downloadingZip || materials.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:bg-navy dark:border-slate-700 dark:text-slate-200"
              >
                <FolderZipRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
                <span>{downloadingZip ? 'Mengompres...' : 'Unduh Semua (.ZIP)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tipe, Search, Sort */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <TextField
            select
            size="small"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-48"
          >
            <MenuItem value="">Semua Tipe Materi</MenuItem>
            {Object.entries(MATERIAL_TYPE_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-44"
          >
            <MenuItem value="terbaru">Terbaru</MenuItem>
            <MenuItem value="terpopuler">Terpopuler</MenuItem>
            <MenuItem value="paling_bermanfaat">Paling Bermanfaat</MenuItem>
          </TextField>
        </div>

        <div className="w-full sm:max-w-xs">
          <TextField
            fullWidth
            size="small"
            placeholder="Cari materi..."
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

      {/* Daftar Materi */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-navy-800">
              <Skeleton variant="text" width="60%" height={28} />
              <Skeleton variant="text" width="90%" height={20} sx={{ mt: 1 }} />
            </div>
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-12 text-center dark:border-slate-700 dark:bg-navy-800/40">
          <SchoolRoundedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-white">
            Belum ada materi pembelajaran di mata kuliah ini
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Jadilah kontributor pertama yang membagikan catatan atau soal latihan untuk adik kelas!
          </p>
          <button
            onClick={() => setOpenUpload(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <AddRoundedIcon sx={{ fontSize: 16 }} />
            <span>Bagikan Materi Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {materials.map((item) => {
            // Evaluasi badge Kakak Tingkat otomatis
            const currentYear = new Date().getFullYear();
            const uploaderYear = parseInt(item.uploader_angkatan, 10) || 0;
            const isAlumni = item.uploader_role === 'alumni';
            const isSenior = uploaderYear > 0 && currentYear - uploaderYear >= Math.ceil(item.semester_rekomendasi / 2);
            const isKakakTingkat = isAlumni || isSenior;

            return (
              <div
                key={item.id}
                className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-emerald-500/50 hover:shadow-md dark:border-slate-800 dark:bg-navy-800"
              >
                <div className="space-y-2 max-w-2xl">
                  {/* Badge & Tipe */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {MATERIAL_TYPE_LABELS[item.tipe_materi] || item.tipe_materi}
                    </span>

                    {item.status === 'pending' && (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        ⏳ Menunggu ACC
                      </span>
                    )}

                    {item.dosen_pengampu_teks && (
                      <span className="text-[10px] text-slate-400">
                        • Konteks: {item.dosen_pengampu_teks}
                      </span>
                    )}
                  </div>

                  {/* Judul Materi */}
                  <Link
                    to={`/akademik/materi/detail/${item.id}`}
                    className="block text-base font-bold text-slate-900 transition hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                  >
                    {item.judul}
                  </Link>

                  {item.deskripsi && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {item.deskripsi}
                    </p>
                  )}

                  {/* Info Kontributor */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      Oleh: {item.uploader_nama}
                    </span>

                    {isKakakTingkat && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <WorkspacePremiumRoundedIcon sx={{ fontSize: 12 }} />
                        {isAlumni ? 'Alumni' : 'Kakak Tingkat'}
                      </span>
                    )}

                    <span>• {item.total_files || 0} Berkas</span>
                    <span className="flex items-center gap-1">
                      <ThumbUpAltRoundedIcon sx={{ fontSize: 12, color: 'success.main' }} />
                      {item.helpful_votes || 0} Bermanfaat
                    </span>
                    <span className="flex items-center gap-1">
                      <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 12 }} />
                      {item.total_comments || 0} Diskusi
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/akademik/materi/detail/${item.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-emerald-950/50"
                  >
                    <span>Buka Materi</span>
                    <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Unggah Materi */}
      <UploadMaterialModal
        open={openUpload}
        onClose={() => setOpenUpload(false)}
        courses={course ? [course] : []}
        defaultCourseId={courseId}
        onSuccess={fetchCourseAndMaterials}
      />
    </div>
  );
}

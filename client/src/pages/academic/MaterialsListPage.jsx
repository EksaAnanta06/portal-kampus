// FILE: client/src/pages/academic/MaterialsListPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';

const ALLOWED_DOC_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar';

export default function MaterialsListPage() {
  const user = useAuthStore((s) => s.user);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // State Modal Tambah Materi Perpustakaan
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [formUpload, setFormUpload] = useState({
    kelas_id: '',
    nomor_pertemuan: 1,
    tipe: 'slide',
    judul: '',
    deskripsi: '',
    external_url: '',
  });

  const isStudent = user?.role === 'mahasiswa';
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await materialApi.getMaterialClasses();
      const data = res.data || [];
      setClasses(data);
      if (data.length > 0 && !formUpload.kelas_id) {
        setFormUpload((prev) => ({ ...prev, kelas_id: data[0].kelas_id }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat repositori materi kuliah.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleOpenModal = () => {
    if (classes.length > 0 && !formUpload.kelas_id) {
      setFormUpload((prev) => ({ ...prev, kelas_id: classes[0].kelas_id }));
    }
    setOpenUploadModal(true);
  };

  const handleCloseModal = () => {
    setOpenUploadModal(false);
    setUploadedFile(null);
    setFormUpload({
      kelas_id: classes[0]?.kelas_id || '',
      nomor_pertemuan: 1,
      tipe: 'slide',
      judul: '',
      deskripsi: '',
      external_url: '',
    });
  };

  const handleSubmitUpload = async (e) => {
    e.preventDefault();
    if (!formUpload.kelas_id) {
      toast.warning('Silakan pilih mata kuliah repositori.');
      return;
    }
    if (!formUpload.judul.trim()) {
      toast.warning('Silakan isi judul materi pembelajaran.');
      return;
    }
    if (formUpload.tipe === 'rekaman' && !formUpload.external_url.trim()) {
      toast.warning('Silakan isi tautan video YouTube.');
      return;
    }
    if (formUpload.tipe !== 'rekaman' && !uploadedFile) {
      toast.warning('Silakan unggah berkas materi (PDF, PPT, DOCX, ZIP).');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('nomor_pertemuan', formUpload.nomor_pertemuan);
      formData.append('tipe', formUpload.tipe);
      formData.append('judul', formUpload.judul.trim());
      formData.append('deskripsi', formUpload.deskripsi || '');
      formData.append('is_published', 1);

      if (formUpload.tipe === 'rekaman') {
        formData.append('external_url', formUpload.external_url.trim());
      } else if (uploadedFile) {
        formData.append('file', uploadedFile);
      }

      const res = await materialApi.createMaterialItem(formUpload.kelas_id, formData);
      toast.success(
        res?.message ||
        (isStaff
          ? 'Materi perpustakaan berhasil ditambahkan!'
          : 'Materi berhasil diunggah! Berkas Anda akan ditinjau Admin/Moderator sebelum dipublikasikan.')
      );
      handleCloseModal();
      await fetchClasses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah materi perpustakaan.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClasses = classes.filter((item) => {
    return (
      search.trim() === '' ||
      item.mata_kuliah_nama?.toLowerCase().includes(search.toLowerCase()) ||
      item.mata_kuliah_kode?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-700 to-sky-700 p-6 text-white shadow-lg md:p-10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <MenuBookRoundedIcon sx={{ fontSize: 16 }} />
              <span>Perpustakaan & Repositori Pembelajaran Mahasiswa</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
              Perpustakaan Materi Kuliah
            </h1>
            <p className="mt-1 text-xs text-emerald-100 sm:text-sm">
              Kumpulan modul belajar, slide presentasi PDF, rekaman video, dan silabus yang dibagikan secara sukarela oleh alumni serta mahasiswa tingkat lanjut.
            </p>
          </div>

          {/* Tombol Bagikan / Unggah Materi Perpustakaan */}
          <div className="shrink-0">
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold text-emerald-800 shadow-lg transition-all duration-200 hover:bg-emerald-50 hover:shadow-xl active:scale-95"
            >
              <AddRoundedIcon sx={{ fontSize: 20, color: 'success.main' }} />
              <span>+ Bagikan Materi Perpustakaan</span>
            </button>
          </div>
        </div>

        {/* Decorative circle */}
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Search Bar */}
      <div className="mb-8 max-w-md">
        <TextField
          fullWidth
          size="small"
          placeholder="Cari mata kuliah atau kode materi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />
      </div>

      {/* Grid Mata Kuliah */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-navy-800">
              <Skeleton variant="text" width="50%" height={24} />
              <Skeleton variant="text" width="90%" height={32} sx={{ mt: 1 }} />
              <Skeleton variant="rectangular" height={80} sx={{ mt: 3, borderRadius: 2 }} />
            </div>
          ))}
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/50 p-12 text-center dark:border-slate-700 dark:bg-navy-800/40">
          <MenuBookRoundedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-white">
            Tidak ada modul pembelajaran ditemukan
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {search ? 'Coba ubah kata kunci pencarian Anda.' : 'Repositori materi belum tersedia.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((item) => (
            <div
              key={item.kelas_id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg dark:border-slate-800 dark:bg-navy-800"
            >
              <div>
                {/* Meta Header Bersih Murni Nuansa Perpustakaan */}
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5 font-bold">
                    <SchoolRoundedIcon sx={{ fontSize: 16 }} />
                    Kode: {item.mata_kuliah_kode}
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Perpustakaan Modul
                  </span>
                </div>

                {/* Judul Mata Kuliah */}
                <Link
                  to={`/akademik/materi/${item.kelas_id}`}
                  className="mt-3 block text-lg font-bold text-slate-900 transition hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                >
                  {item.mata_kuliah_nama}
                </Link>

                {/* Jumlah Materi */}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  📚 {item.total_materials || 0} Materi Pembelajaran Tersedia
                </p>

                {/* Progress Belajar (Khusus Mahasiswa) */}
                {isStudent && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-navy dark:border-slate-700/60">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span className="flex items-center gap-1 text-[11px]">
                        <CheckCircleRoundedIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        Progres Pembelajaran
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {item.progress_percentage || 0}%
                      </span>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={item.progress_percentage || 0}
                      color="success"
                      sx={{ borderRadius: 1, height: 6 }}
                    />
                    <span className="mt-1.5 block text-[10px] text-slate-400">
                      {item.completed_materials || 0} dari {item.total_materials || 0} materi telah dipelajari
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                <Link
                  to={`/akademik/materi/${item.kelas_id}`}
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

      {/* Modal Dialog: Bagikan Materi Perpustakaan */}
      <Dialog
        open={openUploadModal}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <DialogTitle className="!font-bold !text-lg !pb-2">
          Bagikan Materi Perpustakaan Baru
        </DialogTitle>
        <DialogContent dividers>
          {!isStaff && (
            <div className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60 leading-relaxed">
              💡 <strong>Catatan Kurasi:</strong> Materi yang Anda bagikan akan ditinjau dan di-ACC oleh Admin/Moderator sebelum dapat dilihat oleh seluruh mahasiswa.
            </div>
          )}

          <form id="upload-library-material-form" onSubmit={handleSubmitUpload} className="space-y-4 pt-1">
            {/* Pilihan Mata Kuliah */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Koleksi Mata Kuliah:
              </label>
              <TextField
                select
                fullWidth
                size="small"
                value={formUpload.kelas_id}
                onChange={(e) => setFormUpload({ ...formUpload, kelas_id: e.target.value })}
                required
              >
                {classes.map((c) => (
                  <MenuItem key={c.kelas_id} value={c.kelas_id}>
                    {c.mata_kuliah_kode} - {c.mata_kuliah_nama}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            {/* Sesi Pertemuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sesi Modul / Pertemuan Ke:
              </label>
              <TextField
                select
                fullWidth
                size="small"
                value={formUpload.nomor_pertemuan}
                onChange={(e) => setFormUpload({ ...formUpload, nomor_pertemuan: Number(e.target.value) })}
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => (
                  <MenuItem key={num} value={num}>
                    Pertemuan {num} {num === 8 ? '(Persiapan UTS)' : num === 16 ? '(Persiapan UAS)' : ''}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            {/* Tipe Materi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tipe Materi:
              </label>
              <TextField
                select
                fullWidth
                size="small"
                value={formUpload.tipe}
                onChange={(e) => setFormUpload({ ...formUpload, tipe: e.target.value })}
              >
                <MenuItem value="slide">Slide Presentasi (PDF)</MenuItem>
                <MenuItem value="silabus">Silabus / RPS Modul</MenuItem>
                <MenuItem value="rekaman">Video Pembahasan / YouTube</MenuItem>
                <MenuItem value="modul_praktikum">Modul Praktikum / Source Code</MenuItem>
                <MenuItem value="lainnya">Dokumen / E-Book Lainnya</MenuItem>
              </TextField>
            </div>

            {/* Judul Materi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Materi Pembelajaran:
              </label>
              <TextField
                fullWidth
                size="small"
                placeholder="Contoh: Rangkuman Materi Database & ERD Diagram"
                value={formUpload.judul}
                onChange={(e) => setFormUpload({ ...formUpload, judul: e.target.value })}
                required
              />
            </div>

            {/* Deskripsi Singkat */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Deskripsi Singkat / Catatan Pembelajaran:
              </label>
              <textarea
                rows={2}
                placeholder="Tuliskan catatan penting, topik yang dibahas, atau pesan untuk adik tingkat..."
                value={formUpload.deskripsi}
                onChange={(e) => setFormUpload({ ...formUpload, deskripsi: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-navy dark:text-slate-200"
              />
            </div>

            {/* Upload File atau URL */}
            {formUpload.tipe === 'rekaman' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL Video YouTube:
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                  value={formUpload.external_url}
                  onChange={(e) => setFormUpload({ ...formUpload, external_url: e.target.value })}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unggah Berkas Materi (PDF, ZIP, DOCX, XLSX, PPTX):
                </label>
                <input
                  type="file"
                  accept={ALLOWED_DOC_ACCEPT}
                  onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-500 file:mr-2 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-300"
                />
                {uploadedFile && (
                  <span className="mt-1 block text-[11px] text-emerald-600 font-semibold">
                    📄 {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                )}
              </div>
            )}
          </form>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseModal} color="inherit" disabled={submitting}>
            Batal
          </Button>
          <Button
            type="submit"
            form="upload-library-material-form"
            variant="contained"
            color="success"
            disabled={submitting}
            startIcon={<CloudUploadRoundedIcon />}
            sx={{ borderRadius: 2 }}
          >
            {submitting ? 'Mengunggah...' : 'Bagikan Materi'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

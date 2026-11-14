// FILE: client/src/components/academic/UploadMaterialModal.jsx
import { useState, useEffect, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import MaterialRulesModal from './MaterialRulesModal';

const ALLOWED_EXTENSIONS = ['pdf', 'zip', 'rar', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE_MB = 10;

const MATERIAL_TYPES = [
  { value: 'ringkasan_catatan', label: '📝 Ringkasan & Catatan Belajar' },
  { value: 'slide', label: '📊 Slide Presentasi (PDF/PPT)' },
  { value: 'modul', label: '📖 Modul Praktikum / Buku Panduan' },
  { value: 'soal_latihan', label: '🎯 Soal Latihan & Pembahasan' },
  { value: 'video', label: '🎬 Video Pembahasan (Link YouTube)' },
  { value: 'kode_referensi', label: '💻 Kode Referensi (ZIP / Repo Git)' },
  { value: 'tips_belajar', label: '💡 Tips Belajar & Proyek' },
  { value: 'lainnya', label: '📁 Berkas Pembelajaran Lainnya' },
];

export default function UploadMaterialModal({ open, onClose, courses = [], defaultCourseId = '', onSuccess }) {
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    mata_kuliah_id: defaultCourseId || '',
    tipe_materi: 'ringkasan_catatan',
    judul: '',
    deskripsi: '',
    tags: '',
    tahun_akademik: '2025/2026',
    angkatan_kontributor: user?.angkatan_year || user?.angkatan || '',
    dosen_pengampu_teks: '',
    sumber_kredit: '',
    external_url: '',
    agreement_checked: false,
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [courseList, setCourseList] = useState(courses);

  useEffect(() => {
    if (open) {
      if (defaultCourseId) {
        setForm((prev) => ({ ...prev, mata_kuliah_id: defaultCourseId }));
      }
      materialApi
        .getCourses({ all: false })
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setCourseList(res.data);
            if (!defaultCourseId && !form.mata_kuliah_id) {
              setForm((prev) => ({ ...prev, mata_kuliah_id: res.data[0].id }));
            }
          }
        })
        .catch(() => {
          if (courses && courses.length > 0) setCourseList(courses);
        });
    }
  }, [open, defaultCourseId]);

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  const handleFilesSelect = (files) => {
    const validFiles = [];
    for (const f of files) {
      const ext = f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.warning(`Format berkas "${f.name}" tidak didukung.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.warning(`Ukuran berkas "${f.name}" melebihi batas ${MAX_FILE_SIZE_MB} MB.`);
        continue;
      }
      validFiles.push(f);
    }

    setSelectedFiles((prev) => [...prev, ...validFiles].slice(0, 10));
  };

  const removeFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.mata_kuliah_id) {
      toast.warning('Silakan pilih mata kuliah.');
      return;
    }
    if (!form.judul.trim()) {
      toast.warning('Silakan masukkan judul materi pembelajaran.');
      return;
    }
    if (form.tipe_materi === 'video' && !form.external_url.trim()) {
      toast.warning('Silakan masukkan tautan video YouTube.');
      return;
    }
    if (form.tipe_materi !== 'video' && selectedFiles.length === 0 && !form.external_url.trim()) {
      toast.warning('Silakan unggah minimal 1 berkas materi atau cantumkan tautan eksternal.');
      return;
    }
    if (!form.agreement_checked) {
      toast.warning('Anda wajib mencentang persetujuan Aturan Berbagi Materi.');
      return;
    }

    try {
      setSubmitting(true);
      setUploadProgress(0);

      const data = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        data.append(key, val);
      });

      selectedFiles.forEach((file) => {
        data.append('files', file);
      });

      const res = await materialApi.createMaterial(data, (percent) => {
        setUploadProgress(percent);
      });

      toast.success(res.message || 'Materi berhasil diunggah!');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah materi pembelajaran.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={submitting ? undefined : onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <DialogTitle className="!font-black !text-lg !text-emerald-700 dark:!text-emerald-400 !flex !items-center !justify-between">
          <span>Bagikan Materi Pembelajaran (Peer-to-Peer)</span>
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 dark:text-slate-400 font-bold"
          >
            <HelpOutlineRoundedIcon sx={{ fontSize: 16 }} />
            <span>Lihat Aturan Konten</span>
          </button>
        </DialogTitle>

        <DialogContent dividers className="space-y-4">
          {!isStaff && (
            <div className="rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60 leading-relaxed">
              💡 <strong>Alur Moderasi:</strong> Materi yang Anda bagikan akan berstatus <em>Pending</em> dan tayang ke publik setelah disetujui Moderator/Admin demi menjaga kualitas dan kepatuhan hak cipta.
            </div>
          )}

          <form id="upload-p2p-material-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Grid Mata Kuliah & Tipe */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mata Kuliah: *
                </label>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={form.mata_kuliah_id}
                  onChange={(e) => setForm({ ...form, mata_kuliah_id: e.target.value })}
                  required
                >
                  {courseList.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.kode} - {c.nama} (Sem {c.semester_rekomendasi})
                    </MenuItem>
                  ))}
                </TextField>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipe Materi: *
                </label>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={form.tipe_materi}
                  onChange={(e) => setForm({ ...form, tipe_materi: e.target.value })}
                  required
                >
                  {MATERIAL_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
            </div>

            {/* Judul Materi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Materi Pembelajaran: *
              </label>
              <TextField
                fullWidth
                size="small"
                placeholder="Contoh: Rangkuman Lengkap Normalisasi Database 1NF s.d. BCNF + Contoh Soal"
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                required
              />
            </div>

            {/* Deskripsi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Deskripsi Singkat / Catatan Pembelajaran:
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan catatan penting, topik yang dibahas, atau saran belajar bagi adik tingkat..."
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-navy dark:text-slate-200"
              />
            </div>

            {/* Metadata Konteks: Tag, Angkatan/Tahun, Dosen Opsional, Sumber */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tag / Kata Kunci (pisahkan koma):
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Contoh: erd, sql, uts, kuis"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dosen Pengampu (Opsional, teks bebas):
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Contoh: Bpk. Dr. Ahmad / Ibu Maya (hanya metadata)"
                  value={form.dosen_pengampu_teks}
                  onChange={(e) => setForm({ ...form, dosen_pengampu_teks: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tahun Akademik / Semester Materi Dibuat:
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Contoh: 2024/2025 Genap"
                  value={form.tahun_akademik}
                  onChange={(e) => setForm({ ...form, tahun_akademik: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sumber / Kredit Asli (Jika merujuk karya lain):
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Contoh: Diadaptasi dari RPS Lab Informatika Pasim"
                  value={form.sumber_kredit}
                  onChange={(e) => setForm({ ...form, sumber_kredit: e.target.value })}
                />
              </div>
            </div>

            {/* Link Eksternal / Video YouTube / Repo Git */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tautan Eksternal / Video YouTube / Link Repo (Opsional):
              </label>
              <TextField
                fullWidth
                size="small"
                placeholder="https://www.youtube.com/watch?v=... atau https://github.com/..."
                value={form.external_url}
                onChange={(e) => setForm({ ...form, external_url: e.target.value })}
              />
            </div>

            {/* Area Drag and Drop Multiple File */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Unggah Berkas Materi (PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ZIP, JPG/PNG - Max 10 MB/file):
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files) handleFilesSelect(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-navy-700/50'
                }`}
              >
                <CloudUploadRoundedIcon sx={{ fontSize: 36, color: 'success.main' }} />
                <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tarik & Lepas berkas di sini, atau <span className="text-emerald-600 underline">Pilih Berkas</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Boleh mengunggah beberapa berkas sekaligus (Maksimal 10 berkas).
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Daftar Berkas Terpilih */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs border border-slate-200 dark:bg-navy dark:border-slate-700"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-sm">
                        📄 {f.name} ({(f.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-red-500 hover:text-red-700 font-bold ml-2 p-1"
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Progress Bar Upload */}
            {submitting && uploadProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-emerald-600">
                  <span>Mengunggah Berkas...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <LinearProgress variant="determinate" value={uploadProgress} color="success" sx={{ borderRadius: 1 }} />
              </div>
            )}

            {/* Checkbox Aturan Berbagi Materi */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.agreement_checked}
                    onChange={(e) => setForm({ ...form, agreement_checked: e.target.checked })}
                    color="success"
                  />
                }
                label={
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Saya menyatakan materi ini <strong>bebas hak cipta bajakan</strong>, bukan kunci jawaban ujian aktif, dan mematuhi{' '}
                    <button
                      type="button"
                      onClick={() => setShowRulesModal(true)}
                      className="font-bold text-emerald-600 underline hover:text-emerald-700"
                    >
                      Aturan Konten & Etika Akademik
                    </button>
                    . *
                  </span>
                }
              />
            </div>
          </form>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit" disabled={submitting}>
            Batal
          </Button>
          <Button
            type="submit"
            form="upload-p2p-material-form"
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

      {/* Modal Aturan Konten */}
      <MaterialRulesModal open={showRulesModal} onClose={() => setShowRulesModal(false)} />
    </>
  );
}

// FILE: client/src/pages/gallery/AngkatanListPage.jsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import Button from '@mui/material/Button';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { galleryApi } from '../../api/gallery.api';
import AngkatanCard, { AngkatanCardSkeleton } from '../../components/gallery/AngkatanCard';
import EditAngkatanDialog from '../../components/gallery/EditAngkatanDialog';
import EmptyState from '../../components/common/EmptyState';
import useAuthStore, { selectIsStaff } from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import {
  ALLOWED_IMAGE_ACCEPT,
  ALLOWED_IMAGE_TYPES,
  ANGKATAN_YEAR_OPTIONS,
  MAX_FILE_SIZE,
  formatBytes,
} from '../../utils/constants';

export default function AngkatanListPage() {
  const isStaff = useAuthStore(selectIsStaff);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog Edit Angkatan (Admin & Moderator)
  const [angkatanToEdit, setAngkatanToEdit] = useState(null);

  // Dialog Tambah Angkatan Baru (Admin & Moderator)
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    title: '',
    description: '',
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAngkatan = async () => {
    setLoading(true);
    try {
      const res = await galleryApi.getAngkatanList();
      setList(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAngkatan();
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreview && coverPreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  const clearCoverSelection = () => {
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview('');
  };

  const handleCloseCreate = () => {
    if (submitting) return;
    setOpenCreate(false);
    clearCoverSelection();
  };

  const handleSelectCover = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Gambar cover harus berupa file JPG, PNG, atau WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Ukuran gambar terlalu besar (${formatBytes(file.size)}). Maksimal 5 MB.`);
      e.target.value = '';
      return;
    }
    clearCoverSelection();
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('year', String(form.year));
      formData.append('title', form.title.trim());
      if (form.description.trim()) formData.append('description', form.description.trim());
      if (coverFile) formData.append('cover', coverFile);

      const res = await galleryApi.createAngkatan(formData);
      toast.success(res.message);
      setOpenCreate(false);
      clearCoverSelection();
      setForm({ year: new Date().getFullYear(), title: '', description: '' });
      fetchAngkatan();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = list.filter((item) => {
    const term = search.toLowerCase();
    return (
      String(item.year).includes(term) ||
      item.title?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
            Arsip Kenangan Kampus
          </span>
          <h1 className="section-title mt-1">Galeri Angkatan UNAS PASIM</h1>
          <p className="text-muted mb-0 mt-2 text-sm max-w-xl">
            Pilih tahun angkatan untuk menelusuri momen PKKMB, perkuliahan, karya inovasi, makrab, KKN, hingga upacara wisuda.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <TextField
            placeholder="Cari tahun atau nama julukan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            className="w-full sm:w-72"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" className="text-slate-400" />
                </InputAdornment>
              ),
            }}
          />

          {isStaff && (
            <Button
              variant="contained"
              startIcon={<AddPhotoAlternateRoundedIcon />}
              onClick={() => setOpenCreate(true)}
              className="!w-full sm:!w-auto whitespace-nowrap"
            >
              Tambah Angkatan
            </Button>
          )}
        </div>
      </div>

      <div>
        {loading ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <AngkatanCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Angkatan tidak ditemukan"
            description={search ? `Tidak ada hasil untuk pencarian "${search}".` : 'Belum ada data angkatan.'}
          />
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <AngkatanCard
                key={item.id}
                angkatan={item}
                onEdit={(a) => setAngkatanToEdit(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog Edit Angkatan (Admin & Moderator) */}
      <EditAngkatanDialog
        open={Boolean(angkatanToEdit)}
        angkatan={angkatanToEdit}
        onClose={() => setAngkatanToEdit(null)}
        onSuccess={() => fetchAngkatan()}
      />

      {/* Dialog Tambah Angkatan (Admin & Moderator) */}
      <Dialog open={openCreate} onClose={handleCloseCreate} fullWidth maxWidth="sm">
        <form onSubmit={handleCreateSubmit}>
          <DialogTitle className="font-bold">Tambah Galeri Angkatan Baru</DialogTitle>
          <DialogContent className="!pt-3 space-y-4">
            <Alert severity="info" className="!text-xs">
              <strong>Gambar Banner Card:</strong> Ini adalah gambar sampul landscape (rekomendasi 16:9) yang menjadi latar kartu angkatan. Bukan untuk unggah foto dokumentasi kegiatan sivitas.
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                select
                label="Tahun Angkatan"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                required
                SelectProps={{ native: true }}
              >
                {ANGKATAN_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </TextField>

              <TextField
                label="Judul / Julukan Angkatan"
                placeholder="Contoh: Angkatan 2026 — Cakrawala Baru"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <TextField
              label="Deskripsi Angkatan"
              multiline
              minRows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ceritakan gambaran singkat tentang generasi angkatan ini..."
            />

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Foto Sampul / Banner (Opsional)
              </span>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800/40">
                {coverPreview ? (
                  <img src={coverPreview} alt="cover preview" className="max-h-40 rounded-lg object-cover" />
                ) : (
                  <>
                    <CloudUploadRoundedIcon className="text-pasim" sx={{ fontSize: 36 }} />
                    <span className="mt-2 text-xs font-semibold">Klik untuk memilih gambar cover</span>
                  </>
                )}
                <input
                  type="file"
                  accept={ALLOWED_IMAGE_ACCEPT}
                  onChange={handleSelectCover}
                  className="hidden"
                />
              </label>
            </div>
          </DialogContent>
          <DialogActions className="!px-6 !pb-5">
            <Button color="inherit" onClick={handleCloseCreate} disabled={submitting}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? 'Menyimpan...' : 'Simpan Angkatan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

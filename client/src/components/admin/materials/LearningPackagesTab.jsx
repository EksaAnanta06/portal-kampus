// FILE: client/src/components/admin/materials/LearningPackagesTab.jsx
import { useState, useEffect, useCallback } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { materialApi } from '../../../api/material.api';
import { getErrorMessage } from '../../../api/axiosInstance';
import { toast } from '../../../store/useThemeStore';
import useDebounce from '../../../hooks/useDebounce';
import ConfirmDialog from '../../common/ConfirmDialog';
import EmptyState from '../../common/EmptyState';
import { MATERIAL_TYPE_LABELS } from '../../../utils/constants';

export default function LearningPackagesTab({ prodiList = [], onPackagesChange }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  const [pkgDialog, setPkgDialog] = useState({
    open: false,
    isEdit: false,
    id: null,
    form: {
      prodi_id: prodiList[0]?.id || 1,
      semester: 1,
      judul: '',
      deskripsi: '',
      material_ids: [],
    },
  });
  const [saving, setSaving] = useState(false);

  // Picker materi terbit untuk kurasi material_ids
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const debouncedMaterialSearch = useDebounce(materialSearch, 300);

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    id: null,
    judul: '',
  });
  const [deleting, setDeleting] = useState(false);

  const fetchPackages = useCallback(async (signal) => {
    try {
      setLoading(true);
      const res = await materialApi.getLearningPackages({}, signal ? { signal } : {});
      if (!signal?.aborted) setPackages(res.data || []);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      toast.error('Gagal memuat paket belajar semester.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPackages(controller.signal);
    return () => controller.abort();
  }, [fetchPackages]);

  // Muat kandidat materi terbit sesuai prodi paket & kata kunci saat modal terbuka
  useEffect(() => {
    if (!pkgDialog.open) return;
    const controller = new AbortController();
    setLoadingAvailable(true);
    materialApi
      .getMaterials(
        {
          status: 'approved',
          prodiId: pkgDialog.form.prodi_id || null,
          search: debouncedMaterialSearch,
          limit: 50,
        },
        { signal: controller.signal }
      )
      .then((res) => {
        if (!controller.signal.aborted) setAvailableMaterials(res.data || []);
      })
      .catch((err) => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setAvailableMaterials([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAvailable(false);
      });

    return () => controller.abort();
  }, [pkgDialog.open, pkgDialog.form.prodi_id, debouncedMaterialSearch]);

  const handleOpenCreate = () => {
    setMaterialSearch('');
    setPkgDialog({
      open: true,
      isEdit: false,
      id: null,
      form: {
        prodi_id: prodiList[0]?.id || 1,
        semester: 1,
        judul: '',
        deskripsi: '',
        material_ids: [],
      },
    });
  };

  const handleOpenEdit = async (pkg) => {
    setMaterialSearch('');
    setPkgDialog({
      open: true,
      isEdit: true,
      id: pkg.id,
      form: {
        prodi_id: pkg.prodi_id || prodiList[0]?.id || 1,
        semester: pkg.semester || 1,
        judul: pkg.judul || '',
        deskripsi: pkg.deskripsi || '',
        material_ids: [],
      },
    });
    try {
      const detail = await materialApi.getLearningPackageDetail(pkg.id);
      const existingIds = (detail.data?.materials || []).map((m) => Number(m.id));
      setPkgDialog((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          material_ids: existingIds,
        },
      }));
    } catch {
      toast.error('Gagal memuat daftar materi isi paket.');
    }
  };

  const handleToggleMaterialId = (materiId) => {
    const numericId = Number(materiId);
    setPkgDialog((prev) => {
      const exists = prev.form.material_ids.includes(numericId);
      const nextIds = exists
        ? prev.form.material_ids.filter((id) => id !== numericId)
        : [...prev.form.material_ids, numericId];
      return {
        ...prev,
        form: { ...prev.form, material_ids: nextIds },
      };
    });
  };

  const handleSavePackage = async (e) => {
    e.preventDefault();
    const { isEdit, id, form } = pkgDialog;
    if (!form.judul.trim()) {
      toast.warning('Judul paket belajar wajib diisi.');
      return;
    }

    const payload = {
      prodi_id: Number(form.prodi_id),
      semester: Number(form.semester),
      judul: form.judul.trim(),
      deskripsi: form.deskripsi.trim(),
      material_ids: form.material_ids,
    };

    try {
      setSaving(true);
      if (isEdit) {
        await materialApi.updateLearningPackage(id, payload);
        toast.success('Paket belajar berhasil diperbarui!');
      } else {
        await materialApi.createLearningPackage(payload);
        toast.success('Paket belajar semester berhasil dikurasi!');
      }
      setPkgDialog((prev) => ({ ...prev, open: false }));
      await fetchPackages();
      onPackagesChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadZip = async (pkg) => {
    try {
      setDownloadingId(pkg.id);
      toast.info(`Menyiapkan kompresi ZIP paket "${pkg.judul}"...`);
      await materialApi.downloadPackageZip(pkg.id, pkg.judul);
      toast.success('Unduhan arsip ZIP paket belajar berhasil!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunduh ZIP paket belajar.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.id) return;
    try {
      setDeleting(true);
      await materialApi.deleteLearningPackage(deleteDialog.id);
      toast.success('Paket belajar berhasil dihapus.');
      setDeleteDialog({ open: false, id: null, judul: '' });
      await fetchPackages();
      onPackagesChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Kurasi Paket Belajar (Starter Pack)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kumpulan materi pilihan siap unduh dalam bentuk ZIP per program studi & semester.
          </p>
        </div>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddRoundedIcon />}
          onClick={handleOpenCreate}
          sx={{ borderRadius: 2, minHeight: 42, shrink: 0 }}
        >
          Buat Paket Belajar Baru
        </Button>
      </div>

      {loading ? (
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
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>{pkg.prodi_nama || 'Umum'}</span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Semester {pkg.semester}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 break-words">
                  {pkg.judul}
                </h4>

                {pkg.deskripsi && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {pkg.deskripsi}
                  </p>
                )}

                <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  {pkg.total_materials || 0} Materi Pilihan Terkurasi
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  disabled={downloadingId === pkg.id || (pkg.total_materials || 0) === 0}
                  onClick={() => handleDownloadZip(pkg)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50"
                >
                  <FolderZipRoundedIcon sx={{ fontSize: 16 }} />
                  <span>{downloadingId === pkg.id ? 'Mengompres...' : 'Unduh ZIP'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
                    onClick={() => handleOpenEdit(pkg)}
                    sx={{ fontSize: 12, minHeight: 40 }}
                  >
                    Edit & Isi
                  </Button>
                  <IconButton
                    onClick={() => setDeleteDialog({ open: true, id: pkg.id, judul: pkg.judul })}
                    className="!min-h-[40px] !min-w-[40px] text-slate-400 hover:text-red-600"
                    aria-label={`Hapus paket ${pkg.judul}`}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 19 }} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create / Edit Paket Belajar + Kurasi Materi */}
      <Dialog
        open={pkgDialog.open}
        onClose={() => !saving && setPkgDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ className: '!rounded-none sm:!rounded-3xl' }}
      >
        <form onSubmit={handleSavePackage}>
          <DialogTitle className="!font-bold !text-base">
            {pkgDialog.isEdit ? 'Edit Paket Belajar & Kurasi Materi' : 'Buat Paket Belajar Semester'}
          </DialogTitle>
          <DialogContent dividers className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                select
                fullWidth
                size="small"
                label="Program Studi"
                value={pkgDialog.form.prodi_id}
                onChange={(e) =>
                  setPkgDialog((prev) => ({
                    ...prev,
                    form: { ...prev.form, prodi_id: e.target.value },
                  }))
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
                label="Semester"
                value={pkgDialog.form.semester}
                onChange={(e) =>
                  setPkgDialog((prev) => ({
                    ...prev,
                    form: { ...prev.form, semester: e.target.value },
                  }))
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

            <TextField
              fullWidth
              size="small"
              label="Judul Paket Belajar"
              placeholder="Contoh: Starter Pack Semester 1 Teknik Informatika"
              value={pkgDialog.form.judul}
              onChange={(e) =>
                setPkgDialog((prev) => ({
                  ...prev,
                  form: { ...prev.form, judul: e.target.value },
                }))
              }
              required
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              label="Deskripsi Kurasi"
              placeholder="Kumpulan materi pilihan pengantar pemrograman dan matematika dasar..."
              value={pkgDialog.form.deskripsi}
              onChange={(e) =>
                setPkgDialog((prev) => ({
                  ...prev,
                  form: { ...prev.form, deskripsi: e.target.value },
                }))
              }
            />

            {/* Picker Materi Terkurasi */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Pilih Materi Terbit untuk Dimasukkan ({pkgDialog.form.material_ids.length} terpilih)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Menampilkan materi terbit pada program studi terpilih.
                  </p>
                </div>
                <TextField
                  size="small"
                  placeholder="Filter judul / kode MK..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  className="w-full sm:w-56"
                />
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {loadingAvailable ? (
                  <div className="py-6 flex justify-center">
                    <CircularProgress size={22} />
                  </div>
                ) : availableMaterials.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Belum ada materi berstatus Terbit pada program studi ini.
                  </p>
                ) : (
                  availableMaterials.map((m) => {
                    const checked = pkgDialog.form.material_ids.includes(Number(m.id));
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition ${
                          checked
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <Checkbox
                          size="small"
                          color="success"
                          checked={checked}
                          onChange={() => handleToggleMaterialId(m.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                            {m.mata_kuliah_kode} • {m.judul}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            Sem {m.semester_rekomendasi} •{' '}
                            {MATERIAL_TYPE_LABELS[m.tipe_materi] || m.tipe_materi} • Oleh:{' '}
                            {m.uploader_nama}
                          </span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => setPkgDialog((prev) => ({ ...prev, open: false }))}
              color="inherit"
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Paket Belajar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Hapus Paket Belajar?"
        message={`Paket belajar "${deleteDialog.judul}" akan dihapus. Materi asli di dalamnya tidak ikut terhapus.`}
        confirmText="Hapus Paket"
        color="error"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => !deleting && setDeleteDialog({ open: false, id: null, judul: '' })}
      />
    </div>
  );
}

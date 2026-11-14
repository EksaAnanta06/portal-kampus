// FILE: client/src/components/gallery/EditAngkatanDialog.jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { galleryApi } from '../../api/gallery.api';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import { ANGKATAN_YEAR_OPTIONS } from '../../utils/constants';

export default function EditAngkatanDialog({ open, angkatan, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    year: '',
    description: '',
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (angkatan) {
      setForm({
        title: angkatan.title || '',
        year: angkatan.year || new Date().getFullYear(),
        description: angkatan.description || '',
      });
      setCoverPreview(angkatan.cover_url || '');
      setCoverFile(null);
    }
  }, [angkatan, open]);

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!angkatan?.id) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      formData.append('year', String(form.year));
      formData.append('description', form.description.trim());
      if (coverFile) {
        formData.append('cover', coverFile);
      }

      const res = await galleryApi.updateAngkatan(angkatan.id, formData);
      toast.success(res.message || `Informasi Angkatan ${form.year} berhasil diperbarui.`);
      if (onSuccess) {
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memperbarui informasi angkatan.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle className="font-bold flex items-center gap-2 !pb-2">
          <EditRoundedIcon className="text-pasim dark:text-pasim-300" />
          <span>Edit Informasi & Card Angkatan</span>
        </DialogTitle>

        <DialogContent className="!pt-3 space-y-4">
          <Alert severity="info" className="!text-xs">
            Admin dan Moderator dapat mengubah judul, julukan, tahun, deskripsi, serta gambar sampul/banner card angkatan ini.
          </Alert>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <TextField
                select
                fullWidth
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
            </div>

            <div className="sm:col-span-2">
              <TextField
                fullWidth
                label="Judul / Nama Julukan Card"
                placeholder="Contoh: Angkatan 2024 — Adhigana"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                helperText="Nama julukan yang tampil pada kartu angkatan"
              />
            </div>
          </div>

          <TextField
            fullWidth
            label="Deskripsi Angkatan"
            multiline
            minRows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Tuliskan cerita singkat, profil, atau kenangan angkatan ini..."
          />

          <div>
            <span className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
              Foto Sampul / Banner Card Angkatan (Landscape 16:9)
            </span>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-pasim hover:bg-pasim-50/40 dark:border-slate-700 dark:bg-slate-800/40">
              {coverPreview ? (
                <div className="space-y-2 w-full">
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="max-h-40 w-full rounded-xl object-cover shadow-sm mx-auto"
                  />
                  <span className="block text-xs font-semibold text-pasim dark:text-pasim-300">
                    Klik di sini untuk mengganti foto banner card
                  </span>
                </div>
              ) : (
                <>
                  <CloudUploadRoundedIcon className="text-pasim" sx={{ fontSize: 36 }} />
                  <span className="mt-2 text-xs font-bold text-slate-800 dark:text-white">
                    Pilih file gambar banner (JPG, PNG, WEBP)
                  </span>
                  <span className="text-[11px] text-muted mt-0.5">
                    Rekomendasi rasio 16:9 (Maks. 5 MB)
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleSelectFile}
                className="hidden"
              />
            </label>
          </div>
        </DialogContent>

        <DialogActions className="!px-6 !pb-5">
          <Button color="inherit" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <EditRoundedIcon />}
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

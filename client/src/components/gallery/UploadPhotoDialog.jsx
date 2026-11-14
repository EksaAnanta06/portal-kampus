// FILE: client/src/components/gallery/UploadPhotoDialog.jsx
import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import { galleryApi } from '../../api/gallery.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import useAuthStore, { selectIsStaff } from '../../store/useAuthStore';
import {
  ALLOWED_IMAGE_ACCEPT,
  ALLOWED_IMAGE_TYPES,
  MAX_FILES_PER_UPLOAD,
  MAX_FILE_SIZE,
  formatBytes,
} from '../../utils/constants';

export default function UploadPhotoDialog({
  open,
  onClose,
  defaultAngkatanId = null,
  angkatanList = [],
  albums = [],
  onSuccess,
}) {
  const isStaff = useAuthStore(selectIsStaff);
  const fileInputRef = useRef(null);
  const filesRef = useRef([]);

  const [files, setFiles] = useState([]); // [{ file, preview }]
  const [angkatanId, setAngkatanId] = useState(defaultAngkatanId || '');
  const [albumId, setAlbumId] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [takenDate, setTakenDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((f) => {
        if (f?.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (open) {
      if (defaultAngkatanId) setAngkatanId(defaultAngkatanId);
      else if (angkatanList.length > 0 && !angkatanId) setAngkatanId(angkatanList[0].id);
    } else {
      // Bersihkan object URL preview
      filesRef.current.forEach((f) => {
        if (f?.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(f.preview);
        }
      });
      setFiles([]);
      setCaption('');
      setTags('');
      setTakenDate('');
      setAlbumId('');
      setProgress(0);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultAngkatanId]);

  const handleSelectFiles = (e) => {
    setError('');
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;

    const remainingSlots = MAX_FILES_PER_UPLOAD - files.length;
    if (remainingSlots <= 0) {
      setError(`Maksimal ${MAX_FILES_PER_UPLOAD} foto dalam satu kali unggah.`);
      return;
    }

    const accepted = [];
    for (const f of incoming.slice(0, remainingSlots)) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        setError(`File "${f.name}" bukan gambar JPG, PNG, atau WEBP.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`Ukuran file "${f.name}" melebihi batas 5 MB (${formatBytes(f.size)}).`);
        continue;
      }
      accepted.push({ file: f, preview: URL.createObjectURL(f) });
    }

    setFiles((prev) => [...prev, ...accepted]);
    e.target.value = '';
  };

  const removeFile = (idx) => {
    URL.revokeObjectURL(files[idx].preview);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (files.length === 0) {
      setError('Pilih minimal 1 file foto.');
      return;
    }
    if (!angkatanId) {
      setError('Pilih angkatan tujuan.');
      return;
    }
    if (caption.trim().length < 3) {
      setError('Caption minimal 3 karakter.');
      return;
    }

    const formData = new FormData();
    files.forEach((item) => formData.append('photos', item.file));
    formData.append('angkatan_id', String(angkatanId));
    if (albumId) formData.append('album_id', String(albumId));
    formData.append('caption', caption.trim());
    if (tags.trim()) formData.append('tags', tags.trim());
    if (takenDate) formData.append('taken_date', takenDate);

    setUploading(true);
    setProgress(0);

    try {
      const res = await galleryApi.uploadPhotos(formData, (p) => setProgress(p));
      toast.success(res.message);
      onSuccess?.(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengunggah foto.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={uploading ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle className="flex items-center justify-between !pb-2">
          <div className="flex items-center gap-2">
            <PhotoLibraryRoundedIcon className="text-pasim" />
            <span className="font-bold text-base sm:text-lg">Unggah Foto Galeri Dokumentasi</span>
          </div>
          <IconButton onClick={onClose} disabled={uploading} size="small" aria-label="Tutup">
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent className="!pt-3">
          {error && (
            <Alert severity="error" className="!mb-4">
              {error}
            </Alert>
          )}

          <Alert severity="info" className="!mb-4 !rounded-xl !text-xs">
            <strong>📸 Foto Galeri Kegiatan:</strong> Form ini khusus untuk mengunggah foto dokumentasi momen sivitas (seperti Ospek, praktikum, makrab, seminar, wisuda).
            <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
              *Catatan: Bukan untuk mengganti foto sampul/banner kartu angkatan. Banner kartu angkatan diatur tersendiri melalui menu pengelola kampus.
            </div>
          </Alert>

          {!isStaff && (
            <Alert severity="warning" className="!mb-4 !rounded-xl !text-xs">
              Foto yang Anda unggah akan ditinjau oleh moderator kampus terlebih dahulu sebelum tayang di galeri publik.
            </Alert>
          )}

          {/* Area drop / pilih file */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-pasim hover:bg-pasim-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-pasim-300"
          >
            <CloudUploadRoundedIcon className="text-pasim dark:text-pasim-300" sx={{ fontSize: 44 }} />
            <p className="mb-0 mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Klik untuk memilih foto dari perangkat
            </p>
            <p className="text-muted mb-0 mt-1 text-xs">
              Maksimal {MAX_FILES_PER_UPLOAD} foto, hingga 5 MB per file (JPG, PNG, WEBP)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_IMAGE_ACCEPT}
              onChange={handleSelectFiles}
              className="hidden"
            />
          </div>

          {/* Thumbnail preview */}
          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {files.map((item, idx) => (
                <div key={item.preview} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700">
                  <img src={item.preview} alt="preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    disabled={uploading}
                    className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-black/70 text-white"
                  >
                    ×
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">
                    {formatBytes(item.file.size)}
                  </span>
                </div>
              ))}
              {files.length < MAX_FILES_PER_UPLOAD && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-transparent text-slate-400 hover:border-pasim hover:text-pasim dark:border-slate-700"
                >
                  <AddPhotoAlternateRoundedIcon fontSize="small" />
                </button>
              )}
            </div>
          )}

          {/* Form metadata */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                select
                label="Angkatan"
                value={angkatanId}
                onChange={(e) => {
                  setAngkatanId(e.target.value);
                  setAlbumId('');
                }}
                required
              >
                {angkatanList.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    Angkatan {a.year} {a.title?.includes('—') ? `— ${a.title.split('—')[1]}` : ''}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Album (opsional)"
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="">— Tanpa Album —</MenuItem>
                {albums.map((al) => (
                  <MenuItem key={al.id} value={al.id}>
                    {al.name}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            <TextField
              label="Caption / Cerita Momen"
              multiline
              minRows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 1000))}
              placeholder="Ceritakan apa yang terjadi pada momen foto ini..."
              helperText={`${caption.length}/1000`}
              required
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Tag (pisahkan koma)"
                value={tags}
                onChange={(e) => setTags(e.target.value.slice(0, 255))}
                placeholder="ospek, kkn, wisuda"
              />
              <TextField
                type="date"
                label="Tanggal Momen (opsional)"
                value={takenDate}
                onChange={(e) => setTakenDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </div>

            {uploading && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Mengunggah ke Cloudinary...</span>
                  <span>{progress}%</span>
                </div>
                <LinearProgress variant={progress > 0 ? 'determinate' : 'indeterminate'} value={progress} />
              </div>
            )}
          </div>
        </DialogContent>

        <DialogActions className="!px-6 !pb-5">
          <Button color="inherit" onClick={onClose} disabled={uploading}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={uploading || files.length === 0}
            startIcon={<CloudUploadRoundedIcon />}
          >
            {uploading ? `Mengunggah (${files.length} foto)...` : `Unggah ${files.length ? `(${files.length}) ` : ''}ke Galeri`}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

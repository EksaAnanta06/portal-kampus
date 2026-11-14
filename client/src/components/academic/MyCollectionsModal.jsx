// FILE: client/src/components/academic/MyCollectionsModal.jsx
import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Skeleton from '@mui/material/Skeleton';
import materialApi from '../../api/material.api';
import { toast } from '../../store/useThemeStore';

export default function MyCollectionsModal({ open, onClose }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await materialApi.getUserCollections();
      setCollections(res.data || []);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCollections();
    }
  }, [open]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!nama.trim()) {
      toast.warning('Silakan masukkan nama koleksi.');
      return;
    }
    try {
      setSubmitting(true);
      await materialApi.createCollection({ nama: nama.trim(), deskripsi });
      toast.success('Koleksi baru berhasil dibuat!');
      setNama('');
      setDeskripsi('');
      setShowAdd(false);
      await fetchCollections();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat koleksi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (colId, colName) => {
    if (!window.confirm(`Hapus koleksi "${colName}"?`)) return;
    try {
      await materialApi.deleteCollection(colId);
      toast.success('Koleksi berhasil dihapus.');
      await fetchCollections();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus koleksi.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ className: '!rounded-3xl' }}>
      <DialogTitle className="!font-black !text-lg !text-emerald-700 dark:!text-emerald-400 !flex !items-center !justify-between">
        <div className="flex items-center gap-2">
          <BookmarkRoundedIcon />
          <span>Koleksi Belajar Saya</span>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            + Buat Koleksi
          </button>
        )}
      </DialogTitle>

      <DialogContent dividers className="space-y-4">
        {showAdd && (
          <form onSubmit={handleCreate} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 dark:border-emerald-800 dark:bg-emerald-950/20">
            <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              Buat Folder Koleksi Baru
            </h4>
            <TextField
              fullWidth
              size="small"
              placeholder="Contoh: Persiapan UTS Algoritma 2026"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
            />
            <TextField
              fullWidth
              size="small"
              placeholder="Deskripsi singkat (opsional)"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="small" onClick={() => setShowAdd(false)} color="inherit">
                Batal
              </Button>
              <Button size="small" type="submit" variant="contained" color="success" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Anda belum memiliki folder koleksi. Buat folder untuk menandai materi-materi favorit Anda.
          </div>
        ) : (
          <div className="space-y-2">
            {collections.map((col) => (
              <div
                key={col.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-navy-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <FolderSpecialRoundedIcon sx={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">{col.nama}</h5>
                    <span className="text-[10px] text-slate-400">
                      {col.total_items || 0} Materi Tersimpan
                      {col.deskripsi ? ` • ${col.deskripsi}` : ''}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(col.id, col.nama)}
                  className="text-slate-400 hover:text-red-600 p-1 transition"
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="inherit" sx={{ borderRadius: 2 }}>
          Tutup
        </Button>
      </DialogActions>
    </Dialog>
  );
}

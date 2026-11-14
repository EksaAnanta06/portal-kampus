// FILE: client/src/components/academic/MyCollectionsModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import materialApi from '../../api/material.api';
import { toast } from '../../store/useThemeStore';
import ConfirmDialog from '../common/ConfirmDialog';
import { MATERIAL_TYPE_LABELS } from '../../utils/constants';

export default function MyCollectionsModal({ open, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Drilldown isi koleksi
  const [selectedCol, setSelectedCol] = useState(null);
  const [colItems, setColItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Konfirmasi hapus folder koleksi
  const [colToDelete, setColToDelete] = useState(null);
  const [deletingCol, setDeletingCol] = useState(false);

  const fetchCollections = useCallback(async (signal) => {
    try {
      setLoading(true);
      const res = await materialApi.getUserCollections(signal ? { signal } : {});
      if (!signal?.aborted) setCollections(res.data || []);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setCollections([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setShowAdd(false);
      setNama('');
      setDeskripsi('');
      setSelectedCol(null);
      setColItems([]);
      setColToDelete(null);
      return;
    }

    const controller = new AbortController();
    fetchCollections(controller.signal);
    return () => controller.abort();
  }, [open, fetchCollections]);

  const handleOpenCollection = async (col) => {
    setSelectedCol(col);
    try {
      setItemsLoading(true);
      const res = await materialApi.getCollectionItems(col.id);
      setColItems(res.data || []);
    } catch {
      setColItems([]);
      toast.error('Gagal memuat daftar materi dalam koleksi.');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleRemoveItem = async (materiId) => {
    if (!selectedCol) return;
    try {
      await materialApi.removeCollectionItem(selectedCol.id, materiId);
      setColItems((prev) => prev.filter((it) => (it.materi_id || it.id) !== materiId));
      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedCol.id
            ? { ...c, total_items: Math.max(0, (c.total_items || 1) - 1) }
            : c
        )
      );
      toast.success('Materi dihapus dari koleksi.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus materi dari koleksi.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!nama.trim()) {
      toast.warning('Silakan masukkan nama koleksi.');
      return;
    }
    try {
      setSubmitting(true);
      await materialApi.createCollection({ nama: nama.trim(), deskripsi: deskripsi.trim() });
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

  const handleConfirmDeleteCol = async () => {
    if (!colToDelete) return;
    try {
      setDeletingCol(true);
      await materialApi.deleteCollection(colToDelete.id);
      toast.success('Koleksi berhasil dihapus.');
      if (selectedCol?.id === colToDelete.id) {
        setSelectedCol(null);
        setColItems([]);
      }
      setColToDelete(null);
      await fetchCollections();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus koleksi.');
    } finally {
      setDeletingCol(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ className: '!rounded-none sm:!rounded-3xl' }}
      >
        <DialogTitle className="!font-black !text-base sm:!text-lg !text-emerald-700 dark:!text-emerald-400 !flex !items-center !justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {selectedCol ? (
              <IconButton
                size="small"
                onClick={() => {
                  setSelectedCol(null);
                  setColItems([]);
                }}
                aria-label="Kembali ke daftar koleksi"
                className="!min-h-[40px] !min-w-[40px]"
              >
                <ArrowBackRoundedIcon fontSize="small" />
              </IconButton>
            ) : (
              <BookmarkRoundedIcon />
            )}
            <span className="truncate">
              {selectedCol ? selectedCol.nama : 'Koleksi Belajar Saya'}
            </span>
          </div>
          {!selectedCol && !showAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="min-h-[40px] px-2 shrink-0 text-xs font-bold text-emerald-600 hover:underline"
            >
              + Buat Koleksi
            </button>
          )}
        </DialogTitle>

        <DialogContent dividers className="space-y-4">
          {selectedCol ? (
            itemsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
                ))}
              </div>
            ) : colItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                Folder koleksi ini masih kosong. Tandai materi dari halaman detail materi untuk menyimpannya di sini.
              </div>
            ) : (
              <div className="space-y-2">
                {colItems.map((item) => {
                  const matId = item.materi_id || item.id;
                  return (
                    <div
                      key={matId}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-navy-800"
                    >
                      <Link
                        to={`/akademik/materi/detail/${matId}`}
                        onClick={onClose}
                        className="min-w-0 flex-1 group"
                      >
                        <h5 className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-600 dark:text-white">
                          {item.mata_kuliah_kode ? `${item.mata_kuliah_kode} • ` : ''}
                          {item.judul}
                        </h5>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {MATERIAL_TYPE_LABELS[item.tipe_materi] || item.tipe_materi}
                        </span>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          to={`/akademik/materi/detail/${matId}`}
                          onClick={onClose}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          aria-label="Buka materi"
                        >
                          <ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />
                        </Link>
                        <IconButton
                          onClick={() => handleRemoveItem(matId)}
                          className="!min-h-[40px] !min-w-[40px] text-slate-400 hover:text-red-600"
                          aria-label="Hapus dari koleksi"
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <>
              {showAdd && (
                <form
                  onSubmit={handleCreate}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 dark:border-emerald-800 dark:bg-emerald-950/20"
                >
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
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                  Anda belum memiliki folder koleksi. Buat folder untuk menandai materi-materi favorit Anda.
                </div>
              ) : (
                <div className="space-y-2">
                  {collections.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-navy-800"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenCollection(col)}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left group"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <FolderSpecialRoundedIcon sx={{ fontSize: 20 }} />
                        </div>
                        <div className="min-w-0">
                          <h5 className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-600 dark:text-white">
                            {col.nama}
                          </h5>
                          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {col.total_items || 0} Materi Tersimpan
                            {col.deskripsi ? ` • ${col.deskripsi}` : ''}
                          </span>
                        </div>
                      </button>

                      <IconButton
                        onClick={() => setColToDelete(col)}
                        className="!min-h-[40px] !min-w-[40px] text-slate-400 hover:text-red-600 shrink-0"
                        aria-label={`Hapus koleksi ${col.nama}`}
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} variant="contained" color="inherit" sx={{ borderRadius: 2, minHeight: 40 }}>
            Tutup
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(colToDelete)}
        title="Hapus Folder Koleksi?"
        message={`Koleksi "${colToDelete?.nama || ''}" beserta seluruh penandanya akan dihapus.`}
        confirmText="Hapus Koleksi"
        color="error"
        loading={deletingCol}
        onClose={() => !deletingCol && setColToDelete(null)}
        onConfirm={handleConfirmDeleteCol}
      />
    </>
  );
}

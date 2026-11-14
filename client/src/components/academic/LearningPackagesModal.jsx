// FILE: client/src/components/academic/LearningPackagesModal.jsx
import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded';
import Skeleton from '@mui/material/Skeleton';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';

export default function LearningPackagesModal({ open, onClose, prodiList = [] }) {
  const user = useAuthStore((s) => s.user);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await materialApi.getLearningPackages();
      setPackages(res.data || []);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPackages();
    }
  }, [open]);

  const handleOpenDetail = async (pkgId) => {
    try {
      const res = await materialApi.getLearningPackageDetail(pkgId);
      setSelectedPkg(res.data);
    } catch (err) {
      toast.error('Gagal memuat rincian paket belajar.');
    }
  };

  const handleDownloadZip = async (pkg) => {
    try {
      setDownloadingId(pkg.id);
      toast.info('Menyiapkan kompresi arsip ZIP paket belajar...');
      await materialApi.downloadPackageZip(pkg.id, pkg.judul);
      toast.success('Unduhan arsip ZIP paket belajar berhasil!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunduh paket belajar.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ className: '!rounded-3xl' }}>
      <DialogTitle className="!font-black !text-lg !text-emerald-700 dark:!text-emerald-400 !flex !items-center !justify-between">
        <div className="flex items-center gap-2">
          <AutoAwesomeRoundedIcon />
          <span>Paket Belajar Semester (Kurasi Starter Pack)</span>
        </div>
      </DialogTitle>

      <DialogContent dividers className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Kumpulan materi pilihan kurasi per program studi dan semester yang siap diunduh sekali klik untuk persiapan kuliah baru atau bahan belajar ujian.
        </p>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Belum ada paket belajar semester yang dikurasi saat ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-500 hover:shadow-md dark:border-slate-800 dark:bg-navy-800"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span>{pkg.prodi_nama || 'Umum'}</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Semester {pkg.semester}
                    </span>
                  </div>

                  <h4 className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                    {pkg.judul}
                  </h4>
                  {pkg.deskripsi && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {pkg.deskripsi}
                    </p>
                  )}
                  <span className="mt-2 block text-[11px] text-slate-400">
                    📦 {pkg.total_materials || 0} Materi Pilihan
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    onClick={() => handleOpenDetail(pkg.id)}
                    className="text-xs font-bold text-slate-600 hover:text-emerald-600 dark:text-slate-300"
                  >
                    Lihat Isi
                  </button>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    disabled={downloadingId === pkg.id}
                    onClick={() => handleDownloadZip(pkg)}
                    startIcon={<FolderZipRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={{ borderRadius: 1.5, fontSize: 11 }}
                  >
                    {downloadingId === pkg.id ? 'Mengompres...' : 'Unduh ZIP'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Sub-Detail Isi Paket */}
        {selectedPkg && (
          <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                Isi Paket: {selectedPkg.judul}
              </h4>
              <button
                onClick={() => setSelectedPkg(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕ Tutup
              </button>
            </div>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {selectedPkg.materials?.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl bg-white p-2.5 text-xs border border-slate-200 dark:bg-navy dark:border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {m.mata_kuliah_kode} - {m.judul}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      Tipe: {m.tipe_materi} • Oleh: {m.uploader_nama}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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

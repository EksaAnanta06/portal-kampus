// FILE: client/src/components/admin/materials/MaterialsModerationTab.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import Pagination from '@mui/material/Pagination';
import IconButton from '@mui/material/IconButton';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { materialApi } from '../../../api/material.api';
import { getErrorMessage } from '../../../api/axiosInstance';
import { toast } from '../../../store/useThemeStore';
import useDebounce from '../../../hooks/useDebounce';
import EmptyState from '../../common/EmptyState';
import ConfirmDialog from '../../common/ConfirmDialog';
import { formatDateTime } from '../../../utils/formatDate';
import { MATERIAL_STATUS_LABELS, MATERIAL_TYPE_LABELS } from '../../../utils/constants';

const STATUS_BADGE_STYLES = {
  approved:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  pending:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  rejected:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  takedown:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
};

export default function MaterialsModerationTab({
  prodiList = [],
  initialStatus = '',
  onSummaryChange,
}) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(initialStatus);
  const [filterProdi, setFilterProdi] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [moderateDialog, setModerateDialog] = useState({
    open: false,
    materialId: null,
    materialTitle: '',
    status: '',
    note: '',
  });
  const [submittingModeration, setSubmittingModeration] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    materialId: null,
    materialTitle: '',
  });
  const [deleting, setDeleting] = useState(false);

  const fetchMaterials = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        const res = await materialApi.getMaterials(
          {
            status: filterStatus || null,
            prodiId: filterProdi || null,
            semester: filterSemester || null,
            search: debouncedSearch,
            page,
            limit: 15,
          },
          signal ? { signal } : {}
        );
        if (signal?.aborted) return;
        setMaterials(res.data || []);
        setTotalPages(Math.max(1, res.meta?.totalPages || 1));
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        toast.error('Gagal memuat daftar materi perkuliahan.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filterStatus, filterProdi, filterSemester, debouncedSearch, page]
  );

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterProdi, filterSemester, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchMaterials(controller.signal);
    return () => controller.abort();
  }, [fetchMaterials]);

  const handleApprove = async (materialId) => {
    try {
      await materialApi.moderateMaterial(materialId, { status: 'approved' });
      toast.success('Izin tayang materi disetujui (ACC). Materi kini dapat diakses publik.');
      await fetchMaterials();
      onSummaryChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleModerateSubmit = async (e) => {
    e.preventDefault();
    const { materialId, status, note } = moderateDialog;
    try {
      setSubmittingModeration(true);
      await materialApi.moderateMaterial(materialId, { status, note: note.trim() });
      toast.success(
        status === 'takedown'
          ? 'Materi telah dicabut/diturunkan (Takedown).'
          : 'Materi telah ditolak.'
      );
      setModerateDialog({ open: false, materialId: null, materialTitle: '', status: '', note: '' });
      await fetchMaterials();
      onSummaryChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingModeration(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.materialId) return;
    try {
      setDeleting(true);
      await materialApi.deleteMaterial(deleteDialog.materialId);
      toast.success('Materi berhasil dihapus permanen.');
      setDeleteDialog({ open: false, materialId: null, materialTitle: '' });
      await fetchMaterials();
      onSummaryChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bar Filter Status, Prodi, Semester & Pencarian */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
          <TextField
            select
            size="small"
            label="Status Perizinan"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-44"
          >
            <MenuItem value="">Semua Status</MenuItem>
            <MenuItem value="pending">Menunggu Izin</MenuItem>
            <MenuItem value="approved">Aktif Tayang</MenuItem>
            <MenuItem value="rejected">Ditolak</MenuItem>
            <MenuItem value="takedown">Ditakedown</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Program Studi"
            value={filterProdi}
            onChange={(e) => setFilterProdi(e.target.value)}
            className="w-full sm:w-44"
          >
            <MenuItem value="">Semua Prodi</MenuItem>
            {prodiList.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.kode} - {p.nama}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Semester"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="w-full sm:w-32"
          >
            <MenuItem value="">Semua</MenuItem>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <MenuItem key={s} value={s}>
                Semester {s}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <div className="w-full md:max-w-xs">
          <TextField
            fullWidth
            size="small"
            placeholder="Cari judul materi / kode MK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </div>
      </div>

      {/* Daftar Materi & Tombol Aksi Perizinan */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card-surface p-5 animate-pulse space-y-2">
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : materials.length === 0 ? (
        <EmptyState
          title="Tidak ada materi ditemukan"
          description="Tidak ada materi perkuliahan yang sesuai dengan filter pencarian Anda."
        />
      ) : (
        <>
          <div className="space-y-3">
            {materials.map((m) => {
              const badgeClass = STATUS_BADGE_STYLES[m.status] || STATUS_BADGE_STYLES.pending;
              const statusLabel = MATERIAL_STATUS_LABELS[m.status] || m.status;
              return (
                <div
                  key={m.id}
                  className="card-surface p-4 sm:p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black border ${badgeClass}`}>
                        {statusLabel}
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {m.mata_kuliah_kode} • Sem {m.semester_rekomendasi}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {MATERIAL_TYPE_LABELS[m.tipe_materi] || m.tipe_materi}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 dark:text-white break-words">
                      {m.judul}
                    </h4>

                    {m.deskripsi && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {m.deskripsi}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        Pengunggah: {m.uploader_nama || m.uploader_name} (
                        {m.uploader_role === 'alumni' ? 'Alumni' : 'Mahasiswa'}
                        {m.uploader_nim ? ` • ${m.uploader_nim}` : ''})
                      </span>
                      <span>• {formatDateTime(m.created_at)}</span>
                      <span>• {m.total_files || 0} Berkas</span>
                      <span>• {m.helpful_votes || 0} Bermanfaat</span>
                      {m.moderation_note && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          • Catatan: "{m.moderation_note}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tombol Perizinan & Kontrol Admin */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 md:pt-0">
                    {m.status !== 'approved' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        onClick={() => handleApprove(m.id)}
                        sx={{ borderRadius: 1.5, fontSize: 11, minHeight: 40 }}
                      >
                        ACC
                      </Button>
                    )}

                    {m.status === 'pending' && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<BlockRoundedIcon />}
                        onClick={() =>
                          setModerateDialog({
                            open: true,
                            materialId: m.id,
                            materialTitle: m.judul,
                            status: 'rejected',
                            note: '',
                          })
                        }
                        sx={{ borderRadius: 1.5, fontSize: 11, minHeight: 40 }}
                      >
                        Tolak
                      </Button>
                    )}

                    {m.status === 'approved' && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<BlockRoundedIcon />}
                        onClick={() =>
                          setModerateDialog({
                            open: true,
                            materialId: m.id,
                            materialTitle: m.judul,
                            status: 'takedown',
                            note: '',
                          })
                        }
                        sx={{ borderRadius: 1.5, fontSize: 11, minHeight: 40 }}
                      >
                        Takedown
                      </Button>
                    )}

                    <Link
                      to={`/akademik/materi/detail/${m.id}`}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                    >
                      <span>Lihat</span>
                      <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                    </Link>

                    <IconButton
                      onClick={() =>
                        setDeleteDialog({
                          open: true,
                          materialId: m.id,
                          materialTitle: m.judul,
                        })
                      }
                      className="!min-h-[40px] !min-w-[40px] text-slate-400 hover:text-red-600"
                      aria-label="Hapus Materi Permanen"
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 19 }} />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pt-2 flex justify-center">
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, val) => setPage(val)}
                color="primary"
                shape="rounded"
              />
            </div>
          )}
        </>
      )}

      {/* Modal Alasan Tolak / Takedown */}
      <Dialog
        open={moderateDialog.open}
        onClose={() =>
          !submittingModeration && setModerateDialog({ ...moderateDialog, open: false })
        }
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <form onSubmit={handleModerateSubmit}>
          <DialogTitle className="!font-bold !text-base">
            {moderateDialog.status === 'takedown' ? 'Takedown Materi' : 'Tolak Materi'}
          </DialogTitle>
          <DialogContent className="space-y-3 !pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Materi: <strong>{moderateDialog.materialTitle}</strong>
            </p>
            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              label="Catatan / Alasan"
              placeholder={
                moderateDialog.status === 'takedown'
                  ? 'Contoh: Melanggar hak cipta buku komersial...'
                  : 'Contoh: Berkas buram atau tidak sesuai kurikulum...'
              }
              value={moderateDialog.note}
              onChange={(e) => setModerateDialog({ ...moderateDialog, note: e.target.value })}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setModerateDialog({ ...moderateDialog, open: false })}
              color="inherit"
              disabled={submittingModeration}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={submittingModeration}
            >
              {submittingModeration
                ? 'Memproses...'
                : moderateDialog.status === 'takedown'
                ? 'Konfirmasi Takedown'
                : 'Konfirmasi Tolak'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog Hapus Materi Permanen */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Hapus Materi Permanen"
        message={`Apakah Anda yakin ingin menghapus materi "${deleteDialog.materialTitle}" secara permanen? Seluruh lampiran berkas juga akan dihapus.`}
        confirmText="Hapus Permanen"
        color="error"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() =>
          !deleting && setDeleteDialog({ open: false, materialId: null, materialTitle: '' })
        }
      />
    </div>
  );
}

// FILE: client/src/components/admin/materials/MaterialReportsTab.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Pagination from '@mui/material/Pagination';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { materialApi } from '../../../api/material.api';
import { getErrorMessage } from '../../../api/axiosInstance';
import { toast } from '../../../store/useThemeStore';
import EmptyState from '../../common/EmptyState';
import { formatDateTime } from '../../../utils/formatDate';
import { MATERIAL_REPORT_REASON_LABELS } from '../../../utils/constants';

const REPORT_STATUS_MAP = {
  pending: {
    label: 'Menunggu Tindak Lanjut',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  resolved: {
    label: 'Diselesaikan (Takedown)',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  dismissed: {
    label: 'Diabaikan',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

export default function MaterialReportsTab({ onReportHandled }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [actionDialog, setActionDialog] = useState({
    open: false,
    reportId: null,
    action: '',
    takedownNote: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        const res = await materialApi.getReports(
          {
            status: filterStatus || undefined,
            page,
            limit: 15,
          },
          signal ? { signal } : {}
        );
        if (signal?.aborted) return;
        setReports(res.data || []);
        setTotalPages(Math.max(1, res.meta?.totalPages || 1));
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        toast.error('Gagal memuat laporan pelanggaran materi.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filterStatus, page]
  );

  useEffect(() => {
    setPage(1);
  }, [filterStatus]);

  useEffect(() => {
    const controller = new AbortController();
    fetchReports(controller.signal);
    return () => controller.abort();
  }, [fetchReports]);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    const { reportId, action, takedownNote } = actionDialog;
    try {
      setSubmitting(true);
      await materialApi.handleReport(reportId, {
        action,
        takedown_note: action === 'takedown' ? takedownNote.trim() : '',
      });
      toast.success(
        action === 'takedown'
          ? 'Materi berhasil diturunkan (Takedown) dan laporan diselesaikan.'
          : 'Laporan telah ditandai diabaikan.'
      );
      setActionDialog({ open: false, reportId: null, action: '', takedownNote: '' });
      await fetchReports();
      onReportHandled?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Laporan Pelanggaran Konten & Hak Cipta
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tinjau laporan dari mahasiswa dan turunkan materi jika terbukti melanggar etika atau hak cipta.
          </p>
        </div>

        <TextField
          select
          size="small"
          label="Status Laporan"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
          className="w-full sm:w-52"
        >
          <MenuItem value="">Semua Status</MenuItem>
          <MenuItem value="pending">Menunggu Tindak Lanjut</MenuItem>
          <MenuItem value="resolved">Diselesaikan</MenuItem>
          <MenuItem value="dismissed">Diabaikan</MenuItem>
        </TextField>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card-surface p-5 animate-pulse space-y-2">
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="Antrean Laporan Bersih"
          description="Tidak ada laporan pelanggaran hak cipta atau konten bermasalah sesuai filter ini."
        />
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((r) => {
              const statusInfo = REPORT_STATUS_MAP[r.status] || REPORT_STATUS_MAP.pending;
              const reasonLabel = MATERIAL_REPORT_REASON_LABELS[r.alasan] || r.alasan;

              return (
                <div
                  key={r.id}
                  className="card-surface p-4 sm:p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2.5 py-0.5 text-[11px] font-bold">
                        {reasonLabel}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/akademik/materi/detail/${r.materi_id}`}
                        className="text-sm font-bold text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400 inline-flex items-center gap-1"
                      >
                        <span>
                          {r.materi_judul} ({r.mata_kuliah_nama})
                        </span>
                        <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                      </Link>
                    </div>

                    {r.deskripsi && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Catatan pelapor: "{r.deskripsi}"
                      </p>
                    )}

                    {r.takedown_note && (
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        Catatan tindakan: "{r.takedown_note}"
                      </p>
                    )}

                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pelapor: <strong>{r.reporter_nama || '-'}</strong> • Pengunggah:{' '}
                      <strong>{r.uploader_nama || '-'}</strong> • {formatDateTime(r.created_at)}
                    </div>
                  </div>

                  {r.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<BlockRoundedIcon />}
                        onClick={() =>
                          setActionDialog({
                            open: true,
                            reportId: r.id,
                            action: 'takedown',
                            takedownNote: `Diturunkan karena laporan ${reasonLabel}${r.deskripsi ? `: ${r.deskripsi}` : ''}`,
                          })
                        }
                        sx={{ minHeight: 40 }}
                      >
                        Takedown Materi
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={() =>
                          setActionDialog({
                            open: true,
                            reportId: r.id,
                            action: 'dismissed',
                            takedownNote: '',
                          })
                        }
                        sx={{ minHeight: 40 }}
                      >
                        Abaikan
                      </Button>
                    </div>
                  )}
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

      {/* Dialog Selesaikan Laporan */}
      <Dialog
        open={actionDialog.open}
        onClose={() => !submitting && setActionDialog({ ...actionDialog, open: false })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <form onSubmit={handleReportSubmit}>
          <DialogTitle className="!font-bold !text-base">
            {actionDialog.action === 'takedown'
              ? 'Takedown Materi Sesuai Laporan'
              : 'Abaikan Laporan Pelanggaran'}
          </DialogTitle>
          <DialogContent className="space-y-3 !pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {actionDialog.action === 'takedown'
                ? 'Materi akan diturunkan dari publik dan catatan tindakan akan disimpan pada log moderasi.'
                : 'Laporan akan ditutup tanpa mengubah status tayang materi.'}
            </p>
            {actionDialog.action === 'takedown' && (
              <TextField
                fullWidth
                multiline
                rows={3}
                size="small"
                label="Catatan Tindakan Takedown"
                value={actionDialog.takedownNote}
                onChange={(e) =>
                  setActionDialog({ ...actionDialog, takedownNote: e.target.value })
                }
                required
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setActionDialog({ ...actionDialog, open: false })}
              color="inherit"
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              color={actionDialog.action === 'takedown' ? 'error' : 'primary'}
              disabled={submitting}
            >
              {submitting
                ? 'Memproses...'
                : actionDialog.action === 'takedown'
                ? 'Takedown & Selesaikan'
                : 'Abaikan Laporan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

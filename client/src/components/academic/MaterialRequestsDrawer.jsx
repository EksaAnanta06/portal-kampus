// FILE: client/src/components/academic/MaterialRequestsDrawer.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Skeleton from '@mui/material/Skeleton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpCenterRoundedIcon from '@mui/icons-material/HelpCenterRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';

export default function MaterialRequestsDrawer({ open, onClose, courses = [] }) {
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form Buat Permintaan
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    mata_kuliah_id: '',
    judul: '',
    deskripsi: '',
    tipe_materi_diminta: 'ringkasan_catatan',
  });
  const [submitting, setSubmitting] = useState(false);

  // State Tautkan Jawaban Materi
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [linkMateriId, setLinkMateriId] = useState('');
  const [myMaterials, setMyMaterials] = useState([]);
  const [courseList, setCourseList] = useState(courses);

  const fetchRequests = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        const res = await materialApi.getRequests(
          { page, limit: 15 },
          signal ? { signal } : {}
        );
        if (signal?.aborted) return;
        setRequests(res.data || []);
        setTotalPages(Math.max(1, res.meta?.totalPages || 1));
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setRequests([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page]
  );

  const fetchMyApproved = useCallback(async (signal) => {
    try {
      const res = await materialApi.getMyApprovedMaterials(signal ? { signal } : {});
      if (!signal?.aborted) setMyMaterials(res.data || []);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setMyMaterials([]);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setShowCreateForm(false);
      setSelectedRequestId(null);
      setLinkMateriId('');
      setPage(1);
      return;
    }

    const controller = new AbortController();
    fetchMyApproved(controller.signal);
    materialApi
      .getCourses({ all: false }, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.data && res.data.length > 0) {
          setCourseList(res.data);
          setForm((prev) => ({
            ...prev,
            mata_kuliah_id: prev.mata_kuliah_id || res.data[0].id,
          }));
        }
      })
      .catch((err) => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        if (courses && courses.length > 0) setCourseList(courses);
      });

    return () => controller.abort();
  }, [open, courses, fetchMyApproved]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetchRequests(controller.signal);
    return () => controller.abort();
  }, [open, fetchRequests]);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!form.mata_kuliah_id || !form.judul.trim()) {
      toast.warning('Silakan pilih mata kuliah dan tuliskan judul materi yang dicari.');
      return;
    }
    try {
      setSubmitting(true);
      await materialApi.createRequest(form);
      toast.success('Permintaan materi berhasil diposting!');
      setForm((prev) => ({
        ...prev,
        judul: '',
        deskripsi: '',
        tipe_materi_diminta: 'ringkasan_catatan',
      }));
      setShowCreateForm(false);
      setPage(1);
      await fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat permintaan materi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkAnswer = async (reqId) => {
    if (!linkMateriId) {
      toast.warning('Silakan pilih materi Anda untuk ditautkan sebagai jawaban.');
      return;
    }
    try {
      await materialApi.fulfillRequest(reqId, {
        action: 'link',
        fulfilled_materi_id: Number(linkMateriId),
      });
      toast.success('Terima kasih telah menautkan materi Anda untuk membantu adik kelas!');
      setSelectedRequestId(null);
      setLinkMateriId('');
      await fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menautkan materi.');
    }
  };

  const handleToggleStatus = async (reqId, action) => {
    try {
      const res = await materialApi.fulfillRequest(reqId, { action });
      toast.success(
        res.message ||
          (action === 'mark_fulfilled' ? 'Permintaan ditandai terpenuhi.' : 'Permintaan dibuka kembali.')
      );
      await fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui status permintaan.');
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ className: '!w-full sm:!w-[520px] flex flex-col h-dvh p-4 sm:p-6' }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-base sm:text-lg">
          <HelpCenterRoundedIcon />
          <span>Papan Minta Materi</span>
        </div>
        <IconButton onClick={onClose} aria-label="Tutup panel" className="!min-h-[44px] !min-w-[44px]">
          <CloseRoundedIcon />
        </IconButton>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed shrink-0">
        Adik kelas dapat mencari catatan kuliah atau latihan soal spesifik di sini. Kakak tingkat & alumni dapat menautkan materi terbit dari mata kuliah yang sama.
      </p>

      {/* Tombol Buat Permintaan Baru */}
      <div className="mt-3 shrink-0">
        {!showCreateForm ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="w-full min-h-[44px] rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            + Buat Permintaan Materi Baru
          </button>
        ) : (
          <form
            onSubmit={handleCreateRequest}
            className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 dark:border-emerald-800/60 dark:bg-emerald-950/20"
          >
            <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300">
              Form Permintaan Materi
            </h4>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                    {c.prodi_kode ? `[${c.prodi_kode}] ` : ''}{c.kode} - {c.nama} (Sem {c.semester_rekomendasi})
                  </MenuItem>
                ))}
              </TextField>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Topik / Materi yang Dicari: *
              </label>
              <TextField
                fullWidth
                size="small"
                placeholder="Contoh: Butuh rangkuman rumus kalkulus 2 bab integral lipat"
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Keterangan Tambahan:
              </label>
              <textarea
                rows={2}
                placeholder="Misal: untuk persiapan kuis minggu depan..."
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-navy dark:text-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="small" onClick={() => setShowCreateForm(false)} color="inherit">
                Batal
              </Button>
              <Button
                type="submit"
                size="small"
                variant="contained"
                color="success"
                disabled={submitting}
                startIcon={<SendRoundedIcon sx={{ fontSize: 14 }} />}
              >
                {submitting ? 'Mengirim...' : 'Posting'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Daftar Permintaan Materi */}
      <div className="mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
        {loading ? (
          [1, 2, 3].map((n) => (
            <Skeleton key={n} variant="rectangular" height={90} sx={{ borderRadius: 2 }} />
          ))
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
            Belum ada permintaan materi saat ini.
          </div>
        ) : (
          requests.map((r) => {
            const isRequesterOrStaff = isStaff || Number(r.user_id) === Number(user?.id);
            const matchingMaterials = myMaterials.filter(
              (m) => Number(m.mata_kuliah_id) === Number(r.mata_kuliah_id)
            );

            return (
              <div
                key={r.id}
                className={`rounded-2xl p-4 border transition ${
                  r.is_fulfilled
                    ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-navy-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {r.mata_kuliah_kode} - {r.mata_kuliah_nama}
                  </span>
                  {r.is_fulfilled ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                      Terpenuhi
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full dark:bg-amber-950/60 dark:text-amber-300">
                      Menunggu Respon
                    </span>
                  )}
                </div>

                <h5 className="mt-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {r.judul}
                </h5>
                {r.deskripsi && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {r.deskripsi}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <span>
                    Oleh: {r.requester_nama} (Angkatan {r.requester_angkatan || '-'})
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {!r.is_fulfilled && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequestId(selectedRequestId === r.id ? null : r.id);
                          setLinkMateriId('');
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1 font-bold text-emerald-600 hover:underline"
                      >
                        <LinkRoundedIcon sx={{ fontSize: 14 }} />
                        <span>Tautkan Materi</span>
                      </button>
                    )}

                    {isRequesterOrStaff && !r.is_fulfilled && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(r.id, 'mark_fulfilled')}
                        className="inline-flex min-h-[36px] items-center gap-1 font-bold text-slate-600 hover:text-emerald-600 dark:text-slate-300"
                      >
                        <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                        <span>Tandai Terpenuhi</span>
                      </button>
                    )}

                    {isRequesterOrStaff && r.is_fulfilled && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(r.id, 'reopen')}
                        className="inline-flex min-h-[36px] items-center gap-1 font-bold text-amber-600 hover:underline"
                      >
                        <RefreshRoundedIcon sx={{ fontSize: 14 }} />
                        <span>Buka Lagi</span>
                      </button>
                    )}
                  </div>
                </div>

                {r.is_fulfilled && r.fulfilled_materi_judul && (
                  <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-bold dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1.5">
                    <span>Jawaban:</span>
                    {r.fulfilled_materi_id ? (
                      <Link
                        to={`/akademik/materi/detail/${r.fulfilled_materi_id}`}
                        onClick={onClose}
                        className="underline hover:text-emerald-600 truncate"
                      >
                        {r.fulfilled_materi_judul}
                      </Link>
                    ) : (
                      <span className="truncate">{r.fulfilled_materi_judul}</span>
                    )}
                  </div>
                )}

                {selectedRequestId === r.id && !r.is_fulfilled && (
                  <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 dark:border-emerald-700 dark:bg-emerald-950/30">
                    <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1.5">
                      Pilih materi terbit Anda pada mata kuliah {r.mata_kuliah_kode}:
                    </label>
                    {matchingMaterials.length === 0 ? (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Anda belum memiliki materi berstatus Terbit pada mata kuliah ini. Unggah dan tunggu ACC materi terlebih dahulu.
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={linkMateriId}
                          onChange={(e) => setLinkMateriId(e.target.value)}
                        >
                          {matchingMaterials.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                              {m.judul} ({m.mata_kuliah_kode})
                            </MenuItem>
                          ))}
                        </TextField>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleLinkAnswer(r.id)}
                          sx={{ borderRadius: 1.5, flexShrink: 0, minHeight: 40 }}
                        >
                          Tautkan
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center shrink-0">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, val) => setPage(val)}
            color="primary"
            size="small"
            shape="rounded"
          />
        </div>
      )}
    </Drawer>
  );
}

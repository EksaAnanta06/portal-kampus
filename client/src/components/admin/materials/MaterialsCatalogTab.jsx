// FILE: client/src/components/admin/materials/MaterialsCatalogTab.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { materialApi } from '../../../api/material.api';
import { getErrorMessage } from '../../../api/axiosInstance';
import { toast } from '../../../store/useThemeStore';
import useDebounce from '../../../hooks/useDebounce';
import ConfirmDialog from '../../common/ConfirmDialog';
import EmptyState from '../../common/EmptyState';

export default function MaterialsCatalogTab({ prodiList = [], onCatalogChange }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [courses, setCourses] = useState([]);
  const [pendingCourses, setPendingCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProdi, setFilterProdi] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [courseDialog, setCourseDialog] = useState({
    open: false,
    isEdit: false,
    id: null,
    form: {
      kode: '',
      nama: '',
      sks: 3,
      prodi_id: prodiList[0]?.id || 1,
      semester_rekomendasi: 1,
      deskripsi: '',
      status: 'approved',
    },
  });
  const [savingCourse, setSavingCourse] = useState(false);

  const [prodiDialog, setProdiDialog] = useState({
    open: false,
    form: {
      kode: '',
      nama: '',
      jenjang: 'S1',
      fakultas: 'Fakultas Ilmu Komputer & Desain',
    },
  });
  const [savingProdi, setSavingProdi] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    id: null,
    nama: '',
  });
  const [deletingCourse, setDeletingCourse] = useState(false);

  const fetchCourses = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        const cfg = signal ? { signal } : {};
        const [cRes, pRes] = await Promise.all([
          materialApi.getCourses(
            {
              prodiId: filterProdi || null,
              semester: filterSemester || null,
              search: debouncedSearch,
              all: false,
              status: 'approved',
              page,
              limit: 20,
            },
            cfg
          ),
          materialApi.getCourses({ status: 'pending', all: true }, cfg),
        ]);
        if (signal?.aborted) return;
        setCourses(cRes.data || []);
        setTotalPages(Math.max(1, cRes.meta?.totalPages || 1));
        setPendingCourses(pRes.data || []);
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        toast.error('Gagal memuat katalog mata kuliah.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filterProdi, filterSemester, debouncedSearch, page]
  );

  useEffect(() => {
    setPage(1);
  }, [filterProdi, filterSemester, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCourses(controller.signal);
    return () => controller.abort();
  }, [fetchCourses]);

  const handleApproveProposal = async (courseId, status = 'approved') => {
    try {
      await materialApi.approveProposedCourse(courseId, { status });
      toast.success(`Usulan mata kuliah ${status === 'approved' ? 'disetujui' : 'ditolak'}.`);
      await fetchCourses();
      onCatalogChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenDialog = (course = null) => {
    if (course) {
      setCourseDialog({
        open: true,
        isEdit: true,
        id: course.id,
        form: {
          kode: course.kode,
          nama: course.nama,
          sks: course.sks,
          prodi_id: course.prodi_id || prodiList[0]?.id || 1,
          semester_rekomendasi: course.semester_rekomendasi || 1,
          deskripsi: course.deskripsi || '',
          status: course.status || 'approved',
        },
      });
    } else {
      setCourseDialog({
        open: true,
        isEdit: false,
        id: null,
        form: {
          kode: '',
          nama: '',
          sks: 3,
          prodi_id: prodiList[0]?.id || 1,
          semester_rekomendasi: 1,
          deskripsi: '',
          status: 'approved',
        },
      });
    }
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    const { isEdit, id, form } = courseDialog;
    try {
      setSavingCourse(true);
      if (isEdit) {
        await materialApi.updateCourse(id, form);
        toast.success('Mata kuliah berhasil diperbarui.');
      } else {
        await materialApi.createCourse(form);
        toast.success('Mata kuliah baru berhasil ditambahkan.');
      }
      setCourseDialog((prev) => ({ ...prev, open: false }));
      await fetchCourses();
      onCatalogChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingCourse(false);
    }
  };

  const handleSaveProdi = async (e) => {
    e.preventDefault();
    try {
      setSavingProdi(true);
      await materialApi.createProdi(prodiDialog.form);
      toast.success('Program studi baru berhasil ditambahkan.');
      setProdiDialog({
        open: false,
        form: {
          kode: '',
          nama: '',
          jenjang: 'S1',
          fakultas: 'Fakultas Ilmu Komputer & Desain',
        },
      });
      await fetchCourses();
      onCatalogChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingProdi(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!deleteDialog.id) return;
    try {
      setDeletingCourse(true);
      await materialApi.deleteCourse(deleteDialog.id);
      toast.success('Mata kuliah berhasil dihapus.');
      setDeleteDialog({ open: false, id: null, nama: '' });
      await fetchCourses();
      onCatalogChange?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingCourse(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Usulan Mata Kuliah Baru Mahasiswa */}
      {pendingCourses.length > 0 && (
        <div className="rounded-2xl border border-sky-300 bg-sky-50/60 p-4 sm:p-5 dark:border-sky-800 dark:bg-sky-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200 font-black text-sm">
              <SchoolRoundedIcon />
              <span>Antrean Usulan Mata Kuliah Baru ({pendingCourses.length})</span>
            </div>
            <span className="text-[11px] text-sky-700 dark:text-sky-300">
              Perlu ditinjau sebelum aktif di katalog
            </span>
          </div>

          <div className="space-y-3">
            {pendingCourses.map((c) => (
              <div
                key={c.id}
                className="rounded-xl bg-white p-4 border border-slate-200 dark:bg-navy-800 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>
                      {c.kode} • {c.sks} SKS
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {c.prodi_nama || 'Program Studi'} • Sem {c.semester_rekomendasi}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{c.nama}</h4>
                  {c.deskripsi && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.deskripsi}</p>
                  )}
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Diusulkan oleh: <strong>{c.proposer_nama || 'Mahasiswa'}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckRoundedIcon />}
                    onClick={() => handleApproveProposal(c.id, 'approved')}
                    sx={{ minHeight: 40 }}
                  >
                    Setujui Usulan
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<BlockRoundedIcon />}
                    onClick={() => handleApproveProposal(c.id, 'rejected')}
                    sx={{ minHeight: 40 }}
                  >
                    Tolak
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Header & Filter Mata Kuliah */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 card-surface p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
          <TextField
            select
            size="small"
            label="Filter Prodi"
            value={filterProdi}
            onChange={(e) => setFilterProdi(e.target.value)}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
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
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
            className="w-full sm:w-32"
          >
            <MenuItem value="">Semua</MenuItem>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <MenuItem key={s} value={s}>
                Semester {s}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            placeholder="Cari kode/nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddRoundedIcon />}
            onClick={() =>
              setProdiDialog({
                open: true,
                form: {
                  kode: '',
                  nama: '',
                  jenjang: 'S1',
                  fakultas: 'Fakultas Ilmu Komputer & Desain',
                },
              })
            }
            sx={{ borderRadius: 2, minHeight: 42 }}
          >
            Tambah Prodi
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddRoundedIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: 2, minHeight: 42 }}
          >
            Tambah Mata Kuliah
          </Button>
        </div>
      </div>

      {/* Grid Mata Kuliah */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card-surface p-5 animate-pulse space-y-2">
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          title="Belum ada mata kuliah"
          description="Tidak ditemukan mata kuliah yang sesuai dengan filter."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((c) => (
              <div
                key={c.id}
                className="card-surface p-5 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>
                      {c.kode} • {c.sks} SKS
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {c.prodi_kode || 'UMUM'} • Sem {c.semester_rekomendasi}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 break-words">
                    {c.nama}
                  </h4>

                  {c.deskripsi && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {c.deskripsi}
                    </p>
                  )}

                  <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                    {c.total_materials || 0} Materi Pembelajaran Tersedia
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Link
                    to={`/akademik/materi/matkul/${c.id}`}
                    className="inline-flex min-h-[40px] items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                  >
                    <span>Buka Koleksi</span>
                    <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                  </Link>

                  <div className="flex items-center gap-1">
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
                      onClick={() => handleOpenDialog(c)}
                      sx={{ fontSize: 12, minHeight: 40 }}
                    >
                      Edit
                    </Button>
                    <IconButton
                      onClick={() => setDeleteDialog({ open: true, id: c.id, nama: c.nama })}
                      className="!min-h-[40px] !min-w-[40px] text-slate-400 hover:text-red-600"
                      aria-label={`Hapus mata kuliah ${c.nama}`}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 19 }} />
                    </IconButton>
                  </div>
                </div>
              </div>
            ))}
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

      {/* Modal Form Tambah / Edit Mata Kuliah */}
      <Dialog
        open={courseDialog.open}
        onClose={() => !savingCourse && setCourseDialog({ ...courseDialog, open: false })}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ className: '!rounded-none sm:!rounded-3xl' }}
      >
        <form onSubmit={handleSaveCourse}>
          <DialogTitle className="!font-bold !text-base">
            {courseDialog.isEdit ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah Baru'}
          </DialogTitle>
          <DialogContent className="space-y-3 !pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                select
                fullWidth
                size="small"
                label="Program Studi"
                value={courseDialog.form.prodi_id}
                onChange={(e) =>
                  setCourseDialog({
                    ...courseDialog,
                    form: { ...courseDialog.form, prodi_id: e.target.value },
                  })
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
                value={courseDialog.form.semester_rekomendasi}
                onChange={(e) =>
                  setCourseDialog({
                    ...courseDialog,
                    form: { ...courseDialog.form, semester_rekomendasi: e.target.value },
                  })
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextField
                fullWidth
                size="small"
                label="Kode MK"
                placeholder="IF101"
                value={courseDialog.form.kode}
                onChange={(e) =>
                  setCourseDialog({
                    ...courseDialog,
                    form: { ...courseDialog.form, kode: e.target.value.toUpperCase() },
                  })
                }
                required
              />
              <div className="sm:col-span-2">
                <TextField
                  fullWidth
                  size="small"
                  label="Nama Mata Kuliah"
                  placeholder="Dasar Pemrograman"
                  value={courseDialog.form.nama}
                  onChange={(e) =>
                    setCourseDialog({
                      ...courseDialog,
                      form: { ...courseDialog.form, nama: e.target.value },
                    })
                  }
                  required
                />
              </div>
            </div>

            <TextField
              type="number"
              fullWidth
              size="small"
              label="Bobot SKS"
              value={courseDialog.form.sks}
              inputProps={{ min: 1, max: 6 }}
              onChange={(e) =>
                setCourseDialog({
                  ...courseDialog,
                  form: { ...courseDialog.form, sks: e.target.value },
                })
              }
              required
            />

            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              label="Deskripsi Mata Kuliah (Opsional)"
              value={courseDialog.form.deskripsi}
              onChange={(e) =>
                setCourseDialog({
                  ...courseDialog,
                  form: { ...courseDialog.form, deskripsi: e.target.value },
                })
              }
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setCourseDialog({ ...courseDialog, open: false })}
              color="inherit"
              disabled={savingCourse}
            >
              Batal
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={savingCourse}>
              {savingCourse ? 'Menyimpan...' : 'Simpan Mata Kuliah'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Form Tambah Program Studi */}
      <Dialog
        open={prodiDialog.open}
        onClose={() => !savingProdi && setProdiDialog({ ...prodiDialog, open: false })}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ className: '!rounded-none sm:!rounded-3xl' }}
      >
        <form onSubmit={handleSaveProdi}>
          <DialogTitle className="!font-bold !text-base">
            Tambah Program Studi Baru
          </DialogTitle>
          <DialogContent className="space-y-3 !pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                fullWidth
                size="small"
                label="Kode Prodi"
                placeholder="Contoh: TIN"
                value={prodiDialog.form.kode}
                onChange={(e) =>
                  setProdiDialog({
                    ...prodiDialog,
                    form: { ...prodiDialog.form, kode: e.target.value.toUpperCase() },
                  })
                }
                required
              />

              <TextField
                select
                fullWidth
                size="small"
                label="Jenjang"
                value={prodiDialog.form.jenjang}
                onChange={(e) =>
                  setProdiDialog({
                    ...prodiDialog,
                    form: { ...prodiDialog.form, jenjang: e.target.value },
                  })
                }
                required
              >
                <MenuItem value="D3">D3 (Diploma 3)</MenuItem>
                <MenuItem value="S1">S1 (Sarjana)</MenuItem>
                <MenuItem value="S2">S2 (Magister)</MenuItem>
              </TextField>
            </div>

            <TextField
              fullWidth
              size="small"
              label="Nama Program Studi"
              placeholder="Contoh: S1 Teknik Industri"
              value={prodiDialog.form.nama}
              onChange={(e) =>
                setProdiDialog({
                  ...prodiDialog,
                  form: { ...prodiDialog.form, nama: e.target.value },
                })
              }
              required
            />

            <TextField
              fullWidth
              size="small"
              label="Fakultas"
              placeholder="Contoh: Fakultas Teknik"
              value={prodiDialog.form.fakultas}
              onChange={(e) =>
                setProdiDialog({
                  ...prodiDialog,
                  form: { ...prodiDialog.form, fakultas: e.target.value },
                })
              }
              required
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setProdiDialog({ ...prodiDialog, open: false })}
              color="inherit"
              disabled={savingProdi}
            >
              Batal
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={savingProdi}>
              {savingProdi ? 'Menyimpan...' : 'Simpan Prodi'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog Hapus Mata Kuliah */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Hapus Mata Kuliah"
        message={`Apakah Anda yakin ingin menghapus mata kuliah "${deleteDialog.nama}" dari katalog kurikulum? Jika masih ada materi atau permintaan terkait, penghapusan akan ditolak.`}
        confirmText="Hapus MK"
        color="error"
        loading={deletingCourse}
        onConfirm={handleDeleteCourse}
        onClose={() => !deletingCourse && setDeleteDialog({ open: false, id: null, nama: '' })}
      />
    </div>
  );
}

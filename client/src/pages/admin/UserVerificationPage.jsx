// FILE: client/src/pages/admin/UserVerificationPage.jsx
import { useEffect, useState } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Pagination from '@mui/material/Pagination';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import { userApi } from '../../api/user.api';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import EmptyState from '../../components/common/EmptyState';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import useDebounce from '../../hooks/useDebounce';
import {
  ROLE_COLORS,
  ROLE_LABELS,
  USER_STATUS_COLORS,
  USER_STATUS_LABELS,
  getInitials,
} from '../../utils/constants';
import { formatDateTime } from '../../utils/formatDate';

export default function UserVerificationPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [page, setPage] = useState(1);

  // Edit / Verifikasi Dialog
  const [editUser, setEditUser] = useState(null);
  const [newStatus, setNewStatus] = useState('active');
  const [newRole, setNewRole] = useState('mahasiswa');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async (signal) => {
    setLoading(true);
    try {
      const res = await userApi.getAdminUsers(
        {
          status: status || undefined,
          search: debouncedSearch || undefined,
          page,
          limit: 20,
        },
        signal ? { signal } : {}
      );
      if (signal?.aborted) return;
      setUsers(res.data || []);
      const count = res.meta?.total || 0;
      setTotal(count);
      setTotalPages(res.meta?.totalPages || Math.max(1, Math.ceil(count / 20)));
    } catch (err) {
      if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
        console.error(err);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedSearch, page]);

  const handleQuickVerify = async (user, targetStatus) => {
    try {
      const res = await userApi.verifyUser(user.id, { status: targetStatus });
      toast.success(res.message);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenEdit = (user) => {
    setEditUser(user);
    setNewStatus(user.status);
    setNewRole(user.role);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userApi.verifyUser(editUser.id, {
        status: newStatus,
        role: newRole,
      });
      toast.success(res.message);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Administrasi Kemahasiswaan
        </span>
        <h1 className="section-title mt-1">Verifikasi NIM & Manajemen Pengguna</h1>
        <p className="text-muted mb-0 mt-2 text-sm">
          Tinjau pendaftaran baru, sesuaikan peranan sivitas (Mahasiswa, Alumni, Moderator), dan kelola hak akses akun.
        </p>
      </div>

      {/* FILTER BOX */}
      <div className="card-surface flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 w-full">
          <TextField
            select
            size="small"
            label="Status Akun"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
            className="w-full sm:w-48"
          >
            <MenuItem value="">Semua Status</MenuItem>
            <MenuItem value="pending">Menunggu Verifikasi</MenuItem>
            <MenuItem value="active">Aktif</MenuItem>
            <MenuItem value="suspended">Ditangguhkan</MenuItem>
            <MenuItem value="rejected">Ditolak</MenuItem>
          </TextField>

          <TextField
            size="small"
            placeholder="Cari nama, NIM, atau email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-64"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" className="text-slate-400" />
                </InputAdornment>
              ),
            }}
          />
        </div>

        <span className="text-muted text-xs font-semibold">
          Ditemukan: <strong>{total}</strong> akun
        </span>
      </div>

      {/* DAFTAR MOBILE (< md) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-surface p-4 space-y-2">
              <Skeleton width="55%" height={24} />
              <Skeleton width="75%" />
              <Skeleton width="40%" />
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="card-surface p-4">
            <EmptyState title="Tidak ada akun pengguna yang sesuai kriteria." />
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="card-surface p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={getOptimizedImageUrl(u.avatar_url, { width: 80, height: 80 })}
                    sx={{ width: 40, height: 40, fontSize: 14 }}
                  >
                    {getInitials(u.full_name)}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {u.full_name}
                    </div>
                    <div className="text-muted text-xs truncate">
                      {u.nim} · {u.email}
                    </div>
                  </div>
                </div>
                <Chip
                  size="small"
                  label={USER_STATUS_LABELS[u.status] || u.status}
                  color={USER_STATUS_COLORS[u.status] || 'default'}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Chip
                  size="small"
                  label={ROLE_LABELS[u.role] || u.role}
                  color={ROLE_COLORS[u.role] || 'default'}
                  variant="outlined"
                />
                <span className="text-muted">
                  {u.prodi} · Angkatan {u.angkatan_year || '-'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {u.status === 'pending' && (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckRoundedIcon />}
                      onClick={() => handleQuickVerify(u, 'active')}
                      className="min-h-[40px]"
                    >
                      Setujui
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<BlockRoundedIcon />}
                      onClick={() => handleQuickVerify(u, 'rejected')}
                      className="min-h-[40px]"
                    >
                      Tolak
                    </Button>
                  </>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<ManageAccountsRoundedIcon />}
                  onClick={() => handleOpenEdit(u)}
                  className="min-h-[40px] ml-auto"
                >
                  Ubah
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* TABEL PENGGUNA (DESKTOP >= md) */}
      <TableContainer component={Paper} className="card-surface overflow-x-auto shadow-none hidden md:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pengguna</TableCell>
              <TableCell>NIM</TableCell>
              <TableCell>Program Studi / Angkatan</TableCell>
              <TableCell>Peran</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Terdaftar</TableCell>
              <TableCell align="right">Aksi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton height={36} />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="!py-10 text-center">
                  <EmptyState title="Tidak ada akun pengguna yang sesuai kriteria." />
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={getOptimizedImageUrl(u.avatar_url, { width: 80, height: 80 })}
                        sx={{ width: 36, height: 36, fontSize: 13 }}
                      >
                        {getInitials(u.full_name)}
                      </Avatar>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {u.full_name}
                        </div>
                        <div className="text-muted text-xs">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-semibold">{u.nim}</TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold">{u.prodi}</div>
                    <div className="text-muted text-[11px]">Angkatan {u.angkatan_year || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={ROLE_LABELS[u.role] || u.role}
                      color={ROLE_COLORS[u.role] || 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={USER_STATUS_LABELS[u.status] || u.status}
                      color={USER_STATUS_COLORS[u.status] || 'default'}
                    />
                  </TableCell>
                  <TableCell className="text-muted text-xs">{formatDateTime(u.created_at)}</TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      {u.status === 'pending' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckRoundedIcon />}
                            onClick={() => handleQuickVerify(u, 'active')}
                          >
                            Setujui
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<BlockRoundedIcon />}
                            onClick={() => handleQuickVerify(u, 'rejected')}
                          >
                            Tolak
                          </Button>
                        </>
                      )}
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<ManageAccountsRoundedIcon />}
                        onClick={() => handleOpenEdit(u)}
                      >
                        Ubah
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, val) => setPage(val)}
            color="primary"
            shape="rounded"
          />
        </div>
      )}

      {/* DIALOG UBAH STATUS / PERAN */}
      <Dialog
        open={Boolean(editUser)}
        onClose={() => !saving && setEditUser(null)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={handleSaveEdit}>
          <DialogTitle className="font-bold">Ubah Status & Peran Pengguna</DialogTitle>
          <DialogContent className="!pt-3 space-y-4">
            {editUser && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
                <div className="font-bold text-sm">{editUser.full_name}</div>
                <div className="text-muted">NIM: {editUser.nim} · {editUser.email}</div>
              </div>
            )}

            <TextField
              select
              label="Status Akun"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              fullWidth
            >
              <MenuItem value="pending">Menunggu Verifikasi</MenuItem>
              <MenuItem value="active">Aktif (Diverifikasi)</MenuItem>
              <MenuItem value="suspended">Ditangguhkan (Suspended)</MenuItem>
              <MenuItem value="rejected">Ditolak</MenuItem>
            </TextField>

            <TextField
              select
              label="Peran Akun (Role)"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              fullWidth
            >
              <MenuItem value="mahasiswa">Mahasiswa</MenuItem>
              <MenuItem value="alumni">Alumni</MenuItem>
              <MenuItem value="moderator">Moderator Galeri</MenuItem>
              <MenuItem value="admin">Administrator Sistem</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions className="!px-6 !pb-5">
            <Button color="inherit" onClick={() => setEditUser(null)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

// FILE: client/src/pages/campus/DirectoryPage.jsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Pagination from '@mui/material/Pagination';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { userApi } from '../../api/user.api';
import EmptyState from '../../components/common/EmptyState';
import UserProfileModal from '../../components/campus/UserProfileModal';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import useDebounce from '../../hooks/useDebounce';
import {
  ANGKATAN_YEAR_OPTIONS,
  PRODI_LIST,
  ROLE_COLORS,
  ROLE_LABELS,
  getInitials,
} from '../../utils/constants';

export default function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchUrl = searchParams.get('search') || '';

  const [users, setUsers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter Form State
  const [search, setSearch] = useState(searchUrl);
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [angkatan, setAngkatan] = useState('');
  const [prodi, setProdi] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSearch(searchUrl);
    setPage(1);
  }, [searchUrl]);

  // Modal Profile State
  const initialUserId = searchParams.get('user') ? Number(searchParams.get('user')) : null;
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [profileModalOpen, setProfileModalOpen] = useState(Boolean(initialUserId));

  const handleOpenProfile = (id) => {
    setSelectedUserId(id);
    setProfileModalOpen(true);
  };

  const handleCloseProfile = () => {
    setProfileModalOpen(false);
    setSelectedUserId(null);
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    userApi
      .getDirectory(
        {
          search: debouncedSearch || undefined,
          angkatan: angkatan || undefined,
          prodi: prodi || undefined,
          role: role || undefined,
          page,
          limit: 12,
        },
        { signal: controller.signal }
      )
      .then((res) => {
        if (controller.signal.aborted) return;
        setUsers(res.data || []);
        const tp = res.meta?.totalPages || Math.max(1, Math.ceil((res.meta?.total || 0) / 12));
        setTotalPages(tp);
      })
      .catch((err) => {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          console.error(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, angkatan, prodi, role, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setAngkatan('');
    setProdi('');
    setRole('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Jejaring Sivitas Akademika
        </span>
        <h1 className="section-title mt-1">Direktori Mahasiswa & Alumni</h1>
        <p className="text-muted mb-0 mt-2 text-sm max-w-xl">
          Temukan rekan satu angkatan, bangun koneksi profesional antar program studi, dan telusuri portofolio alumni UNAS PASIM.
        </p>
      </div>

      {/* FILTER BOX */}
      <form
        onSubmit={handleSearchSubmit}
        className="card-surface grid gap-3.5 p-4 sm:p-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        <TextField
          placeholder="Cari nama, NIM, profesi..."
          value={search}
          size="small"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" className="text-slate-400" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          select
          size="small"
          label="Program Studi"
          value={prodi}
          onChange={(e) => {
            setProdi(e.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">Semua Program Studi</MenuItem>
          {PRODI_LIST.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Angkatan"
          value={angkatan}
          onChange={(e) => {
            setAngkatan(e.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">Semua Angkatan</MenuItem>
          {ANGKATAN_YEAR_OPTIONS.map((y) => (
            <MenuItem key={y} value={y}>
              Angkatan {y}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Peran / Status"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">Semua Status</MenuItem>
          <MenuItem value="mahasiswa">Mahasiswa Aktif</MenuItem>
          <MenuItem value="alumni">Alumni</MenuItem>
          <MenuItem value="moderator">Moderator</MenuItem>
          <MenuItem value="admin">Administrator</MenuItem>
        </TextField>
      </form>

      {/* USER CARDS GRID */}
      <div>
        {loading ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card-surface p-6 flex flex-col items-center text-center space-y-3">
                <Skeleton variant="circular" width={80} height={80} />
                <Skeleton width="60%" />
                <Skeleton width="80%" />
                <Skeleton width="40%" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="Tidak Ada Profil yang Cocok"
            description="Coba ubah filter pencarian, prodi, atau tahun angkatan Anda."
            action={
              <Button variant="outlined" onClick={resetFilters}>
                Atur Ulang Filter
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {users.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenProfile(item.id)}
                className="card-surface group flex flex-col items-center p-6 text-center transition duration-300 hover:shadow-xl hover:border-pasim-400/60 cursor-pointer relative"
              >
                <div className="relative mb-4">
                  <Avatar
                    src={getOptimizedImageUrl(item.avatar_url, { width: 160, height: 160 })}
                    sx={{ width: 84, height: 84, fontSize: 28, bgcolor: 'primary.main' }}
                    className="shadow-md transition duration-300 group-hover:scale-105"
                  >
                    {getInitials(item.full_name)}
                  </Avatar>
                  <Chip
                    size="small"
                    label={ROLE_LABELS[item.role] || item.role}
                    color={ROLE_COLORS[item.role] || 'default'}
                    className="!absolute -bottom-2.5 left-1/2 -translate-x-1/2 shadow-sm !text-[11px] font-bold"
                  />
                </div>

                <h3 className="mb-0 mt-3 text-base font-bold text-slate-900 line-clamp-1 dark:text-white group-hover:text-pasim dark:group-hover:text-pasim-300 transition">
                  {item.full_name}
                </h3>
                {item.nim && (
                  <span className="text-muted mt-1 text-xs">NIM: {item.nim}</span>
                )}

                <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {item.prodi}
                  {item.angkatan_year ? ` (${item.angkatan_year})` : ''}
                </div>

                {item.current_job && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-pasim dark:text-pasim-300 font-medium">
                    <WorkRoundedIcon sx={{ fontSize: 14 }} />
                    <span className="line-clamp-1">{item.current_job}</span>
                  </div>
                )}

                {item.bio && (
                  <p className="text-muted line-clamp-2 text-xs leading-relaxed my-3">
                    {item.bio}
                  </p>
                )}

                {/* Tombol Kunjungi Profil & Footer Card */}
                <div className="mt-auto w-full pt-3.5 space-y-3">
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProfile(item.id);
                    }}
                    endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                    sx={{
                      textTransform: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 2,
                      py: 0.7,
                    }}
                  >
                    Kunjungi Profil
                  </Button>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <PhotoCameraRoundedIcon sx={{ fontSize: 14 }} />
                      {item.total_photos || 0} Foto
                    </span>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {item.linkedin_url && (
                        <a
                          href={item.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-blue-600 font-bold"
                          title="LinkedIn"
                        >
                          in
                        </a>
                      )}
                      {item.instagram_url && (
                        <a
                          href={item.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-pink-600 font-bold"
                          title="Instagram"
                        >
                          ig
                        </a>
                      )}
                      {item.github_url && (
                        <a
                          href={item.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold"
                          title="GitHub"
                        >
                          gh
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

      {/* Modal Kunjungi Profil Pengguna */}
      <UserProfileModal
        open={profileModalOpen}
        userId={selectedUserId}
        onClose={handleCloseProfile}
      />
    </div>
  );
}

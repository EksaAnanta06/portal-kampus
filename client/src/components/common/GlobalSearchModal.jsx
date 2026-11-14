// FILE: client/src/components/common/GlobalSearchModal.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import InputBase from '@mui/material/InputBase';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import useDebounce from '../../hooks/useDebounce';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { campusApi } from '../../api/campus.api';
import useAuthStore from '../../store/useAuthStore';
import {
  CATEGORY_LABELS,
  MATERIAL_TYPE_LABELS,
  ROLE_LABELS,
  getInitials,
} from '../../utils/constants';
import { formatShortDate } from '../../utils/formatDate';

const EMPTY = { photos: [], announcements: [], users: [], materials: [], courses: [] };

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
      {icon}
      {children}
    </div>
  );
}

export default function GlobalSearchModal({ open, onClose }) {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query.trim(), 350);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(EMPTY);
    }
  }, [open]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    campusApi
      .search(debounced, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setResults({ ...EMPTY, ...(res.data || {}) });
        }
      })
      .catch((err) => {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          setResults(EMPTY);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [debounced]);

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const total =
    (results.photos?.length || 0) +
    (results.announcements?.length || 0) +
    (results.users?.length || 0) +
    (results.courses?.length || 0) +
    (results.materials?.length || 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ className: '!mt-[6vh] sm:!mt-[8vh] !mx-3 sm:!mx-6 !w-full !self-start overflow-hidden' }}
    >
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <SearchRoundedIcon className="text-slate-400" />
        <InputBase
          autoFocus
          fullWidth
          placeholder={
            isLoggedIn
              ? 'Cari foto, materi, matkul, pengumuman, atau sivitas...'
              : 'Cari foto, pengumuman, atau nama mahasiswa/alumni...'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-base"
        />
        {loading && <CircularProgress size={18} />}
        <kbd className="hidden rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline dark:border-slate-600">
          ESC
        </kbd>
      </div>

      <div className="max-h-[60vh] overflow-y-auto pb-3">
        {debounced.length < 2 && (
          <p className="text-muted px-6 py-10 text-center text-sm">
            Ketik minimal 2 karakter untuk mulai mencari di seluruh portal.
          </p>
        )}

        {debounced.length >= 2 && !loading && total === 0 && (
          <p className="text-muted px-6 py-10 text-center text-sm">
            Tidak ada hasil untuk “<strong>{debounced}</strong>”.
          </p>
        )}

        {results.photos.length > 0 && (
          <>
            <SectionTitle icon={<PhotoLibraryRoundedIcon fontSize="inherit" />}>Foto Kenangan</SectionTitle>
            <div className="grid grid-cols-3 gap-2 px-4">
              {results.photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => go(`/angkatan/${p.angkatan_year}?photo=${p.id}`)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-0 bg-slate-100 p-0 dark:bg-slate-800"
                  title={p.caption}
                >
                  <img
                    src={getOptimizedImageUrl(p.url, { width: 240, height: 240 })}
                    alt={p.caption}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">
                    {p.angkatan_year}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {results.announcements.length > 0 && (
          <>
            <SectionTitle icon={<CampaignRoundedIcon fontSize="inherit" />}>Pengumuman</SectionTitle>
            {results.announcements.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => go(`/pengumuman/${a.slug}`)}
                className="flex w-full cursor-pointer flex-col items-start gap-1 border-0 bg-transparent px-4 py-2.5 text-left text-inherit hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="line-clamp-2 text-sm font-semibold">{a.title}</span>
                <span className="text-muted text-xs">
                  {CATEGORY_LABELS[a.category]} · {formatShortDate(a.published_at)}
                </span>
              </button>
            ))}
          </>
        )}

        {isLoggedIn && results.courses?.length > 0 && (
          <>
            <SectionTitle icon={<MenuBookRoundedIcon fontSize="inherit" />}>Mata Kuliah</SectionTitle>
            {results.courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => go(`/akademik/materi/matkul/${c.id}`)}
                className="flex w-full min-h-[44px] cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 py-2 text-left text-inherit hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.nama}</div>
                  <div className="text-muted truncate text-xs">
                    {c.kode} · {c.prodi_nama || 'Semua Prodi'}
                    {c.semester_rekomendasi ? ` · Sem. ${c.semester_rekomendasi}` : ''}
                  </div>
                </div>
                <Chip size="small" label={c.kode} variant="outlined" />
              </button>
            ))}
          </>
        )}

        {isLoggedIn && results.materials?.length > 0 && (
          <>
            <SectionTitle icon={<DescriptionRoundedIcon fontSize="inherit" />}>Materi Perkuliahan</SectionTitle>
            {results.materials.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => go(`/akademik/materi/detail/${m.id}`)}
                className="flex w-full min-h-[44px] cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 py-2 text-left text-inherit hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{m.judul}</div>
                  <div className="text-muted truncate text-xs">
                    {m.mata_kuliah_kode} {m.mata_kuliah_nama ? `· ${m.mata_kuliah_nama}` : ''}
                  </div>
                </div>
                <Chip
                  size="small"
                  label={MATERIAL_TYPE_LABELS?.[m.tipe_materi] || m.tipe_materi}
                  color="primary"
                  variant="outlined"
                />
              </button>
            ))}
          </>
        )}

        {results.users.length > 0 && (
          <>
            <SectionTitle icon={<PeopleAltRoundedIcon fontSize="inherit" />}>Mahasiswa & Alumni</SectionTitle>
            {results.users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => go(isLoggedIn ? `/direktori?search=${encodeURIComponent(u.full_name)}` : '/login')}
                className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2 text-left text-inherit hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar src={getOptimizedImageUrl(u.avatar_url, { width: 80, height: 80 })} sx={{ width: 34, height: 34 }}>
                  {getInitials(u.full_name)}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.full_name}</div>
                  <div className="text-muted truncate text-xs">
                    {u.prodi}
                    {u.angkatan_year ? ` · Angkatan ${u.angkatan_year}` : ''}
                  </div>
                </div>
                <Chip size="small" label={ROLE_LABELS[u.role]} variant="outlined" />
              </button>
            ))}
          </>
        )}
      </div>
    </Dialog>
  );
}

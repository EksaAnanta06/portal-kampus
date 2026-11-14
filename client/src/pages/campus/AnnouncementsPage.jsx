// FILE: client/src/pages/campus/AnnouncementsPage.jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Pagination from '@mui/material/Pagination';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { campusApi } from '../../api/campus.api';
import EmptyState from '../../components/common/EmptyState';
import { ANNOUNCEMENT_CATEGORIES, CATEGORY_LABELS } from '../../utils/constants';
import { formatDate, formatShortDate } from '../../utils/formatDate';
import useCloudinaryUrl from '../../hooks/useCloudinaryUrl';
import useDebounce from '../../hooks/useDebounce';

export default function AnnouncementsPage() {
  const { slugOrId } = useParams();

  // Mode Detail jika ada parameter slugOrId
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(Boolean(slugOrId));

  // Mode List
  const [list, setList] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(!slugOrId);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [page, setPage] = useState(1);

  // 1. Fetch Detail
  useEffect(() => {
    if (!slugOrId) {
      setDetail(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoadingDetail(true);
    campusApi
      .getAnnouncementDetail(slugOrId, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setDetail(res.data);
      })
      .catch((err) => {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          console.error(err);
          setDetail(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDetail(false);
      });
    return () => controller.abort();
  }, [slugOrId]);

  // 2. Fetch List
  useEffect(() => {
    if (slugOrId) return undefined;
    const controller = new AbortController();
    setLoadingList(true);
    campusApi
      .getAnnouncements(
        { category: category || undefined, search: debouncedSearch || undefined, page, limit: 9 },
        { signal: controller.signal }
      )
      .then((res) => {
        if (controller.signal.aborted) return;
        setList(res.data || []);
        const tp = res.meta?.totalPages || Math.max(1, Math.ceil((res.meta?.total || 0) / 9));
        setTotalPages(tp);
      })
      .catch((err) => {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          console.error(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingList(false);
      });
    return () => controller.abort();
  }, [slugOrId, category, debouncedSearch, page]);

  const detailBanner = useCloudinaryUrl(detail?.banner_url, 'hero');

  // Tampilan Detail Pengumuman
  if (slugOrId) {
    if (loadingDetail) {
      return (
        <div className="max-w-4xl space-y-4">
          <Skeleton width={120} />
          <Skeleton height={40} />
          <Skeleton variant="rectangular" height={300} className="!rounded-2xl" />
          <Skeleton width="92%" />
          <Skeleton width="85%" />
          <Skeleton width="72%" />
        </div>
      );
    }

    if (!detail) {
      return (
        <div className="py-12 text-center">
          <EmptyState
            title="Pengumuman Tidak Ditemukan"
            description="Tautan pengumuman mungkin sudah usang atau dihapus."
            action={
              <Button component={Link} to="/pengumuman" variant="contained">
                Kembali ke Daftar Pengumuman
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <article className="max-w-4xl space-y-4">
        <Link
          to="/pengumuman"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pasim hover:underline dark:text-pasim-300"
        >
          <ArrowBackRoundedIcon fontSize="small" />
          Semua Pengumuman
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Chip
            size="small"
            label={CATEGORY_LABELS[detail.category] || detail.category}
            color="primary"
            className="!font-bold"
          />
          {Boolean(detail.is_pinned) && (
            <Chip size="small" label="Penting / Disematkan" color="error" variant="outlined" />
          )}
        </div>

        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-white">
          {detail.title}
        </h1>

        <div className="text-muted flex flex-wrap items-center gap-4 border-b border-slate-200 pb-4 text-xs dark:border-slate-800">
          <span className="flex items-center gap-1">
            <CalendarMonthRoundedIcon fontSize="inherit" />
            {formatDate(detail.published_at)}
          </span>
          {detail.author_name && (
            <span className="flex items-center gap-1">
              <PersonOutlineRoundedIcon fontSize="inherit" />
              Dipublikasikan oleh {detail.author_name}
            </span>
          )}
        </div>

        {detailBanner && (
          <div className="my-4 overflow-hidden rounded-2xl shadow-sm">
            <img src={detailBanner} alt={detail.title} className="max-h-[420px] w-full object-cover" />
          </div>
        )}

        <div className="prose prose-slate max-w-none dark:prose-invert whitespace-pre-line text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200">
          {detail.content}
        </div>
      </article>
    );
  }

  // Tampilan List Pengumuman
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
            Kabar Sivitas UNAS PASIM
          </span>
          <h1 className="section-title mt-1">Warta & Pengumuman Kampus</h1>
          <p className="text-muted mb-0 mt-2 text-sm max-w-xl">
            Informasi akademik terpadu, kemahasiswaan, beasiswa, pendaftaran wisuda, dan kabar ikatan alumni.
          </p>
        </div>

        <TextField
          placeholder="Cari kata kunci warta..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          size="small"
          className="w-full sm:w-72"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" className="text-slate-400" />
              </InputAdornment>
            ),
          }}
        />
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs
          value={category}
          onChange={(_e, val) => {
            setCategory(val);
            setPage(1);
          }}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab value="" label="Semua Warta" />
          {ANNOUNCEMENT_CATEGORIES.map((c) => (
            <Tab key={c.value} value={c.value} label={c.label} />
          ))}
        </Tabs>
      </div>

      <div>
        {loadingList ? (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-surface p-4 sm:p-6 space-y-3">
                <Skeleton width="40%" />
                <Skeleton height={28} />
                <Skeleton width="90%" />
                <Skeleton width="70%" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="Tidak ada pengumuman"
            description="Belum ada warta untuk kategori atau kata kunci yang dipilih."
          />
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {list.map((item) => (
              <Link
                key={item.id}
                to={`/pengumuman/${item.slug}`}
                className="card-surface group flex flex-col p-4 sm:p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center gap-2 text-xs">
                  <Chip
                    size="small"
                    label={CATEGORY_LABELS[item.category] || item.category}
                    className="!font-semibold"
                  />
                  {Boolean(item.is_pinned) && (
                    <Chip size="small" label="Penting" color="error" variant="outlined" />
                  )}
                  <span className="text-muted ml-auto">{formatShortDate(item.published_at)}</span>
                </div>

                <h3 className="mb-2 mt-3 text-base sm:text-lg font-bold text-slate-900 transition group-hover:text-pasim dark:text-white dark:group-hover:text-pasim-300">
                  {item.title}
                </h3>
                <p className="text-muted line-clamp-3 text-xs sm:text-sm leading-relaxed mb-4">
                  {item.excerpt}
                </p>

                <div className="mt-auto flex items-center text-xs font-bold text-pasim dark:text-pasim-300">
                  Baca Selengkapnya →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!loadingList && totalPages > 1 && (
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
    </div>
  );
}

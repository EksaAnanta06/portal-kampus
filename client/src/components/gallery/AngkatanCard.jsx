// FILE: client/src/components/gallery/AngkatanCard.jsx
import { Link } from 'react-router-dom';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import useCloudinaryUrl from '../../hooks/useCloudinaryUrl';
import useAuthStore, { selectIsStaff } from '../../store/useAuthStore';

export function AngkatanCardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <Skeleton variant="rectangular" height={200} />
      <div className="space-y-2 p-5">
        <Skeleton width="40%" />
        <Skeleton width="80%" height={28} />
        <Skeleton width="60%" />
      </div>
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      {icon}
      <span className="font-bold text-slate-800 dark:text-slate-100">{Number(value) || 0}</span>
      <span>{label}</span>
    </div>
  );
}

export default function AngkatanCard({ angkatan, onEdit }) {
  const isStaff = useAuthStore(selectIsStaff);
  const cover = useCloudinaryUrl(angkatan.cover_url, 'card');
  // Judul seed: "Angkatan 2022 — Prawira Sankara" → ambil julukan setelah tanda pisah, atau gunakan judul penuh
  const nickname = angkatan.title?.includes('—') ? angkatan.title.split('—')[1].trim() : angkatan.title;

  return (
    <Link
      to={`/angkatan/${angkatan.year}`}
      className="card-surface group relative flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-pasim-700 to-navy">
        {cover ? (
          <img
            src={cover}
            alt={angkatan.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/30">
            <PhotoLibraryRoundedIcon sx={{ fontSize: 64 }} />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Tombol Edit Cepat untuk Admin & Moderator */}
        {isStaff && onEdit && (
          <Tooltip title="Edit Judul & Info Card Angkatan">
            <IconButton
              size="small"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(angkatan);
              }}
              className="!absolute !top-3 !right-3 !bg-black/60 hover:!bg-pasim !text-white !backdrop-blur-md transition shadow-md z-10"
            >
              <EditRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}

        <div className="absolute bottom-4 left-5 right-5">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-light">Angkatan</span>
          <div className="text-4xl font-extrabold leading-none text-white">{angkatan.year}</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="m-0 text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
          {nickname}
        </h3>
        {angkatan.description && (
          <p className="text-muted mb-0 mt-1.5 line-clamp-2 text-xs sm:text-sm leading-relaxed">
            {angkatan.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
          <Stat icon={<PhotoLibraryRoundedIcon sx={{ fontSize: 16 }} />} value={angkatan.photo_count} label="foto" />
          <Stat icon={<CollectionsBookmarkRoundedIcon sx={{ fontSize: 16 }} />} value={angkatan.album_count} label="album" />
          <Stat icon={<PeopleAltRoundedIcon sx={{ fontSize: 16 }} />} value={angkatan.member_count} label="anggota" />
          <ArrowForwardRoundedIcon
            fontSize="small"
            className="ml-auto text-pasim transition group-hover:translate-x-1 dark:text-pasim-300"
          />
        </div>
      </div>
    </Link>
  );
}

// FILE: client/src/components/gallery/PhotoMasonryGrid.jsx
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { PHOTO_STATUS_COLORS, PHOTO_STATUS_LABELS } from '../../utils/constants';

const SKELETON_HEIGHTS = [220, 300, 260, 340, 200, 280, 240, 320];

function PhotoTile({ photo, onClick, showStatus, showAngkatan }) {
  const ratio = photo.width && photo.height ? photo.height / photo.width : 0.66;
  const src = getOptimizedImageUrl(photo.url, { width: 560, crop: 'limit' });

  return (
    <button
      type="button"
      onClick={() => onClick?.(photo)}
      className="group relative mb-2.5 sm:mb-4 block w-full cursor-zoom-in overflow-hidden rounded-xl sm:rounded-2xl border-0 bg-slate-200 p-0 text-left shadow-sm transition hover:shadow-lg dark:bg-slate-800"
      style={{ breakInside: 'avoid' }}
    >
      <div style={{ paddingTop: `${Math.min(Math.max(ratio, 0.5), 1.6) * 100}%` }} className="relative">
        <img
          src={src}
          alt={photo.caption}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      </div>

      {showStatus && photo.status && (
        <Chip
          size="small"
          label={PHOTO_STATUS_LABELS[photo.status]}
          color={PHOTO_STATUS_COLORS[photo.status]}
          className="!absolute left-2 top-2 sm:left-3 sm:top-3 shadow !text-[10px] sm:!text-xs"
        />
      )}
      {showAngkatan && photo.angkatan_year && (
        <span className="absolute right-2 top-2 sm:right-3 sm:top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white backdrop-blur">
          {photo.angkatan_year}
        </span>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2.5 sm:p-4 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <p className="m-0 line-clamp-2 text-xs sm:text-sm font-medium leading-snug text-white">{photo.caption}</p>
        <div className="mt-1 sm:mt-2 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-white/85">
          <span className="truncate">{photo.uploader_name}</span>
          <span className="ml-auto flex items-center gap-0.5">
            {Number(photo.is_liked_by_me) ? (
              <FavoriteRoundedIcon sx={{ fontSize: { xs: 13, sm: 15 } }} className="text-pink-400" />
            ) : (
              <FavoriteBorderRoundedIcon sx={{ fontSize: { xs: 13, sm: 15 } }} />
            )}
            {Number(photo.like_count) || 0}
          </span>
          <span className="flex items-center gap-0.5">
            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: { xs: 12, sm: 14 } }} />
            {Number(photo.comment_count) || 0}
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Grid masonry berbasis CSS columns (ringan, tanpa library tambahan).
 */
export default function PhotoMasonryGrid({
  photos = [],
  loading = false,
  skeletonCount = 8,
  onPhotoClick,
  showStatus = false,
  showAngkatan = false,
  className = '',
}) {
  return (
    <div className={`columns-2 gap-2.5 sm:gap-4 lg:columns-3 xl:columns-4 ${className}`}>
      {photos.map((photo) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          onClick={onPhotoClick}
          showStatus={showStatus}
          showAngkatan={showAngkatan}
        />
      ))}
      {loading &&
        Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton
            key={`sk-${i}`}
            variant="rounded"
            height={SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length]}
            className="mb-2.5 sm:mb-4 !rounded-xl sm:!rounded-2xl"
            style={{ breakInside: 'avoid' }}
          />
        ))}
    </div>
  );
}

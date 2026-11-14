// FILE: client/src/components/academic/YoutubePlayer.jsx
import { useMemo } from 'react';
import { extractYoutubeVideoId } from '../../utils/youtube';

/**
 * Komponen responsif untuk memutar video rekaman perkuliahan YouTube.
 * Mendukung videoId langsung atau URL lengkap (watch, youtu.be, shorts, live, embed).
 */
export default function YoutubePlayer({ videoId, videoUrl, url, title = 'Rekaman Perkuliahan' }) {
  const finalVideoId = useMemo(() => {
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) return videoId;
    return extractYoutubeVideoId(videoUrl || url || '');
  }, [videoId, videoUrl, url]);

  if (!finalVideoId) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        Tautan video tidak valid atau belum diatur.
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-lg" style={{ paddingTop: '56.25%' }}>
      <iframe
        className="absolute inset-0 h-full w-full border-0"
        src={`https://www.youtube-nocookie.com/embed/${finalVideoId}?rel=0&modestbranding=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

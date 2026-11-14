// FILE: client/src/utils/youtube.js
const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Mengekstrak ID video YouTube (11 karakter) dari URL watch, youtu.be, embed, shorts, atau live.
 */
export function extractYoutubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (hostname === 'youtu.be') {
      const candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return YOUTUBE_ID_REGEX.test(candidate) ? candidate : null;
    }

    if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com' ||
      hostname === 'youtube-nocookie.com'
    ) {
      const vParam = parsed.searchParams.get('v');
      if (vParam && YOUTUBE_ID_REGEX.test(vParam)) {
        return vParam;
      }

      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
        return YOUTUBE_ID_REGEX.test(segments[1]) ? segments[1] : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getYoutubeEmbedUrl(url) {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?rel=0`;
}

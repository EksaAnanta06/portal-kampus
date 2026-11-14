// FILE: client/src/hooks/useCloudinaryUrl.js
import { useMemo } from 'react';

/**
 * Menyisipkan transformasi Cloudinary (f_auto, q_auto, resize) ke URL gambar.
 *  - URL Cloudinary  : .../image/upload/<transformasi>/v123/folder/file.jpg
 *  - URL Unsplash    : parameter w/h/q diganti (dipakai oleh data seed)
 *  - URL lain        : dikembalikan apa adanya
 */
export const getOptimizedImageUrl = (url, { width, height, crop = 'fill', quality = 'auto', gravity = 'auto' } = {}) => {
  if (!url || typeof url !== 'string') return '';

  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    const parts = ['f_auto', `q_${quality}`];
    if (width) parts.push(`w_${Math.round(width)}`);
    if (height) parts.push(`h_${Math.round(height)}`);
    if (width || height) {
      parts.push(`c_${crop}`);
      if (crop === 'fill' || crop === 'thumb') parts.push(`g_${gravity}`);
    }
    parts.push('dpr_auto');
    return url.replace('/upload/', `/upload/${parts.join(',')}/`);
  }

  if (url.includes('images.unsplash.com')) {
    try {
      const u = new URL(url);
      u.searchParams.set('auto', 'format');
      u.searchParams.set('q', '75');
      if (width) u.searchParams.set('w', String(Math.round(width)));
      if (height) {
        u.searchParams.set('h', String(Math.round(height)));
        u.searchParams.set('fit', 'crop');
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
};

export const IMAGE_PRESETS = {
  thumb: { width: 480 },
  card: { width: 720, height: 420 },
  avatar: { width: 160, height: 160, crop: 'thumb', gravity: 'face' },
  lightbox: { width: 1600, crop: 'limit' },
  hero: { width: 1920, height: 900 },
};

/**
 * Hook: const src = useCloudinaryUrl(photo.url, 'thumb')
 *       const src = useCloudinaryUrl(photo.url, { width: 600 })
 */
export default function useCloudinaryUrl(url, presetOrOptions = 'thumb') {
  return useMemo(() => {
    const opts =
      typeof presetOrOptions === 'string' ? IMAGE_PRESETS[presetOrOptions] || {} : presetOrOptions || {};
    return getOptimizedImageUrl(url, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(presetOrOptions)]);
}

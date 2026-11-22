// FILE: client/src/platform/fileDownloader.js
import { isNativePlatform } from './detection';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { openExternalUrl } from './externalBrowser';

/**
 * Konversi Blob atau ArrayBuffer ke Base64 string
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Membersihkan nama berkas agar aman untuk Android Filesystem, FileProvider, & MimeTypeMap.
 */
function sanitizeFilename(rawName, fallbackExt = '') {
  const baseName = String(rawName || '')
    .split(/[/\\]/)
    .pop()
    .trim();

  const lastDot = baseName.lastIndexOf('.');
  let stem = lastDot > 0 ? baseName.slice(0, lastDot) : baseName;
  let ext = lastDot > 0 ? baseName.slice(lastDot + 1) : '';

  if (/^[a-z0-9]{1,8}$/i.test(ext)) {
    ext = `.${ext.toLowerCase()}`;
  } else {
    if (ext) stem = baseName;
    const cleanFallback = String(fallbackExt || '')
      .replace(/^\./, '')
      .trim()
      .toLowerCase();
    ext = /^[a-z0-9]{1,8}$/.test(cleanFallback) ? `.${cleanFallback}` : '';
  }

  const safeStem = stem
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${safeStem || 'berkas_materi'}${ext}`;
}

/**
 * Menyalin berkas dari Cache ke Documents/PortalPasim secara best-effort agar tetap tersimpan di HP.
 */
async function copyToDocumentsBestEffort(cacheFilename) {
  try {
    await Filesystem.mkdir({
      path: 'PortalPasim',
      directory: Directory.Documents,
      recursive: true,
    }).catch(() => {});

    await Filesystem.copy({
      from: cacheFilename,
      directory: Directory.Cache,
      to: `PortalPasim/${cacheFilename}`,
      toDirectory: Directory.Documents,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Membuka sheet berbagi / penampil berkas Android tanpa EXTRA_TEXT agar MIME file tetap utuh.
 */
async function shareNativeFile(fileUri, safeFilename) {
  const uri = fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`;
  try {
    await Share.share({
      title: safeFilename,
      files: [uri],
      dialogTitle: 'Buka atau Simpan Berkas',
    });
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (!msg.includes('cancel')) {
      throw err;
    }
  }
}

function triggerWebAnchorDownload(href, filename, { external = false } = {}) {
  if (typeof window === 'undefined') return;
  const link = document.createElement('a');
  link.href = href;
  if (external) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Unduh atau simpan berkas Blob (PDF, ZIP materi, dsb).
 * Di Web: Menggunakan link download elemen DOM.
 * Di Native: Menyimpan ke Cache, menyalin ke Documents/PortalPasim, lalu membuka Sheet Berbagi/Penampil sistem.
 */
export async function downloadBlobFile(blobData, filename, fallbackExt = '') {
  if (isNativePlatform()) {
    const safeFilename = sanitizeFilename(filename, fallbackExt);
    const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
    const base64Data = await blobToBase64(blob);

    const saved = await Filesystem.writeFile({
      path: safeFilename,
      data: base64Data,
      directory: Directory.Cache,
    });

    const savedToDocuments = await copyToDocumentsBestEffort(safeFilename);
    await shareNativeFile(saved.uri, safeFilename);
    return { ok: true, filename: safeFilename, savedToDocuments };
  }

  if (typeof window !== 'undefined') {
    const url = window.URL.createObjectURL(
      blobData instanceof Blob ? blobData : new Blob([blobData])
    );
    triggerWebAnchorDownload(url, filename);
    setTimeout(() => window.URL.revokeObjectURL(url), 1500);
    return { ok: true, filename };
  }
  return { ok: false, filename };
}

/**
 * Mengunduh berkas dari URL remote (Cloudinary/eksternal) dengan nama & ekstensi asli.
 * Di Native: Memakai native HTTP stream via Filesystem.downloadFile lalu fallback ke browser sistem jika gagal.
 */
export async function downloadRemoteFile(url, filename, fallbackExt = '') {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    throw new Error('URL berkas tidak valid.');
  }

  const safeFilename = sanitizeFilename(filename, fallbackExt);

  if (isNativePlatform()) {
    try {
      await Filesystem.downloadFile({
        url,
        path: safeFilename,
        directory: Directory.Cache,
      });
      const { uri } = await Filesystem.getUri({
        path: safeFilename,
        directory: Directory.Cache,
      });
      const savedToDocuments = await copyToDocumentsBestEffort(safeFilename);
      await shareNativeFile(uri, safeFilename);
      return { ok: true, filename: safeFilename, savedToDocuments };
    } catch (err) {
      console.warn('[FileDownloader] Native downloadFile gagal, fallback ke browser:', err);
      await openExternalUrl(url);
      return { ok: true, filename: safeFilename, openedInBrowser: true };
    }
  }

  const downloadName = filename || safeFilename;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return await downloadBlobFile(blob, downloadName, fallbackExt);
  } catch {
    triggerWebAnchorDownload(url, downloadName, { external: true });
    return { ok: true, filename: downloadName };
  }
}

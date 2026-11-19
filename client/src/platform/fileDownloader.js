// FILE: client/src/platform/fileDownloader.js
import { isNativePlatform } from './detection';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
 * Unduh atau simpan berkas Blob (PDF, ZIP materi, dsb).
 * Di Web: Menggunakan link download elemen DOM.
 * Di Native: Menyimpan berkas ke direktori cache lokal lalu membuka Sheet Berbagi sistem agar bisa disimpan/dibuka.
 */
export async function downloadBlobFile(blobData, filename) {
  if (isNativePlatform()) {
    try {
      const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
      const base64Data = await blobToBase64(blob);

      // Simpan sementara di direktori Cache aplikasi
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Buka lembar berbagi sistem bawaan Android/iOS
      await Share.share({
        title: filename,
        text: `Berkas materi: ${filename}`,
        url: saved.uri,
        dialogTitle: 'Buka atau Simpan Berkas',
      });
      return true;
    } catch (err) {
      console.error('[FileDownloader] Gagal memproses berkas native:', err);
      // Fallback ke browser standar jika gagal
    }
  }

  // Web Browser fallback
  if (typeof window !== 'undefined') {
    const url = window.URL.createObjectURL(
      blobData instanceof Blob ? blobData : new Blob([blobData])
    );
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1500);
    return true;
  }
  return false;
}
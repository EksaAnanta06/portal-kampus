// FILE: server/src/services/zipStream.service.js
import https from 'https';
import net from 'net';
import { ZipArchive } from 'archiver';
import { sanitizePathSegment } from '../utils/youtube.js';
import { AppError } from '../utils/AppError.js';
import * as catalogRepo from '../repositories/materialCatalog.repository.js';
import * as materialRepo from '../repositories/material.repository.js';
import * as packageRepo from '../repositories/materialPackage.repository.js';

const MAX_REDIRECTS = 3;
const REMOTE_TIMEOUT_MS = 15000;
const ALLOWED_EXTERNAL_HOSTS = new Set(['res.cloudinary.com', 'www.w3.org']);

const isPrivateIpOrHost = (hostname) => {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '::1'
  ) {
    return true;
  }

  if (net.isIP(lower)) {
    if (
      lower.startsWith('127.') ||
      lower.startsWith('10.') ||
      lower.startsWith('192.168.') ||
      lower.startsWith('169.254.') ||
      lower === '0.0.0.0' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    ) {
      return true;
    }
    const octets = lower.split('.').map(Number);
    if (octets.length === 4 && octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return true;
    }
  }
  return false;
};

const isAllowedDownloadUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (isPrivateIpOrHost(host)) return false;
    if (host.endsWith('.cloudinary.com') || ALLOWED_EXTERNAL_HOSTS.has(host)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Streaming berkas remote (HTTPS allowlisted) ke archiver dengan dukungan HTTP redirect <= 3 hop.
 */
const appendRemoteFileToArchive = (archive, fileUrl, zipPath, redirectCount = 0) => {
  return new Promise((resolve) => {
    if (!fileUrl || !isAllowedDownloadUrl(fileUrl)) {
      archive.append(
        `Berkas tidak diunduh otomatis (sumber non-allowlist): ${fileUrl || '-'}`,
        { name: `${zipPath}.txt` }
      );
      return resolve();
    }

    const request = https.get(fileUrl, { timeout: REMOTE_TIMEOUT_MS }, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          archive.append(`Terlalu banyak pengalihan saat mengunduh: ${fileUrl}`, {
            name: `${zipPath}.txt`,
          });
          return resolve();
        }
        const nextUrl = new URL(response.headers.location, fileUrl).toString();
        return resolve(
          appendRemoteFileToArchive(archive, nextUrl, zipPath, redirectCount + 1)
        );
      }

      if (response.statusCode >= 400) {
        response.resume();
        archive.append(`Berkas tidak dapat diakses (HTTP ${response.statusCode}): ${fileUrl}`, {
          name: `${zipPath}.txt`,
        });
        return resolve();
      }

      archive.append(response, { name: zipPath });
      response.on('end', () => resolve());
      response.on('error', (err) => {
        console.warn(`[ZIP STREAM] Stream error ${fileUrl}:`, err.message);
        resolve();
      });
    });

    request.on('timeout', () => {
      request.destroy();
      archive.append(`Waktu unduh habis saat mengambil berkas: ${fileUrl}`, {
        name: `${zipPath}.txt`,
      });
      resolve();
    });

    request.on('error', (err) => {
      console.warn(`[ZIP STREAM] Gagal mengunduh ${fileUrl}:`, err.message);
      archive.append(`Gagal mengunduh berkas: ${fileUrl}`, { name: `${zipPath}.txt` });
      resolve();
    });
  });
};

const createSafeZipStream = (res, zipFilename) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
  res.setHeader('X-Accel-Buffering', 'no');

  const archive = new ZipArchive({ zlib: { level: 6 } });

  archive.on('error', (err) => {
    console.error('[ZIP ARCHIVER ERROR]', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Gagal membuat arsip ZIP.',
        data: null,
        meta: null,
      });
    } else if (!res.destroyed) {
      res.destroy(err);
    }
  });

  archive.pipe(res);
  return archive;
};

export const streamCourseZipService = async (courseId, user, res) => {
  const course = await catalogRepo.getCourseById(courseId);
  if (!course || course.status !== 'approved') {
    throw new AppError('Mata kuliah tidak ditemukan.', 404);
  }

  const rows = await packageRepo.getApprovedMaterialsForCourseDownload(courseId);
  if (!rows || rows.length === 0) {
    throw new AppError(
      'Belum ada materi pembelajaran yang disetujui pada mata kuliah ini.',
      404
    );
  }

  const cleanCourseName = sanitizePathSegment(course.nama);
  const zipFilename = `Materi_${sanitizePathSegment(course.kode)}_${cleanCourseName}.zip`;
  const archive = createSafeZipStream(res, zipFilename);

  const prodiFolder = sanitizePathSegment(course.prodi_kode || 'UMUM');
  const semFolder = `Semester-${course.semester_rekomendasi || 1}`;
  const courseFolder = `${sanitizePathSegment(course.kode)}_${cleanCourseName}`;

  const infoContent =
    `PERPUSTAKAAN MATERI KAMPUS - UNIVERSITAS NASIONAL PASIM\n` +
    `=======================================================\n` +
    `Mata Kuliah  : ${course.kode} - ${course.nama} (${course.sks} SKS)\n` +
    `Program Studi: ${course.prodi_nama || course.prodi_kode || 'Semua Prodi'}\n` +
    `Rekomendasi  : Semester ${course.semester_rekomendasi || 1}\n` +
    `Diunduh oleh : ${user.full_name || 'Mahasiswa'}\n` +
    `Waktu Unduh  : ${new Date().toLocaleString('id-ID')}\n\n` +
    `Catatan Etika Pembelajaran:\n` +
    `- Materi ini dibagikan oleh kakak tingkat dan alumni untuk bahan belajar mandiri.\n` +
    `- Dilarang keras memperjualbelikan berkas atau menggunakan materi untuk kecurangan ujian.\n`;

  archive.append(infoContent, {
    name: `${prodiFolder}/${semFolder}/${courseFolder}/INFORMASI_MATERI.txt`,
  });

  const linkEntries = [];
  const seenLinkMaterials = new Set();
  const downloadedMaterialIds = [];

  for (const row of rows) {
    downloadedMaterialIds.push(row.materi_id);
    const tipeFolder = sanitizePathSegment(row.tipe_materi || 'lainnya');

    if (row.file_url) {
      const cleanFileName = sanitizePathSegment(
        row.file_name || `berkas_${row.file_id}.${row.file_format || 'pdf'}`
      );
      const fullZipPath = `${prodiFolder}/${semFolder}/${courseFolder}/${tipeFolder}/${cleanFileName}`;
      await appendRemoteFileToArchive(archive, row.file_url, fullZipPath);
    }

    if (row.external_url && !seenLinkMaterials.has(row.materi_id)) {
      seenLinkMaterials.add(row.materi_id);
      linkEntries.push(
        `[${String(row.tipe_materi || 'LAINNYA').toUpperCase()}] ${row.materi_judul}\nURL: ${row.external_url}\n`
      );
    }
  }

  if (linkEntries.length > 0) {
    const linksContent =
      `DAFTAR TAUTAN MATERI / VIDEO PERKULIAHAN\nMATA KULIAH: ${course.kode} - ${course.nama}\n\n` +
      linkEntries.join('\n');
    archive.append(linksContent, {
      name: `${prodiFolder}/${semFolder}/${courseFolder}/link-materi.txt`,
    });
  }

  await materialRepo.incrementMaterialDownload(downloadedMaterialIds).catch((err) => {
    console.warn('[ZIP STREAM] Gagal memperbarui counter download:', err.message);
  });
  await archive.finalize();
};

export const streamPackageZipService = async (packageId, user, res) => {
  const pkg = await packageRepo.getLearningPackageDetail(packageId);
  if (!pkg) {
    throw new AppError('Paket belajar tidak ditemukan.', 404);
  }

  const rows = await packageRepo.getApprovedMaterialsForPackageDownload(packageId);
  if (!rows || rows.length === 0) {
    throw new AppError(
      'Belum ada materi pembelajaran yang disetujui di dalam paket belajar ini.',
      404
    );
  }

  const cleanPkgTitle = sanitizePathSegment(pkg.judul);
  const zipFilename = `PaketBelajar_${cleanPkgTitle}.zip`;
  const archive = createSafeZipStream(res, zipFilename);

  const infoPkgContent =
    `PAKET BELAJAR SEMESTER - UNIVERSITAS NASIONAL PASIM\n` +
    `==================================================\n` +
    `Judul Paket  : ${pkg.judul}\n` +
    `Program Studi: ${pkg.prodi_nama || pkg.prodi_kode || 'Umum'}\n` +
    `Semester     : Semester ${pkg.semester || 1}\n` +
    `Deskripsi    : ${pkg.deskripsi || '-'}\n` +
    `Diunduh oleh : ${user.full_name || 'Mahasiswa'}\n` +
    `Waktu Unduh  : ${new Date().toLocaleString('id-ID')}\n\n` +
    `Materi pilihan ini dikurasi oleh tim akademik & moderator untuk persiapan belajar.\n`;

  archive.append(infoPkgContent, {
    name: `${cleanPkgTitle}/INFORMASI_PAKET.txt`,
  });

  const linksMap = {};
  const seenLinkKeys = new Set();
  const downloadedMaterialIds = [];

  for (const row of rows) {
    downloadedMaterialIds.push(row.materi_id);
    const prodiFolder = sanitizePathSegment(row.prodi_kode || pkg.prodi_kode || 'UMUM');
    const semFolder = `Semester-${row.semester_rekomendasi || pkg.semester || 1}`;
    const courseFolder = `${sanitizePathSegment(row.mata_kuliah_kode)}_${sanitizePathSegment(
      row.mata_kuliah_nama
    )}`;
    const tipeFolder = sanitizePathSegment(row.tipe_materi || 'lainnya');

    if (row.file_url) {
      const cleanFileName = sanitizePathSegment(
        row.file_name || `berkas_${row.file_id}.${row.file_format || 'pdf'}`
      );
      const fullZipPath = `${cleanPkgTitle}/${prodiFolder}/${semFolder}/${courseFolder}/${tipeFolder}/${cleanFileName}`;
      await appendRemoteFileToArchive(archive, row.file_url, fullZipPath);
    }

    if (row.external_url && !seenLinkKeys.has(row.materi_id)) {
      seenLinkKeys.add(row.materi_id);
      const key = `${cleanPkgTitle}/${prodiFolder}/${semFolder}/${courseFolder}`;
      if (!linksMap[key]) linksMap[key] = [];
      linksMap[key].push(
        `[${String(row.tipe_materi || 'LAINNYA').toUpperCase()}] ${row.materi_judul}\nURL: ${row.external_url}\n`
      );
    }
  }

  for (const [folderPath, entries] of Object.entries(linksMap)) {
    const content = `DAFTAR TAUTAN MATERI / VIDEO\n\n` + entries.join('\n');
    archive.append(content, { name: `${folderPath}/link-materi.txt` });
  }

  await materialRepo.incrementMaterialDownload(downloadedMaterialIds).catch((err) => {
    console.warn('[ZIP STREAM] Gagal memperbarui counter download:', err.message);
  });
  await archive.finalize();
};

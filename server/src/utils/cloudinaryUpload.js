// FILE: server/src/utils/cloudinaryUpload.js
import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

/**
 * Mengunggah file buffer dari Multer memoryStorage ke Cloudinary via upload_stream
 */
export const uploadBufferToCloudinary = (buffer, subFolder = 'gallery') => {
  return new Promise((resolve, reject) => {
    // Fallback mode jika kredensial Cloudinary belum diisi saat testing lokal awal
    if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
      const mockId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return resolve({
        public_id: `${env.cloudinary.folder}/${subFolder}/${mockId}`,
        secure_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1080&q=80',
        width: 1080,
        height: 720,
        format: 'jpg',
        bytes: buffer.length,
      });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinary.folder}/${subFolder}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) {
          return reject(new AppError(`Gagal mengunggah gambar ke Cloudinary: ${error.message}`, 502));
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Menghapus file dari Cloudinary berdasarkan public_id
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId || publicId.startsWith('seed/') || publicId.includes('/mock_')) {
    return { result: 'skipped_seed_or_mock' };
  }
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    return { result: 'skipped_unconfigured' };
  }
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error(`[Cloudinary] Gagal menghapus public_id ${publicId}:`, err.message);
    return null;
  }
};

/**
 * Mengunggah file berkas dokumen/non-gambar (PDF, DOCX, ZIP, XLSX) ke Cloudinary sebagai raw resource
 * @param {Buffer} buffer - Buffer file
 * @param {string} subFolder - Subfolder (misal: 'tugas/1', 'pengumpulan/1/020123014', 'materi/1/pertemuan-1')
 * @param {Object} options - { accessType: 'authenticated' | 'upload', originalFilename: string }
 */
export const uploadRawBufferToCloudinary = (
  buffer,
  subFolder = 'documents',
  { accessType = 'authenticated', originalFilename = '' } = {}
) => {
  return new Promise((resolve, reject) => {
    if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
      const mockId = `mock_raw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return resolve({
        public_id: `${env.cloudinary.folder}/${subFolder}/${mockId}`,
        secure_url: `https://mock.pasim.ac.id/files/${mockId}`,
        resource_type: 'raw',
        type: accessType,
        bytes: buffer.length,
        original_filename: originalFilename,
      });
    }

    const uploadOptions = {
      folder: `${env.cloudinary.folder}/${subFolder}`,
      resource_type: 'raw',
      type: accessType, // 'authenticated' untuk berkas tugas mahasiswa, 'upload' untuk berkas publik/soal
      use_filename: true,
      unique_filename: true,
    };

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(new AppError(`Gagal mengunggah berkas ke Cloudinary: ${error.message}`, 502));
      }
      resolve(result);
    });

    uploadStream.end(buffer);
  });
};

/**
 * Menghasilkan signed download URL berumur pendek (default 15 menit) untuk berkas authenticated / private
 */
export const getSignedDownloadUrl = (publicId, format = '', expiresInSeconds = 900) => {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    return `https://mock.pasim.ac.id/signed-download/${publicId}`;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.utils.private_download_url(publicId, format || '', {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: expiresAt,
  });
};

/**
 * Menghapus berkas raw dari Cloudinary
 */
export const deleteRawFromCloudinary = async (publicId, accessType = 'authenticated') => {
  if (!publicId || publicId.startsWith('seed/') || publicId.includes('/mock_')) {
    return { result: 'skipped_seed_or_mock' };
  }
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    return { result: 'skipped_unconfigured' };
  }
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      type: accessType,
    });
  } catch (err) {
    console.error(`[Cloudinary] Gagal menghapus raw public_id ${publicId}:`, err.message);
    return null;
  }
};

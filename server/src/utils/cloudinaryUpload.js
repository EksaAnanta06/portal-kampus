// FILE: server/src/utils/cloudinaryUpload.js
import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

const hasCloudinaryConfig = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

/**
 * Mengunggah file buffer gambar ke Cloudinary via upload_stream
 */
export const uploadBufferToCloudinary = (buffer, subFolder = 'gallery') => {
  return new Promise((resolve, reject) => {
    if (!hasCloudinaryConfig()) {
      const mockId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return resolve({
        public_id: `${env.cloudinary.folder}/${subFolder}/${mockId}`,
        secure_url:
          'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1080&q=80',
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
 * Mengunggah berkas dokumen/non-gambar ke Cloudinary sebagai raw resource
 */
export const uploadRawBufferToCloudinary = (
  buffer,
  subFolder = 'documents',
  { accessType = 'upload', originalFilename = '' } = {}
) => {
  return new Promise((resolve, reject) => {
    if (!hasCloudinaryConfig()) {
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
      type: accessType,
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

export const deleteCloudinaryAsset = async (
  publicId,
  { resourceType = 'image', accessType = 'upload' } = {}
) => {
  if (!publicId || publicId.startsWith('seed/') || publicId.includes('/mock_') || publicId.startsWith('dummy_')) {
    return { result: 'skipped_seed_or_mock' };
  }
  if (!hasCloudinaryConfig()) {
    return { result: 'skipped_unconfigured' };
  }

  try {
    const opts = { resource_type: resourceType };
    if (resourceType === 'raw' && accessType) {
      opts.type = accessType;
    }
    return await cloudinary.uploader.destroy(publicId, opts);
  } catch (err) {
    console.error(`[Cloudinary] Gagal menghapus ${resourceType} public_id ${publicId}:`, err.message);
    return null;
  }
};

export const deleteFromCloudinary = (publicId) =>
  deleteCloudinaryAsset(publicId, { resourceType: 'image' });

export const deleteRawFromCloudinary = (publicId, accessType = 'upload') =>
  deleteCloudinaryAsset(publicId, { resourceType: 'raw', accessType });

/**
 * Menghapus file materi (menentukan otomatis apakah image vs raw berdasarkan format atau fallback dua tipe)
 */
export const deleteMaterialAssetFromCloudinary = async (publicId, fileFormat = '') => {
  if (!publicId || publicId.startsWith('dummy_') || publicId.includes('/mock_')) {
    return { result: 'skipped' };
  }
  const fmt = (fileFormat || '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fmt);

  if (isImage) {
    return deleteCloudinaryAsset(publicId, { resourceType: 'image' });
  }
  const res = await deleteCloudinaryAsset(publicId, { resourceType: 'raw', accessType: 'upload' });
  if (res?.result === 'not found') {
    return deleteCloudinaryAsset(publicId, { resourceType: 'raw', accessType: 'authenticated' });
  }
  return res;
};

/**
 * Mengekstrak public_id dari URL Cloudinary sebagai fallback jika public_id tidak tersimpan di DB
 */
export const extractCloudinaryPublicId = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./?#]+)?(?:[?#].*)?$/);
  return match ? match[1] : null;
};

/**
 * Menghasilkan signed download URL berumur pendek
 */
export const getSignedDownloadUrl = (publicId, format = '', expiresInSeconds = 900) => {
  if (!hasCloudinaryConfig()) {
    return `https://mock.pasim.ac.id/signed-download/${publicId}`;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.utils.private_download_url(publicId, format || '', {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: expiresAt,
  });
};

// FILE: server/src/services/gallery.service.js
import { AppError } from '../utils/AppError.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';
import { getAngkatanByYearOrId } from '../queries/angkatan.queries.js';
import {
  insertPhotoRecord,
  findPhotoById,
  updatePhotoRecord,
  moderatePhotoRecord,
  deletePhotoRecord,
} from '../queries/photo.queries.js';
import { createNotification } from '../queries/campus.queries.js';

export const uploadMultiplePhotosService = async ({ files, metadata, user }) => {
  if (!files || files.length === 0) {
    throw new AppError('Pilih minimal 1 file foto untuk diunggah.', 400);
  }

  const angkatan = await getAngkatanByYearOrId(metadata.angkatan_id);
  if (!angkatan) {
    throw new AppError('Angkatan tujuan tidak ditemukan.', 404);
  }

  // Jika pengunggah adalah admin atau moderator, langsung berstatus approved
  const isAutoApproved = ['admin', 'moderator'].includes(user.role);
  const initialStatus = isAutoApproved ? 'approved' : 'pending';

  const uploadedPhotos = [];

  for (const file of files) {
    const cloudRes = await uploadBufferToCloudinary(
      file.buffer,
      `angkatan-${angkatan.year}`
    );

    const newPhotoId = await insertPhotoRecord({
      cloudinary_public_id: cloudRes.public_id,
      url: cloudRes.secure_url,
      width: cloudRes.width,
      height: cloudRes.height,
      format: cloudRes.format,
      bytes: cloudRes.bytes,
      caption: metadata.caption,
      tags: metadata.tags || null,
      taken_date: metadata.taken_date || null,
      status: initialStatus,
      uploader_id: user.id,
      angkatan_id: angkatan.id,
      album_id: metadata.album_id || null,
      moderated_by: isAutoApproved ? user.id : null,
      moderated_at: isAutoApproved ? new Date() : null,
    });

    const savedPhoto = await findPhotoById(newPhotoId, user.id);
    uploadedPhotos.push(savedPhoto);
  }

  return {
    photos: uploadedPhotos,
    status: initialStatus,
  };
};

export const editPhotoByOwnerOrAdminService = async ({ photoId, payload, user }) => {
  const photo = await findPhotoById(photoId);
  if (!photo) {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  const isOwner = photo.uploader_id === user.id;
  const isStaff = ['admin', 'moderator'].includes(user.role);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda hanya dapat mengedit foto milik Anda sendiri.', 403);
  }

  await updatePhotoRecord(photoId, {
    caption: payload.caption,
    album_id: payload.album_id !== undefined ? payload.album_id : photo.album_id,
    tags: payload.tags !== undefined ? payload.tags : photo.tags,
  });

  return findPhotoById(photoId, user.id);
};

export const deletePhotoByOwnerOrAdminService = async ({ photoId, user }) => {
  const photo = await findPhotoById(photoId);
  if (!photo) {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  const isOwner = photo.uploader_id === user.id;
  const isStaff = ['admin', 'moderator'].includes(user.role);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak berhak menghapus foto ini.', 403);
  }

  // Hapus aset di Cloudinary terlebih dahulu menggunakan public_id
  await deleteFromCloudinary(photo.cloudinary_public_id);
  await deletePhotoRecord(photoId);

  return { deletedId: Number(photoId), public_id: photo.cloudinary_public_id };
};

export const moderatePhotoService = async ({ photoId, status, rejection_reason, moderator }) => {
  const photo = await findPhotoById(photoId);
  if (!photo) {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  await moderatePhotoRecord(photoId, {
    status,
    rejection_reason: status === 'rejected' ? rejection_reason : null,
    moderated_by: moderator.id,
  });

  if (photo.uploader_id !== moderator.id) {
    const shortCaption =
      photo.caption.length > 45 ? `${photo.caption.substring(0, 45)}...` : photo.caption;

    await createNotification({
      userId: photo.uploader_id,
      type: status === 'approved' ? 'photo_approved' : 'photo_rejected',
      title: status === 'approved' ? 'Foto Disetujui Moderator' : 'Foto Belum Dapat Ditayangkan',
      message:
        status === 'approved'
          ? `Foto "${shortCaption}" telah tayang di Galeri Angkatan ${photo.angkatan_year}.`
          : `Foto "${shortCaption}" ditolak. Alasan: ${rejection_reason || 'Tidak sesuai pedoman galeri kampus'}.`,
      referenceLink: `/angkatan/${photo.angkatan_year}`,
    });
  }

  return findPhotoById(photoId, moderator.id);
};

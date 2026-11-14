// FILE: server/src/controllers/photo.controller.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { listPhotosQuery, findPhotoById } from '../queries/photo.queries.js';
import { getCommentsByPhotoId } from '../queries/interaction.queries.js';
import {
  uploadMultiplePhotosService,
  editPhotoByOwnerOrAdminService,
  deletePhotoByOwnerOrAdminService,
  moderatePhotoService,
} from '../services/gallery.service.js';

export const getPhotos = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));

  // Hanya admin/moderator atau pemilik foto yang boleh memfilter status selain 'approved'
  let requestedStatus = 'approved';
  if (req.query.status && req.user) {
    const isStaff = ['admin', 'moderator'].includes(req.user.role);
    const isFilteringOwnPhotos = Number(req.query.uploader_id) === req.user.id;
    if (isStaff || isFilteringOwnPhotos) {
      requestedStatus = req.query.status === 'all' ? '' : req.query.status;
    }
  }

  const { rows, total } = await listPhotosQuery({
    angkatanId: req.query.angkatan_id || null,
    angkatanYear: req.query.angkatan_year || null,
    albumId: req.query.album_id || null,
    uploaderId: req.query.uploader_id || null,
    status: requestedStatus,
    search: req.query.search || '',
    tag: req.query.tag || '',
    currentUserId: req.user?.id || null,
    page,
    limit,
  });

  return sendResponse(res, {
    message: 'Daftar foto berhasil dimuat.',
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const getPhotoDetail = asyncHandler(async (req, res) => {
  const photo = await findPhotoById(Number(req.params.id), req.user?.id || null);
  if (!photo) {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  if (photo.status !== 'approved') {
    const isOwner = req.user && req.user.id === photo.uploader_id;
    const isStaff = req.user && ['admin', 'moderator'].includes(req.user.role);
    if (!isOwner && !isStaff) {
      throw new AppError('Foto ini sedang dalam peninjauan moderator.', 403);
    }
  }

  const comments = await getCommentsByPhotoId(photo.id);
  return sendResponse(res, {
    message: 'Detail foto berhasil dimuat.',
    data: {
      photo,
      comments,
    },
  });
});

export const uploadPhotos = asyncHandler(async (req, res) => {
  const result = await uploadMultiplePhotosService({
    files: req.files,
    metadata: req.body,
    user: req.user,
  });

  const message =
    result.status === 'approved'
      ? `${result.photos.length} foto berhasil diunggah dan langsung dipublikasikan.`
      : `${result.photos.length} foto berhasil diunggah dan berstatus "Menunggu Moderasi" admin/moderator.`;

  return sendResponse(res, {
    statusCode: 201,
    message,
    data: result.photos,
  });
});

export const updatePhoto = asyncHandler(async (req, res) => {
  const updated = await editPhotoByOwnerOrAdminService({
    photoId: Number(req.params.id),
    payload: req.body,
    user: req.user,
  });

  return sendResponse(res, {
    message: 'Informasi foto berhasil diperbarui.',
    data: updated,
  });
});

export const deletePhoto = asyncHandler(async (req, res) => {
  const deleted = await deletePhotoByOwnerOrAdminService({
    photoId: Number(req.params.id),
    user: req.user,
  });

  return sendResponse(res, {
    message: 'Foto berhasil dihapus dari database dan Cloudinary.',
    data: deleted,
  });
});

export const moderatePhoto = asyncHandler(async (req, res) => {
  const moderated = await moderatePhotoService({
    photoId: Number(req.params.id),
    status: req.body.status,
    rejection_reason: req.body.rejection_reason,
    moderator: req.user,
  });

  return sendResponse(res, {
    message: `Foto berhasil diubah statusnya menjadi "${moderated.status}".`,
    data: moderated,
  });
});

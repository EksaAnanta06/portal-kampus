// FILE: server/src/controllers/interaction.controller.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { findPhotoById } from '../queries/photo.queries.js';
import {
  togglePhotoLikeQuery,
  getPhotoLikersQuery,
  getCommentsByPhotoId,
  insertCommentRecord,
  findCommentById,
  updateCommentRecord,
  deleteCommentById,
  createPhotoReportRecord,
  listPhotoReportsQuery,
  resolvePhotoReportRecord,
} from '../queries/interaction.queries.js';
import { createNotification } from '../queries/campus.queries.js';

export const toggleLike = asyncHandler(async (req, res) => {
  const photoId = Number(req.params.id);
  const photo = await findPhotoById(photoId);
  if (!photo || photo.status !== 'approved') {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  const result = await togglePhotoLikeQuery(photoId, req.user.id);

  if (result.liked && photo.uploader_id !== req.user.id) {
    await createNotification({
      userId: photo.uploader_id,
      type: 'new_like',
      title: 'Seseorang Menyukai Foto Anda',
      message: `${req.user.full_name} menyukai foto Anda di Galeri Angkatan ${photo.angkatan_year}.`,
      referenceLink: `/angkatan/${photo.angkatan_year}?photo=${photo.id}`,
    });
  }

  return sendResponse(res, {
    message: result.liked ? 'Foto disukai.' : 'Batal menyukai foto.',
    data: result,
  });
});

export const getPhotoLikers = asyncHandler(async (req, res) => {
  const photoId = Number(req.params.id);
  const photo = await findPhotoById(photoId);
  if (!photo) {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  const likers = await getPhotoLikersQuery(photoId);
  return sendResponse(res, {
    message: 'Daftar penyuka foto berhasil dimuat.',
    data: likers,
  });
});

export const listComments = asyncHandler(async (req, res) => {
  const comments = await getCommentsByPhotoId(Number(req.params.id));
  return sendResponse(res, {
    message: 'Komentar berhasil dimuat.',
    data: comments,
  });
});

export const addComment = asyncHandler(async (req, res) => {
  const photoId = Number(req.params.id);
  const photo = await findPhotoById(photoId);
  if (!photo || photo.status !== 'approved') {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  const comment = await insertCommentRecord({
    photoId,
    userId: req.user.id,
    content: req.body.content,
  });

  if (photo.uploader_id !== req.user.id) {
    await createNotification({
      userId: photo.uploader_id,
      type: 'new_comment',
      title: 'Komentar Baru pada Foto Anda',
      message: `${req.user.full_name} mengomentari foto Anda: "${req.body.content.substring(0, 60)}"`,
      referenceLink: `/angkatan/${photo.angkatan_year}?photo=${photo.id}`,
    });
  }

  return sendResponse(res, {
    statusCode: 201,
    message: 'Komentar berhasil ditambahkan.',
    data: comment,
  });
});

export const updateComment = asyncHandler(async (req, res) => {
  const commentId = Number(req.params.commentId);
  const comment = await findCommentById(commentId);
  if (!comment) {
    throw new AppError('Komentar tidak ditemukan.', 404);
  }

  const isOwner = comment.user_id === req.user.id;
  const isStaff = ['admin', 'moderator'].includes(req.user.role);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin mengedit komentar ini.', 403);
  }

  const content = req.body.content?.trim();
  if (!content) {
    throw new AppError('Komentar tidak boleh kosong.', 400);
  }

  const updatedComment = await updateCommentRecord(comment.id, content);
  return sendResponse(res, {
    message: 'Komentar berhasil diperbarui.',
    data: updatedComment,
  });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await findCommentById(Number(req.params.commentId));
  if (!comment) {
    throw new AppError('Komentar tidak ditemukan.', 404);
  }

  const isOwner = comment.user_id === req.user.id;
  const isStaff = ['admin', 'moderator'].includes(req.user.role);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin menghapus komentar ini.', 403);
  }

  await deleteCommentById(comment.id);
  return sendResponse(res, {
    message: 'Komentar berhasil dihapus.',
  });
});

export const reportPhoto = asyncHandler(async (req, res) => {
  const photoId = Number(req.params.id);
  const photo = await findPhotoById(photoId);
  if (!photo) {
    throw new AppError('Foto tidak ditemukan.', 404);
  }

  await createPhotoReportRecord({
    photoId,
    reporterId: req.user.id,
    reason: req.body.reason,
    description: req.body.description,
  });

  return sendResponse(res, {
    statusCode: 201,
    message: 'Laporan telah dikirim ke tim moderator kampus. Terima kasih atas kepedulian Anda.',
  });
});

export const getPhotoReports = asyncHandler(async (req, res) => {
  const reports = await listPhotoReportsQuery(req.query.status || 'open');
  return sendResponse(res, {
    message: 'Daftar laporan foto berhasil dimuat.',
    data: reports,
  });
});

export const resolvePhotoReport = asyncHandler(async (req, res) => {
  const status = req.body.status === 'dismissed' ? 'dismissed' : 'resolved';
  await resolvePhotoReportRecord(Number(req.params.reportId), {
    status,
    resolvedBy: req.user.id,
  });

  return sendResponse(res, {
    message: `Laporan berhasil ditandai sebagai "${status}".`,
  });
});

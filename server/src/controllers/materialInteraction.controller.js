// FILE: server/src/controllers/materialInteraction.controller.js
import { sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as materialService from '../services/material.service.js';

// Vote & Komentar
export const toggleMaterialVote = asyncHandler(async (req, res) => {
  const result = await materialService.toggleMaterialVoteService(req.params.id, req.user);
  return sendResponse(res, {
    message: result.voted
      ? 'Terima kasih! Anda menandai materi ini bermanfaat.'
      : 'Tanda bermanfaat dibatalkan.',
    data: result,
  });
});

export const getMaterialComments = asyncHandler(async (req, res) => {
  const comments = await materialService.getMaterialCommentsService(req.params.id, req.user);
  return sendResponse(res, { message: 'Komentar materi berhasil dimuat.', data: comments });
});

export const addMaterialComment = asyncHandler(async (req, res) => {
  const created = await materialService.addMaterialCommentService(
    req.params.id,
    req.body,
    req.user
  );
  return sendResponse(res, {
    statusCode: 201,
    message: 'Komentar berhasil dipublikasikan.',
    data: created,
  });
});

export const deleteMaterialComment = asyncHandler(async (req, res) => {
  await materialService.deleteMaterialCommentService(req.params.commentId, req.user);
  return sendResponse(res, { message: 'Komentar berhasil dihapus.' });
});

// Laporan & Leaderboard
export const reportMaterial = asyncHandler(async (req, res) => {
  const created = await materialService.reportMaterialService(req.params.id, req.body, req.user);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Laporan Anda telah diterima dan akan ditinjau oleh tim moderator. Terima kasih!',
    data: created,
  });
});

export const getMaterialReports = asyncHandler(async (req, res) => {
  const { rows, meta } = await materialService.getMaterialReportsService(req.query);
  return sendResponse(res, {
    message: 'Daftar laporan materi berhasil dimuat.',
    data: rows,
    meta,
  });
});

export const handleMaterialReport = asyncHandler(async (req, res) => {
  await materialService.handleMaterialReportService(req.params.id, req.body, req.user);
  return sendResponse(res, {
    message: `Laporan berhasil diproses (${req.body.action}).`,
  });
});

export const getLeaderboard = asyncHandler(async (req, res) => {
  const leaders = await materialService.getLeaderboardService(req.query.limit);
  return sendResponse(res, {
    message: 'Papan peringkat kontributor berhasil dimuat.',
    data: leaders,
  });
});

// Koleksi Saya
export const getUserCollections = asyncHandler(async (req, res) => {
  const collections = await materialService.getUserCollectionsService(req.user.id);
  return sendResponse(res, { message: 'Daftar koleksi berhasil dimuat.', data: collections });
});

export const getCollectionItems = asyncHandler(async (req, res) => {
  const collection = await materialService.getCollectionItemsService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Isi koleksi berhasil dimuat.', data: collection });
});

export const createCollection = asyncHandler(async (req, res) => {
  const created = await materialService.createCollectionService(req.user.id, req.body);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Koleksi berhasil dibuat.',
    data: created,
  });
});

export const toggleCollectionItem = asyncHandler(async (req, res) => {
  const result = await materialService.toggleCollectionItemService(
    req.params.id,
    req.body.materi_id,
    req.user.id
  );
  return sendResponse(res, {
    message: result.saved ? 'Materi disimpan ke koleksi.' : 'Materi dihapus dari koleksi.',
    data: result,
  });
});

export const removeCollectionItem = asyncHandler(async (req, res) => {
  await materialService.removeCollectionItemService(
    req.params.id,
    req.params.materiId,
    req.user.id
  );
  return sendResponse(res, { message: 'Materi dihapus dari koleksi.' });
});

export const deleteCollection = asyncHandler(async (req, res) => {
  await materialService.deleteCollectionService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Koleksi berhasil dihapus.' });
});

// Papan Minta Materi
export const getMaterialRequests = asyncHandler(async (req, res) => {
  const { rows, meta } = await materialService.getMaterialRequestsService(req.query);
  return sendResponse(res, {
    message: 'Daftar permintaan materi berhasil dimuat.',
    data: rows,
    meta,
  });
});

export const createMaterialRequest = asyncHandler(async (req, res) => {
  const created = await materialService.createMaterialRequestService(req.body, req.user.id);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Permintaan materi berhasil diposting ke papan diskusi!',
    data: created,
  });
});

export const fulfillMaterialRequest = asyncHandler(async (req, res) => {
  const result = await materialService.fulfillMaterialRequestService(
    req.params.id,
    req.body,
    req.user
  );
  return sendResponse(res, {
    message: result.is_fulfilled
      ? 'Permintaan materi telah ditandai terpenuhi!'
      : 'Materi penaut dikirimkan sebagai jawaban untuk penanya.',
    data: result,
  });
});

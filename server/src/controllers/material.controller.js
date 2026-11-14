// FILE: server/src/controllers/material.controller.js
import { sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as materialService from '../services/material.service.js';

export const getMaterials = asyncHandler(async (req, res) => {
  const { items, meta } = await materialService.getMaterialsService(req.query, req.user);
  return sendResponse(res, {
    message: 'Daftar materi berhasil dimuat.',
    data: items,
    meta,
  });
});

export const getMyApprovedMaterials = asyncHandler(async (req, res) => {
  const items = await materialService.getMyApprovedMaterialsService(req.user.id);
  return sendResponse(res, {
    message: 'Daftar materi disetujui milik Anda berhasil dimuat.',
    data: items,
  });
});

export const getMaterialDetail = asyncHandler(async (req, res) => {
  const material = await materialService.getMaterialDetailService(req.params.id, req.user);
  return sendResponse(res, {
    message: 'Detail materi berhasil dimuat.',
    data: material,
  });
});

export const recordMaterialDownload = asyncHandler(async (req, res) => {
  await materialService.recordMaterialDownloadService(req.params.id, req.user);
  return sendResponse(res, { message: 'Unduhan materi tercatat.' });
});

export const createMaterial = asyncHandler(async (req, res) => {
  const result = await materialService.createMaterialService(req.body, req.files || [], req.user);
  return sendResponse(res, {
    statusCode: 201,
    message:
      result.status === 'approved'
        ? 'Materi pembelajaran berhasil diunggah dan langsung dipublikasikan!'
        : 'Materi berhasil diunggah! Menunggu tinjauan Moderator/Admin sebelum tayang.',
    data: result,
  });
});

export const updateMaterial = asyncHandler(async (req, res) => {
  const { revertedToPending } = await materialService.updateMaterialService(
    req.params.id,
    req.body,
    req.user
  );
  return sendResponse(res, {
    message: revertedToPending
      ? 'Materi berhasil diperbarui dan masuk antrean moderasi ulang.'
      : 'Materi berhasil diperbarui.',
    data: { reverted_to_pending: revertedToPending },
  });
});

export const deleteMaterial = asyncHandler(async (req, res) => {
  await materialService.deleteMaterialService(req.params.id, req.user);
  return sendResponse(res, { message: 'Materi berhasil dihapus.' });
});

export const uploadNewVersion = asyncHandler(async (req, res) => {
  const result = await materialService.uploadNewVersionService(
    req.params.id,
    req.file,
    req.body.changelog_note,
    req.user
  );
  return sendResponse(res, {
    statusCode: 201,
    message: result.revertedToPending
      ? 'Versi baru diunggah dan materi menunggu tinjauan moderasi ulang.'
      : 'Versi baru materi berhasil diunggah!',
    data: result,
  });
});

export const moderateMaterial = asyncHandler(async (req, res) => {
  await materialService.moderateMaterialService(req.params.id, req.body, req.user);
  return sendResponse(res, {
    message: `Materi berhasil di-${req.body.status}.`,
  });
});

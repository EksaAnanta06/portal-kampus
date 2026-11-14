// FILE: server/src/controllers/angkatan.controller.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';
import {
  getAllAngkatanWithStats,
  getAngkatanByYearOrId,
  createAngkatanRecord,
  updateAngkatanRecord,
  deleteAngkatanRecord,
} from '../queries/angkatan.queries.js';
import { getAlbumsByAngkatanId } from '../queries/album.queries.js';

export const getAngkatanList = asyncHandler(async (_req, res) => {
  const list = await getAllAngkatanWithStats();
  return sendResponse(res, {
    message: 'Daftar galeri angkatan berhasil dimuat.',
    data: list,
  });
});

export const getAngkatanDetail = asyncHandler(async (req, res) => {
  const angkatan = await getAngkatanByYearOrId(req.params.yearOrId);
  if (!angkatan || !angkatan.is_active) {
    throw new AppError('Data angkatan tidak ditemukan.', 404);
  }

  const albums = await getAlbumsByAngkatanId(angkatan.id);

  return sendResponse(res, {
    message: `Detail ${angkatan.title} berhasil dimuat.`,
    data: {
      angkatan,
      albums,
    },
  });
});

export const createAngkatan = asyncHandler(async (req, res) => {
  let cover_url = null;
  let cover_public_id = null;

  if (req.file) {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'angkatan-covers');
    cover_url = uploaded.secure_url;
    cover_public_id = uploaded.public_id;
  }

  let id;
  try {
    id = await createAngkatanRecord({
      ...req.body,
      cover_url,
      cover_public_id,
    });
  } catch (err) {
    if (cover_public_id) {
      await deleteFromCloudinary(cover_public_id);
    }
    throw err;
  }

  const created = await getAngkatanByYearOrId(id);
  return sendResponse(res, {
    statusCode: 201,
    message: `Galeri Angkatan ${created.year} berhasil ditambahkan.`,
    data: created,
  });
});

export const updateAngkatan = asyncHandler(async (req, res) => {
  const existing = await getAngkatanByYearOrId(req.params.id);
  if (!existing) {
    throw new AppError('Angkatan tidak ditemukan.', 404);
  }

  const updateFields = {};
  if (req.body.title) updateFields.title = req.body.title.trim();
  if (req.body.description !== undefined) updateFields.description = req.body.description?.trim() || null;
  if (req.body.year) updateFields.year = Number(req.body.year);

  let newCoverPublicId = null;
  if (req.file) {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'angkatan-covers');
    updateFields.cover_url = uploaded.secure_url;
    updateFields.cover_public_id = uploaded.public_id;
    newCoverPublicId = uploaded.public_id;
  }

  try {
    await updateAngkatanRecord(existing.id, updateFields);
  } catch (err) {
    if (newCoverPublicId) {
      await deleteFromCloudinary(newCoverPublicId);
    }
    throw err;
  }

  if (newCoverPublicId && existing.cover_public_id && existing.cover_public_id !== newCoverPublicId) {
    await deleteFromCloudinary(existing.cover_public_id);
  }

  const updated = await getAngkatanByYearOrId(existing.id);

  return sendResponse(res, {
    message: 'Informasi angkatan berhasil diperbarui.',
    data: updated,
  });
});

export const deleteAngkatan = asyncHandler(async (req, res) => {
  const existing = await getAngkatanByYearOrId(req.params.id);
  if (!existing || !existing.is_active) {
    throw new AppError('Angkatan tidak ditemukan.', 404);
  }

  await deleteAngkatanRecord(existing.id);

  return sendResponse(res, {
    message: `Galeri Angkatan ${existing.year} berhasil dinonaktifkan.`,
    data: { id: existing.id },
  });
});

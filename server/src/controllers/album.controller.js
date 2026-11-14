// FILE: server/src/controllers/album.controller.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import {
  getAlbumsByAngkatanId,
  getAlbumById,
  createAlbumRecord,
  updateAlbumRecord,
  deleteAlbumById,
} from '../queries/album.queries.js';

const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const listAlbums = asyncHandler(async (req, res) => {
  const albums = await getAlbumsByAngkatanId(Number(req.query.angkatan_id));
  return sendResponse(res, {
    message: 'Daftar album angkatan berhasil dimuat.',
    data: albums,
  });
});

export const createAlbum = asyncHandler(async (req, res) => {
  const { angkatan_id, name, description } = req.body;
  const slug = slugify(name);

  const albumId = await createAlbumRecord({
    angkatan_id,
    name,
    slug,
    description,
    created_by: req.user.id,
  });

  const albums = await getAlbumsByAngkatanId(angkatan_id);
  const created = albums.find((a) => a.id === albumId);

  return sendResponse(res, {
    statusCode: 201,
    message: `Album "${name}" berhasil dibuat.`,
    data: created,
  });
});

export const updateAlbum = asyncHandler(async (req, res) => {
  const albumId = Number(req.params.id);
  const album = await getAlbumById(albumId);
  if (!album) {
    throw new AppError('Album tidak ditemukan.', 404);
  }

  const isStaff = req.user && ['admin', 'moderator'].includes(req.user.role);
  const isCreator = req.user && album.created_by === req.user.id;
  if (!isStaff && !isCreator) {
    throw new AppError('Anda tidak berhak mengubah album ini.', 403);
  }

  const { name, description } = req.body;
  if (!name || !name.trim()) {
    throw new AppError('Nama album tidak boleh kosong.', 400);
  }

  const updateData = {
    name: name.trim(),
    slug: slugify(name.trim()),
  };
  if (description !== undefined) {
    updateData.description = description?.trim() || null;
  }

  await updateAlbumRecord(albumId, updateData);
  const updated = await getAlbumById(albumId);

  return sendResponse(res, {
    message: `Nama album berhasil diperbarui menjadi "${updated.name}".`,
    data: updated,
  });
});

export const deleteAlbum = asyncHandler(async (req, res) => {
  const albumId = Number(req.params.id);
  const album = await getAlbumById(albumId);
  if (!album) {
    throw new AppError('Album tidak ditemukan.', 404);
  }

  const isStaff = req.user && ['admin', 'moderator'].includes(req.user.role);
  const isCreator = req.user && album.created_by === req.user.id;
  if (!isStaff && !isCreator) {
    throw new AppError('Anda tidak berhak menghapus album ini.', 403);
  }

  await deleteAlbumById(albumId);
  return sendResponse(res, {
    message: `Album "${album.name}" berhasil dihapus. Foto di dalamnya tetap tersimpan di galeri angkatan.`,
    data: { id: albumId },
  });
});

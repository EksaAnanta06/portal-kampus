// FILE: server/src/controllers/user.controller.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { getPublicDirectoryUsers, getAdminUsersList, getUserProfileDetailQuery } from '../queries/user.queries.js';
import { updateMyProfileService, verifyUserByAdminService } from '../services/user.service.js';

export const getDirectory = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));

  const { rows, total } = await getPublicDirectoryUsers({
    search: req.query.search || '',
    angkatan: req.query.angkatan || '',
    prodi: req.query.prodi || '',
    role: req.query.role || '',
    page,
    limit,
  });

  return sendResponse(res, {
    message: 'Data direktori mahasiswa & alumni berhasil dimuat.',
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const isStaff = req.user && ['admin', 'moderator'].includes(req.user.role);
  const user = await getUserProfileDetailQuery(userId, {
    requesterId: req.user?.id || null,
    isStaff,
  });
  if (!user) {
    throw new AppError('Pengguna tidak ditemukan atau profil bersifat privat.', 404);
  }
  return sendResponse(res, {
    message: 'Profil pengguna berhasil dimuat.',
    data: user,
  });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const updatedUser = await updateMyProfileService(req.user.id, req.body, req.file || null);
  return sendResponse(res, {
    message: 'Profil Anda berhasil diperbarui.',
    data: { user: updatedUser },
  });
});

export const listUsersForAdmin = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const { rows, total } = await getAdminUsersList({
    status: req.query.status || '',
    search: req.query.search || '',
    page,
    limit,
  });

  return sendResponse(res, {
    message: 'Daftar akun pengguna berhasil dimuat.',
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const verifyOrUpdateUserStatus = asyncHandler(async (req, res) => {
  const updated = await verifyUserByAdminService({
    targetUserId: Number(req.params.id),
    adminId: req.user.id,
    status: req.body.status,
    role: req.body.role,
  });

  return sendResponse(res, {
    message: `Status pengguna ${updated.full_name} (${updated.nim}) berhasil diubah menjadi "${updated.status}".`,
    data: { user: updated },
  });
});

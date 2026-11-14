// FILE: server/src/services/user.service.js
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';
import {
  findUserById,
  ensureAngkatanExists,
  revokeAllUserRefreshTokens,
} from '../queries/auth.queries.js';
import { updateUserProfileById, getUserAvatarInfo } from '../queries/user.queries.js';
import { createNotification } from '../queries/campus.queries.js';

export const updateMyProfileService = async (userId, payload, avatarFile = null) => {
  const updateData = {};

  const allowedFields = [
    'full_name',
    'prodi',
    'angkatan_year',
    'bio',
    'current_job',
    'linkedin_url',
    'instagram_url',
    'github_url',
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updateData[field] = payload[field] === '' ? null : payload[field];
    }
  }

  if (payload.is_public_profile !== undefined) {
    updateData.is_public_profile = payload.is_public_profile ? 1 : 0;
  }

  if (updateData.angkatan_year) {
    await ensureAngkatanExists(updateData.angkatan_year);
  }

  let oldAvatar = null;
  let newPublicId = null;

  if (avatarFile) {
    oldAvatar = await getUserAvatarInfo(userId);
    const uploaded = await uploadBufferToCloudinary(avatarFile.buffer, 'avatars');
    updateData.avatar_url = uploaded.secure_url;
    updateData.avatar_public_id = uploaded.public_id;
    newPublicId = uploaded.public_id;
  }

  try {
    await updateUserProfileById(userId, updateData);
  } catch (err) {
    if (newPublicId) {
      await deleteFromCloudinary(newPublicId);
    }
    throw err;
  }

  if (newPublicId && oldAvatar?.avatar_public_id && oldAvatar.avatar_public_id !== newPublicId) {
    await deleteFromCloudinary(oldAvatar.avatar_public_id);
  }

  return findUserById(userId);
};

export const verifyUserByAdminService = async ({ targetUserId, adminId, status, role }) => {
  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    throw new AppError('Pengguna tidak ditemukan.', 404);
  }

  if (Number(targetUserId) === Number(adminId)) {
    if ((role && role !== 'admin') || status !== 'active') {
      throw new AppError(
        'Anda tidak dapat menonaktifkan akun admin Anda sendiri atau menurunkan role Anda sendiri.',
        400
      );
    }
  }

  const updateFields = {
    status,
    verified_by: adminId,
    verified_at: status === 'active' ? new Date() : null,
  };

  if (role) {
    updateFields.role = role;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await updateUserProfileById(targetUserId, updateFields, connection);

    if (status !== 'active') {
      await revokeAllUserRefreshTokens(targetUserId, connection);
    }

    if (status === 'active') {
      await createNotification(
        {
          userId: targetUserId,
          type: 'account_verified',
          title: 'Akun & NIM Terverifikasi',
          message: 'Selamat datang di Portal Kampus UNAS PASIM! Akun Anda kini telah aktif sepenuhnya.',
          referenceLink: '/profil',
        },
        connection
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return findUserById(targetUserId);
};

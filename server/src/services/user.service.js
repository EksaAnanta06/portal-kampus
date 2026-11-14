// FILE: server/src/services/user.service.js
import { AppError } from '../utils/AppError.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';
import { findUserById, ensureAngkatanExists } from '../queries/auth.queries.js';
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

  if (avatarFile) {
    const oldAvatar = await getUserAvatarInfo(userId);
    const uploaded = await uploadBufferToCloudinary(avatarFile.buffer, 'avatars');
    updateData.avatar_url = uploaded.secure_url;
    updateData.avatar_public_id = uploaded.public_id;

    if (oldAvatar?.avatar_public_id) {
      await deleteFromCloudinary(oldAvatar.avatar_public_id);
    }
  }

  await updateUserProfileById(userId, updateData);
  return findUserById(userId);
};

export const verifyUserByAdminService = async ({ targetUserId, adminId, status, role }) => {
  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    throw new AppError('Pengguna tidak ditemukan.', 404);
  }

  const updateFields = {
    status,
    verified_by: adminId,
    verified_at: status === 'active' ? new Date() : null,
  };

  if (role) {
    updateFields.role = role;
  }

  await updateUserProfileById(targetUserId, updateFields);

  if (status === 'active') {
    await createNotification({
      userId: targetUserId,
      type: 'account_verified',
      title: 'Akun & NIM Terverifikasi',
      message: 'Selamat datang di Portal Kampus UNAS PASIM! Akun Anda kini telah aktif sepenuhnya.',
      referenceLink: '/profil',
    });
  }

  return findUserById(targetUserId);
};

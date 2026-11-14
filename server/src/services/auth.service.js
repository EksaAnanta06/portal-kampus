// FILE: server/src/services/auth.service.js
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { sendMailOrLog } from '../config/mailer.js';
import { AppError } from '../utils/AppError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt.js';
import {
  findUserByEmailOrNim,
  findUserById,
  createUserRecord,
  saveRefreshToken,
  findValidRefreshToken,
  revokeRefreshTokenByHash,
  createPasswordResetToken,
  findValidPasswordReset,
  markPasswordResetUsed,
  updateUserPassword,
} from '../queries/auth.queries.js';

export const registerUserService = async (payload) => {
  const existingEmail = await findUserByEmailOrNim(payload.email);
  if (existingEmail) {
    throw new AppError('Alamat email sudah terdaftar di sistem.', 409);
  }

  const existingNim = await findUserByEmailOrNim(payload.nim);
  if (existingNim) {
    throw new AppError('NIM sudah terdaftar. Hubungi BAAK/Admin jika terjadi kesalahan.', 409);
  }

  const password_hash = await bcrypt.hash(payload.password, 10);
  const userId = await createUserRecord({
    ...payload,
    password_hash,
  });

  const newUser = await findUserById(userId);
  return newUser;
};

export const loginUserService = async ({ identifier, password, userAgent, ipAddress }) => {
  const user = await findUserByEmailOrNim(identifier);
  if (!user) {
    throw new AppError('Kredensial tidak valid (Email/NIM atau Password salah).', 401);
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordMatch) {
    throw new AppError('Kredensial tidak valid (Email/NIM atau Password salah).', 401);
  }

  if (user.status === 'pending') {
    throw new AppError(
      'Akun Anda sedang menunggu verifikasi NIM oleh Admin Kampus UNAS PASIM.',
      403
    );
  }

  if (user.status === 'rejected' || user.status === 'suspended') {
    throw new AppError(
      `Akun Anda tidak dapat diakses (Status: ${user.status}). Silakan hubungi bagian kemahasiswaan.`,
      403
    );
  }

  const tokenPayload = { id: user.id, role: user.role, nim: user.nim };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  const expiresAt = new Date(Date.now() + env.jwt.refreshCookieMaxAge);
  await saveRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    userAgent,
    ipAddress,
    expiresAt,
  });

  const safeUser = await findUserById(user.id);
  return { user: safeUser, accessToken, refreshToken };
};

export const rotateRefreshTokenService = async ({ oldRefreshToken, userAgent, ipAddress }) => {
  if (!oldRefreshToken) {
    throw new AppError('Refresh token tidak ditemukan.', 401);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError('Sesi telah berakhir, silakan login kembali.', 401);
  }

  const oldTokenHash = hashToken(oldRefreshToken);
  const storedToken = await findValidRefreshToken(oldTokenHash);
  if (!storedToken) {
    throw new AppError('Sesi refresh token tidak lagi berlaku.', 401);
  }

  await revokeRefreshTokenByHash(oldTokenHash);

  const user = await findUserById(decoded.id);
  if (!user || user.status !== 'active') {
    throw new AppError('Akun pengguna tidak aktif.', 403);
  }

  const tokenPayload = { id: user.id, role: user.role, nim: user.nim };
  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  const expiresAt = new Date(Date.now() + env.jwt.refreshCookieMaxAge);
  await saveRefreshToken({
    userId: user.id,
    tokenHash: hashToken(newRefreshToken),
    userAgent,
    ipAddress,
    expiresAt,
  });

  return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const forgotPasswordService = async (email) => {
  const user = await findUserByEmailOrNim(email);
  // Tetap kembalikan sukses meskipun email tidak ditemukan untuk mencegah user enumeration
  if (!user) {
    return { sent: true };
  }

  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawResetToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // Berlaku 30 menit

  await createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${env.clientUrl}/reset-password?token=${rawResetToken}`;

  await sendMailOrLog({
    to: user.email,
    subject: 'Reset Password - Portal Kampus UNAS PASIM Bandung',
    text: `Halo ${user.full_name},\n\nGunakan tautan berikut untuk mengatur ulang password Anda (berlaku 30 menit):\n${resetUrl}\n\nToken Manual: ${rawResetToken}`,
    html: `<p>Halo <strong>${user.full_name}</strong>,</p>
           <p>Silakan klik tautan di bawah ini untuk mengatur ulang password akun Portal Kampus UNAS PASIM Anda (berlaku 30 menit):</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

  return {
    sent: true,
    ...(env.nodeEnv !== 'production' ? { dev_reset_token: rawResetToken, dev_reset_url: resetUrl } : {}),
  };
};

export const resetPasswordService = async ({ token, password }) => {
  const tokenHash = hashToken(token);
  const resetRecord = await findValidPasswordReset(tokenHash);

  if (!resetRecord) {
    throw new AppError('Token reset password tidak valid atau sudah kedaluwarsa.', 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await updateUserPassword(resetRecord.user_id, passwordHash);
  await markPasswordResetUsed(resetRecord.id);
};

// FILE: server/src/services/auth.service.js
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../config/db.js';
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
  findUserAuthById,
  createUserRecord,
  saveRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshTokenByHash,
  revokeAllUserRefreshTokens,
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

  return findUserById(userId);
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
  const storedToken = await findRefreshTokenByHash(oldTokenHash);

  if (!storedToken) {
    throw new AppError('Sesi refresh token tidak lagi berlaku.', 401);
  }

  // Deteksi replay/reuse refresh token yang sudah dicabut -> cabut seluruh sesi pengguna
  if (storedToken.revoked_at !== null) {
    await revokeAllUserRefreshTokens(storedToken.user_id);
    throw new AppError('Aktivitas sesi mencurigakan terdeteksi. Silakan login kembali.', 401);
  }

  if (new Date(storedToken.expires_at) <= new Date()) {
    throw new AppError('Sesi telah kedaluwarsa, silakan login kembali.', 401);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await revokeRefreshTokenByHash(oldTokenHash, connection);

    const user = await findUserById(decoded.id, connection);
    if (!user || user.status !== 'active') {
      await revokeAllUserRefreshTokens(decoded.id, connection);
      await connection.commit();
      throw new AppError('Akun pengguna tidak aktif.', 403);
    }

    const tokenPayload = { id: user.id, role: user.role, nim: user.nim };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);
    const expiresAt = new Date(Date.now() + env.jwt.refreshCookieMaxAge);

    await saveRefreshToken(
      {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        userAgent,
        ipAddress,
        expiresAt,
      },
      connection
    );

    await connection.commit();
    return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
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

  // Token hanya dikirim lewat SMTP / log server; jangan bocorkan via HTTP kecuali opt-in eksplisit saat dev
  return {
    sent: true,
    ...(env.security.allowDevResetTokenResponse
      ? { dev_reset_token: rawResetToken, dev_reset_url: resetUrl }
      : {}),
  };
};

export const resetPasswordService = async ({ token, password }) => {
  const tokenHash = hashToken(token);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const resetRecord = await findValidPasswordReset(tokenHash, connection);
    if (!resetRecord) {
      throw new AppError('Token reset password tidak valid atau sudah kedaluwarsa.', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await updateUserPassword(resetRecord.user_id, passwordHash, connection);
    await markPasswordResetUsed(resetRecord.id, connection);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const changePasswordService = async ({
  userId,
  currentPassword,
  newPassword,
  userAgent,
  ipAddress,
}) => {
  if (currentPassword === newPassword) {
    throw new AppError('Password baru harus berbeda dengan password saat ini.', 400);
  }

  const authUser = await findUserAuthById(userId);
  if (!authUser || authUser.status !== 'active') {
    throw new AppError('Akun tidak ditemukan atau tidak aktif.', 403);
  }

  const isMatch = await bcrypt.compare(currentPassword, authUser.password_hash);
  if (!isMatch) {
    throw new AppError('Password saat ini tidak sesuai.', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const tokenPayload = { id: authUser.id, role: authUser.role, nim: authUser.nim };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  const expiresAt = new Date(Date.now() + env.jwt.refreshCookieMaxAge);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await updateUserPassword(userId, passwordHash, connection);
    await saveRefreshToken(
      {
        userId,
        tokenHash: hashToken(refreshToken),
        userAgent,
        ipAddress,
        expiresAt,
      },
      connection
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return { accessToken, refreshToken };
};

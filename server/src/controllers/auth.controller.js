// FILE: server/src/controllers/auth.controller.js
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { hashToken } from '../utils/jwt.js';
import { findUserById, revokeRefreshTokenByHash } from '../queries/auth.queries.js';
import {
  registerUserService,
  loginUserService,
  rotateRefreshTokenService,
  forgotPasswordService,
  resetPasswordService,
} from '../services/auth.service.js';

const REFRESH_COOKIE_NAME = 'pasim_refresh_token';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  maxAge: env.jwt.refreshCookieMaxAge,
  path: '/',
});

export const register = asyncHandler(async (req, res) => {
  const newUser = await registerUserService(req.body);
  return sendResponse(res, {
    statusCode: 201,
    message:
      'Registrasi berhasil! Akun Anda berstatus "Menunggu Verifikasi" oleh Admin berdasarkan NIM.',
    data: { user: newUser },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const { user, accessToken, refreshToken } = await loginUserService({
    identifier,
    password,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

  return sendResponse(res, {
    message: `Selamat datang kembali, ${user.full_name}!`,
    data: { user, accessToken },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const oldRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const { user, accessToken, refreshToken } = await rotateRefreshTokenService({
    oldRefreshToken,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

  return sendResponse(res, {
    message: 'Token berhasil diperbarui.',
    data: { user, accessToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    await revokeRefreshTokenByHash(hashToken(refreshToken));
  }

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  });

  return sendResponse(res, {
    message: 'Berhasil keluar dari sesi akun.',
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  return sendResponse(res, {
    message: 'Profil pengguna aktif.',
    data: { user },
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await forgotPasswordService(req.body.email);
  return sendResponse(res, {
    message:
      'Jika email terdaftar, instruksi dan tautan reset password telah dikirimkan (cek console server pada mode lokal).',
    data: result,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await resetPasswordService(req.body);
  return sendResponse(res, {
    message: 'Password berhasil diperbarui! Silakan login dengan password baru Anda.',
  });
});

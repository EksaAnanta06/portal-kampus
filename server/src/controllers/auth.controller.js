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
  changePasswordService,
} from '../services/auth.service.js';

const REFRESH_COOKIE_NAME = 'pasim_refresh_token';

const isHttpsRequest = (req) =>
  Boolean(
    req?.secure ||
      req?.headers?.['x-forwarded-proto']?.split(',')[0]?.trim()?.toLowerCase() === 'https'
  );

const getCookieOptions = (req, { includeMaxAge = true } = {}) => {
  const useSecureCookie = env.isProd || isHttpsRequest(req);
  const options = {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: useSecureCookie ? 'none' : 'lax',
    path: '/',
  };
  if (includeMaxAge) {
    options.maxAge = env.jwt.refreshCookieMaxAge;
  }
  return options;
};

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

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req));

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

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req));

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

  res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions(req, { includeMaxAge: false }));

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

export const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const { accessToken, refreshToken } = await changePasswordService({
    userId: req.user.id,
    currentPassword: current_password,
    newPassword: new_password,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

  return sendResponse(res, {
    message: 'Password akun berhasil diubah. Sesi perangkat lain telah dicabut.',
    data: { accessToken },
  });
});

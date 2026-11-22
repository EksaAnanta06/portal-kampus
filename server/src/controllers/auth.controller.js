// FILE: server/src/controllers/auth.controller.js
import crypto from 'crypto';
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
import {
  buildGoogleAuthorizationUrl,
  handleGoogleCallbackService,
  redeemGoogleExchangeCodeService,
  getPendingGoogleRegistrationService,
  completeGoogleRegistrationService,
  renderNativeDeepLinkHtml,
} from '../services/googleAuth.service.js';

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

const isNativeClient = (req) =>
  String(req.headers?.['x-client'] || '').trim().toLowerCase() === 'native';

const extractRefreshToken = (req) => {
  const bodyToken =
    typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
  const headerToken =
    typeof req.headers?.['x-refresh-token'] === 'string'
      ? req.headers['x-refresh-token'].trim()
      : '';
  const cookieToken =
    typeof req.cookies?.[REFRESH_COOKIE_NAME] === 'string'
      ? req.cookies[REFRESH_COOKIE_NAME].trim()
      : '';

  // Klien native hanya memakai token eksplisit dari SharedPreferences agar cookie WebView usang tidak pernah memicu reuse-revocation
  if (isNativeClient(req)) {
    return bodyToken || headerToken || null;
  }
  return cookieToken || bodyToken || headerToken || null;
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

  if (isNativeClient(req)) {
    res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions(req, { includeMaxAge: false }));
    return sendResponse(res, {
      message: `Selamat datang kembali, ${user.full_name}!`,
      data: { user, accessToken, refreshToken },
    });
  }

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req));

  return sendResponse(res, {
    message: `Selamat datang kembali, ${user.full_name}!`,
    data: { user, accessToken },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const oldRefreshToken = extractRefreshToken(req);
  const { user, accessToken, refreshToken } = await rotateRefreshTokenService({
    oldRefreshToken,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  if (isNativeClient(req)) {
    res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions(req, { includeMaxAge: false }));
    return sendResponse(res, {
      message: 'Token berhasil diperbarui.',
      data: { user, accessToken, refreshToken },
    });
  }

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req));

  return sendResponse(res, {
    message: 'Token berhasil diperbarui.',
    data: { user, accessToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = extractRefreshToken(req);
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

  if (isNativeClient(req)) {
    res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions(req, { includeMaxAge: false }));
    return sendResponse(res, {
      message: 'Password akun berhasil diubah. Sesi perangkat lain telah dicabut.',
      data: { accessToken, refreshToken },
    });
  }

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req));

  return sendResponse(res, {
    message: 'Password akun berhasil diubah. Sesi perangkat lain telah dicabut.',
    data: { accessToken },
  });
});

export const startGoogleAuth = asyncHandler(async (req, res) => {
  const authUrl = buildGoogleAuthorizationUrl({
    req,
    platform: req.query.platform,
    origin: req.query.origin,
    redirectPath: req.query.redirect,
  });
  return res.redirect(302, authUrl);
});

export const handleGoogleAuthCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  const { platform, targetUrl } = await handleGoogleCallbackService({ code, state, error });

  if (platform === 'native') {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src 'self' data:`
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderNativeDeepLinkHtml(targetUrl, nonce));
  }

  return res.redirect(302, targetUrl);
});

export const exchangeGoogleCode = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const { user, accessToken, refreshToken, redirectPath } = await redeemGoogleExchangeCodeService({
    code,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  if (isNativeClient(req)) {
    res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions(req, { includeMaxAge: false }));
    return sendResponse(res, {
      message: `Selamat datang kembali, ${user.full_name}!`,
      data: { user, accessToken, refreshToken, redirectPath },
    });
  }

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req));

  return sendResponse(res, {
    message: `Selamat datang kembali, ${user.full_name}!`,
    data: { user, accessToken, redirectPath },
  });
});

export const getPendingGoogleRegistration = asyncHandler(async (req, res) => {
  const profile = getPendingGoogleRegistrationService(req.query.token);
  return sendResponse(res, {
    message: 'Profil Google terverifikasi dimuat.',
    data: profile,
  });
});

export const completeGoogleRegistration = asyncHandler(async (req, res) => {
  const user = await completeGoogleRegistrationService(req.body);
  return sendResponse(res, {
    statusCode: 201,
    message:
      'Registrasi dengan Google berhasil! Akun Anda berstatus "Menunggu Verifikasi" oleh Admin berdasarkan NIM.',
    data: { user },
  });
});

// FILE: server/src/middlewares/auth.middleware.js
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Middleware wajib login: memverifikasi Bearer token dan mengecek status aktif user di DB
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Akses ditolak. Token autentikasi tidak ditemukan.', 401);
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    throw new AppError('Token tidak valid atau telah kedaluwarsa.', 401);
  }

  const [rows] = await pool.execute(
    'SELECT id, nim, full_name, email, role, status, prodi, angkatan_year, avatar_url FROM users WHERE id = ? LIMIT 1',
    [decoded.id]
  );

  const user = rows[0];
  if (!user) {
    throw new AppError('Akun pengguna tidak lagi terdaftar.', 401);
  }

  if (user.status !== 'active') {
    throw new AppError(`Akun Anda berstatus "${user.status}". Hubungi admin kampus untuk verifikasi NIM.`, 403);
  }

  req.user = user;
  next();
});

/**
 * Middleware opsional: mengisi req.user jika ada token valid (berguna untuk cek is_liked_by_me di galeri publik)
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.id, role: decoded.role };
  } catch {
    req.user = null;
  }
  next();
});

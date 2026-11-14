// FILE: server/src/middlewares/rateLimiter.middleware.js
import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.',
    data: null,
    meta: null,
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu 15 menit demi keamanan akun.',
    data: null,
    meta: null,
  },
});

export const zipDownloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 15, // maksimal 15 zip per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Batas unduhan arsip ZIP telah tercapai. Silakan coba kembali dalam beberapa saat demi menjaga kinerja server.',
    data: null,
    meta: null,
  },
});

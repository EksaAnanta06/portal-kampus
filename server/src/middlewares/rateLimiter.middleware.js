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

export const focusTimerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 60, // maksimal 60 aksi timer per menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan sinkronisasi timer dalam waktu singkat. Coba sebentar lagi.',
    data: null,
    meta: null,
  },
});

export const pushSubscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan pendaftaran notifikasi push. Silakan coba beberapa saat lagi.',
    data: null,
    meta: null,
  },
});

export const pokerReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak laporan dalam waktu singkat. Coba beberapa saat lagi.',
    data: null,
    meta: null,
  },
});

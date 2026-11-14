// FILE: server/src/middlewares/error.middleware.js
import multer from 'multer';
import { env } from '../config/env.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan pada server.`,
    data: null,
    meta: null,
  });
};

export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan internal pada server.';
  let errors = err.errors || null;

  // Penanganan error khusus dari Multer
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Ukuran file terlalu besar. Maksimal 5 MB per foto.';
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Jumlah file melebihi batas. Maksimal 10 foto dalam satu kali unggah.';
    } else {
      message = `Kesalahan unggah file: ${err.message}`;
    }
  }

  // Penanganan duplicate entry MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    const sqlMsg = err.sqlMessage || '';
    if (sqlMsg.includes('uq_photo_reports_user')) {
      message = 'Anda sudah pernah melaporkan foto ini.';
    } else if (sqlMsg.includes('uq_albums_angkatan_slug')) {
      message = 'Album dengan nama serupa sudah ada di angkatan ini.';
    } else if (sqlMsg.includes('email')) {
      message = 'Alamat email sudah terdaftar.';
    } else if (sqlMsg.includes('nim')) {
      message = 'NIM sudah terdaftar.';
    } else if (sqlMsg.includes('year')) {
      message = 'Tahun angkatan tersebut sudah terdaftar.';
    } else {
      message = 'Data yang Anda masukkan sudah terdaftar.';
    }
  }

  if (statusCode === 500) {
    console.error('[SERVER ERROR]:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    meta: {
      ...(errors ? { errors } : {}),
      ...(env.nodeEnv === 'development' && statusCode === 500 ? { stack: err.stack } : {}),
    },
  });
};

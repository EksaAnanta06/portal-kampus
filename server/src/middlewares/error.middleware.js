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

export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan internal pada server.';
  const errors = err.errors || null;

  // Penanganan error khusus dari Multer (dibedakan antara dokumen materi vs foto/gambar)
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    const isMaterialUpload =
      req.originalUrl?.includes('/materials') || err.field === 'file' || err.field === 'files';
    const maxMb = Math.round(
      (isMaterialUpload ? env.upload.maxDocBytes : env.upload.maxPhotoBytes) / (1024 * 1024)
    );

    if (err.code === 'LIMIT_FILE_SIZE') {
      message = isMaterialUpload
        ? `Ukuran berkas terlalu besar. Maksimal ${maxMb} MB per file.`
        : `Ukuran file terlalu besar. Maksimal ${maxMb} MB per foto.`;
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = isMaterialUpload
        ? 'Jumlah berkas melebihi batas. Maksimal 10 file dalam satu kali unggah.'
        : 'Jumlah file melebihi batas. Maksimal 10 foto dalam satu kali unggah.';
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
    } else if (sqlMsg.includes('uq_materi_reporter')) {
      message = 'Anda sudah pernah melaporkan materi ini.';
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

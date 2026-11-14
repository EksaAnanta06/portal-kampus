// FILE: server/src/middlewares/upload.middleware.js
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.zip',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];

const storage = multer.memoryStorage();

const getExtension = (filename = '') => {
  const idx = filename.lastIndexOf('.');
  return idx !== -1 ? filename.slice(idx).toLowerCase() : '';
};

const hasBytesPrefix = (buf, bytes, offset = 0) => {
  if (!buf || buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
};

const detectMagicMatch = (buffer, ext) => {
  if (!buffer || buffer.length < 4) return false;

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return hasBytesPrefix(buffer, [0xff, 0xd8, 0xff]);
    case '.png':
      return hasBytesPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case '.webp':
      return (
        hasBytesPrefix(buffer, [0x52, 0x49, 0x46, 0x46], 0) &&
        hasBytesPrefix(buffer, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case '.pdf': {
      const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
      return head.includes('%PDF-');
    }
    case '.zip':
    case '.docx':
    case '.xlsx':
    case '.pptx':
      return (
        hasBytesPrefix(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
        hasBytesPrefix(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
        hasBytesPrefix(buffer, [0x50, 0x4b, 0x07, 0x08])
      );
    case '.doc':
      return (
        hasBytesPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) ||
        buffer.subarray(0, 16).toString('latin1').trimStart().startsWith('{\\rtf')
      );
    case '.xls':
    case '.ppt':
      return hasBytesPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    default:
      return false;
  }
};

const imageFileFilter = (_req, file, cb) => {
  const ext = getExtension(file.originalname);
  const validExt = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
  const validMime = ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype);

  if (validExt && validMime) {
    cb(null, true);
  } else {
    cb(new AppError('Format gambar tidak didukung. Gunakan format JPG, PNG, atau WEBP.', 400), false);
  }
};

const documentFileFilter = (_req, file, cb) => {
  const ext = getExtension(file.originalname);
  const validExt = ALLOWED_DOCUMENT_EXTENSIONS.includes(ext);
  // Beberapa browser/OS mengirim application/octet-stream khusus untuk arsip/dokumen Office;
  // validasi akhir tetap diperketat via magic-bytes di verifyUploadedBuffers('document').
  const validMime =
    ALLOWED_DOCUMENT_MIMES.includes(file.mimetype) ||
    (file.mimetype === 'application/octet-stream' &&
      ['.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext));

  if (validExt && validMime) {
    cb(null, true);
  } else {
    const maxMb = Math.round(env.upload.maxDocBytes / (1024 * 1024));
    cb(
      new AppError(
        `Berkas "${file.originalname}" tidak valid. Hanya format PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ZIP, dan gambar JPG/PNG/WEBP yang diizinkan (Maksimal ${maxMb} MB).`,
        400
      ),
      false
    );
  }
};

const withSignatureCheck = (multerMiddleware, kind = 'image') => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) return next(err);

    const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
    for (const file of files) {
      const ext = getExtension(file.originalname);
      if (!detectMagicMatch(file.buffer, ext)) {
        return next(
          new AppError(
            kind === 'image'
              ? `File gambar "${file.originalname}" tidak valid atau rusak (signature tidak cocok).`
              : `Isi berkas "${file.originalname}" tidak sesuai dengan ekstensi ${ext}.`,
            400
          )
        );
      }
    }
    return next();
  });
};

export const uploadMultiplePhotos = withSignatureCheck(
  multer({
    storage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: env.upload.maxPhotoBytes,
      files: 10,
    },
  }).array('photos', 10),
  'image'
);

export const uploadSingleImage = (fieldName = 'image') =>
  withSignatureCheck(
    multer({
      storage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: env.upload.maxPhotoBytes,
        files: 1,
      },
    }).single(fieldName),
    'image'
  );

export const uploadSingleDocument = (fieldName = 'file') =>
  withSignatureCheck(
    multer({
      storage,
      fileFilter: documentFileFilter,
      limits: {
        fileSize: env.upload.maxDocBytes,
        files: 1,
      },
    }).single(fieldName),
    'document'
  );

export const uploadMultipleDocuments = (fieldName = 'files', maxCount = 10) =>
  withSignatureCheck(
    multer({
      storage,
      fileFilter: documentFileFilter,
      limits: {
        fileSize: env.upload.maxDocBytes,
        files: maxCount,
      },
    }).array(fieldName, maxCount),
    'document'
  );

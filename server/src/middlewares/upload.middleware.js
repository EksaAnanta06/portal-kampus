// FILE: server/src/middlewares/upload.middleware.js
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Format file tidak didukung. Gunakan format JPG, PNG, atau WEBP.', 400), false);
  }
};

export const uploadMultiplePhotos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Maksimal 10 file per upload
  },
}).array('photos', 10);

export const uploadSingleImage = (fieldName = 'image') =>
  multer({
    storage,
    fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
    },
  }).single(fieldName);

// ============================================================================
// UPLOAD BERKAS MATERI PERPUSTAKAAN PEER-TO-PEER (PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ZIP, JPG/PNG/WEBP - Max 10MB)
// ============================================================================
const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/x-rar-compressed',
  'application/octet-stream',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.zip',
  '.rar',
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
const MAX_DOCUMENT_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES) || 10 * 1024 * 1024; // 10 MB

const documentFileFilter = (_req, file, cb) => {
  const lastDot = file.originalname.lastIndexOf('.');
  const ext = lastDot !== -1 ? file.originalname.slice(lastDot).toLowerCase() : '';
  const isValidExt = ALLOWED_DOCUMENT_EXTENSIONS.includes(ext);
  const isValidMime =
    ALLOWED_DOCUMENT_MIMES.includes(file.mimetype) ||
    !file.mimetype ||
    file.mimetype === 'application/octet-stream' ||
    file.mimetype.startsWith('application/') ||
    file.mimetype.startsWith('image/');

  if (isValidExt && isValidMime) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Berkas "${file.originalname}" tidak valid. Hanya format PDF, ZIP, RAR, DOC/DOCX, XLS/XLSX, PPT/PPTX, dan gambar JPG/PNG/WEBP yang diizinkan (Maksimal 10 MB).`,
        400
      ),
      false
    );
  }
};

export const uploadSingleDocument = (fieldName = 'file') =>
  multer({
    storage,
    fileFilter: documentFileFilter,
    limits: {
      fileSize: MAX_DOCUMENT_FILE_SIZE,
      files: 1,
    },
  }).single(fieldName);

export const uploadMultipleDocuments = (fieldName = 'files', maxCount = 10) =>
  multer({
    storage,
    fileFilter: documentFileFilter,
    limits: {
      fileSize: MAX_DOCUMENT_FILE_SIZE,
      files: maxCount,
    },
  }).array(fieldName, maxCount);

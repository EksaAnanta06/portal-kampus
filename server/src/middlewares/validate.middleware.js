// FILE: server/src/middlewares/validate.middleware.js
import { AppError } from '../utils/AppError.js';
import { sanitizeValue } from '../utils/sanitize.js';

export const sanitizeRequest = (req, _res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

/**
 * Validasi input request menggunakan skema Zod (sekaligus membersihkan string pasca-Multer)
 */
export const validate = (schema, source = 'body') => {
  return (req, _res, next) => {
    const sanitizedInput = sanitizeValue(req[source]);
    const result = schema.safeParse(sanitizedInput);
    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Validasi data gagal. Periksa kembali input Anda.', 422, formattedErrors));
    }
    req[source] = result.data;
    next();
  };
};

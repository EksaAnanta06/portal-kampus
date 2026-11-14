// FILE: server/src/middlewares/role.middleware.js
import { AppError } from '../utils/AppError.js';

export const authorizeRoles = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('Anda tidak memiliki izin akses untuk menjalankan operasi ini.', 403)
      );
    }
    next();
  };
};

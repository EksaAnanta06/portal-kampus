// FILE: server/src/routes/user.routes.js
import { Router } from 'express';
import {
  getDirectory,
  getUserProfile,
  updateMyProfile,
  listUsersForAdmin,
  verifyOrUpdateUserStatus,
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { uploadSingleImage } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateProfileSchema, verifyUserStatusSchema } from '../validators/user.validator.js';

const router = Router();

// Direktori publik mahasiswa & alumni (wajib login agar data sivitas terlindungi dari publik luar)
router.get('/directory', authenticate, getDirectory);
router.get('/profile/:id', authenticate, getUserProfile);

// Update profil & foto profil via Cloudinary
router.put(
  '/profile',
  authenticate,
  uploadSingleImage('avatar'),
  validate(updateProfileSchema),
  updateMyProfile
);

// Manajemen & verifikasi NIM pengguna oleh Admin
router.get('/admin/list', authenticate, authorizeRoles('admin'), listUsersForAdmin);
router.patch(
  '/admin/:id/verify',
  authenticate,
  authorizeRoles('admin'),
  validate(verifyUserStatusSchema),
  verifyOrUpdateUserStatus
);

export default router;

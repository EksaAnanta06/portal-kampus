// FILE: server/src/routes/photo.routes.js
import { Router } from 'express';
import {
  getPhotos,
  getPhotoDetail,
  uploadPhotos,
  updatePhoto,
  deletePhoto,
  moderatePhoto,
} from '../controllers/photo.controller.js';
import {
  toggleLike,
  getPhotoLikers,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  reportPhoto,
  getPhotoReports,
  resolvePhotoReport,
} from '../controllers/interaction.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { uploadMultiplePhotos } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  uploadPhotoMetadataSchema,
  updatePhotoSchema,
  moderatePhotoSchema,
  commentSchema,
  reportPhotoSchema,
  resolvePhotoReportSchema,
} from '../validators/gallery.validator.js';

const router = Router();

// Daftar laporan foto untuk Admin/Moderator
router.get('/reports/list', authenticate, authorizeRoles('admin', 'moderator'), getPhotoReports);
router.patch(
  '/reports/:reportId/resolve',
  authenticate,
  authorizeRoles('admin', 'moderator'),
  validate(resolvePhotoReportSchema),
  resolvePhotoReport
);

// Galeri Foto CRUD & Moderasi
router.get('/', optionalAuth, getPhotos);
router.get('/:id', optionalAuth, getPhotoDetail);

router.post(
  '/upload',
  authenticate,
  uploadMultiplePhotos,
  validate(uploadPhotoMetadataSchema),
  uploadPhotos
);

router.put('/:id', authenticate, validate(updatePhotoSchema), updatePhoto);
router.delete('/:id', authenticate, deletePhoto);

router.patch(
  '/:id/moderate',
  authenticate,
  authorizeRoles('admin', 'moderator'),
  validate(moderatePhotoSchema),
  moderatePhoto
);

// Likes, Comments, dan Reports
router.post('/:id/like', authenticate, toggleLike);
router.get('/:id/likes', optionalAuth, getPhotoLikers);
router.get('/:id/comments', optionalAuth, listComments);
router.post('/:id/comments', authenticate, validate(commentSchema), addComment);
router.put('/:id/comments/:commentId', authenticate, validate(commentSchema), updateComment);
router.delete('/:id/comments/:commentId', authenticate, deleteComment);
router.post('/:id/report', authenticate, validate(reportPhotoSchema), reportPhoto);

export default router;

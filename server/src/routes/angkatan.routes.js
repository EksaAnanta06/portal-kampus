// FILE: server/src/routes/angkatan.routes.js
import { Router } from 'express';
import {
  getAngkatanList,
  getAngkatanDetail,
  createAngkatan,
  updateAngkatan,
  deleteAngkatan,
} from '../controllers/angkatan.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { uploadSingleImage } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createAngkatanSchema, updateAngkatanSchema } from '../validators/gallery.validator.js';

const router = Router();

router.get('/', getAngkatanList);
router.get('/:yearOrId', getAngkatanDetail);

router.post(
  '/',
  authenticate,
  authorizeRoles('admin'),
  uploadSingleImage('cover'),
  validate(createAngkatanSchema),
  createAngkatan
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles('admin', 'moderator'),
  uploadSingleImage('cover'),
  validate(updateAngkatanSchema),
  updateAngkatan
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  deleteAngkatan
);

export default router;

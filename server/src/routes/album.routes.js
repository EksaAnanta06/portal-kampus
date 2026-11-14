// FILE: server/src/routes/album.routes.js
import { Router } from 'express';
import { listAlbums, createAlbum, updateAlbum, deleteAlbum } from '../controllers/album.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createAlbumSchema, updateAlbumSchema } from '../validators/gallery.validator.js';

const router = Router();

router.get('/', listAlbums);
router.post(
  '/',
  authenticate,
  authorizeRoles('admin', 'moderator', 'mahasiswa', 'alumni'),
  validate(createAlbumSchema),
  createAlbum
);
router.put('/:id', authenticate, validate(updateAlbumSchema), updateAlbum);
router.delete('/:id', authenticate, deleteAlbum);

export default router;

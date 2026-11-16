// FILE: server/src/routes/index.js
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import angkatanRoutes from './angkatan.routes.js';
import albumRoutes from './album.routes.js';
import photoRoutes from './photo.routes.js';
import campusRoutes from './campus.routes.js';
import materialRoutes from './material.routes.js';
import focusRoutes from './focus.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Portal Kampus UNAS PASIM Bandung berjalan normal.',
    data: { timestamp: new Date().toISOString() },
    meta: null,
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/angkatan', angkatanRoutes);
router.use('/albums', albumRoutes);
router.use('/photos', photoRoutes);
router.use('/campus', campusRoutes);
router.use('/materials', materialRoutes);
router.use('/focus', focusRoutes);

export default router;

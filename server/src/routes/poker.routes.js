// FILE: server/src/routes/poker.routes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { pokerReportLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  pokerReportHttpSchema,
  adminFeatureToggleSchema,
  roomControlSchema,
} from '../poker/schemas.js';
import {
  getPokerStatus,
  reportPokerPlayer,
  adminTogglePokerFeature,
  adminClosePokerRoom,
} from '../controllers/poker.controller.js';

const router = Router();

router.use(authenticate);

router.get('/status', getPokerStatus);

router.post(
  '/report',
  pokerReportLimiter,
  validate(pokerReportHttpSchema, 'body'),
  reportPokerPlayer
);

router.patch(
  '/admin/feature-flag',
  authorizeRoles('admin'),
  validate(adminFeatureToggleSchema, 'body'),
  adminTogglePokerFeature
);

router.post(
  '/admin/rooms/:roomId/close',
  authorizeRoles('admin', 'moderator'),
  validate(roomControlSchema, 'params'),
  adminClosePokerRoom
);

export default router;

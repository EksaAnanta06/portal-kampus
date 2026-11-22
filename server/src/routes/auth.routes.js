// FILE: server/src/routes/auth.routes.js
import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  startGoogleAuth,
  handleGoogleAuthCallback,
  exchangeGoogleCode,
  getPendingGoogleRegistration,
  completeGoogleRegistration,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  googleExchangeSchema,
  googleCompleteRegistrationSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.patch('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

router.get('/google', startGoogleAuth);
router.get('/google/callback', handleGoogleAuthCallback);
router.post('/google/exchange', authLimiter, validate(googleExchangeSchema), exchangeGoogleCode);
router.get('/google/pending-registration', getPendingGoogleRegistration);
router.post(
  '/google/complete-registration',
  authLimiter,
  validate(googleCompleteRegistrationSchema),
  completeGoogleRegistration
);

export default router;

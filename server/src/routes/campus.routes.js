// FILE: server/src/routes/campus.routes.js
import { Router } from 'express';
import {
  getHomeOverview,
  getAnnouncements,
  getAnnouncementDetail,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getEvents,
  getEventDetail,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleEventLike,
  getEventLikers,
  listEventComments,
  addEventComment,
  updateEventComment,
  deleteEventComment,
  getNotifications,
  readNotifications,
  createNotificationPushSession,
  revokeNotificationPushSession,
  streamNotifications,
  pollPendingNotifications,
  globalSearch,
  getAdminStats,
} from '../controllers/campus.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import {
  notificationStreamLimiter,
  notificationPollLimiter,
} from '../middlewares/rateLimiter.middleware.js';
import { uploadSingleImage } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { announcementSchema, eventSchema, eventCommentSchema } from '../validators/campus.validator.js';

const router = Router();

// Beranda & Pencarian Global
router.get('/home', optionalAuth, getHomeOverview);
router.get('/search', optionalAuth, globalSearch);

// Statistik Dashboard Admin
router.get('/admin/stats', authenticate, authorizeRoles('admin', 'moderator'), getAdminStats);

// Pengumuman Kampus
router.get('/announcements', getAnnouncements);
router.get('/announcements/:slugOrId', getAnnouncementDetail);
router.post(
  '/announcements',
  authenticate,
  authorizeRoles('admin'),
  uploadSingleImage('banner'),
  validate(announcementSchema),
  createAnnouncement
);
router.put(
  '/announcements/:id',
  authenticate,
  authorizeRoles('admin'),
  uploadSingleImage('banner'),
  validate(announcementSchema),
  updateAnnouncement
);
router.delete('/announcements/:id', authenticate, authorizeRoles('admin'), deleteAnnouncement);

// Agenda / Events Kampus
router.get('/events', optionalAuth, getEvents);
router.get('/events/:id', optionalAuth, getEventDetail);
router.post(
  '/events',
  authenticate,
  authorizeRoles('admin'),
  uploadSingleImage('banner'),
  validate(eventSchema),
  createEvent
);
router.put(
  '/events/:id',
  authenticate,
  authorizeRoles('admin'),
  uploadSingleImage('banner'),
  validate(eventSchema),
  updateEvent
);
router.delete('/events/:id', authenticate, authorizeRoles('admin'), deleteEvent);

// Interaksi Event (Like & Komentar)
router.post('/events/:id/like', authenticate, toggleEventLike);
router.get('/events/:id/likes', optionalAuth, getEventLikers);
router.get('/events/:id/comments', optionalAuth, listEventComments);
router.post('/events/:id/comments', authenticate, validate(eventCommentSchema), addEventComment);
router.put('/events/:id/comments/:commentId', authenticate, validate(eventCommentSchema), updateEventComment);
router.delete('/events/:id/comments/:commentId', authenticate, deleteEventComment);

// Notifikasi Pengguna
router.get('/notifications', authenticate, getNotifications);
router.get('/notifications/stream', notificationStreamLimiter, streamNotifications);
router.get('/notifications/pending', notificationPollLimiter, pollPendingNotifications);
router.post('/notifications/push-session', authenticate, createNotificationPushSession);
router.delete('/notifications/push-session', optionalAuth, revokeNotificationPushSession);
router.patch('/notifications/read-all', authenticate, readNotifications);
router.patch('/notifications/:id/read', authenticate, readNotifications);

export default router;

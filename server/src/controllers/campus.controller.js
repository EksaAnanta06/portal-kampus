// FILE: server/src/controllers/campus.controller.js
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { notificationHub, formatSseEvent } from '../services/notificationHub.js';
import {
  listAnnouncementsQuery,
  getAnnouncementBySlugOrId,
  listEventsQuery,
  getEventByIdQuery,
  toggleEventLikeQuery,
  getEventLikersQuery,
  getEventCommentsQuery,
  insertEventCommentRecord,
  findEventCommentById,
  updateEventCommentRecord,
  deleteEventCommentById,
  createNotification,
  getUserNotifications,
  markNotificationsRead,
  createNotificationStreamToken,
  findUserByNotificationStreamToken,
  revokeNotificationStreamToken,
  getLatestNotificationId,
  getUnreadNotificationsAfterId,
  getPublicHomeStats,
  getAdminDashboardStats,
} from '../queries/campus.queries.js';
import {
  createAnnouncementService,
  updateAnnouncementService,
  deleteAnnouncementService,
  createEventService,
  updateEventService,
  deleteEventService,
  globalSearchService,
} from '../services/campus.service.js';
import { listPhotosQuery } from '../queries/photo.queries.js';

export const getHomeOverview = asyncHandler(async (req, res) => {
  const [stats, recentPhotosRes, announcementsRes, upcomingEvents] = await Promise.all([
    getPublicHomeStats(),
    listPhotosQuery({ status: 'approved', currentUserId: req.user?.id || null, page: 1, limit: 8 }),
    listAnnouncementsQuery({ page: 1, limit: 3 }),
    listEventsQuery({ upcomingOnly: true, limit: 4, userId: req.user?.id || null }),
  ]);

  return sendResponse(res, {
    message: 'Data beranda portal kampus berhasil dimuat.',
    data: {
      stats,
      recentPhotos: recentPhotosRes.rows,
      announcements: announcementsRes.rows,
      events: upcomingEvents,
    },
  });
});

export const getAnnouncements = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 10));

  const { rows, total } = await listAnnouncementsQuery({
    category: req.query.category || '',
    search: req.query.search || '',
    page,
    limit,
  });

  return sendResponse(res, {
    message: 'Daftar pengumuman kampus berhasil dimuat.',
    data: rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getAnnouncementDetail = asyncHandler(async (req, res) => {
  const item = await getAnnouncementBySlugOrId(req.params.slugOrId);
  if (!item) {
    throw new AppError('Pengumuman tidak ditemukan.', 404);
  }
  return sendResponse(res, { message: 'Detail pengumuman berhasil dimuat.', data: item });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const created = await createAnnouncementService({
    body: req.body,
    file: req.file || null,
    authorId: req.user.id,
  });
  return sendResponse(res, {
    statusCode: 201,
    message: 'Pengumuman kampus berhasil diterbitkan.',
    data: created,
  });
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const updated = await updateAnnouncementService({
    id: Number(req.params.id),
    body: req.body,
    file: req.file || null,
  });
  return sendResponse(res, {
    message: 'Pengumuman berhasil diperbarui.',
    data: updated,
  });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  await deleteAnnouncementService(Number(req.params.id));
  return sendResponse(res, { message: 'Pengumuman berhasil dihapus.' });
});

export const getEvents = asyncHandler(async (req, res) => {
  const upcomingOnly = req.query.upcoming === 'true';
  const events = await listEventsQuery({
    upcomingOnly,
    limit: 30,
    userId: req.user?.id || null,
  });
  return sendResponse(res, {
    message: 'Agenda kegiatan kampus berhasil dimuat.',
    data: events,
  });
});

export const getEventDetail = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const event = await getEventByIdQuery(id, req.user?.id || null);
  if (!event) {
    throw new AppError('Agenda kegiatan tidak ditemukan.', 404);
  }
  return sendResponse(res, {
    message: 'Detail agenda kampus berhasil dimuat.',
    data: event,
  });
});

export const createEvent = asyncHandler(async (req, res) => {
  const created = await createEventService({
    body: req.body,
    file: req.file || null,
    userId: req.user.id,
  });
  return sendResponse(res, {
    statusCode: 201,
    message: 'Agenda kampus berhasil ditambahkan.',
    data: created,
  });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const updated = await updateEventService({
    id: Number(req.params.id),
    body: req.body,
    file: req.file || null,
    userId: req.user.id,
  });
  return sendResponse(res, {
    message: 'Agenda kampus berhasil diperbarui.',
    data: updated,
  });
});

export const deleteEvent = asyncHandler(async (req, res) => {
  await deleteEventService(Number(req.params.id));
  return sendResponse(res, { message: 'Agenda kampus berhasil dihapus.' });
});

// ---------------- EVENT LIKES HANDLERS ----------------
export const toggleEventLike = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await getEventByIdQuery(eventId);
  if (!event) {
    throw new AppError('Agenda tidak ditemukan.', 404);
  }

  const result = await toggleEventLikeQuery(eventId, req.user.id);

  if (result.liked && event.created_by && Number(event.created_by) !== Number(req.user.id)) {
    await createNotification({
      userId: event.created_by,
      type: 'new_like',
      title: 'Seseorang Menyukai Agenda Anda',
      message: `${req.user.full_name} menyukai agenda "${event.title}".`,
      referenceLink: '/agenda',
    });
  }

  return sendResponse(res, {
    message: result.liked ? 'Agenda disukai.' : 'Batal menyukai agenda.',
    data: result,
  });
});

export const getEventLikers = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await getEventByIdQuery(eventId);
  if (!event) {
    throw new AppError('Agenda tidak ditemukan.', 404);
  }

  const likers = await getEventLikersQuery(eventId);
  return sendResponse(res, {
    message: 'Daftar penyuka agenda berhasil dimuat.',
    data: likers,
  });
});

// ---------------- EVENT COMMENTS HANDLERS ----------------
export const listEventComments = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await getEventByIdQuery(eventId);
  if (!event) {
    throw new AppError('Agenda tidak ditemukan.', 404);
  }

  const comments = await getEventCommentsQuery(eventId);
  return sendResponse(res, {
    message: 'Komentar agenda berhasil dimuat.',
    data: comments,
  });
});

export const addEventComment = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await getEventByIdQuery(eventId);
  if (!event) {
    throw new AppError('Agenda tidak ditemukan.', 404);
  }

  const trimmedContent = req.body.content.trim();
  const comment = await insertEventCommentRecord({
    eventId,
    userId: req.user.id,
    content: trimmedContent,
  });

  if (event.created_by && Number(event.created_by) !== Number(req.user.id)) {
    await createNotification({
      userId: event.created_by,
      type: 'new_comment',
      title: 'Komentar Baru pada Agenda Kampus',
      message: `${req.user.full_name} mengomentari agenda "${event.title}": "${trimmedContent.substring(0, 60)}"`,
      referenceLink: '/agenda',
    });
  }

  return sendResponse(res, {
    statusCode: 201,
    message: 'Komentar berhasil ditambahkan.',
    data: comment,
  });
});

export const updateEventComment = asyncHandler(async (req, res) => {
  const commentId = Number(req.params.commentId);
  const comment = await findEventCommentById(commentId);
  if (!comment) {
    throw new AppError('Komentar tidak ditemukan.', 404);
  }

  const isOwner = comment.user_id === req.user.id;
  const isStaff = ['admin', 'moderator'].includes(req.user.role);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin mengedit komentar ini.', 403);
  }

  const content = req.body.content?.trim();
  if (!content) {
    throw new AppError('Komentar tidak boleh kosong.', 400);
  }

  const updatedComment = await updateEventCommentRecord(comment.id, content);
  return sendResponse(res, {
    message: 'Komentar berhasil diperbarui.',
    data: updatedComment,
  });
});

export const deleteEventComment = asyncHandler(async (req, res) => {
  const commentId = Number(req.params.commentId);
  const comment = await findEventCommentById(commentId);
  if (!comment) {
    throw new AppError('Komentar tidak ditemukan.', 404);
  }

  const isOwner = comment.user_id === req.user.id;
  const isStaff = ['admin', 'moderator'].includes(req.user.role);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin menghapus komentar ini.', 403);
  }

  await deleteEventCommentById(comment.id);
  return sendResponse(res, {
    message: 'Komentar berhasil dihapus.',
  });
});

const resolveStreamUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwtToken = authHeader.slice(7).trim();
    if (jwtToken) {
      try {
        const decoded = verifyAccessToken(jwtToken);
        const [rows] = await pool.execute(
          'SELECT id, role, status FROM users WHERE id = ? AND status = ? LIMIT 1',
          [decoded.id, 'active']
        );
        if (rows[0]) return rows[0];
      } catch {
        // Jatuhkan ke pemeriksaan token stream native
      }
    }
  }

  const headerStreamToken =
    typeof req.headers['x-notification-token'] === 'string'
      ? req.headers['x-notification-token']
      : '';
  const queryStreamToken =
    typeof req.query?.stream_token === 'string' ? req.query.stream_token : '';
  const rawStreamToken = headerStreamToken.trim() || queryStreamToken.trim();
  if (!rawStreamToken) return null;
  return findUserByNotificationStreamToken(rawStreamToken);
};

export const getNotifications = asyncHandler(async (req, res) => {
  const result = await getUserNotifications(req.user.id);
  return sendResponse(res, {
    message: 'Notifikasi berhasil dimuat.',
    data: result.notifications,
    meta: { unread_count: result.unread_count },
  });
});

export const createNotificationPushSession = asyncHandler(async (req, res) => {
  const deviceLabel = String(req.headers['user-agent'] || '').slice(0, 120) || null;
  const [session, latestNotificationId] = await Promise.all([
    createNotificationStreamToken(req.user.id, { deviceLabel }),
    getLatestNotificationId(req.user.id),
  ]);

  return sendResponse(res, {
    statusCode: 201,
    message: 'Sesi stream notifikasi real-time berhasil dibuat.',
    data: {
      streamToken: session.streamToken,
      expiresAt: session.expiresAt,
      latestNotificationId,
    },
  });
});

export const revokeNotificationPushSession = asyncHandler(async (req, res) => {
  const rawToken =
    (typeof req.body?.streamToken === 'string' ? req.body.streamToken.trim() : '') ||
    (typeof req.headers['x-notification-token'] === 'string'
      ? req.headers['x-notification-token'].trim()
      : '');
  if (rawToken) {
    await revokeNotificationStreamToken(rawToken);
  }
  return sendResponse(res, {
    message: 'Sesi stream notifikasi real-time berhasil dicabut.',
  });
});

export const streamNotifications = asyncHandler(async (req, res) => {
  const user = await resolveStreamUser(req);
  if (!user) {
    throw new AppError('Token stream notifikasi tidak valid atau sudah dicabut.', 401);
  }

  const rawAfterId = req.query.after_id ?? req.headers['last-event-id'];
  const afterId = Number(rawAfterId);
  const latestId = await getLatestNotificationId(user.id);
  const missedNotifications =
    Number.isFinite(afterId) && afterId > 0
      ? await getUnreadNotificationsAfterId(user.id, afterId, 20)
      : [];

  req.socket?.setTimeout?.(0);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(
    formatSseEvent({
      event: 'connected',
      data: { userId: Number(user.id), latestId },
    })
  );

  for (const notif of missedNotifications) {
    res.write(
      formatSseEvent({
        id: notif.id,
        event: 'notification',
        data: notif,
      })
    );
  }

  notificationHub.subscribe(user.id, res);
});

export const pollPendingNotifications = asyncHandler(async (req, res) => {
  const user = await resolveStreamUser(req);
  if (!user) {
    throw new AppError('Token sinkronisasi notifikasi tidak valid atau sudah dicabut.', 401);
  }

  const afterId = Number(req.query.after_id);
  const latestId = await getLatestNotificationId(user.id);
  const notifications =
    Number.isFinite(afterId) && afterId > 0
      ? await getUnreadNotificationsAfterId(user.id, afterId, 20)
      : [];

  res.setHeader('Cache-Control', 'no-store');
  return sendResponse(res, {
    message: 'Notifikasi tertunda berhasil dimuat.',
    data: {
      notifications,
      latestId,
    },
  });
});

export const readNotifications = asyncHandler(async (req, res) => {
  const notificationId = req.params.id ? Number(req.params.id) : null;
  await markNotificationsRead(req.user.id, notificationId);
  return sendResponse(res, {
    message: 'Notifikasi ditandai sudah dibaca.',
  });
});

export const globalSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const results = await globalSearchService(q, req.user || null);
  return sendResponse(res, {
    message: q.length < 2 ? 'Masukkan minimal 2 karakter untuk mencari.' : `Hasil pencarian untuk "${q}".`,
    data: results,
  });
});

export const getAdminStats = asyncHandler(async (_req, res) => {
  const stats = await getAdminDashboardStats();
  return sendResponse(res, {
    message: 'Statistik dashboard admin berhasil dimuat.',
    data: stats,
  });
});

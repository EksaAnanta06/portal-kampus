// FILE: server/src/controllers/campus.controller.js
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import {
  listAnnouncementsQuery,
  getAnnouncementBySlugOrId,
  createAnnouncementRecord,
  updateAnnouncementRecord,
  deleteAnnouncementRecord,
  listEventsQuery,
  getEventByIdQuery,
  createEventRecord,
  updateEventRecord,
  deleteEventRecord,
  toggleEventLikeQuery,
  getEventLikersQuery,
  getEventCommentsQuery,
  insertEventCommentRecord,
  findEventCommentById,
  updateEventCommentRecord,
  deleteEventCommentById,
  getUserNotifications,
  markNotificationsRead,
  getPublicHomeStats,
  getAdminDashboardStats,
  globalSearchQuery,
} from '../queries/campus.queries.js';
import { listPhotosQuery } from '../queries/photo.queries.js';

const makeSlug = (title) =>
  `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;

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
  let banner_url = req.body.banner_url || null;

  if (req.file) {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'announcements');
    banner_url = uploaded.secure_url;
  }

  const slug = makeSlug(req.body.title);
  const id = await createAnnouncementRecord({
    ...req.body,
    banner_url,
    slug,
    author_id: req.user.id,
  });
  const created = await getAnnouncementBySlugOrId(id);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Pengumuman kampus berhasil diterbitkan.',
    data: created,
  });
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getAnnouncementBySlugOrId(id);
  if (!existing) {
    throw new AppError('Pengumuman tidak ditemukan.', 404);
  }

  let banner_url = req.body.banner_url !== undefined ? req.body.banner_url : existing.banner_url;

  if (req.file) {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'announcements');
    banner_url = uploaded.secure_url;
  }

  await updateAnnouncementRecord(id, {
    ...req.body,
    banner_url,
  });
  const updated = await getAnnouncementBySlugOrId(id);
  return sendResponse(res, {
    message: 'Pengumuman berhasil diperbarui.',
    data: updated,
  });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  await deleteAnnouncementRecord(Number(req.params.id));
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
  let banner_url = req.body.banner_url || null;

  if (req.file) {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'events');
    banner_url = uploaded.secure_url;
  }

  const id = await createEventRecord({
    ...req.body,
    banner_url,
    created_by: req.user.id,
  });
  const created = await getEventByIdQuery(id, req.user.id);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Agenda kampus berhasil ditambahkan.',
    data: created,
  });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getEventByIdQuery(id);
  if (!existing) {
    throw new AppError('Agenda kampus tidak ditemukan.', 404);
  }

  let banner_url = req.body.banner_url !== undefined ? req.body.banner_url : existing.banner_url;

  if (req.file) {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'events');
    banner_url = uploaded.secure_url;
  }

  await updateEventRecord(id, {
    ...req.body,
    banner_url,
  });

  const updated = await getEventByIdQuery(id, req.user.id);
  return sendResponse(res, {
    message: 'Agenda kampus berhasil diperbarui.',
    data: updated,
  });
});

export const deleteEvent = asyncHandler(async (req, res) => {
  await deleteEventRecord(Number(req.params.id));
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

  const comment = await insertEventCommentRecord({
    eventId,
    userId: req.user.id,
    content: req.body.content.trim(),
  });

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

export const getNotifications = asyncHandler(async (req, res) => {
  const result = await getUserNotifications(req.user.id);
  return sendResponse(res, {
    message: 'Notifikasi berhasil dimuat.',
    data: result.notifications,
    meta: { unread_count: result.unread_count },
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
  if (q.length < 2) {
    return sendResponse(res, {
      message: 'Masukkan minimal 2 karakter untuk mencari.',
      data: { photos: [], announcements: [], users: [] },
    });
  }

  const results = await globalSearchQuery(q);
  return sendResponse(res, {
    message: `Hasil pencarian untuk "${q}".`,
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

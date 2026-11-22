// FILE: client/src/api/campus.api.js
import axiosInstance from './axiosInstance';
import { unwrap, cleanParams } from './apiHelpers';

export const campusApi = {
  getHome: () => unwrap(axiosInstance.get('/campus/home')),
  search: (q, config = {}) => unwrap(axiosInstance.get('/campus/search', { ...config, params: { q } })),
  getAdminStats: () => unwrap(axiosInstance.get('/campus/admin/stats')),

  // ---------- Pengumuman ----------
  /** params: category, search, page, limit */
  getAnnouncements: (params, config = {}) =>
    unwrap(axiosInstance.get('/campus/announcements', { ...config, params: cleanParams(params) })),
  getAnnouncementDetail: (slugOrId, config = {}) =>
    unwrap(axiosInstance.get(`/campus/announcements/${slugOrId}`, config)),
  createAnnouncement: (payload) => unwrap(axiosInstance.post('/campus/announcements', payload)),
  updateAnnouncement: (id, payload) => unwrap(axiosInstance.put(`/campus/announcements/${id}`, payload)),
  deleteAnnouncement: (id) => unwrap(axiosInstance.delete(`/campus/announcements/${id}`)),

  // ---------- Agenda ----------
  getEvents: ({ upcoming = false } = {}, config = {}) =>
    unwrap(
      axiosInstance.get('/campus/events', {
        ...config,
        params: upcoming ? { upcoming: 'true' } : {},
      })
    ),
  getEventDetail: (id) => unwrap(axiosInstance.get(`/campus/events/${id}`)),
  createEvent: (payload) => unwrap(axiosInstance.post('/campus/events', payload)),
  updateEvent: (id, payload) => unwrap(axiosInstance.put(`/campus/events/${id}`, payload)),
  deleteEvent: (id) => unwrap(axiosInstance.delete(`/campus/events/${id}`)),
  toggleEventLike: (id) => unwrap(axiosInstance.post(`/campus/events/${id}/like`)),
  getEventLikers: (id) => unwrap(axiosInstance.get(`/campus/events/${id}/likes`)),
  getEventComments: (id) => unwrap(axiosInstance.get(`/campus/events/${id}/comments`)),
  addEventComment: (id, content) => unwrap(axiosInstance.post(`/campus/events/${id}/comments`, { content })),
  updateEventComment: (eventId, commentId, content) =>
    unwrap(axiosInstance.put(`/campus/events/${eventId}/comments/${commentId}`, { content })),
  deleteEventComment: (eventId, commentId) =>
    unwrap(axiosInstance.delete(`/campus/events/${eventId}/comments/${commentId}`)),

  // ---------- Notifikasi ----------
  getNotifications: () => unwrap(axiosInstance.get('/campus/notifications')),
  createNotificationPushSession: () =>
    unwrap(axiosInstance.post('/campus/notifications/push-session')),
  revokeNotificationPushSession: (streamToken) =>
    unwrap(
      axiosInstance.delete(
        '/campus/notifications/push-session',
        streamToken
          ? { data: { streamToken }, headers: { 'X-Notification-Token': streamToken } }
          : {}
      )
    ),
  readAllNotifications: () => unwrap(axiosInstance.patch('/campus/notifications/read-all')),
  readNotification: (id) => unwrap(axiosInstance.patch(`/campus/notifications/${id}/read`)),
};

export default campusApi;

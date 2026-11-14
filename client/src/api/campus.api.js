// FILE: client/src/api/campus.api.js
import axiosInstance from './axiosInstance';

const unwrap = (promise) => promise.then((res) => res.data);

const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export const campusApi = {
  getHome: () => unwrap(axiosInstance.get('/campus/home')),
  search: (q) => unwrap(axiosInstance.get('/campus/search', { params: { q } })),
  getAdminStats: () => unwrap(axiosInstance.get('/campus/admin/stats')),

  // ---------- Pengumuman ----------
  /** params: category, search, page, limit */
  getAnnouncements: (params) =>
    unwrap(axiosInstance.get('/campus/announcements', { params: cleanParams(params) })),
  getAnnouncementDetail: (slugOrId) => unwrap(axiosInstance.get(`/campus/announcements/${slugOrId}`)),
  createAnnouncement: (payload) => unwrap(axiosInstance.post('/campus/announcements', payload)),
  updateAnnouncement: (id, payload) => unwrap(axiosInstance.put(`/campus/announcements/${id}`, payload)),
  deleteAnnouncement: (id) => unwrap(axiosInstance.delete(`/campus/announcements/${id}`)),

  // ---------- Agenda ----------
  getEvents: ({ upcoming = false } = {}) =>
    unwrap(axiosInstance.get('/campus/events', { params: upcoming ? { upcoming: 'true' } : {} })),
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
  readAllNotifications: () => unwrap(axiosInstance.patch('/campus/notifications/read-all')),
  readNotification: (id) => unwrap(axiosInstance.patch(`/campus/notifications/${id}/read`)),
};

export default campusApi;

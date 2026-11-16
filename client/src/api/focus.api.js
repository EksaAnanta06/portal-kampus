// FILE: client/src/api/focus.api.js
import axiosInstance from './axiosInstance';
import { unwrap, cleanParams } from './apiHelpers';

export const focusApi = {
  // Tugas Pribadi (reusing tugas_pribadi)
  getTasks: (params = {}) =>
    unwrap(axiosInstance.get('/focus/tasks', { params: cleanParams(params) })),
  createTask: (payload) => unwrap(axiosInstance.post('/focus/tasks', payload)),
  updateTask: (id, payload) => unwrap(axiosInstance.put(`/focus/tasks/${id}`, payload)),
  updateTaskStatus: (id, status) =>
    unwrap(axiosInstance.patch(`/focus/tasks/${id}/status`, { status })),
  deleteTask: (id) => unwrap(axiosInstance.delete(`/focus/tasks/${id}`)),

  // Penjadwalan & Rencana Otomatis
  getSchedules: (params = {}) =>
    unwrap(axiosInstance.get('/focus/schedules', { params: cleanParams(params) })),
  autoPlan: (payload) => unwrap(axiosInstance.post('/focus/schedules/auto-plan', payload)),
  createSchedules: (payload) => unwrap(axiosInstance.post('/focus/schedules', payload)),
  updateScheduleStatus: (id, status) =>
    unwrap(axiosInstance.patch(`/focus/schedules/${id}/status`, { status })),
  suggestRescheduleSlot: (id) =>
    unwrap(axiosInstance.get(`/focus/schedules/${id}/reschedule-suggestion`)),
  rescheduleSession: (id, payload) =>
    unwrap(axiosInstance.post(`/focus/schedules/${id}/reschedule`, payload)),
  deleteSchedule: (id) => unwrap(axiosInstance.delete(`/focus/schedules/${id}`)),

  // Timer Fokus Pomodoro
  getActiveTimer: () => unwrap(axiosInstance.get('/focus/timer/active')),
  startTimer: (payload) => unwrap(axiosInstance.post('/focus/timer/start', payload)),
  pauseTimer: (id) => unwrap(axiosInstance.post(`/focus/timer/${id}/pause`)),
  resumeTimer: (id) => unwrap(axiosInstance.post(`/focus/timer/${id}/resume`)),
  completeTimer: (id, payload = {}) =>
    unwrap(axiosInstance.post(`/focus/timer/${id}/complete`, payload)),
  cancelTimer: (id) => unwrap(axiosInstance.post(`/focus/timer/${id}/cancel`)),
  getTimerHistory: (limit = 20) =>
    unwrap(axiosInstance.get('/focus/timer/history', { params: { limit } })),

  // Pengaturan & Web Push
  getSettings: () => unwrap(axiosInstance.get('/focus/settings')),
  updateSettings: (payload) => unwrap(axiosInstance.put('/focus/settings', payload)),
  getVapidPublicKey: () => unwrap(axiosInstance.get('/focus/push/vapid-public-key')),
  subscribePush: (payload) => unwrap(axiosInstance.post('/focus/push/subscribe', payload)),
  unsubscribePush: (endpoint) =>
    unwrap(axiosInstance.post('/focus/push/unsubscribe', { endpoint })),

  // Statistik & Widget Beranda
  getStats: () => unwrap(axiosInstance.get('/focus/stats')),
  getNextSessionWidget: () => unwrap(axiosInstance.get('/focus/next-session')),
};

export default focusApi;

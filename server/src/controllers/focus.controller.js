// FILE: server/src/controllers/focus.controller.js
import { sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getVapidConfig } from '../utils/webPushClient.js';
import * as focusService from '../services/focus.service.js';

// ============================================================================
// TUGAS PRIBADI
// ============================================================================

export const listTasks = asyncHandler(async (req, res) => {
  const tasks = await focusService.listTasksService(req.user.id, req.query);
  return sendResponse(res, { message: 'Daftar tugas pribadi berhasil dimuat.', data: tasks });
});

export const createTask = asyncHandler(async (req, res) => {
  const created = await focusService.createTaskService(req.user.id, req.body);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Tugas pribadi berhasil ditambahkan.',
    data: created,
  });
});

export const updateTask = asyncHandler(async (req, res) => {
  const updated = await focusService.updateTaskService(req.params.id, req.user.id, req.body);
  return sendResponse(res, { message: 'Tugas pribadi berhasil diperbarui.', data: updated });
});

export const updateTaskStatus = asyncHandler(async (req, res) => {
  const updated = await focusService.updateTaskStatusService(
    req.params.id,
    req.user.id,
    req.body.status
  );
  return sendResponse(res, { message: 'Status tugas berhasil diperbarui.', data: updated });
});

export const deleteTask = asyncHandler(async (req, res) => {
  await focusService.deleteTaskService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Tugas pribadi berhasil dihapus.' });
});

// ============================================================================
// PENJADWALAN ("KAPAN DIKERJAKAN") & RENCANA OTOMATIS
// ============================================================================

export const listSchedules = asyncHandler(async (req, res) => {
  const data = await focusService.listSchedulesService(req.user.id, req.query);
  return sendResponse(res, { message: 'Daftar jadwal belajar berhasil dimuat.', data });
});

export const autoPlanSchedules = asyncHandler(async (req, res) => {
  const plan = await focusService.computeAutoPlanService(req.user.id, req.body);
  return sendResponse(res, {
    message: 'Saran rencana otomatis berhasil dihitung.',
    data: plan,
  });
});

export const createSchedules = asyncHandler(async (req, res) => {
  const result = await focusService.createScheduleService(req.user.id, req.body);
  return sendResponse(res, {
    statusCode: 201,
    message: `${result.sessions.length} sesi kerja berhasil dijadwalkan.`,
    data: result,
  });
});

export const updateScheduleStatus = asyncHandler(async (req, res) => {
  const updated = await focusService.updateScheduleStatusService(
    req.params.id,
    req.user.id,
    req.body.status
  );
  return sendResponse(res, { message: 'Status sesi jadwal diperbarui.', data: updated });
});

export const suggestRescheduleSlot = asyncHandler(async (req, res) => {
  const slot = await focusService.suggestRescheduleSlotService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Saran slot jadwal ulang berhasil ditemukan.', data: slot });
});

export const rescheduleSession = asyncHandler(async (req, res) => {
  const result = await focusService.rescheduleSessionService(req.params.id, req.user.id, req.body);
  return sendResponse(res, { message: 'Sesi berhasil dijadwalkan ulang.', data: result });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  await focusService.deleteScheduleService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Sesi jadwal berhasil dihapus.' });
});

// ============================================================================
// TIMER FOKUS (POMODORO)
// ============================================================================

export const getActiveTimer = asyncHandler(async (req, res) => {
  const result = await focusService.getActiveTimerService(req.user.id);
  return sendResponse(res, { message: 'Status timer aktif dimuat.', data: result });
});

export const startTimer = asyncHandler(async (req, res) => {
  const result = await focusService.startTimerService(req.user.id, req.body);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Sesi fokus dimulai.',
    data: result,
  });
});

export const pauseTimer = asyncHandler(async (req, res) => {
  const result = await focusService.pauseTimerService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Timer dijeda.', data: result });
});

export const resumeTimer = asyncHandler(async (req, res) => {
  const result = await focusService.resumeTimerService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Timer dilanjutkan.', data: result });
});

export const completeTimer = asyncHandler(async (req, res) => {
  const result = await focusService.completeTimerService(req.params.id, req.user.id, req.body);
  return sendResponse(res, { message: 'Sesi timer selesai tercatat.', data: result });
});

export const cancelTimer = asyncHandler(async (req, res) => {
  const result = await focusService.cancelTimerService(req.params.id, req.user.id);
  return sendResponse(res, { message: 'Sesi timer dihentikan.', data: result });
});

export const listTimerHistory = asyncHandler(async (req, res) => {
  const history = await focusService.listTimerHistoryService(req.user.id, req.query.limit);
  return sendResponse(res, { message: 'Riwayat sesi fokus dimuat.', data: history });
});

// ============================================================================
// PENGATURAN, WEB PUSH, STATISTIK & WIDGET BERANDA
// ============================================================================

export const getFocusSettings = asyncHandler(async (req, res) => {
  const settings = await focusService.getSettingsService(req.user.id);
  return sendResponse(res, { message: 'Pengaturan fokus dimuat.', data: settings });
});

export const updateFocusSettings = asyncHandler(async (req, res) => {
  const updated = await focusService.updateSettingsService(req.user.id, req.body);
  return sendResponse(res, { message: 'Pengaturan fokus berhasil disimpan.', data: updated });
});

export const getVapidPublicKey = asyncHandler(async (_req, res) => {
  const vapid = getVapidConfig();
  return sendResponse(res, {
    message: 'Kunci publik VAPID dimuat.',
    data: { publicKey: vapid.publicKey, isEphemeral: vapid.isEphemeral },
  });
});

export const subscribePush = asyncHandler(async (req, res) => {
  await focusService.subscribePushService(req.user.id, req.body, req.headers['user-agent']);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Notifikasi Web Push berhasil diaktifkan untuk perangkat ini.',
  });
});

export const unsubscribePush = asyncHandler(async (req, res) => {
  await focusService.unsubscribePushService(req.user.id, req.body.endpoint);
  return sendResponse(res, { message: 'Langganan Web Push dinonaktifkan.' });
});

export const getFocusStats = asyncHandler(async (req, res) => {
  const stats = await focusService.getFocusStatsService(req.user.id);
  return sendResponse(res, { message: 'Statistik fokus dimuat.', data: stats });
});

export const getNextSessionWidget = asyncHandler(async (req, res) => {
  const data = await focusService.getNextSessionWidgetService(req.user.id);
  return sendResponse(res, { message: 'Widget sesi berikutnya dimuat.', data });
});

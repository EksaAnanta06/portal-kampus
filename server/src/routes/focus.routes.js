// FILE: server/src/routes/focus.routes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  focusTimerLimiter,
  pushSubscriptionLimiter,
} from '../middlewares/rateLimiter.middleware.js';
import {
  autoPlanSchema,
  completeTimerSchema,
  createScheduleSchema,
  createTaskSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  rescheduleSchema,
  scheduleIdParamSchema,
  schedulesQuerySchema,
  sessionIdParamSchema,
  startTimerSchema,
  taskIdParamSchema,
  tasksQuerySchema,
  updateFocusSettingsSchema,
  updateScheduleStatusSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validators/focus.validator.js';
import {
  autoPlanSchedules,
  cancelTimer,
  completeTimer,
  createSchedules,
  createTask,
  deleteSchedule,
  deleteTask,
  getActiveTimer,
  getFocusSettings,
  getFocusStats,
  getNextSessionWidget,
  getVapidPublicKey,
  listSchedules,
  listTasks,
  listTimerHistory,
  pauseTimer,
  rescheduleSession,
  resumeTimer,
  startTimer,
  subscribePush,
  suggestRescheduleSlot,
  unsubscribePush,
  updateFocusSettings,
  updateScheduleStatus,
  updateTask,
  updateTaskStatus,
} from '../controllers/focus.controller.js';

export const ASSIGNMENT_HUB_ROLES = ['mahasiswa', 'moderator', 'admin'];

const router = Router();

// Seluruh endpoint modul Penjadwalan, Timer Fokus, & Pengingat mengikuti hak akses Assignment Hub:
// hanya user terverifikasi (authenticate) dengan role mahasiswa/moderator/admin; alumni diblokir (403).
router.use(authenticate, authorizeRoles(...ASSIGNMENT_HUB_ROLES));

// 1. Tugas Pribadi (reusing tugas_pribadi)
router.get('/tasks', validate(tasksQuerySchema, 'query'), listTasks);
router.post('/tasks', validate(createTaskSchema), createTask);
router.put(
  '/tasks/:id',
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskSchema),
  updateTask
);
router.patch(
  '/tasks/:id/status',
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskStatusSchema),
  updateTaskStatus
);
router.delete('/tasks/:id', validate(taskIdParamSchema, 'params'), deleteTask);

// 2. Penjadwalan ("Kapan dikerjakan") & Rencana Otomatis
router.get('/schedules', validate(schedulesQuerySchema, 'query'), listSchedules);
router.post('/schedules/auto-plan', validate(autoPlanSchema), autoPlanSchedules);
router.post('/schedules', validate(createScheduleSchema), createSchedules);
router.patch(
  '/schedules/:id/status',
  validate(scheduleIdParamSchema, 'params'),
  validate(updateScheduleStatusSchema),
  updateScheduleStatus
);
router.get(
  '/schedules/:id/reschedule-suggestion',
  validate(scheduleIdParamSchema, 'params'),
  suggestRescheduleSlot
);
router.post(
  '/schedules/:id/reschedule',
  validate(scheduleIdParamSchema, 'params'),
  validate(rescheduleSchema),
  rescheduleSession
);
router.delete('/schedules/:id', validate(scheduleIdParamSchema, 'params'), deleteSchedule);

// 3. Timer Fokus Pomodoro (dengan rate limit khusus)
router.get('/timer/active', focusTimerLimiter, getActiveTimer);
router.get('/timer/history', listTimerHistory);
router.post('/timer/start', focusTimerLimiter, validate(startTimerSchema), startTimer);
router.post(
  '/timer/:id/pause',
  focusTimerLimiter,
  validate(sessionIdParamSchema, 'params'),
  pauseTimer
);
router.post(
  '/timer/:id/resume',
  focusTimerLimiter,
  validate(sessionIdParamSchema, 'params'),
  resumeTimer
);
router.post(
  '/timer/:id/complete',
  focusTimerLimiter,
  validate(sessionIdParamSchema, 'params'),
  validate(completeTimerSchema),
  completeTimer
);
router.post(
  '/timer/:id/cancel',
  focusTimerLimiter,
  validate(sessionIdParamSchema, 'params'),
  cancelTimer
);

// 4. Pengaturan Fokus & Pengingat
router.get('/settings', getFocusSettings);
router.put('/settings', validate(updateFocusSettingsSchema), updateFocusSettings);

// 5. Web Push VAPID (dengan rate limit khusus)
router.get('/push/vapid-public-key', getVapidPublicKey);
router.post('/push/subscribe', pushSubscriptionLimiter, validate(pushSubscribeSchema), subscribePush);
router.post(
  '/push/unsubscribe',
  pushSubscriptionLimiter,
  validate(pushUnsubscribeSchema),
  unsubscribePush
);

// 6. Statistik & Widget Beranda
router.get('/stats', getFocusStats);
router.get('/next-session', getNextSessionWidget);

export default router;

// FILE: server/src/validators/focus.validator.js
import { z } from 'zod';
import { positiveIntParamSchema } from './common.validator.js';
import { isValidTimeZone } from '../utils/timezone.js';

export const TASK_PRIORITIES = ['rendah', 'sedang', 'tinggi'];
export const TASK_STATUSES = ['belum_mulai', 'sedang_dikerjakan', 'selesai'];
export const SCHEDULE_STATUSES = ['terjadwal', 'selesai', 'dilewati', 'terlewat'];
export const TIMER_MODES = ['fokus', 'istirahat_pendek', 'istirahat_panjang'];

const hmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalIsoDateSchema = z.preprocess(
  (val) => (val === '' || val === undefined ? null : val),
  z
    .string()
    .refine((val) => Number.isFinite(Date.parse(val)), {
      message: 'Format tanggal/waktu tidak valid (gunakan format ISO UTC).',
    })
    .nullable()
    .optional()
);

const requiredIsoDateSchema = z
  .string({ required_error: 'Waktu wajib diisi.' })
  .refine((val) => Number.isFinite(Date.parse(val)), {
    message: 'Format waktu tidak valid (gunakan format ISO).',
  });

const nullablePositiveInt = (label, max = 10000) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.coerce.number().int(`${label} harus bilangan bulat`).min(1).max(max).nullable().optional()
  );

export const taskIdParamSchema = z.object({
  id: positiveIntParamSchema('ID Tugas'),
});

export const scheduleIdParamSchema = z.object({
  id: positiveIntParamSchema('ID Sesi Jadwal'),
});

export const sessionIdParamSchema = z.object({
  id: positiveIntParamSchema('ID Sesi Fokus'),
});

export const tasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
});

const nullableKategoriSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().trim().max(100, 'Kategori maksimal 100 karakter.').nullable().optional()
);

export const createTaskSchema = z.object({
  kategori: nullableKategoriSchema,
  judul: z
    .string({ required_error: 'Judul tugas wajib diisi.' })
    .trim()
    .min(2, 'Judul tugas minimal 2 karakter.')
    .max(200, 'Judul tugas maksimal 200 karakter.'),
  deskripsi: z.string().trim().max(5000).nullable().optional().default(null),
  prioritas: z.enum(TASK_PRIORITIES).optional().default('sedang'),
  status: z.enum(TASK_STATUSES).optional().default('belum_mulai'),
  deadline_at: optionalIsoDateSchema,
  estimasi_menit: nullablePositiveInt('Estimasi menit', 6000),
  target_mulai: optionalIsoDateSchema,
});

export const updateTaskSchema = z
  .object({
    kategori: nullableKategoriSchema,
    judul: z.string().trim().min(2).max(200).optional(),
    deskripsi: z.string().trim().max(5000).nullable().optional(),
    prioritas: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    deadline_at: optionalIsoDateSchema,
    estimasi_menit: nullablePositiveInt('Estimasi menit', 6000),
    target_mulai: optionalIsoDateSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada perubahan data tugas.',
  });

export const updateTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES, {
    errorMap: () => ({ message: 'Status tugas tidak valid.' }),
  }),
});

export const schedulesQuerySchema = z.object({
  from: optionalIsoDateSchema,
  to: optionalIsoDateSchema,
  tugas_id: nullablePositiveInt('ID Tugas', 999999),
  status: z.enum(SCHEDULE_STATUSES).optional(),
});

export const autoPlanSchema = z.object({
  tugas_id: positiveIntParamSchema('ID Tugas'),
  estimasi_menit: nullablePositiveInt('Estimasi menit', 3000),
  deadline_at: optionalIsoDateSchema,
  target_mulai: optionalIsoDateSchema,
  strategy: z.enum(['bagi_rata', 'dekat_deadline']).optional().default('bagi_rata'),
  preferred_session_minutes: z.coerce.number().int().min(15).max(180).optional().default(50),
});

export const createScheduleSchema = z.object({
  tugas_id: positiveIntParamSchema('ID Tugas'),
  estimasi_menit: nullablePositiveInt('Estimasi menit', 6000),
  target_mulai: optionalIsoDateSchema,
  sessions: z
    .array(
      z.object({
        mulai_at: requiredIsoDateSchema,
        durasi_menit: z.coerce.number().int().min(10, 'Durasi minimal 10 menit').max(480, 'Durasi maksimal 480 menit'),
      })
    )
    .min(1, 'Minimal jadwalkan satu sesi kerja.')
    .max(30, 'Maksimal 30 sesi dalam satu kali simpan.'),
});

export const updateScheduleStatusSchema = z.object({
  status: z.enum(SCHEDULE_STATUSES, {
    errorMap: () => ({ message: 'Status sesi jadwal tidak valid.' }),
  }),
});

export const rescheduleSchema = z.object({
  auto: z.boolean().optional().default(false),
  mulai_at: optionalIsoDateSchema,
  durasi_menit: nullablePositiveInt('Durasi sesi', 480),
});

export const startTimerSchema = z.object({
  tipe: z.enum(TIMER_MODES).optional().default('fokus'),
  durasi_menit: nullablePositiveInt('Durasi timer', 180),
  tugas_id: nullablePositiveInt('ID Tugas', 999999),
  sesi_jadwal_id: nullablePositiveInt('ID Sesi Jadwal', 999999),
  siklus_ke: z.coerce.number().int().min(1).max(20).optional().default(1),
});

export const completeTimerSchema = z.object({
  catatan: z.string().trim().max(500).nullable().optional(),
  tandai_tugas_selesai: z.boolean().optional().default(false),
  tandai_jadwal_selesai: z.boolean().optional().default(true),
});

export const updateFocusSettingsSchema = z.object({
  durasi_fokus: z.coerce.number().int().min(5).max(120).optional(),
  durasi_istirahat_pendek: z.coerce.number().int().min(1).max(45).optional(),
  durasi_istirahat_panjang: z.coerce.number().int().min(5).max(90).optional(),
  siklus_sebelum_panjang: z.coerce.number().int().min(2).max(10).optional(),
  auto_start: z.boolean().optional(),
  suara_aktif: z.boolean().optional(),
  getar_aktif: z.boolean().optional(),
  batas_beban_harian_menit: z.coerce.number().int().min(30).max(720).optional(),
  jam_aktif_mulai: z.string().regex(hmRegex, 'Format jam aktif mulai HH:MM').optional(),
  jam_aktif_selesai: z.string().regex(hmRegex, 'Format jam aktif selesai HH:MM').optional(),
  jam_tenang_aktif: z.boolean().optional(),
  jam_tenang_mulai: z.string().regex(hmRegex, 'Format jam tenang mulai HH:MM').optional(),
  jam_tenang_selesai: z.string().regex(hmRegex, 'Format jam tenang selesai HH:MM').optional(),
  zona_waktu: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((tz) => isValidTimeZone(tz), { message: 'Zona waktu IANA tidak valid.' })
    .optional(),
  ingatkan_sesi_akan_mulai: z.boolean().optional(),
  offset_sesi_menit: z.coerce.number().int().min(1).max(120).optional(),
  ingatkan_sesi_mulai: z.boolean().optional(),
  ingatkan_deadline_h3: z.boolean().optional(),
  ingatkan_deadline_h1: z.boolean().optional(),
  ingatkan_deadline_3jam: z.boolean().optional(),
  ingatkan_sesi_terlewat: z.boolean().optional(),
  email_pengingat_aktif: z.boolean().optional(),
});

export const pushSubscribeSchema = z.object({
  endpoint: z
    .string({ required_error: 'Endpoint Web Push wajib diisi.' })
    .url('Endpoint push tidak valid.')
    .refine((url) => url.startsWith('https://') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'), {
      message: 'Endpoint push wajib menggunakan HTTPS.',
    }),
  keys: z.object({
    p256dh: z.string().min(20, 'Kunci p256dh tidak valid.'),
    auth: z.string().min(10, 'Kunci auth tidak valid.'),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string({ required_error: 'Endpoint wajib diisi.' }).url(),
});

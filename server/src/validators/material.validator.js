// FILE: server/src/validators/material.validator.js
import { z } from 'zod';
import {
  booleanish,
  optionalSafeHttpUrlSchema,
  positiveIntParamSchema,
} from './common.validator.js';

export const MATERIAL_TYPES = [
  'ringkasan_catatan',
  'slide',
  'modul',
  'soal_latihan',
  'video',
  'kode_referensi',
  'tips_belajar',
  'lainnya',
];

export const MATERIAL_STATUSES = ['pending', 'approved', 'rejected', 'takedown'];
export const COURSE_STATUSES = ['approved', 'pending', 'rejected'];
export const REPORT_REASONS = [
  'hak_cipta',
  'konten_salah_menyesatkan',
  'tidak_pantas',
  'spam',
  'lainnya',
];

const emptyToUndefined = (val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
};

const optionalPositiveInt = (label) =>
  z.preprocess(emptyToUndefined, positiveIntParamSchema(label).optional());

const optionalSemesterQuery = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ invalid_type_error: 'Semester harus berupa angka.' })
    .int()
    .min(1, 'Semester minimal 1.')
    .max(8, 'Semester maksimal 8.')
    .optional()
);

// Params
export const idParamSchema = z.object({
  id: positiveIntParamSchema('ID'),
});

export const commentIdParamSchema = z.object({
  commentId: positiveIntParamSchema('ID Komentar'),
});

export const collectionItemParamSchema = z.object({
  id: positiveIntParamSchema('ID Koleksi'),
  materiId: positiveIntParamSchema('ID Materi'),
});

// 1. Katalog Prodi & Mata Kuliah
export const createProdiSchema = z.object({
  kode: z
    .string({ required_error: 'Kode prodi wajib diisi.' })
    .trim()
    .min(2, 'Kode prodi minimal 2 karakter.')
    .max(20, 'Kode prodi maksimal 20 karakter.')
    .transform((v) => v.toUpperCase()),
  nama: z
    .string({ required_error: 'Nama prodi wajib diisi.' })
    .trim()
    .min(3, 'Nama prodi minimal 3 karakter.')
    .max(100, 'Nama prodi maksimal 100 karakter.'),
  jenjang: z.enum(['D3', 'S1', 'S2']).default('S1'),
  fakultas: z
    .string()
    .trim()
    .max(100, 'Nama fakultas maksimal 100 karakter.')
    .optional()
    .default('Fakultas Ilmu Komputer & Desain'),
});

export const coursesQuerySchema = z.object({
  prodiId: optionalPositiveInt('ID Program Studi'),
  semester: optionalSemesterQuery,
  search: z.string().trim().max(100).optional().default(''),
  status: z.preprocess(emptyToUndefined, z.enum(COURSE_STATUSES).optional()),
  all: z.preprocess(emptyToUndefined, booleanish.optional()),
});

export const createCourseSchema = z.object({
  kode: z
    .string({ required_error: 'Kode mata kuliah wajib diisi.' })
    .trim()
    .min(2, 'Kode mata kuliah minimal 2 karakter.')
    .max(20, 'Kode mata kuliah maksimal 20 karakter.')
    .transform((v) => v.toUpperCase()),
  nama: z
    .string({ required_error: 'Nama mata kuliah wajib diisi.' })
    .trim()
    .min(3, 'Nama mata kuliah minimal 3 karakter.')
    .max(150, 'Nama mata kuliah maksimal 150 karakter.'),
  sks: z.coerce
    .number({ invalid_type_error: 'SKS harus berupa angka.' })
    .int()
    .min(1, 'SKS minimal 1.')
    .max(8, 'SKS maksimal 8.')
    .default(3),
  prodi_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    positiveIntParamSchema('Program Studi').nullable().optional()
  ),
  semester_rekomendasi: z.coerce
    .number({ invalid_type_error: 'Semester rekomendasi harus berupa angka.' })
    .int()
    .min(1, 'Semester minimal 1.')
    .max(8, 'Semester maksimal 8.')
    .default(1),
  deskripsi: z.string().trim().max(2000).optional().default(''),
});

export const updateCourseSchema = z
  .object({
    kode: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .transform((v) => v.toUpperCase())
      .optional(),
    nama: z.string().trim().min(3).max(150).optional(),
    sks: z.coerce.number().int().min(1).max(8).optional(),
    prodi_id: z.preprocess(
      (v) => (v === '' ? null : v),
      positiveIntParamSchema('Program Studi').nullable().optional()
    ),
    semester_rekomendasi: z.coerce.number().int().min(1).max(8).optional(),
    deskripsi: z.string().trim().max(2000).optional(),
    status: z.enum(COURSE_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal satu field mata kuliah harus diperbarui.',
  });

export const approveCourseSchema = z.object({
  status: z.enum(['approved', 'rejected']).default('approved'),
});

// 2. Materi Perkuliahan
export const materialsQuerySchema = z.object({
  mataKuliahId: optionalPositiveInt('ID Mata Kuliah'),
  prodiId: optionalPositiveInt('ID Program Studi'),
  semester: optionalSemesterQuery,
  tipeMateri: z.preprocess(emptyToUndefined, z.enum(MATERIAL_TYPES).optional()),
  search: z.string().trim().max(120).optional().default(''),
  status: z.preprocess(emptyToUndefined, z.enum(MATERIAL_STATUSES).optional()),
  sort: z.enum(['terbaru', 'terpopuler', 'paling_bermanfaat']).optional().default('terbaru'),
  mine: z.preprocess(emptyToUndefined, booleanish.optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(24)),
});

export const createMaterialSchema = z.object({
  mata_kuliah_id: positiveIntParamSchema('Mata Kuliah'),
  tipe_materi: z.enum(MATERIAL_TYPES, {
    errorMap: () => ({ message: 'Tipe materi tidak valid.' }),
  }),
  judul: z
    .string({ required_error: 'Judul materi wajib diisi.' })
    .trim()
    .min(3, 'Judul materi minimal 3 karakter.')
    .max(255, 'Judul materi maksimal 255 karakter.'),
  deskripsi: z.string().trim().max(5000).optional().default(''),
  tags: z.string().trim().max(255).optional().default(''),
  tahun_akademik: z.string().trim().max(20).optional().default(''),
  angkatan_kontributor: z.string().trim().max(10).optional().default(''),
  dosen_pengampu_teks: z.string().trim().max(150).optional().default(''),
  sumber_kredit: z.string().trim().max(255).optional().default(''),
  external_url: optionalSafeHttpUrlSchema('Tautan Eksternal'),
  agreement_checked: booleanish.refine((v) => v === true, {
    message: 'Anda wajib mencentang pernyataan kepatuhan etika & hak cipta.',
  }),
});

export const updateMaterialSchema = z
  .object({
    judul: z.string().trim().min(3, 'Judul minimal 3 karakter.').max(255).optional(),
    deskripsi: z.string().trim().max(5000).optional(),
    tags: z.string().trim().max(255).optional(),
    tahun_akademik: z.string().trim().max(20).optional(),
    angkatan_kontributor: z.string().trim().max(10).optional(),
    dosen_pengampu_teks: z.string().trim().max(150).optional(),
    sumber_kredit: z.string().trim().max(255).optional(),
    external_url: optionalSafeHttpUrlSchema('Tautan Eksternal'),
    tipe_materi: z.enum(MATERIAL_TYPES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada data yang diubah.',
  });

export const uploadVersionSchema = z.object({
  changelog_note: z
    .string()
    .trim()
    .max(255, 'Catatan revisi maksimal 255 karakter.')
    .optional()
    .default('Pembaruan berkas materi'),
});

export const moderateMaterialSchema = z.object({
  status: z.enum(['approved', 'rejected', 'takedown'], {
    errorMap: () => ({ message: 'Status moderasi tidak valid.' }),
  }),
  note: z.string().trim().max(1000).optional().default(''),
});

// 3. Interaksi & Gamifikasi
export const createCommentSchema = z.object({
  konten: z
    .string({ required_error: 'Komentar tidak boleh kosong.' })
    .trim()
    .min(1, 'Komentar tidak boleh kosong.')
    .max(2000, 'Komentar maksimal 2000 karakter.'),
  parent_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    positiveIntParamSchema('Komentar Induk').nullable().optional()
  ),
});

export const reportMaterialSchema = z.object({
  alasan: z.enum(REPORT_REASONS, {
    errorMap: () => ({ message: 'Silakan pilih alasan laporan yang valid.' }),
  }),
  deskripsi: z.string().trim().max(1000).optional().default(''),
});

export const reportsQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['pending', 'resolved', 'dismissed']).optional()
  ),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(25)),
});

export const handleReportSchema = z.object({
  action: z.enum(['takedown', 'dismissed'], {
    errorMap: () => ({ message: 'Tindakan penanganan laporan tidak valid.' }),
  }),
  takedown_note: z.string().trim().max(1000).optional().default(''),
});

export const leaderboardQuerySchema = z.object({
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(15)),
});

// 4. Koleksi Saya
export const createCollectionSchema = z.object({
  nama: z
    .string({ required_error: 'Nama koleksi wajib diisi.' })
    .trim()
    .min(1, 'Nama koleksi wajib diisi.')
    .max(100, 'Nama koleksi maksimal 100 karakter.'),
  deskripsi: z.string().trim().max(255).optional().default(''),
});

export const toggleCollectionItemSchema = z.object({
  materi_id: positiveIntParamSchema('ID Materi'),
});

// 5. Papan Minta Materi
export const requestsQuerySchema = z.object({
  prodiId: optionalPositiveInt('ID Program Studi'),
  mataKuliahId: optionalPositiveInt('ID Mata Kuliah'),
  search: z.string().trim().max(100).optional().default(''),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(30)),
});

export const createRequestSchema = z.object({
  mata_kuliah_id: positiveIntParamSchema('Mata Kuliah'),
  judul: z
    .string({ required_error: 'Judul permintaan materi wajib diisi.' })
    .trim()
    .min(3, 'Judul permintaan minimal 3 karakter.')
    .max(200, 'Judul permintaan maksimal 200 karakter.'),
  deskripsi: z.string().trim().max(2000).optional().default(''),
  tipe_materi_diminta: z.string().trim().max(50).optional().default(''),
});

export const fulfillRequestSchema = z
  .object({
    action: z.enum(['link', 'mark_fulfilled', 'reopen']).optional(),
    fulfilled_materi_id: z.preprocess(
      emptyToUndefined,
      positiveIntParamSchema('Materi Penaut').optional()
    ),
  })
  .refine(
    (data) => {
      if (data.action === 'mark_fulfilled' || data.action === 'reopen') return true;
      return Boolean(data.fulfilled_materi_id);
    },
    { message: 'Materi penaut wajib disertakan untuk menjawab permintaan.' }
  );

// 6. Paket Belajar Semester
export const packagesQuerySchema = z.object({
  prodiId: optionalPositiveInt('ID Program Studi'),
  semester: optionalSemesterQuery,
});

export const packageBodySchema = z.object({
  prodi_id: positiveIntParamSchema('Program Studi'),
  semester: z.coerce
    .number({ invalid_type_error: 'Semester harus berupa angka.' })
    .int()
    .min(1, 'Semester minimal 1.')
    .max(8, 'Semester maksimal 8.'),
  judul: z
    .string({ required_error: 'Judul paket belajar wajib diisi.' })
    .trim()
    .min(3, 'Judul paket minimal 3 karakter.')
    .max(150, 'Judul paket maksimal 150 karakter.'),
  deskripsi: z.string().trim().max(2000).optional().default(''),
  material_ids: z.array(positiveIntParamSchema('ID Materi')).max(100).optional().default([]),
});

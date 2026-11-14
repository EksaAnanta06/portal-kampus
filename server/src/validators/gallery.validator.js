// FILE: server/src/validators/gallery.validator.js
import { z } from 'zod';

export const createAngkatanSchema = z.object({
  year: z.coerce.number().int().min(1996).max(2035),
  title: z.string().trim().min(3, 'Judul angkatan minimal 3 karakter').max(100),
  description: z.string().max(1000).optional().nullable(),
});

export const updateAngkatanSchema = z.object({
  year: z.coerce.number().int().min(1996).max(2035).optional(),
  title: z.string().trim().min(3, 'Judul angkatan minimal 3 karakter').max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
});

export const createAlbumSchema = z.object({
  angkatan_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(2, 'Nama album minimal 2 karakter').max(100),
  description: z.string().max(255).optional().nullable(),
});

export const updateAlbumSchema = z.object({
  name: z.string().trim().min(2, 'Nama album minimal 2 karakter').max(100),
  description: z.string().max(255).optional().nullable(),
});

export const uploadPhotoMetadataSchema = z.object({
  angkatan_id: z.coerce.number().int().positive('Angkatan wajib dipilih'),
  album_id: z.preprocess(
    (val) => (val === '' || val === 'null' || val === undefined ? null : Number(val)),
    z.number().int().positive().nullable()
  ),
  caption: z.string().trim().min(3, 'Caption minimal 3 karakter').max(1000),
  tags: z.string().max(255).optional().nullable(),
  taken_date: z.preprocess(
    (val) => (val === '' || val === 'null' || val === undefined ? null : val),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').nullable().optional()
  ),
});

export const updatePhotoSchema = z.object({
  caption: z.string().trim().min(3, 'Caption minimal 3 karakter').max(1000),
  album_id: z.coerce.number().int().positive().nullable().optional(),
  tags: z.string().max(255).nullable().optional(),
});

export const moderatePhotoSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejection_reason: z.string().max(255).optional().nullable(),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Komentar tidak boleh kosong').max(500, 'Komentar maksimal 500 karakter'),
});

export const reportPhotoSchema = z.object({
  reason: z.enum(['inappropriate', 'spam', 'harassment', 'copyright', 'other']),
  description: z.string().max(500).optional().nullable(),
});

export const resolvePhotoReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']).default('resolved'),
});

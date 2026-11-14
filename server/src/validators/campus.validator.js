// FILE: server/src/validators/campus.validator.js
import { z } from 'zod';
import { booleanish, optionalSafeHttpUrlSchema } from './common.validator.js';

export const announcementSchema = z.object({
  title: z.string().trim().min(5, 'Judul pengumuman minimal 5 karakter').max(200),
  category: z.enum(['akademik', 'kemahasiswaan', 'alumni', 'beasiswa', 'umum']).default('umum'),
  excerpt: z.string().trim().min(10, 'Ringkasan minimal 10 karakter').max(300),
  content: z.string().trim().min(20, 'Isi pengumuman minimal 20 karakter'),
  banner_url: optionalSafeHttpUrlSchema('URL banner tidak valid (wajib http:// atau https://)'),
  is_pinned: booleanish.optional().default(false),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(5, 'Nama agenda minimal 5 karakter').max(200),
    description: z.string().trim().min(10, 'Deskripsi agenda minimal 10 karakter'),
    location: z.string().trim().min(3, 'Lokasi kegiatan wajib diisi').max(200),
    organizer: z.string().trim().min(2).max(120).default('BEM UNAS PASIM'),
    start_date: z.string().min(10, 'Tanggal mulai wajib diisi'),
    end_date: z.string().min(10, 'Tanggal selesai wajib diisi'),
    registration_link: optionalSafeHttpUrlSchema('Format link pendaftaran tidak valid (wajib http:// atau https://)'),
    banner_url: optionalSafeHttpUrlSchema('URL banner tidak valid (wajib http:// atau https://)'),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
    },
    { message: 'Waktu selesai harus sama dengan atau setelah waktu mulai', path: ['end_date'] }
  );

export const eventCommentSchema = z.object({
  content: z.string().trim().min(1, 'Komentar tidak boleh kosong').max(500, 'Komentar maksimal 500 karakter'),
});

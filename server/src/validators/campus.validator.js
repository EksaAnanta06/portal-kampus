// FILE: server/src/validators/campus.validator.js
import { z } from 'zod';

// Mengubah "true"/"false"/"1"/"0" menjadi boolean (z.coerce.boolean() menganggap "false" = true).
const booleanish = z.preprocess((val) => {
  if (val === true || val === 'true' || val === '1' || val === 1) return true;
  if (val === false || val === 'false' || val === '0' || val === 0) return false;
  return val;
}, z.boolean());

export const announcementSchema = z.object({
  title: z.string().min(5, 'Judul pengumuman minimal 5 karakter').max(200),
  category: z.enum(['akademik', 'kemahasiswaan', 'alumni', 'beasiswa', 'umum']).default('umum'),
  excerpt: z.string().min(10, 'Ringkasan minimal 10 karakter').max(300),
  content: z.string().min(20, 'Isi pengumuman minimal 20 karakter'),
  banner_url: z.string().url().or(z.literal('')).nullable().optional(),
  is_pinned: booleanish.optional().default(false),
});

export const eventSchema = z.object({
  title: z.string().min(5, 'Nama agenda minimal 5 karakter').max(200),
  description: z.string().min(10, 'Deskripsi agenda minimal 10 karakter'),
  location: z.string().min(3, 'Lokasi kegiatan wajib diisi').max(200),
  organizer: z.string().min(2).max(120).default('BEM UNAS PASIM'),
  start_date: z.string().min(10, 'Tanggal mulai wajib diisi'),
  end_date: z.string().min(10, 'Tanggal selesai wajib diisi'),
  registration_link: z.string().url('Format link pendaftaran tidak valid').or(z.literal('')).nullable().optional(),
  banner_url: z.string().url().or(z.literal('')).nullable().optional(),
});

export const eventCommentSchema = z.object({
  content: z.string().trim().min(1, 'Komentar tidak boleh kosong').max(500, 'Komentar maksimal 500 karakter'),
});

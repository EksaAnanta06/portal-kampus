// FILE: server/src/validators/auth.validator.js
import { z } from 'zod';

export const registerSchema = z.object({
  nim: z
    .string()
    .min(5, 'NIM minimal 5 karakter')
    .max(30, 'NIM maksimal 30 karakter')
    .regex(/^[A-Za-z0-9-]+$/, 'NIM hanya boleh berisi huruf, angka, dan tanda hubung'),
  full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(120),
  email: z.string().email('Format email tidak valid').max(150),
  prodi: z.string().min(3, 'Program studi wajib dipilih').max(100),
  angkatan_year: z.coerce
    .number()
    .int()
    .min(1996, 'Tahun angkatan minimal 1996')
    .max(2035, 'Tahun angkatan tidak valid'),
  role: z.enum(['mahasiswa', 'alumni']).optional().default('mahasiswa'),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(72, 'Password maksimal 72 karakter'),
});

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Email atau NIM wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Masukkan alamat email terdaftar yang valid'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token reset tidak valid'),
  password: z.string().min(8, 'Password baru minimal 8 karakter').max(72),
});

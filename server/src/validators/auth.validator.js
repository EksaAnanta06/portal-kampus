// FILE: server/src/validators/auth.validator.js
import { z } from 'zod';

export const registerSchema = z.object({
  nim: z
    .string()
    .trim()
    .toUpperCase()
    .min(5, 'NIM minimal 5 karakter')
    .max(30, 'NIM maksimal 30 karakter')
    .regex(/^[A-Za-z0-9-]+$/, 'NIM hanya boleh berisi huruf, angka, dan tanda hubung'),
  full_name: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(120),
  email: z.string().trim().toLowerCase().email('Format email tidak valid').max(150),
  prodi: z.string().trim().min(3, 'Program studi wajib dipilih').max(100),
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
  identifier: z.string().trim().min(3, 'Email atau NIM wajib diisi').max(150),
  password: z.string().min(1, 'Password wajib diisi').max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Masukkan alamat email terdaftar yang valid'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Token reset tidak valid').max(256),
  password: z.string().min(8, 'Password baru minimal 8 karakter').max(72),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Password saat ini wajib diisi').max(72),
  new_password: z.string().min(8, 'Password baru minimal 8 karakter').max(72),
});

export const googleExchangeSchema = z.object({
  code: z.string().trim().min(16, 'Kode otorisasi tidak valid').max(256),
});

export const googleCompleteRegistrationSchema = z.object({
  token: z.string().trim().min(16, 'Token pendaftaran Google tidak valid').max(256),
  nim: z
    .string()
    .trim()
    .toUpperCase()
    .min(5, 'NIM minimal 5 karakter')
    .max(30, 'NIM maksimal 30 karakter')
    .regex(/^[A-Za-z0-9-]+$/, 'NIM hanya boleh berisi huruf, angka, dan tanda hubung'),
  full_name: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(120),
  prodi: z.string().trim().min(3, 'Program studi wajib dipilih').max(100),
  angkatan_year: z.coerce
    .number()
    .int()
    .min(1996, 'Tahun angkatan minimal 1996')
    .max(2035, 'Tahun angkatan tidak valid'),
  role: z.enum(['mahasiswa', 'alumni']).optional().default('mahasiswa'),
});

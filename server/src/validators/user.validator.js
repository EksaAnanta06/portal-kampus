// FILE: server/src/validators/user.validator.js
import { z } from 'zod';

// Mengubah nilai string dari multipart/form-data ("true"/"false"/"1"/"0") menjadi boolean.
// z.coerce.boolean() tidak dipakai karena string "false" akan dianggap true.
const booleanish = z.preprocess((val) => {
  if (val === true || val === 'true' || val === '1' || val === 1) return true;
  if (val === false || val === 'false' || val === '0' || val === 0) return false;
  return val;
}, z.boolean());

export const updateProfileSchema = z.object({
  full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(120).optional(),
  prodi: z.string().min(3).max(100).optional(),
  angkatan_year: z.coerce.number().int().min(1996).max(2035).optional(),
  bio: z.string().max(500, 'Bio maksimal 500 karakter').nullable().optional(),
  current_job: z.string().max(150).nullable().optional(),
  linkedin_url: z.string().url('URL LinkedIn tidak valid').or(z.literal('')).nullable().optional(),
  instagram_url: z.string().url('URL Instagram tidak valid').or(z.literal('')).nullable().optional(),
  github_url: z.string().url('URL GitHub tidak valid').or(z.literal('')).nullable().optional(),
  is_public_profile: booleanish.optional(),
});

export const verifyUserStatusSchema = z.object({
  status: z.enum(['active', 'rejected', 'suspended', 'pending']),
  role: z.enum(['admin', 'moderator', 'mahasiswa', 'alumni']).optional(),
});

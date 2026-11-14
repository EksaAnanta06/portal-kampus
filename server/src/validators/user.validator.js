// FILE: server/src/validators/user.validator.js
import { z } from 'zod';
import { booleanish, optionalSafeHttpUrlSchema } from './common.validator.js';

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(120).optional(),
  prodi: z.string().trim().min(3).max(100).optional(),
  angkatan_year: z.coerce.number().int().min(1996).max(2035).optional(),
  bio: z.string().max(500, 'Bio maksimal 500 karakter').nullable().optional(),
  current_job: z.string().max(150).nullable().optional(),
  linkedin_url: optionalSafeHttpUrlSchema('URL LinkedIn tidak valid (wajib http:// atau https://)'),
  instagram_url: optionalSafeHttpUrlSchema('URL Instagram tidak valid (wajib http:// atau https://)'),
  github_url: optionalSafeHttpUrlSchema('URL GitHub tidak valid (wajib http:// atau https://)'),
  is_public_profile: booleanish.optional(),
});

export const verifyUserStatusSchema = z.object({
  status: z.enum(['active', 'rejected', 'suspended', 'pending']),
  role: z.enum(['admin', 'moderator', 'mahasiswa', 'alumni']).optional(),
});

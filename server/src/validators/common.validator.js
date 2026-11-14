// FILE: server/src/validators/common.validator.js
import { z } from 'zod';
import { isSafeHttpUrl } from '../utils/sanitize.js';

/**
 * Mengubah nilai string dari multipart/form-data ("true"/"false"/"1"/"0") menjadi boolean.
 * z.coerce.boolean() tidak dipakai karena string "false" dianggap true.
 */
export const booleanish = z.preprocess((val) => {
  if (val === true || val === 'true' || val === '1' || val === 1) return true;
  if (val === false || val === 'false' || val === '0' || val === 0) return false;
  return val;
}, z.boolean());

/**
 * Validator URL ketat: hanya mengizinkan protokol http:// atau https:// (anti javascript: / data: XSS)
 */
export const safeHttpUrlSchema = (message = 'URL tidak valid (wajib menggunakan http:// atau https://)') =>
  z.string().trim().max(500, 'URL maksimal 500 karakter').refine((val) => isSafeHttpUrl(val), { message });

export const optionalSafeHttpUrlSchema = (message) =>
  safeHttpUrlSchema(message).or(z.literal('')).nullable().optional();

export const positiveIntParamSchema = (label = 'ID') =>
  z.coerce.number().int(`${label} harus berupa angka bulat`).positive(`${label} tidak valid`);

// FILE: server/src/utils/sanitize.js

/**
 * Membersihkan string input dari markup script/event-handler berbahaya
 * tanpa merusak tanda baca normal (seperti '&', '"', '<', '>' pada catatan teks).
 */
export const sanitizeString = (val) => {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|svg|math)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
};

export const sanitizeValue = (val) => {
  if (typeof val === 'string') return sanitizeString(val);
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === 'object' && !Buffer.isBuffer(val)) {
    const cleaned = {};
    for (const key of Object.keys(val)) {
      cleaned[key] = sanitizeValue(val[key]);
    }
    return cleaned;
  }
  return val;
};

/**
 * Memeriksa apakah string URL menggunakan skema aman http:// atau https://
 */
export const isSafeHttpUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

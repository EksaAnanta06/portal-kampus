// FILE: server/src/utils/youtube.js

/**
 * Ekstrak ID video YouTube (11 karakter) dari berbagai variasi URL:
 * watch?v=, youtu.be/, embed/, shorts/, live/.
 */
export const extractYoutubeVideoId = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\.|^m\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const segment = parsed.pathname.split('/').filter(Boolean)[0];
      return segment && /^[a-zA-Z0-9_-]{11}$/.test(segment) ? segment : null;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        const candidate = parts[1];
        return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * Sanitasi nama berkas atau folder untuk arsip ZIP.
 */
export const sanitizePathSegment = (str) => {
  return String(str || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 80);
};

/**
 * Evaluasi badge "Kakak Tingkat / Alumni" berbasis tahun akademik aktif (mulai September)
 * serta memprioritaskan `angkatan_kontributor` bila diisi.
 */
export const computeIsKakakTingkat = ({
  uploader_role,
  uploader_angkatan,
  angkatan_kontributor,
  semester_rekomendasi = 1,
} = {}) => {
  if (uploader_role === 'alumni') return true;
  if (uploader_role !== 'mahasiswa') return false;

  const entryYear =
    parseInt(angkatan_kontributor, 10) || parseInt(uploader_angkatan, 10) || 0;
  const now = new Date();
  const currentYear = now.getFullYear();

  if (entryYear <= 0 || entryYear > currentYear) return false;

  const activeAcademicStartYear =
    now.getMonth() >= 8 ? currentYear : currentYear - 1;
  const studentStudyYear = activeAcademicStartYear - entryYear + 1;
  const targetCourseStudyYear = Math.ceil((Number(semester_rekomendasi) || 1) / 2);

  return studentStudyYear > targetCourseStudyYear;
};

/**
 * Bersihkan payload materi sebelum dikirim ke client:
 * - Hitung is_kakak_tingkat secara konsisten di list maupun detail
 * - Sembunyikan field sensitif (nim untuk non-staff, moderation_note untuk non-owner/non-staff)
 */
export const serializeMaterialDto = (row, { currentUserId = null, isStaff = false } = {}) => {
  if (!row) return null;

  const isOwner = Boolean(currentUserId && Number(row.uploaded_by) === Number(currentUserId));
  const dto = {
    ...row,
    is_kakak_tingkat: computeIsKakakTingkat(row),
  };

  delete dto.uploader_email;

  if (!isStaff) {
    delete dto.uploader_nim;
  }

  if (!isStaff && !isOwner) {
    delete dto.moderation_note;
    delete dto.moderated_by;
    delete dto.moderated_at;
  }

  return dto;
};

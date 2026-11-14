// FILE: client/src/utils/constants.js

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Portal Kampus UNAS PASIM Bandung';

export const CAMPUS_INFO = {
  name: 'Universitas Nasional Pasim',
  shortName: 'UNAS PASIM',
  city: 'Bandung',
  address: 'Jl. Dakota No. 8A, Sukaraja, Kec. Cicendo, Kota Bandung, Jawa Barat 40175',
  website: 'https://pasim.ac.id',
  email: 'info@pasim.ac.id',
};

export const PRODI_LIST = [
  'S1 Teknik Informatika',
  'S1 Sistem Informasi',
  'S1 Manajemen',
  'S1 Akuntansi',
  'S1 Psikologi',
  'S1 Sastra Jepang',
];

export const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MAHASISWA: 'mahasiswa',
  ALUMNI: 'alumni',
  DOSEN: 'dosen',
  ASISTEN_LAB: 'asisten_lab',
};

export const STAFF_ROLES = [ROLES.ADMIN, ROLES.MODERATOR];
export const INSTRUCTOR_ROLES = [ROLES.DOSEN, ROLES.ASISTEN_LAB, ROLES.ADMIN];

export const ROLE_LABELS = {
  admin: 'Admin',
  moderator: 'Moderator',
  mahasiswa: 'Mahasiswa',
  alumni: 'Alumni',
  dosen: 'Dosen',
  asisten_lab: 'Asisten Lab',
};

export const ROLE_COLORS = {
  admin: 'error',
  moderator: 'warning',
  mahasiswa: 'primary',
  alumni: 'success',
  dosen: 'secondary',
  asisten_lab: 'info',
};

export const SUBMISSION_STATUS_LABELS = {
  belum_dikumpulkan: 'Belum Dikumpulkan',
  menunggu_dinilai: 'Menunggu Dinilai',
  sudah_dinilai: 'Sudah Dinilai',
  perlu_revisi: 'Perlu Revisi',
};

export const SUBMISSION_STATUS_COLORS = {
  belum_dikumpulkan: 'default',
  menunggu_dinilai: 'warning',
  sudah_dinilai: 'success',
  perlu_revisi: 'error',
};

export const MAX_DOC_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.zip', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
export const ALLOWED_DOC_ACCEPT = '.pdf,.zip,.doc,.docx,.ppt,.pptx,.xls,.xlsx';

export const USER_STATUS_LABELS = {
  pending: 'Menunggu Verifikasi',
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  rejected: 'Ditolak',
};

export const USER_STATUS_COLORS = {
  pending: 'warning',
  active: 'success',
  suspended: 'default',
  rejected: 'error',
};

export const PHOTO_STATUS_LABELS = {
  pending: 'Menunggu Moderasi',
  approved: 'Tayang',
  rejected: 'Ditolak',
};

export const PHOTO_STATUS_COLORS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export const ANNOUNCEMENT_CATEGORIES = [
  { value: 'akademik', label: 'Akademik' },
  { value: 'kemahasiswaan', label: 'Kemahasiswaan' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'beasiswa', label: 'Beasiswa' },
  { value: 'umum', label: 'Umum' },
];

export const CATEGORY_LABELS = ANNOUNCEMENT_CATEGORIES.reduce((acc, c) => {
  acc[c.value] = c.label;
  return acc;
}, {});

export const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Konten tidak pantas' },
  { value: 'spam', label: 'Spam / tidak relevan' },
  { value: 'harassment', label: 'Pelecehan / perundungan' },
  { value: 'copyright', label: 'Pelanggaran hak cipta' },
  { value: 'other', label: 'Lainnya' },
];

export const REPORT_REASON_LABELS = REPORT_REASONS.reduce((acc, r) => {
  acc[r.value] = r.label;
  return acc;
}, {});

// Batasan upload — harus sama dengan server/src/middlewares/upload.middleware.js
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_FILES_PER_UPLOAD = 10;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';

export const MIN_ANGKATAN_YEAR = 1996;
export const MAX_ANGKATAN_YEAR = 2035;

export const ANGKATAN_YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = Math.min(current + 1, MAX_ANGKATAN_YEAR); y >= MIN_ANGKATAN_YEAR; y -= 1) {
    years.push(y);
  }
  return years;
})();

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const getInitials = (name = '') =>
  name
    .replace(/[^A-Za-z\s]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

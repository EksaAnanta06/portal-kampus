// FILE: client/src/utils/formatDate.js
// Formatter tanggal berbahasa Indonesia (zona waktu Asia/Jakarta / WIB)

const LOCALE = 'id-ID';
const TIME_ZONE = 'Asia/Jakarta';

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 8 November 2026 */
export const formatDate = (value, options = {}) => {
  const d = toDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
    ...options,
  }).format(d);
};

/** 8 Nov 2026 */
export const formatShortDate = (value) =>
  formatDate(value, { month: 'short' });

/** Minggu, 8 November 2026 pukul 17.30 WIB */
export const formatDateTime = (value) => {
  const d = toDate(value);
  if (!d) return '-';
  const datePart = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(d);
  return `${datePart} pukul ${formatTime(d)} WIB`;
};

/** 17.30 */
export const formatTime = (value) => {
  const d = toDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(d);
};

/** { day: '15', month: 'NOV', weekday: 'Sab' } — untuk badge tanggal agenda */
export const getDateParts = (value) => {
  const d = toDate(value);
  if (!d) return { day: '-', month: '-', weekday: '-' };
  const fmt = (opts) => new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...opts }).format(d);
  return {
    day: fmt({ day: '2-digit' }),
    month: fmt({ month: 'short' }).replace('.', '').toUpperCase(),
    weekday: fmt({ weekday: 'short' }),
  };
};

/** Rentang agenda: "15 Nov 2026, 09.00 – 16.00 WIB" atau lintas hari */
export const formatEventRange = (start, end) => {
  const s = toDate(start);
  const e = toDate(end);
  if (!s) return '-';
  if (!e) return `${formatShortDate(s)}, ${formatTime(s)} WIB`;

  const sameDay = formatDate(s) === formatDate(e);
  if (sameDay) {
    return `${formatShortDate(s)}, ${formatTime(s)} – ${formatTime(e)} WIB`;
  }
  return `${formatShortDate(s)} ${formatTime(s)} – ${formatShortDate(e)} ${formatTime(e)} WIB`;
};

/** "baru saja", "5 menit lalu", "kemarin", "3 hari lalu", dst. */
export const formatRelative = (value) => {
  const d = toDate(value);
  if (!d) return '-';

  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

  if (Math.abs(diffSec) < 45) return 'baru saja';

  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSec) >= seconds) {
      return rtf.format(-Math.round(diffSec / seconds), unit);
    }
  }
  return rtf.format(-diffSec, 'second');
};

/** Nilai untuk <input type="datetime-local"> (waktu lokal browser) */
export const toDateTimeLocalInput = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "2026-11-15T09:00" -> "2026-11-15 09:00:00" (format DATETIME MySQL) */
export const toMysqlDateTime = (localInput) => {
  if (!localInput) return '';
  const [date, time = '00:00'] = localInput.split('T');
  return `${date} ${time.length === 5 ? `${time}:00` : time}`;
};

/** Nilai untuk <input type="date"> */
export const toDateInput = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const isPast = (value) => {
  const d = toDate(value);
  return d ? d.getTime() < Date.now() : false;
};

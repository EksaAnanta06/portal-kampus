// FILE: server/src/utils/timezone.js

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

const formatterCache = new Map();

const getFormatter = (timeZone) => {
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  if (!formatterCache.has(tz)) {
    formatterCache.set(
      tz,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }
  return formatterCache.get(tz);
};

export const isValidTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const resolveTimeZone = (timeZone) =>
  isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Mengonversi Date / ISO string / epoch ms menjadi UTC DATETIME MySQL ("YYYY-MM-DD HH:mm:ss").
 */
export const toUtcMysqlDatetime = (input) => {
  if (input === null || input === undefined || input === '') return null;
  let ms;
  if (typeof input === 'number') {
    ms = input;
  } else if (input instanceof Date) {
    ms = input.getTime();
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
      ms = Date.parse(`${normalized.replace(' ', 'T')}Z`);
    } else {
      ms = Date.parse(trimmed);
    }
  }
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(
    d.getUTCHours()
  )}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};

/**
 * Mengonversi nilai tanggal dari MySQL / JSON menjadi epoch ms UTC atau ISO UTC string.
 * Menangani string ISO '...Z', string 'YYYY-MM-DD HH:mm:ss', maupun Date hasil driver mysql2 (+07:00).
 */
export const toUtcMs = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    // Jika dibaca langsung dari mysql2 dengan timezone='+07:00', wall-clock UTC tersimpan bergeser +7 jam.
    // Query kami memakai DATE_FORMAT(..., '%Y-%m-%dT%H:%i:%sZ') sehingga path utama selalu string ISO UTC.
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str)) {
    const normalized = str.length === 16 ? `${str}:00` : str;
    const parsed = Date.parse(`${normalized.replace(' ', 'T')}Z`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(str);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toUtcIsoString = (value) => {
  const ms = toUtcMs(value);
  return ms === null ? null : new Date(ms).toISOString();
};

/**
 * Mengurai string "HH:MM" menjadi total menit sejak 00:00 (0..1439).
 */
export const parseHmToMinutes = (hm, fallbackMinutes = 0) => {
  if (typeof hm !== 'string') return fallbackMinutes;
  const match = hm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallbackMinutes;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallbackMinutes;
  }
  return h * 60 + m;
};

/**
 * Mengambil komponen waktu lokal user pada zona_waktu tertentu dari epoch UTC ms.
 */
export const getZonedParts = (utcMs, timeZone = DEFAULT_TIMEZONE) => {
  const parts = getFormatter(timeZone).formatToParts(new Date(utcMs));
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const hour = map.hour === 24 ? 0 : map.hour;
  const dateKey = `${map.year}-${pad2(map.month)}-${pad2(map.day)}`;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: map.minute,
    second: map.second,
    dateKey,
    minutesOfDay: hour * 60 + map.minute,
  };
};

/**
 * Menambah N hari kalender pada dateKey "YYYY-MM-DD".
 */
export const addDaysToDateKey = (dateKey, deltaDays) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
};

/**
 * Mengonversi waktu lokal (year, month, day, hour, minute, second) pada zona_waktu ke UTC epoch ms.
 */
export const zonedTimeToUtcMs = ({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = DEFAULT_TIMEZONE) => {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetAsUtc;
  for (let i = 0; i < 3; i += 1) {
    const p = getZonedParts(guess, timeZone);
    const seenAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = targetAsUtc - seenAsUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return guess;
};

export const dateKeyAndMinutesToUtcMs = (dateKey, minutesOfDay, timeZone = DEFAULT_TIMEZONE) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  return zonedTimeToUtcMs({ year, month, day, hour, minute, second: 0 }, timeZone);
};

/**
 * Menyesuaikan timestamp pengiriman pengingat agar tidak mengganggu jam tenang (quiet hours) user.
 * Mendukung jam tenang lintas malam (misal 22:00 - 07:00) maupun satu hari (misal 13:00 - 15:00).
 */
export const adjustForQuietHours = (utcMs, settings = {}) => {
  if (!Number.isFinite(utcMs)) return utcMs;
  const enabled = Boolean(settings.jam_tenang_aktif ?? true);
  if (!enabled) return utcMs;

  const tz = resolveTimeZone(settings.zona_waktu);
  const startMin = parseHmToMinutes(settings.jam_tenang_mulai, 22 * 60);
  const endMin = parseHmToMinutes(settings.jam_tenang_selesai, 7 * 60);

  if (startMin === endMin) return utcMs;

  const local = getZonedParts(utcMs, tz);
  const curMin = local.minutesOfDay;

  if (startMin > endMin) {
    // Lintas hari: misal 22:00 s/d 07:00
    if (curMin >= startMin) {
      const nextDateKey = addDaysToDateKey(local.dateKey, 1);
      return dateKeyAndMinutesToUtcMs(nextDateKey, endMin, tz);
    }
    if (curMin < endMin) {
      return dateKeyAndMinutesToUtcMs(local.dateKey, endMin, tz);
    }
    return utcMs;
  }

  // Hari yang sama: misal 12:00 s/d 14:00
  if (curMin >= startMin && curMin < endMin) {
    return dateKeyAndMinutesToUtcMs(local.dateKey, endMin, tz);
  }

  return utcMs;
};

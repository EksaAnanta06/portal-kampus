// FILE: server/src/queries/campus.queries.js
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { notificationHub } from '../services/notificationHub.js';

const columnExistsCache = new Map();
const ENUM_VALUE_REGEX = /'((?:[^'\\]|\\.|'')*)'/g;
let cachedNotificationEnumTypes = null;
const warnedMissingNotificationTypes = new Set();
let streamTableInitialized = false;
let streamTablePromise = null;

const truncateChars = (value, max) => Array.from(String(value ?? '')).slice(0, max).join('');

const isDataTruncationError = (err) =>
  err?.errno === 1265 ||
  err?.code === 'WARN_DATA_TRUNCATED' ||
  err?.code === 'ER_WARN_DATA_TRUNCATED';

const getNotificationEnumTypes = async (db = pool, forceRefresh = false) => {
  if (!forceRefresh && cachedNotificationEnumTypes) {
    return cachedNotificationEnumTypes;
  }

  try {
    const [rows] = await db.query(
      `SELECT DATA_TYPE, COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'
       LIMIT 1`
    );
    if (rows.length === 0) return null;

    if (String(rows[0].DATA_TYPE || '').toLowerCase() !== 'enum') {
      cachedNotificationEnumTypes = null;
      return null;
    }

    const colType = String(rows[0].COLUMN_TYPE || '');
    const values = new Set();
    for (const match of colType.matchAll(ENUM_VALUE_REGEX)) {
      values.add(match[1].replace(/\\'/g, "'").replace(/''/g, "'"));
    }

    if (values.size > 0) {
      cachedNotificationEnumTypes = values;
      return values;
    }
    return null;
  } catch {
    return null;
  }
};

export const hasTableColumn = async (tableName, columnName) => {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key);
  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [tableName, columnName]
    );
    const exists = rows.length > 0;
    columnExistsCache.set(key, exists);
    return exists;
  } catch {
    return false;
  }
};

export const createNotification = async (
  { userId, type, title, message, referenceLink = null },
  db = pool
) => {
  if (!userId) return;

  let resolvedType = String(type || 'system');
  let enumTypes = await getNotificationEnumTypes(db);

  if (enumTypes && !enumTypes.has(resolvedType)) {
    // Muat ulang metadata sekali siapa tahu migrasi 002 baru saja dijalankan.
    enumTypes = await getNotificationEnumTypes(db, true);
  }

  if (enumTypes && !enumTypes.has(resolvedType)) {
    if (!warnedMissingNotificationTypes.has(resolvedType)) {
      warnedMissingNotificationTypes.add(resolvedType);
      console.warn(
        `[DB Compat] Kolom notifications.type belum mendukung "${resolvedType}". Fallback ke "system". Jalankan database/migrations/002_hardening_fk_indexes_cloudinary_up.sql.`
      );
    }
    if (enumTypes.has('system')) {
      resolvedType = 'system';
    } else {
      return;
    }
  }

  const safeTitle = truncateChars(title, 150);
  const safeMessage = truncateChars(message, 300);
  const safeLink = referenceLink ? truncateChars(referenceLink, 255) : null;

  const publishInserted = (insertId, emittedType) => {
    if (!insertId) return;
    setImmediate(() => {
      notificationHub.publish(userId, {
        id: Number(insertId),
        user_id: Number(userId),
        type: emittedType,
        title: safeTitle,
        message: safeMessage,
        reference_link: safeLink,
        is_read: 0,
        created_at: new Date().toISOString(),
      });
    });
  };

  try {
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, reference_link)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, resolvedType, safeTitle, safeMessage, safeLink]
    );
    publishInserted(result?.insertId, resolvedType);
  } catch (err) {
    if (!isDataTruncationError(err)) {
      throw err;
    }
    cachedNotificationEnumTypes = null;
    if (resolvedType !== 'system') {
      try {
        const [fallbackRes] = await db.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_link)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, 'system', safeTitle, safeMessage, safeLink]
        );
        publishInserted(fallbackRes?.insertId, 'system');
        return;
      } catch (fallbackErr) {
        if (!isDataTruncationError(fallbackErr)) {
          throw fallbackErr;
        }
      }
    }
    console.warn(`[DB Compat] Notifikasi dilewati karena batas kolom DB: ${err.message}`);
  }
};

const hashStreamToken = (rawToken) =>
  crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');

export const ensureNotificationStreamTable = async () => {
  if (streamTableInitialized) return;
  if (streamTablePromise) return streamTablePromise;

  streamTablePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_stream_tokens (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        device_label VARCHAR(120) NULL,
        expires_at DATETIME NOT NULL,
        last_used_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_nst_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_nst_user (user_id),
        INDEX idx_nst_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    streamTableInitialized = true;
  })().catch((err) => {
    streamTablePromise = null;
    throw err;
  });

  return streamTablePromise;
};

export const createNotificationStreamToken = async (
  userId,
  { deviceLabel = null, ttlDays = 30 } = {}
) => {
  await ensureNotificationStreamTable();
  const safeTtlDays = Math.max(1, Math.min(90, Number(ttlDays) || 30));

  await pool.query(
    'DELETE FROM notification_stream_tokens WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()',
    [userId]
  );

  await pool.query(
    `DELETE n1 FROM notification_stream_tokens n1
     LEFT JOIN (
       SELECT id FROM notification_stream_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 9
     ) keep ON keep.id = n1.id
     WHERE n1.user_id = ? AND keep.id IS NULL`,
    [userId, userId]
  );

  const streamToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashStreamToken(streamToken);
  const safeLabel = deviceLabel ? truncateChars(deviceLabel, 120) : null;

  await pool.query(
    `INSERT INTO notification_stream_tokens (user_id, token_hash, device_label, expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
    [userId, tokenHash, safeLabel, safeTtlDays]
  );

  return {
    streamToken,
    expiresAt: new Date(Date.now() + safeTtlDays * 24 * 60 * 60 * 1000).toISOString(),
  };
};

export const findUserByNotificationStreamToken = async (rawToken) => {
  await ensureNotificationStreamTable();
  const trimmed = String(rawToken || '').trim();
  if (!trimmed) return null;

  const [rows] = await pool.query(
    `SELECT nst.id AS token_id, u.id, u.role, u.status
     FROM notification_stream_tokens nst
     INNER JOIN users u ON u.id = nst.user_id
     WHERE nst.token_hash = ? AND u.status = 'active' AND nst.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [hashStreamToken(trimmed)]
  );

  const row = rows[0];
  if (!row) return null;

  pool
    .query('UPDATE notification_stream_tokens SET last_used_at = UTC_TIMESTAMP() WHERE id = ?', [
      row.token_id,
    ])
    .catch(() => {});

  return { id: row.id, role: row.role, status: row.status };
};

export const revokeNotificationStreamToken = async (rawToken) => {
  await ensureNotificationStreamTable();
  const trimmed = String(rawToken || '').trim();
  if (!trimmed) return;
  await pool.query('DELETE FROM notification_stream_tokens WHERE token_hash = ?', [
    hashStreamToken(trimmed),
  ]);
};

export const revokeAllNotificationStreamTokensForUser = async (userId) => {
  await ensureNotificationStreamTable();
  await pool.query('DELETE FROM notification_stream_tokens WHERE user_id = ?', [userId]);
};

export const getLatestNotificationId = async (userId) => {
  const [rows] = await pool.query(
    'SELECT COALESCE(MAX(id), 0) AS latest_id FROM notifications WHERE user_id = ?',
    [userId]
  );
  return Number(rows[0]?.latest_id || 0);
};

export const getUnreadNotificationsAfterId = async (userId, afterId, limit = 20) => {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const [rows] = await pool.query(
    `SELECT id, user_id, type, title, message, reference_link, is_read, created_at
     FROM notifications
     WHERE user_id = ? AND is_read = 0 AND id > ?
     ORDER BY id ASC
     LIMIT ?`,
    [userId, Number(afterId) || 0, safeLimit]
  );
  return rows;
};

export const getUserNotifications = async (userId, limit = 25) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, type, title, message, reference_link, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, Number(limit)]
  );
  const [unreadRows] = await pool.query(
    `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
    [userId]
  );
  return { notifications: rows, unread_count: unreadRows[0].unread_count };
};

export const markNotificationsRead = async (userId, notificationId = null) => {
  if (notificationId) {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [
      notificationId,
      userId,
    ]);
  } else {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  }
};

export const listAnnouncementsQuery = async ({ category = '', search = '', page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let whereSql = 'WHERE 1=1';

  if (category) {
    whereSql += ' AND an.category = ?';
    params.push(category);
  }
  if (search) {
    whereSql += ' AND (an.title LIKE ? OR an.excerpt LIKE ? OR an.content LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const hasBannerPublicId = await hasTableColumn('announcements', 'banner_public_id');
  const bannerPidSelect = hasBannerPublicId
    ? 'an.banner_public_id'
    : 'NULL AS banner_public_id';

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM announcements an ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT an.id, an.title, an.slug, an.category, an.excerpt, an.content,
            an.banner_url, ${bannerPidSelect}, an.is_pinned, an.author_id,
            an.published_at, an.created_at, an.updated_at,
            u.full_name AS author_name
     FROM announcements an
     LEFT JOIN users u ON u.id = an.author_id
     ${whereSql}
     ORDER BY an.is_pinned DESC, an.published_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { rows, total: countRows[0].total };
};

export const getAnnouncementBySlugOrId = async (identifier) => {
  const hasBannerPublicId = await hasTableColumn('announcements', 'banner_public_id');
  const bannerPidSelect = hasBannerPublicId
    ? 'an.banner_public_id'
    : 'NULL AS banner_public_id';

  const [rows] = await pool.query(
    `SELECT an.id, an.title, an.slug, an.category, an.excerpt, an.content,
            an.banner_url, ${bannerPidSelect}, an.is_pinned, an.author_id,
            an.published_at, an.created_at, an.updated_at,
            u.full_name AS author_name
     FROM announcements an
     LEFT JOIN users u ON u.id = an.author_id
     WHERE an.slug = ? OR an.id = ?
     LIMIT 1`,
    [identifier, identifier]
  );
  return rows[0] || null;
};

export const createAnnouncementRecord = async ({
  title,
  slug,
  category,
  excerpt,
  content,
  banner_url,
  banner_public_id = null,
  is_pinned,
  author_id,
}) => {
  const hasBannerPublicId = await hasTableColumn('announcements', 'banner_public_id');
  if (hasBannerPublicId) {
    const [result] = await pool.query(
      `INSERT INTO announcements (title, slug, category, excerpt, content, banner_url, banner_public_id, is_pinned, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, category, excerpt, content, banner_url || null, banner_public_id || null, is_pinned ? 1 : 0, author_id]
    );
    return result.insertId;
  }

  const [result] = await pool.query(
    `INSERT INTO announcements (title, slug, category, excerpt, content, banner_url, is_pinned, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, category, excerpt, content, banner_url || null, is_pinned ? 1 : 0, author_id]
  );
  return result.insertId;
};

export const updateAnnouncementRecord = async (
  id,
  { title, category, excerpt, content, banner_url, banner_public_id, is_pinned }
) => {
  const hasBannerPublicId = await hasTableColumn('announcements', 'banner_public_id');
  if (hasBannerPublicId) {
    await pool.query(
      `UPDATE announcements
       SET title = ?, category = ?, excerpt = ?, content = ?, banner_url = ?, banner_public_id = ?, is_pinned = ?
       WHERE id = ?`,
      [title, category, excerpt, content, banner_url || null, banner_public_id ?? null, is_pinned ? 1 : 0, id]
    );
    return;
  }

  await pool.query(
    `UPDATE announcements
     SET title = ?, category = ?, excerpt = ?, content = ?, banner_url = ?, is_pinned = ?
     WHERE id = ?`,
    [title, category, excerpt, content, banner_url || null, is_pinned ? 1 : 0, id]
  );
};

export const deleteAnnouncementRecord = async (id) => {
  const [result] = await pool.query('DELETE FROM announcements WHERE id = ?', [id]);
  return result.affectedRows || 0;
};

export const listEventsQuery = async ({ upcomingOnly = false, limit = 20, userId = null }) => {
  const whereSql = upcomingOnly ? 'WHERE e.end_date >= NOW()' : '';
  const hasBannerPublicId = await hasTableColumn('events', 'banner_public_id');
  const bannerPidSelect = hasBannerPublicId ? 'e.banner_public_id' : 'NULL AS banner_public_id';

  const [rows] = await pool.query(
    `SELECT
        e.id, e.title, e.description, e.location, e.organizer,
        e.start_date, e.end_date, e.registration_link, e.banner_url, ${bannerPidSelect},
        e.created_by, e.created_at, e.updated_at,
        u.full_name AS creator_name,
        COALESCE(el_agg.like_count, 0) AS like_count,
        COALESCE(ec_agg.comment_count, 0) AS comment_count,
        IF(? IS NOT NULL AND EXISTS(SELECT 1 FROM event_likes el WHERE el.event_id = e.id AND el.user_id = ?), 1, 0) AS is_liked_by_me
     FROM events e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN (SELECT event_id, COUNT(*) AS like_count FROM event_likes GROUP BY event_id) el_agg ON el_agg.event_id = e.id
     LEFT JOIN (SELECT event_id, COUNT(*) AS comment_count FROM event_comments GROUP BY event_id) ec_agg ON ec_agg.event_id = e.id
     ${whereSql}
     ORDER BY e.start_date ASC
     LIMIT ?`,
    [userId, userId, Number(limit)]
  );
  return rows;
};

export const getEventByIdQuery = async (id, userId = null) => {
  const hasBannerPublicId = await hasTableColumn('events', 'banner_public_id');
  const bannerPidSelect = hasBannerPublicId ? 'e.banner_public_id' : 'NULL AS banner_public_id';

  const [rows] = await pool.query(
    `SELECT
        e.id, e.title, e.description, e.location, e.organizer,
        e.start_date, e.end_date, e.registration_link, e.banner_url, ${bannerPidSelect},
        e.created_by, e.created_at, e.updated_at,
        u.full_name AS creator_name,
        (SELECT COUNT(*) FROM event_likes el WHERE el.event_id = e.id) AS like_count,
        (SELECT COUNT(*) FROM event_comments ec WHERE ec.event_id = e.id) AS comment_count,
        IF(? IS NOT NULL AND EXISTS(SELECT 1 FROM event_likes el WHERE el.event_id = e.id AND el.user_id = ?), 1, 0) AS is_liked_by_me
     FROM events e
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.id = ?
     LIMIT 1`,
    [userId, userId, Number(id)]
  );
  return rows[0] || null;
};

export const createEventRecord = async ({
  title,
  description,
  location,
  organizer,
  start_date,
  end_date,
  registration_link,
  banner_url,
  banner_public_id = null,
  created_by,
}) => {
  const hasBannerPublicId = await hasTableColumn('events', 'banner_public_id');
  if (hasBannerPublicId) {
    const [result] = await pool.query(
      `INSERT INTO events (title, description, location, organizer, start_date, end_date, registration_link, banner_url, banner_public_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description,
        location,
        organizer,
        start_date,
        end_date,
        registration_link || null,
        banner_url || null,
        banner_public_id || null,
        created_by,
      ]
    );
    return result.insertId;
  }

  const [result] = await pool.query(
    `INSERT INTO events (title, description, location, organizer, start_date, end_date, registration_link, banner_url, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description,
      location,
      organizer,
      start_date,
      end_date,
      registration_link || null,
      banner_url || null,
      created_by,
    ]
  );
  return result.insertId;
};

export const updateEventRecord = async (
  id,
  {
    title,
    description,
    location,
    organizer,
    start_date,
    end_date,
    registration_link,
    banner_url,
    banner_public_id,
  }
) => {
  const hasBannerPublicId = await hasTableColumn('events', 'banner_public_id');
  if (hasBannerPublicId) {
    await pool.query(
      `UPDATE events
       SET title = ?, description = ?, location = ?, organizer = ?, start_date = ?, end_date = ?, registration_link = ?, banner_url = ?, banner_public_id = ?
       WHERE id = ?`,
      [
        title,
        description,
        location,
        organizer,
        start_date,
        end_date,
        registration_link || null,
        banner_url || null,
        banner_public_id ?? null,
        id,
      ]
    );
    return;
  }

  await pool.query(
    `UPDATE events
     SET title = ?, description = ?, location = ?, organizer = ?, start_date = ?, end_date = ?, registration_link = ?, banner_url = ?
     WHERE id = ?`,
    [
      title,
      description,
      location,
      organizer,
      start_date,
      end_date,
      registration_link || null,
      banner_url || null,
      id,
    ]
  );
};

export const deleteEventRecord = async (id) => {
  const [result] = await pool.query('DELETE FROM events WHERE id = ?', [id]);
  return result.affectedRows || 0;
};

// ---------------- EVENT LIKES ----------------
export const toggleEventLikeQuery = async (eventId, userId) => {
  const [existing] = await pool.execute(
    'SELECT id FROM event_likes WHERE event_id = ? AND user_id = ? LIMIT 1',
    [eventId, userId]
  );

  let liked = false;
  if (existing.length > 0) {
    await pool.execute('DELETE FROM event_likes WHERE id = ?', [existing[0].id]);
    liked = false;
  } else {
    await pool.execute('INSERT INTO event_likes (event_id, user_id) VALUES (?, ?)', [eventId, userId]);
    liked = true;
  }

  const [countRows] = await pool.execute(
    'SELECT COUNT(*) AS like_count FROM event_likes WHERE event_id = ?',
    [eventId]
  );

  return { liked, like_count: countRows[0].like_count };
};

export const getEventLikersQuery = async (eventId) => {
  const [rows] = await pool.execute(
    `SELECT
        el.id,
        el.user_id,
        el.created_at,
        u.full_name AS user_name,
        u.role AS user_role,
        u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan,
        u.avatar_url AS user_avatar
     FROM event_likes el
     INNER JOIN users u ON u.id = el.user_id
     WHERE el.event_id = ?
     ORDER BY el.created_at DESC`,
    [eventId]
  );
  return rows;
};

// ---------------- EVENT COMMENTS ----------------
export const getEventCommentsQuery = async (eventId) => {
  const [rows] = await pool.execute(
    `SELECT
        ec.id,
        ec.event_id,
        ec.user_id,
        ec.content,
        ec.created_at,
        ec.updated_at,
        u.full_name AS user_name,
        u.role AS user_role,
        u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan,
        u.avatar_url AS user_avatar
     FROM event_comments ec
     INNER JOIN users u ON u.id = ec.user_id
     WHERE ec.event_id = ?
     ORDER BY ec.created_at ASC`,
    [eventId]
  );
  return rows;
};

export const insertEventCommentRecord = async ({ eventId, userId, content }) => {
  const [result] = await pool.execute(
    'INSERT INTO event_comments (event_id, user_id, content) VALUES (?, ?, ?)',
    [eventId, userId, content]
  );

  const [rows] = await pool.execute(
    `SELECT
        ec.id, ec.event_id, ec.user_id, ec.content, ec.created_at, ec.updated_at,
        u.full_name AS user_name, u.role AS user_role, u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan, u.avatar_url AS user_avatar
     FROM event_comments ec
     INNER JOIN users u ON u.id = ec.user_id
     WHERE ec.id = ?`,
    [result.insertId]
  );
  return rows[0];
};

export const findEventCommentById = async (commentId) => {
  const [rows] = await pool.execute('SELECT * FROM event_comments WHERE id = ? LIMIT 1', [commentId]);
  return rows[0] || null;
};

export const updateEventCommentRecord = async (commentId, content) => {
  await pool.execute(
    'UPDATE event_comments SET content = ?, updated_at = NOW() WHERE id = ?',
    [content, commentId]
  );

  const [rows] = await pool.execute(
    `SELECT
        ec.id, ec.event_id, ec.user_id, ec.content, ec.created_at, ec.updated_at,
        u.full_name AS user_name, u.role AS user_role, u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan, u.avatar_url AS user_avatar
     FROM event_comments ec
     INNER JOIN users u ON u.id = ec.user_id
     WHERE ec.id = ?`,
    [commentId]
  );
  return rows[0];
};

export const deleteEventCommentById = async (commentId) => {
  await pool.execute('DELETE FROM event_comments WHERE id = ?', [commentId]);
};

export const getPublicHomeStats = async () => {
  const [[userCounts]] = await pool.query(
    `SELECT
        COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_users,
        COUNT(CASE WHEN status = 'active' AND role = 'mahasiswa' THEN 1 END) AS total_mahasiswa,
        COUNT(CASE WHEN status = 'active' AND role = 'alumni' THEN 1 END) AS total_alumni
     FROM users`
  );
  const [[photoCounts]] = await pool.query(
    `SELECT COUNT(*) AS approved_photos FROM photos WHERE status = 'approved'`
  );
  const [[angkatanCounts]] = await pool.query(
    `SELECT COUNT(*) AS total_angkatan FROM angkatan WHERE is_active = 1`
  );

  return {
    active_users: userCounts.active_users || 0,
    total_mahasiswa: userCounts.total_mahasiswa || 0,
    total_alumni: userCounts.total_alumni || 0,
    approved_photos: photoCounts.approved_photos || 0,
    total_angkatan: angkatanCounts.total_angkatan || 0,
  };
};

export const getAdminDashboardStats = async () => {
  const publicStats = await getPublicHomeStats();
  const [[moderationCounts]] = await pool.query(
    `SELECT
        (SELECT COUNT(*) FROM photos WHERE status = 'pending') AS pending_photos,
        (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending_users,
        (SELECT COUNT(*) FROM photo_reports WHERE status = 'open') AS open_reports,
        (SELECT COUNT(*) FROM announcements) AS total_announcements,
        (SELECT COUNT(*) FROM events) AS total_events,
        (SELECT COUNT(*) FROM materi WHERE status = 'pending') AS pending_materials,
        (SELECT COUNT(*) FROM mata_kuliah WHERE status = 'pending') AS pending_courses,
        (SELECT COUNT(*) FROM materi WHERE status = 'approved') AS total_materials,
        (SELECT COUNT(*) FROM mata_kuliah WHERE status = 'approved') AS total_courses,
        (SELECT COUNT(*) FROM materi_laporan WHERE status = 'pending') AS material_reports`
  );

  return {
    ...publicStats,
    ...moderationCounts,
  };
};

export const globalSearchQuery = async (keyword, { includeAuthenticatedData = false } = {}) => {
  const likeTerm = `%${keyword}%`;

  const [photos] = await pool.query(
    `SELECT p.id, p.url, p.caption, p.tags, a.year AS angkatan_year, u.full_name AS uploader_name
     FROM photos p
     INNER JOIN angkatan a ON a.id = p.angkatan_id
     INNER JOIN users u ON u.id = p.uploader_id
     WHERE p.status = 'approved' AND a.is_active = 1 AND (p.caption LIKE ? OR p.tags LIKE ?)
     ORDER BY p.created_at DESC
     LIMIT 6`,
    [likeTerm, likeTerm]
  );

  const [announcements] = await pool.query(
    `SELECT id, title, slug, category, excerpt, published_at
     FROM announcements
     WHERE title LIKE ? OR excerpt LIKE ? OR content LIKE ?
     ORDER BY published_at DESC
     LIMIT 5`,
    [likeTerm, likeTerm, likeTerm]
  );

  let users = [];
  let materials = [];
  let courses = [];

  if (includeAuthenticatedData) {
    const [uRows] = await pool.query(
      `SELECT id, nim, full_name, role, prodi, angkatan_year, avatar_url, current_job
       FROM users
       WHERE status = 'active' AND is_public_profile = 1
         AND (full_name LIKE ? OR nim LIKE ? OR prodi LIKE ?)
       ORDER BY full_name ASC
       LIMIT 6`,
      [likeTerm, likeTerm, likeTerm]
    );
    users = uRows;

    const [mRows] = await pool.query(
      `SELECT m.id, m.judul, m.tipe_materi, m.mata_kuliah_id, mk.kode AS mk_kode, mk.nama AS mk_nama,
              p.nama AS prodi_nama, u.full_name AS uploader_name
       FROM materi m
       INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
       LEFT JOIN prodi p ON p.id = mk.prodi_id
       LEFT JOIN users u ON u.id = m.uploaded_by
       WHERE m.status = 'approved' AND m.is_published = 1 AND mk.status = 'approved'
         AND (m.judul LIKE ? OR m.tags LIKE ? OR mk.nama LIKE ?)
       ORDER BY m.created_at DESC
       LIMIT 6`,
      [likeTerm, likeTerm, likeTerm]
    );
    materials = mRows;

    const [cRows] = await pool.query(
      `SELECT mk.id, mk.kode, mk.nama, mk.semester_rekomendasi, p.nama AS prodi_nama
       FROM mata_kuliah mk
       LEFT JOIN prodi p ON p.id = mk.prodi_id
       WHERE mk.status = 'approved' AND (mk.nama LIKE ? OR mk.kode LIKE ?)
       ORDER BY mk.semester_rekomendasi ASC, mk.nama ASC
       LIMIT 6`,
      [likeTerm, likeTerm]
    );
    courses = cRows;
  } else {
    // Tamu tidak menerima NIM maupun pencarian berbasis NIM
    const [uRows] = await pool.query(
      `SELECT id, full_name, role, prodi, angkatan_year, avatar_url, current_job
       FROM users
       WHERE status = 'active' AND is_public_profile = 1
         AND (full_name LIKE ? OR prodi LIKE ?)
       ORDER BY full_name ASC
       LIMIT 6`,
      [likeTerm, likeTerm]
    );
    users = uRows;
  }

  return { photos, announcements, users, materials, courses };
};

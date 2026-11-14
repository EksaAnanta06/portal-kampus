// FILE: server/src/queries/campus.queries.js
import { pool } from '../config/db.js';

export const createNotification = async ({ userId, type, title, message, referenceLink = null }) => {
  if (!userId) return;
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, reference_link)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, message, referenceLink]
  );
};

export const getUserNotifications = async (userId, limit = 25) => {
  const [rows] = await pool.query(
    `SELECT * FROM notifications
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

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM announcements an ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT an.*, u.full_name AS author_name
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
  const [rows] = await pool.query(
    `SELECT an.*, u.full_name AS author_name
     FROM announcements an
     LEFT JOIN users u ON u.id = an.author_id
     WHERE an.slug = ? OR an.id = ?
     LIMIT 1`,
    [identifier, identifier]
  );
  return rows[0] || null;
};

export const createAnnouncementRecord = async ({ title, slug, category, excerpt, content, banner_url, is_pinned, author_id }) => {
  const [result] = await pool.query(
    `INSERT INTO announcements (title, slug, category, excerpt, content, banner_url, is_pinned, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, category, excerpt, content, banner_url || null, is_pinned ? 1 : 0, author_id]
  );
  return result.insertId;
};

export const updateAnnouncementRecord = async (id, { title, category, excerpt, content, banner_url, is_pinned }) => {
  await pool.query(
    `UPDATE announcements
     SET title = ?, category = ?, excerpt = ?, content = ?, banner_url = ?, is_pinned = ?
     WHERE id = ?`,
    [title, category, excerpt, content, banner_url || null, is_pinned ? 1 : 0, id]
  );
};

export const deleteAnnouncementRecord = async (id) => {
  await pool.query('DELETE FROM announcements WHERE id = ?', [id]);
};

export const listEventsQuery = async ({ upcomingOnly = false, limit = 20, userId = null }) => {
  const whereSql = upcomingOnly ? 'WHERE e.end_date >= NOW()' : '';
  const [rows] = await pool.query(
    `SELECT
        e.*,
        u.full_name AS creator_name,
        (SELECT COUNT(*) FROM event_likes el WHERE el.event_id = e.id) AS like_count,
        (SELECT COUNT(*) FROM event_comments ec WHERE ec.event_id = e.id) AS comment_count,
        IF(? IS NOT NULL AND EXISTS(SELECT 1 FROM event_likes el WHERE el.event_id = e.id AND el.user_id = ?), 1, 0) AS is_liked_by_me
     FROM events e
     LEFT JOIN users u ON u.id = e.created_by
     ${whereSql}
     ORDER BY e.start_date ASC
     LIMIT ?`,
    [userId, userId, Number(limit)]
  );
  return rows;
};

export const getEventByIdQuery = async (id, userId = null) => {
  const [rows] = await pool.query(
    `SELECT
        e.*,
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
  created_by,
}) => {
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
  { title, description, location, organizer, start_date, end_date, registration_link, banner_url }
) => {
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
  await pool.query('DELETE FROM events WHERE id = ?', [id]);
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

export const globalSearchQuery = async (keyword) => {
  const likeTerm = `%${keyword}%`;

  const [photos] = await pool.query(
    `SELECT p.id, p.url, p.caption, p.tags, a.year AS angkatan_year, u.full_name AS uploader_name
     FROM photos p
     INNER JOIN angkatan a ON a.id = p.angkatan_id
     INNER JOIN users u ON u.id = p.uploader_id
     WHERE p.status = 'approved' AND (p.caption LIKE ? OR p.tags LIKE ?)
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

  const [users] = await pool.query(
    `SELECT id, nim, full_name, role, prodi, angkatan_year, avatar_url, current_job
     FROM users
     WHERE status = 'active' AND is_public_profile = 1
       AND (full_name LIKE ? OR nim LIKE ? OR prodi LIKE ?)
     ORDER BY full_name ASC
     LIMIT 6`,
    [likeTerm, likeTerm, likeTerm]
  );

  return { photos, announcements, users };
};

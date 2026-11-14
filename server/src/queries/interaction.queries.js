// FILE: server/src/queries/interaction.queries.js
import { pool } from '../config/db.js';

export const togglePhotoLikeQuery = async (photoId, userId) => {
  const [existing] = await pool.execute(
    'SELECT id FROM photo_likes WHERE photo_id = ? AND user_id = ? LIMIT 1',
    [photoId, userId]
  );

  let liked = false;
  if (existing.length > 0) {
    await pool.execute('DELETE FROM photo_likes WHERE id = ?', [existing[0].id]);
    liked = false;
  } else {
    await pool.execute('INSERT INTO photo_likes (photo_id, user_id) VALUES (?, ?)', [photoId, userId]);
    liked = true;
  }

  const [countRows] = await pool.execute(
    'SELECT COUNT(*) AS like_count FROM photo_likes WHERE photo_id = ?',
    [photoId]
  );

  return { liked, like_count: countRows[0].like_count };
};

export const getPhotoLikersQuery = async (photoId) => {
  const [rows] = await pool.execute(
    `SELECT
        pl.id,
        pl.user_id,
        pl.created_at,
        u.full_name AS user_name,
        u.role AS user_role,
        u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan,
        u.avatar_url AS user_avatar
     FROM photo_likes pl
     INNER JOIN users u ON u.id = pl.user_id
     WHERE pl.photo_id = ?
     ORDER BY pl.created_at DESC`,
    [photoId]
  );
  return rows;
};

export const getCommentsByPhotoId = async (photoId) => {
  const [rows] = await pool.execute(
    `SELECT
        pc.id,
        pc.photo_id,
        pc.user_id,
        pc.content,
        pc.created_at,
        pc.updated_at,
        u.full_name AS user_name,
        u.role AS user_role,
        u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan,
        u.avatar_url AS user_avatar
     FROM photo_comments pc
     INNER JOIN users u ON u.id = pc.user_id
     WHERE pc.photo_id = ?
     ORDER BY pc.created_at ASC`,
    [photoId]
  );
  return rows;
};

export const insertCommentRecord = async ({ photoId, userId, content }) => {
  const [result] = await pool.execute(
    'INSERT INTO photo_comments (photo_id, user_id, content) VALUES (?, ?, ?)',
    [photoId, userId, content]
  );

  const [rows] = await pool.execute(
    `SELECT
        pc.id, pc.photo_id, pc.user_id, pc.content, pc.created_at,
        u.full_name AS user_name, u.role AS user_role, u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan, u.avatar_url AS user_avatar
     FROM photo_comments pc
     INNER JOIN users u ON u.id = pc.user_id
     WHERE pc.id = ?`,
    [result.insertId]
  );
  return rows[0];
};

export const findCommentById = async (commentId) => {
  const [rows] = await pool.execute('SELECT * FROM photo_comments WHERE id = ? LIMIT 1', [commentId]);
  return rows[0] || null;
};

export const updateCommentRecord = async (commentId, content) => {
  await pool.execute(
    'UPDATE photo_comments SET content = ?, updated_at = NOW() WHERE id = ?',
    [content, commentId]
  );

  const [rows] = await pool.execute(
    `SELECT
        pc.id, pc.photo_id, pc.user_id, pc.content, pc.created_at, pc.updated_at,
        u.full_name AS user_name, u.role AS user_role, u.prodi AS user_prodi,
        u.angkatan_year AS user_angkatan, u.avatar_url AS user_avatar
     FROM photo_comments pc
     INNER JOIN users u ON u.id = pc.user_id
     WHERE pc.id = ?`,
    [commentId]
  );
  return rows[0];
};

export const deleteCommentById = async (commentId) => {
  await pool.execute('DELETE FROM photo_comments WHERE id = ?', [commentId]);
};

export const createPhotoReportRecord = async ({ photoId, reporterId, reason, description }) => {
  const [result] = await pool.execute(
    `INSERT INTO photo_reports (photo_id, reporter_id, reason, description)
     VALUES (?, ?, ?, ?)`,
    [photoId, reporterId, reason, description || null]
  );
  return result.insertId;
};

export const listPhotoReportsQuery = async (status = 'open') => {
  const [rows] = await pool.execute(
    `SELECT
        pr.*,
        p.url AS photo_url,
        p.caption AS photo_caption,
        p.status AS photo_status,
        a.year AS angkatan_year,
        u.full_name AS reporter_name,
        u.nim AS reporter_nim
     FROM photo_reports pr
     INNER JOIN photos p ON p.id = pr.photo_id
     INNER JOIN angkatan a ON a.id = p.angkatan_id
     INNER JOIN users u ON u.id = pr.reporter_id
     WHERE (? = 'all' OR pr.status = ?)
     ORDER BY pr.created_at DESC`,
    [status, status]
  );
  return rows;
};

export const resolvePhotoReportRecord = async (reportId, { status, resolvedBy }) => {
  await pool.execute(
    `UPDATE photo_reports
     SET status = ?, resolved_by = ?, resolved_at = NOW()
     WHERE id = ?`,
    [status, resolvedBy, reportId]
  );
};

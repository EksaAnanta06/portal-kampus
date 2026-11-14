// FILE: server/src/queries/photo.queries.js
import { pool } from '../config/db.js';

export const listPhotosQuery = async ({
  angkatanId = null,
  angkatanYear = null,
  albumId = null,
  uploaderId = null,
  status = 'approved',
  search = '',
  tag = '',
  currentUserId = null,
  page = 1,
  limit = 12,
}) => {
  const offset = (page - 1) * limit;
  const params = [];
  let whereSql = 'WHERE 1=1';

  if (status) {
    whereSql += ' AND p.status = ?';
    params.push(status);
  }
  if (angkatanId) {
    whereSql += ' AND p.angkatan_id = ?';
    params.push(Number(angkatanId));
  }
  if (angkatanYear) {
    whereSql += ' AND a.year = ?';
    params.push(Number(angkatanYear));
  }
  if (albumId) {
    whereSql += ' AND p.album_id = ?';
    params.push(Number(albumId));
  }
  if (uploaderId) {
    whereSql += ' AND p.uploader_id = ?';
    params.push(Number(uploaderId));
  }
  if (search) {
    whereSql += ' AND (p.caption LIKE ? OR p.tags LIKE ? OR u.full_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (tag) {
    whereSql += ' AND FIND_IN_SET(?, REPLACE(p.tags, " ", "")) > 0';
    params.push(tag);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM photos p
     INNER JOIN angkatan a ON a.id = p.angkatan_id
     INNER JOIN users u ON u.id = p.uploader_id
     ${whereSql}`,
    params
  );

  const selectLikedExpr = currentUserId
    ? `EXISTS(SELECT 1 FROM photo_likes pl2 WHERE pl2.photo_id = p.id AND pl2.user_id = ${Number(currentUserId)})`
    : '0';

  const [rows] = await pool.query(
    `SELECT
        p.id,
        p.cloudinary_public_id,
        p.url,
        p.width,
        p.height,
        p.format,
        p.caption,
        p.tags,
        p.taken_date,
        p.status,
        p.rejection_reason,
        p.uploader_id,
        p.angkatan_id,
        p.album_id,
        p.created_at,
        a.year AS angkatan_year,
        a.title AS angkatan_title,
        al.name AS album_name,
        al.slug AS album_slug,
        u.full_name AS uploader_name,
        u.nim AS uploader_nim,
        u.prodi AS uploader_prodi,
        u.avatar_url AS uploader_avatar,
        (SELECT COUNT(*) FROM photo_likes pl WHERE pl.photo_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM photo_comments pc WHERE pc.photo_id = p.id) AS comment_count,
        ${selectLikedExpr} AS is_liked_by_me
     FROM photos p
     INNER JOIN angkatan a ON a.id = p.angkatan_id
     INNER JOIN users u ON u.id = p.uploader_id
     LEFT JOIN albums al ON al.id = p.album_id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { rows, total: countRows[0].total };
};

export const insertPhotoRecord = async ({
  cloudinary_public_id,
  url,
  width,
  height,
  format,
  bytes,
  caption,
  tags,
  taken_date,
  status,
  uploader_id,
  angkatan_id,
  album_id,
  moderated_by = null,
  moderated_at = null,
}) => {
  const [result] = await pool.query(
    `INSERT INTO photos (
      cloudinary_public_id, url, width, height, format, bytes,
      caption, tags, taken_date, status, uploader_id, angkatan_id, album_id,
      moderated_by, moderated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cloudinary_public_id,
      url,
      width || null,
      height || null,
      format || null,
      bytes || null,
      caption,
      tags || null,
      taken_date || null,
      status,
      uploader_id,
      angkatan_id,
      album_id || null,
      moderated_by,
      moderated_at,
    ]
  );
  return result.insertId;
};

export const findPhotoById = async (photoId, currentUserId = null) => {
  const selectLikedExpr = currentUserId
    ? `EXISTS(SELECT 1 FROM photo_likes pl2 WHERE pl2.photo_id = p.id AND pl2.user_id = ${Number(currentUserId)})`
    : '0';

  const [rows] = await pool.query(
    `SELECT
        p.*,
        a.year AS angkatan_year,
        a.title AS angkatan_title,
        al.name AS album_name,
        u.full_name AS uploader_name,
        u.nim AS uploader_nim,
        u.prodi AS uploader_prodi,
        u.avatar_url AS uploader_avatar,
        (SELECT COUNT(*) FROM photo_likes pl WHERE pl.photo_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM photo_comments pc WHERE pc.photo_id = p.id) AS comment_count,
        ${selectLikedExpr} AS is_liked_by_me
     FROM photos p
     INNER JOIN angkatan a ON a.id = p.angkatan_id
     INNER JOIN users u ON u.id = p.uploader_id
     LEFT JOIN albums al ON al.id = p.album_id
     WHERE p.id = ?
     LIMIT 1`,
    [photoId]
  );
  return rows[0] || null;
};

export const updatePhotoRecord = async (photoId, { caption, album_id, tags }) => {
  await pool.query(
    `UPDATE photos
     SET caption = ?, album_id = ?, tags = ?
     WHERE id = ?`,
    [caption, album_id ?? null, tags ?? null, photoId]
  );
};

export const moderatePhotoRecord = async (photoId, { status, rejection_reason, moderated_by }) => {
  await pool.query(
    `UPDATE photos
     SET status = ?, rejection_reason = ?, moderated_by = ?, moderated_at = NOW()
     WHERE id = ?`,
    [status, rejection_reason || null, moderated_by, photoId]
  );
};

export const deletePhotoRecord = async (photoId) => {
  await pool.query('DELETE FROM photos WHERE id = ?', [photoId]);
};

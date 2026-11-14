// FILE: server/src/queries/angkatan.queries.js
import { pool } from '../config/db.js';

export const getAllAngkatanWithStats = async () => {
  const [rows] = await pool.execute(
    `SELECT
        a.id,
        a.year,
        a.title,
        a.description,
        COALESCE(
          a.cover_url,
          (SELECT p2.url FROM photos p2 WHERE p2.angkatan_id = a.id AND p2.status = 'approved' ORDER BY p2.created_at DESC LIMIT 1)
        ) AS cover_url,
        a.cover_public_id,
        COUNT(DISTINCT CASE WHEN p.status = 'approved' THEN p.id END) AS photo_count,
        COUNT(DISTINCT CASE WHEN p.status = 'approved' THEN p.uploader_id END) AS contributor_count,
        (SELECT COUNT(*) FROM users u WHERE u.angkatan_year = a.year AND u.status = 'active') AS member_count,
        (SELECT COUNT(*) FROM albums al WHERE al.angkatan_id = a.id) AS album_count
     FROM angkatan a
     LEFT JOIN photos p ON p.angkatan_id = a.id
     WHERE a.is_active = 1
     GROUP BY a.id
     ORDER BY a.year DESC`
  );
  return rows;
};

export const getAngkatanByYearOrId = async (identifier) => {
  const [rows] = await pool.execute(
    `SELECT
        a.*,
        COUNT(DISTINCT CASE WHEN p.status = 'approved' THEN p.id END) AS photo_count,
        COUNT(DISTINCT CASE WHEN p.status = 'approved' THEN p.uploader_id END) AS contributor_count,
        (SELECT COUNT(*) FROM users u WHERE u.angkatan_year = a.year AND u.status = 'active') AS member_count
     FROM angkatan a
     LEFT JOIN photos p ON p.angkatan_id = a.id
     WHERE a.year = ? OR a.id = ?
     GROUP BY a.id
     LIMIT 1`,
    [identifier, identifier]
  );
  return rows[0] || null;
};

export const createAngkatanRecord = async ({ year, title, description, cover_url = null, cover_public_id = null }) => {
  const [result] = await pool.execute(
    `INSERT INTO angkatan (year, title, description, cover_url, cover_public_id)
     VALUES (?, ?, ?, ?, ?)`,
    [year, title, description || null, cover_url, cover_public_id]
  );
  return result.insertId;
};

export const updateAngkatanRecord = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  await pool.execute(`UPDATE angkatan SET ${setClause} WHERE id = ?`, [...values, id]);
};

export const deleteAngkatanRecord = async (id) => {
  await pool.execute(`UPDATE angkatan SET is_active = 0 WHERE id = ?`, [id]);
};

// FILE: server/src/queries/album.queries.js
import { pool } from '../config/db.js';

export const getAlbumsByAngkatanId = async (angkatanId) => {
  const [rows] = await pool.execute(
    `SELECT
        al.id,
        al.angkatan_id,
        al.name,
        al.slug,
        al.description,
        al.created_by,
        al.created_at,
        COUNT(CASE WHEN p.status = 'approved' THEN p.id END) AS photo_count
     FROM albums al
     LEFT JOIN photos p ON p.album_id = al.id
     WHERE al.angkatan_id = ?
     GROUP BY al.id
     ORDER BY al.name ASC`,
    [angkatanId]
  );
  return rows;
};

export const getAlbumById = async (id) => {
  const [rows] = await pool.execute('SELECT * FROM albums WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

export const createAlbumRecord = async ({ angkatan_id, name, slug, description, created_by }) => {
  const [result] = await pool.execute(
    `INSERT INTO albums (angkatan_id, name, slug, description, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [angkatan_id, name, slug, description || null, created_by]
  );
  return result.insertId;
};

export const updateAlbumRecord = async (id, { name, slug, description }) => {
  const fields = [];
  const values = [];
  if (name !== undefined) {
    fields.push('name = ?');
    values.push(name);
  }
  if (slug !== undefined) {
    fields.push('slug = ?');
    values.push(slug);
  }
  if (description !== undefined) {
    fields.push('description = ?');
    values.push(description);
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE albums SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const deleteAlbumById = async (id) => {
  await pool.execute('DELETE FROM albums WHERE id = ?', [id]);
};

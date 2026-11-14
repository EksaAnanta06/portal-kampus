// FILE: server/src/queries/user.queries.js
import { pool } from '../config/db.js';

export const getPublicDirectoryUsers = async ({ search = '', angkatan = '', prodi = '', role = '', page = 1, limit = 12 }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let whereSql = `WHERE u.status = 'active' AND u.is_public_profile = 1`;

  if (search) {
    whereSql += ` AND (u.full_name LIKE ? OR u.nim LIKE ? OR u.current_job LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (angkatan) {
    whereSql += ` AND u.angkatan_year = ?`;
    params.push(Number(angkatan));
  }
  if (prodi) {
    whereSql += ` AND u.prodi = ?`;
    params.push(prodi);
  }
  if (role && ['mahasiswa', 'alumni', 'moderator', 'admin'].includes(role)) {
    whereSql += ` AND u.role = ?`;
    params.push(role);
  }

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT u.id, u.nim, u.full_name, u.role, u.prodi, u.angkatan_year,
            u.avatar_url, u.bio, u.current_job, u.linkedin_url, u.instagram_url, u.github_url,
            (SELECT COUNT(*) FROM photos p WHERE p.uploader_id = u.id AND p.status = 'approved') AS total_photos
     FROM users u
     ${whereSql}
     ORDER BY u.angkatan_year DESC, u.full_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { rows, total };
};

export const getAdminUsersList = async ({ status = '', search = '', page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const params = [];
  let whereSql = 'WHERE 1=1';

  if (status) {
    whereSql += ' AND u.status = ?';
    params.push(status);
  }
  if (search) {
    whereSql += ' AND (u.full_name LIKE ? OR u.nim LIKE ? OR u.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT u.id, u.nim, u.full_name, u.email, u.role, u.status, u.prodi, u.angkatan_year,
            u.avatar_url, u.verified_at, u.created_at
     FROM users u
     ${whereSql}
     ORDER BY FIELD(u.status, 'pending', 'active', 'suspended', 'rejected'), u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { rows, total: countRows[0].total };
};

export const updateUserProfileById = async (userId, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, userId]);
};

export const getUserAvatarInfo = async (userId) => {
  const [rows] = await pool.query('SELECT avatar_url, avatar_public_id FROM users WHERE id = ?', [userId]);
  return rows[0] || null;
};

export const getUserProfileDetailQuery = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.nim, u.full_name, u.role, u.status, u.prodi, u.angkatan_year,
            u.avatar_url, u.bio, u.current_job, u.linkedin_url, u.instagram_url, u.github_url,
            u.created_at, u.verified_at,
            (SELECT COUNT(*) FROM photos p WHERE p.uploader_id = u.id AND p.status = 'approved') AS total_photos
     FROM users u
     WHERE u.id = ? AND u.status = 'active'
     LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;

  const user = rows[0];
  const [photos] = await pool.query(
    `SELECT p.id, p.url, p.caption, a.year AS angkatan_year, p.created_at
     FROM photos p
     INNER JOIN angkatan a ON a.id = p.angkatan_id
     WHERE p.uploader_id = ? AND p.status = 'approved'
     ORDER BY p.created_at DESC
     LIMIT 12`,
    [userId]
  );

  return { ...user, photos };
};

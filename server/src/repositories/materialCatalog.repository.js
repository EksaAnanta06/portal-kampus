// FILE: server/src/repositories/materialCatalog.repository.js
import { pool } from '../config/db.js';

export const getProdiList = async (db = pool) => {
  const [rows] = await db.query(
    'SELECT id, kode, nama, jenjang, fakultas, created_at FROM prodi ORDER BY id ASC'
  );
  return rows;
};

export const getProdiById = async (prodiId, db = pool) => {
  const [rows] = await db.query(
    'SELECT id, kode, nama, jenjang, fakultas FROM prodi WHERE id = ? LIMIT 1',
    [prodiId]
  );
  return rows[0] || null;
};

export const findProdiByKode = async (kode, db = pool) => {
  const [rows] = await db.query('SELECT id FROM prodi WHERE kode = ? LIMIT 1', [kode]);
  return rows[0] || null;
};

export const createProdi = async ({ kode, nama, jenjang = 'S1', fakultas }, db = pool) => {
  const [result] = await db.query(
    'INSERT INTO prodi (kode, nama, jenjang, fakultas) VALUES (?, ?, ?, ?)',
    [kode, nama, jenjang, fakultas]
  );
  return result.insertId;
};

export const getCourses = async (
  { prodiId = null, semester = null, search = '', status = null, all = false, isStaff = false },
  db = pool
) => {
  const params = [];
  const whereClauses = [];

  if (!isStaff) {
    whereClauses.push("mk.status = 'approved'");
  } else if (status) {
    whereClauses.push('mk.status = ?');
    params.push(status);
  } else if (!all) {
    whereClauses.push("mk.status = 'approved'");
  }

  if (prodiId) {
    whereClauses.push('(mk.prodi_id = ? OR mk.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (semester) {
    whereClauses.push('mk.semester_rekomendasi = ?');
    params.push(Number(semester));
  }

  if (search && search.trim()) {
    whereClauses.push('(mk.nama LIKE ? OR mk.kode LIKE ? OR mk.deskripsi LIKE ?)');
    const kw = `%${search.trim()}%`;
    params.push(kw, kw, kw);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      mk.id,
      mk.kode,
      mk.nama,
      mk.sks,
      mk.prodi_id,
      mk.semester_rekomendasi,
      mk.deskripsi,
      mk.status,
      mk.proposed_by,
      mk.created_at,
      mk.updated_at,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u_prop.full_name AS proposer_nama,
      COALESCE(mat_stats.total_materials, 0) AS total_materials
    FROM mata_kuliah mk
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u_prop ON u_prop.id = mk.proposed_by
    LEFT JOIN (
      SELECT mata_kuliah_id, COUNT(*) AS total_materials
      FROM materi
      WHERE status = 'approved' AND is_published = 1
      GROUP BY mata_kuliah_id
    ) mat_stats ON mat_stats.mata_kuliah_id = mk.id
    ${whereSql}
    ORDER BY mk.semester_rekomendasi ASC, mk.kode ASC
  `;

  const [rows] = await db.query(sql, params);
  return rows;
};

export const getCourseById = async (courseId, db = pool) => {
  const sql = `
    SELECT
      mk.id,
      mk.kode,
      mk.nama,
      mk.sks,
      mk.prodi_id,
      mk.semester_rekomendasi,
      mk.deskripsi,
      mk.status,
      mk.proposed_by,
      mk.created_at,
      mk.updated_at,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      (SELECT COUNT(*) FROM materi m WHERE m.mata_kuliah_id = mk.id AND m.status = 'approved' AND m.is_published = 1) AS total_materials
    FROM mata_kuliah mk
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    WHERE mk.id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [courseId]);
  return rows[0] || null;
};

export const findCourseByKode = async (kode, excludeId = null, db = pool) => {
  const params = [kode];
  let sql = 'SELECT id FROM mata_kuliah WHERE kode = ?';
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
};

export const createCourse = async (
  { kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi = '', status = 'pending', proposed_by = null },
  db = pool
) => {
  const [result] = await db.query(
    `INSERT INTO mata_kuliah (kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status, proposed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [kode, nama, sks, prodi_id ?? null, semester_rekomendasi, deskripsi, status, proposed_by]
  );
  return result.insertId;
};

export const updateCourse = async (courseId, updateFields, db = pool) => {
  const allowedKeys = [
    'kode',
    'nama',
    'sks',
    'prodi_id',
    'semester_rekomendasi',
    'deskripsi',
    'status',
  ];
  const keys = Object.keys(updateFields).filter((k) => allowedKeys.includes(k) && updateFields[k] !== undefined);
  if (keys.length === 0) return false;

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => updateFields[k]);
  values.push(courseId);

  const [result] = await db.query(`UPDATE mata_kuliah SET ${setClauses} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

export const updateCourseStatus = async (courseId, status, db = pool) => {
  const [result] = await db.query('UPDATE mata_kuliah SET status = ? WHERE id = ?', [status, courseId]);
  return result.affectedRows > 0;
};

export const countCourseDependencies = async (courseId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM materi WHERE mata_kuliah_id = ?) AS materials_count,
       (SELECT COUNT(*) FROM materi_request WHERE mata_kuliah_id = ?) AS requests_count`,
    [courseId, courseId]
  );
  return rows[0] || { materials_count: 0, requests_count: 0 };
};

export const deleteCourse = async (courseId, db = pool) => {
  const [result] = await db.query('DELETE FROM mata_kuliah WHERE id = ?', [courseId]);
  return result.affectedRows > 0;
};

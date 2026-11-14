// FILE: server/src/repositories/materialSocial.repository.js
import { pool } from '../config/db.js';

// ============================================================================
// VOTE BERMANFAAT & KOMENTAR
// ============================================================================

export const toggleMaterialVote = async (materialId, userId, db = pool) => {
  const [existing] = await db.query(
    'SELECT id FROM materi_vote WHERE materi_id = ? AND user_id = ? LIMIT 1',
    [materialId, userId]
  );

  if (existing.length > 0) {
    await db.query('DELETE FROM materi_vote WHERE id = ?', [existing[0].id]);
    return { voted: false };
  }

  await db.query('INSERT INTO materi_vote (materi_id, user_id) VALUES (?, ?)', [
    materialId,
    userId,
  ]);
  return { voted: true };
};

export const getMaterialComments = async (materialId, db = pool) => {
  const sql = `
    SELECT
      mk.id,
      mk.materi_id,
      mk.user_id,
      mk.parent_id,
      mk.konten,
      mk.created_at,
      mk.updated_at,
      u.full_name AS user_nama,
      u.role AS user_role,
      u.angkatan_year AS user_angkatan,
      u.avatar_url AS user_avatar
    FROM materi_komentar mk
    INNER JOIN users u ON u.id = mk.user_id
    WHERE mk.materi_id = ?
    ORDER BY mk.created_at ASC
  `;
  const [rows] = await db.query(sql, [materialId]);
  return rows;
};

export const getCommentById = async (commentId, db = pool) => {
  const [rows] = await db.query(
    'SELECT id, materi_id, user_id FROM materi_komentar WHERE id = ? LIMIT 1',
    [commentId]
  );
  return rows[0] || null;
};

export const createMaterialComment = async (
  { materialId, userId, parentId = null, konten },
  db = pool
) => {
  const [result] = await db.query(
    'INSERT INTO materi_komentar (materi_id, user_id, parent_id, konten) VALUES (?, ?, ?, ?)',
    [materialId, userId, parentId, konten]
  );
  return result.insertId;
};

export const deleteMaterialComment = async (commentId, userId, isStaff = false, db = pool) => {
  let sql = 'DELETE FROM materi_komentar WHERE id = ?';
  const params = [commentId];
  if (!isStaff) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  const [result] = await db.query(sql, params);
  return result.affectedRows > 0;
};

// ============================================================================
// LAPORAN MATERI & LEADERBOARD
// ============================================================================

export const findMaterialReportByReporter = async (materialId, reporterId, db = pool) => {
  const [rows] = await db.query(
    'SELECT id, status FROM materi_laporan WHERE materi_id = ? AND reporter_id = ? LIMIT 1',
    [materialId, reporterId]
  );
  return rows[0] || null;
};

export const createMaterialReport = async (
  { materialId, reporterId, alasan, deskripsi = '' },
  db = pool
) => {
  const [result] = await db.query(
    'INSERT INTO materi_laporan (materi_id, reporter_id, alasan, deskripsi) VALUES (?, ?, ?, ?)',
    [materialId, reporterId, alasan, deskripsi]
  );
  return result.insertId;
};

export const getMaterialReports = async ({ status = null, page = 1, limit = 25 } = {}, db = pool) => {
  const params = [];
  const whereClauses = [];

  if (status) {
    whereClauses.push('ml.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM materi_laporan ml ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const sql = `
    SELECT
      ml.id,
      ml.materi_id,
      ml.reporter_id,
      ml.alasan,
      ml.deskripsi,
      ml.status,
      ml.handled_by,
      ml.handled_at,
      ml.action_taken,
      ml.takedown_note,
      ml.created_at,
      m.judul AS materi_judul,
      m.tipe_materi,
      m.status AS materi_status,
      mk.nama AS mata_kuliah_nama,
      u_rep.full_name AS reporter_nama,
      u_uploader.full_name AS uploader_nama,
      u_uploader.id AS uploader_id
    FROM materi_laporan ml
    INNER JOIN materi m ON m.id = ml.materi_id
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN users u_rep ON u_rep.id = ml.reporter_id
    LEFT JOIN users u_uploader ON u_uploader.id = m.uploaded_by
    ${whereSql}
    ORDER BY FIELD(ml.status, 'pending', 'resolved', 'dismissed'), ml.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await db.query(sql, [...params, safeLimit, offset]);
  return {
    rows,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

export const getMaterialReportById = async (reportId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
       ml.id,
       ml.materi_id,
       ml.reporter_id,
       ml.status AS report_status,
       m.judul AS materi_judul,
       m.uploaded_by AS uploader_id
     FROM materi_laporan ml
     INNER JOIN materi m ON m.id = ml.materi_id
     WHERE ml.id = ?
     LIMIT 1`,
    [reportId]
  );
  return rows[0] || null;
};

export const resolveMaterialReport = async (
  reportId,
  { reportStatus, action, takedownNote, handlerId },
  db = pool
) => {
  const [result] = await db.query(
    `UPDATE materi_laporan
     SET status = ?, action_taken = ?, takedown_note = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [reportStatus, action, takedownNote || '', handlerId, reportId]
  );
  return result.affectedRows > 0;
};

export const getContributorsLeaderboard = async (limit = 15, db = pool) => {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 15));
  const sql = `
    SELECT
      u.id AS user_id,
      u.full_name AS nama,
      u.role,
      u.angkatan_year AS angkatan,
      u.avatar_url,
      COUNT(DISTINCT m.id) AS approved_materials_count,
      COUNT(DISTINCT mv.id) AS total_helpful_votes,
      ((COUNT(DISTINCT m.id) * 20) + (COUNT(DISTINCT mv.id) * 5)) AS total_points
    FROM users u
    INNER JOIN materi m ON m.uploaded_by = u.id AND m.status = 'approved' AND m.is_published = 1
    LEFT JOIN materi_vote mv ON mv.materi_id = m.id
    WHERE u.role IN ('mahasiswa', 'alumni') AND u.status = 'active'
    GROUP BY u.id
    ORDER BY total_points DESC, approved_materials_count DESC
    LIMIT ?
  `;
  const [rows] = await db.query(sql, [safeLimit]);
  return rows;
};

// ============================================================================
// KOLEKSI SAYA (BOOKMARK)
// ============================================================================

export const getUserCollections = async (userId, db = pool) => {
  const sql = `
    SELECT
      mk.id,
      mk.user_id,
      mk.nama,
      mk.deskripsi,
      mk.created_at,
      COUNT(mki.id) AS total_items
    FROM materi_koleksi mk
    LEFT JOIN materi_koleksi_item mki ON mki.koleksi_id = mk.id
    WHERE mk.user_id = ?
    GROUP BY mk.id
    ORDER BY mk.created_at DESC
  `;
  const [rows] = await db.query(sql, [userId]);
  return rows;
};

export const getCollectionById = async (koleksiId, db = pool) => {
  const [rows] = await db.query(
    'SELECT id, user_id, nama, deskripsi, created_at FROM materi_koleksi WHERE id = ? LIMIT 1',
    [koleksiId]
  );
  return rows[0] || null;
};

export const getCollectionItems = async (koleksiId, db = pool) => {
  const sql = `
    SELECT
      mki.id AS item_id,
      mki.added_at,
      m.id AS materi_id,
      m.judul,
      m.tipe_materi,
      m.status,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      u.full_name AS uploader_nama
    FROM materi_koleksi_item mki
    INNER JOIN materi m ON m.id = mki.materi_id
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN users u ON u.id = m.uploaded_by
    WHERE mki.koleksi_id = ? AND m.status = 'approved' AND m.is_published = 1
    ORDER BY mki.added_at DESC
  `;
  const [rows] = await db.query(sql, [koleksiId]);
  return rows;
};

export const createCollection = async (userId, nama, deskripsi = '', db = pool) => {
  const [result] = await db.query(
    'INSERT INTO materi_koleksi (user_id, nama, deskripsi) VALUES (?, ?, ?)',
    [userId, nama, deskripsi]
  );
  return result.insertId;
};

export const toggleCollectionItem = async (koleksiId, materiId, db = pool) => {
  const [existing] = await db.query(
    'SELECT id FROM materi_koleksi_item WHERE koleksi_id = ? AND materi_id = ? LIMIT 1',
    [koleksiId, materiId]
  );

  if (existing.length > 0) {
    await db.query('DELETE FROM materi_koleksi_item WHERE id = ?', [existing[0].id]);
    return { saved: false };
  }

  await db.query(
    'INSERT INTO materi_koleksi_item (koleksi_id, materi_id) VALUES (?, ?)',
    [koleksiId, materiId]
  );
  return { saved: true };
};

export const removeCollectionItem = async (koleksiId, materiId, db = pool) => {
  const [result] = await db.query(
    'DELETE FROM materi_koleksi_item WHERE koleksi_id = ? AND materi_id = ?',
    [koleksiId, materiId]
  );
  return result.affectedRows > 0;
};

export const deleteCollection = async (koleksiId, userId, db = pool) => {
  const [result] = await db.query(
    'DELETE FROM materi_koleksi WHERE id = ? AND user_id = ?',
    [koleksiId, userId]
  );
  return result.affectedRows > 0;
};

// ============================================================================
// PAPAN "MINTA MATERI"
// ============================================================================

export const getMaterialRequests = async (
  { prodiId = null, mataKuliahId = null, search = '', page = 1, limit = 30 } = {},
  db = pool
) => {
  const params = [];
  const whereClauses = [];

  if (mataKuliahId) {
    whereClauses.push('mr.mata_kuliah_id = ?');
    params.push(Number(mataKuliahId));
  }

  if (prodiId) {
    whereClauses.push('(mk.prodi_id = ? OR mk.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (search && search.trim()) {
    whereClauses.push('(mr.judul LIKE ? OR mr.deskripsi LIKE ? OR mk.nama LIKE ?)');
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM materi_request mr
     INNER JOIN mata_kuliah mk ON mk.id = mr.mata_kuliah_id
     ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const sql = `
    SELECT
      mr.id,
      mr.user_id,
      mr.mata_kuliah_id,
      mr.judul,
      mr.deskripsi,
      mr.tipe_materi_diminta,
      mr.is_fulfilled,
      mr.fulfilled_materi_id,
      mr.created_at,
      mr.updated_at,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS requester_nama,
      u.angkatan_year AS requester_angkatan,
      m_ful.judul AS fulfilled_materi_judul
    FROM materi_request mr
    INNER JOIN mata_kuliah mk ON mk.id = mr.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = mr.user_id
    LEFT JOIN materi m_ful ON m_ful.id = mr.fulfilled_materi_id
    ${whereSql}
    ORDER BY mr.is_fulfilled ASC, mr.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(sql, [...params, safeLimit, offset]);
  return {
    rows,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

export const getMaterialRequestById = async (requestId, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, user_id, mata_kuliah_id, judul, is_fulfilled, fulfilled_materi_id
     FROM materi_request WHERE id = ? LIMIT 1`,
    [requestId]
  );
  return rows[0] || null;
};

export const createMaterialRequest = async (
  { userId, mataKuliahId, judul, deskripsi = '', tipe_materi_diminta = '' },
  db = pool
) => {
  const [result] = await db.query(
    'INSERT INTO materi_request (user_id, mata_kuliah_id, judul, deskripsi, tipe_materi_diminta) VALUES (?, ?, ?, ?, ?)',
    [userId, mataKuliahId, judul, deskripsi, tipe_materi_diminta]
  );
  return result.insertId;
};

export const updateMaterialRequestFulfillment = async (
  requestId,
  { isFulfilled, fulfilledMateriId },
  db = pool
) => {
  const [result] = await db.query(
    'UPDATE materi_request SET is_fulfilled = ?, fulfilled_materi_id = ? WHERE id = ?',
    [isFulfilled ? 1 : 0, fulfilledMateriId ?? null, requestId]
  );
  return result.affectedRows > 0;
};

// FILE: server/src/queries/material.queries.js
import { pool } from '../config/db.js';


// ============================================================================
// 1. KATALOG AKADEMIK (PRODI & MATA KULIAH)
// ============================================================================

export const getProdiListQuery = async () => {
  const [rows] = await pool.query('SELECT * FROM prodi ORDER BY kode ASC');
  return rows;
};

export const createProdiQuery = async ({ kode, nama, jenjang = 'S1', fakultas }) => {
  const [result] = await pool.query(
    'INSERT INTO prodi (kode, nama, jenjang, fakultas) VALUES (?, ?, ?, ?)',
    [kode, nama, jenjang, fakultas || 'Fakultas Ilmu Komputer & Desain']
  );
  return result.insertId;
};

export const getCoursesQuery = async ({
  prodiId = null,
  semesterRekomendasi = null,
  search = '',
  status = 'approved',
  includeAll = false,
}) => {
  const params = [];
  const whereClauses = [];

  if (!includeAll && status) {
    whereClauses.push('mk.status = ?');
    params.push(status);
  }

  if (prodiId) {
    whereClauses.push('(mk.prodi_id = ? OR mk.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (semesterRekomendasi) {
    whereClauses.push('(mk.semester_rekomendasi = ? OR mk.semester_rekomendasi = 0)');
    params.push(Number(semesterRekomendasi));
  }

  if (search && search.trim() !== '') {
    whereClauses.push('(mk.nama LIKE ? OR mk.kode LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      mk.id,
      mk.kode,
      mk.nama,
      mk.sks,
      mk.prodi_id,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      mk.semester_rekomendasi,
      mk.deskripsi,
      mk.status,
      mk.proposed_by,
      u.full_name AS proposer_nama,
      (
        SELECT COUNT(m.id)
        FROM materi m
        WHERE m.mata_kuliah_id = mk.id AND m.status = 'approved' AND m.is_published = 1
      ) AS total_materials
    FROM mata_kuliah mk
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = mk.proposed_by
    ${whereSql}
    ORDER BY mk.semester_rekomendasi ASC, mk.kode ASC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const getCourseByIdQuery = async (courseId) => {
  const sql = `
    SELECT
      mk.*,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama
    FROM mata_kuliah mk
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    WHERE mk.id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [courseId]);
  return rows[0] || null;
};

export const createCourseQuery = async ({
  kode,
  nama,
  sks = 3,
  prodi_id,
  semester_rekomendasi = 1,
  deskripsi = '',
  status = 'approved',
  proposed_by = null,
}) => {
  const [result] = await pool.query(
    `INSERT INTO mata_kuliah (kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status, proposed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status, proposed_by]
  );
  return result.insertId;
};

export const approveProposedCourseQuery = async (id, status = 'approved') => {
  const [result] = await pool.query('UPDATE mata_kuliah SET status = ? WHERE id = ?', [status, id]);
  return result.affectedRows > 0;
};

export const updateCourseQuery = async (
  id,
  { kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status }
) => {
  const [result] = await pool.query(
    `UPDATE mata_kuliah 
     SET kode = ?, nama = ?, sks = ?, prodi_id = ?, semester_rekomendasi = ?, deskripsi = ?, status = ?
     WHERE id = ?`,
    [kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status, id]
  );
  return result.affectedRows > 0;
};

export const deleteCourseQuery = async (id) => {
  const [result] = await pool.query('DELETE FROM mata_kuliah WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

// ============================================================================
// 2. REPOSITORI & KONTRIBUSI MATERI (PEER-TO-PEER)
// ============================================================================

export const getMaterialsQuery = async ({
  prodiId = null,
  semester = null,
  mataKuliahId = null,
  tipeMateri = null,
  tahun = null,
  search = '',
  sort = 'terbaru',
  status = null,
  currentUserId = null,
  role = null,
}) => {
  const params = [];
  const whereClauses = [];

  const isStaff = role === 'admin' || role === 'moderator';

  // Filter Status Moderasi
  if (status) {
    whereClauses.push('m.status = ?');
    params.push(status);
  } else if (!isStaff) {
    if (currentUserId) {
      whereClauses.push('(m.status = "approved" OR m.uploaded_by = ?)');
      params.push(currentUserId);
    } else {
      whereClauses.push('m.status = "approved"');
    }
    whereClauses.push('m.is_published = 1');
  }

  if (mataKuliahId) {
    whereClauses.push('m.mata_kuliah_id = ?');
    params.push(Number(mataKuliahId));
  }

  if (prodiId) {
    whereClauses.push('(mk.prodi_id = ? OR mk.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (semester) {
    whereClauses.push('(mk.semester_rekomendasi = ? OR mk.semester_rekomendasi = 0)');
    params.push(Number(semester));
  }

  if (tipeMateri) {
    whereClauses.push('m.tipe_materi = ?');
    params.push(tipeMateri);
  }

  if (tahun) {
    whereClauses.push('(m.tahun_akademik LIKE ? OR m.angkatan_kontributor LIKE ?)');
    params.push(`%${tahun}%`, `%${tahun}%`);
  }

  if (search && search.trim() !== '') {
    whereClauses.push(`(
      m.judul LIKE ? OR 
      m.deskripsi LIKE ? OR 
      m.tags LIKE ? OR 
      mk.nama LIKE ? OR 
      mk.kode LIKE ?
    )`);
    const s = `%${search.trim()}%`;
    params.push(s, s, s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Order sorting: terbaru, terpopuler (view/download), paling bermanfaat (upvotes)
  let orderSql = 'ORDER BY m.created_at DESC';
  if (sort === 'terpopuler') {
    orderSql = 'ORDER BY (m.view_count + m.download_count) DESC, m.created_at DESC';
  } else if (sort === 'paling_bermanfaat') {
    orderSql = 'ORDER BY helpful_votes DESC, m.created_at DESC';
  }

  const sql = `
    SELECT
      m.*,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.sks AS mata_kuliah_sks,
      mk.semester_rekomendasi,
      p.id AS prodi_id,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS uploader_nama,
      u.full_name AS uploader_name,
      u.nim AS uploader_nim,
      u.email AS uploader_email,
      u.role AS uploader_role,
      u.angkatan_year AS uploader_angkatan,
      u.avatar_url AS uploader_avatar,
      (SELECT COUNT(mv.id) FROM materi_vote mv WHERE mv.materi_id = m.id) AS helpful_votes,
      (SELECT COUNT(mkom.id) FROM materi_komentar mkom WHERE mkom.materi_id = m.id) AS total_comments,
      (SELECT COUNT(mf.id) FROM materi_file mf WHERE mf.materi_id = m.id) AS total_files,
      (SELECT mf2.file_url FROM materi_file mf2 WHERE mf2.materi_id = m.id ORDER BY mf2.urutan ASC LIMIT 1) AS file_url,
      (SELECT mf2.file_url FROM materi_file mf2 WHERE mf2.materi_id = m.id ORDER BY mf2.urutan ASC LIMIT 1) AS url,
      ${currentUserId ? `(SELECT COUNT(mv2.id) FROM materi_vote mv2 WHERE mv2.materi_id = m.id AND mv2.user_id = ${Number(currentUserId)}) > 0` : '0'} AS has_voted
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = m.uploaded_by
    ${whereSql}
    ${orderSql}
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const getMaterialByIdQuery = async (materialId, currentUserId = null) => {
  const sql = `
    SELECT
      m.*,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.sks AS mata_kuliah_sks,
      mk.semester_rekomendasi,
      p.id AS prodi_id,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS uploader_nama,
      u.full_name AS uploader_name,
      u.nim AS uploader_nim,
      u.email AS uploader_email,
      u.role AS uploader_role,
      u.angkatan_year AS uploader_angkatan,
      u.avatar_url AS uploader_avatar,
      mod_u.full_name AS moderator_nama,
      (SELECT COUNT(mv.id) FROM materi_vote mv WHERE mv.materi_id = m.id) AS helpful_votes,
      (SELECT COUNT(mkom.id) FROM materi_komentar mkom WHERE mkom.materi_id = m.id) AS total_comments,
      ${currentUserId ? `(SELECT COUNT(mv2.id) FROM materi_vote mv2 WHERE mv2.materi_id = m.id AND mv2.user_id = ${Number(currentUserId)}) > 0` : '0'} AS has_voted,
      ${currentUserId ? `(SELECT COUNT(mki.id) FROM materi_koleksi_item mki INNER JOIN materi_koleksi mk2 ON mk2.id = mki.koleksi_id WHERE mki.materi_id = m.id AND mk2.user_id = ${Number(currentUserId)}) > 0` : '0'} AS is_bookmarked
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = m.uploaded_by
    LEFT JOIN users mod_u ON mod_u.id = m.moderated_by
    WHERE m.id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [materialId]);
  if (rows.length === 0) return null;

  const item = rows[0];

  // Ambil berkas-berkas lampiran
  const [files] = await pool.query(
    'SELECT * FROM materi_file WHERE materi_id = ? ORDER BY urutan ASC, id ASC',
    [materialId]
  );
  item.files = files;

  // Ambil riwayat versi singkat
  const [versions] = await pool.query(
    `SELECT mv.*, u.full_name AS creator_nama 
     FROM materi_version mv 
     LEFT JOIN users u ON u.id = mv.created_by 
     WHERE mv.materi_id = ? 
     ORDER BY mv.version_num DESC`,
    [materialId]
  );
  item.versions = versions;

  return item;
};

export const incrementMaterialViewQuery = async (materialId) => {
  await pool.query('UPDATE materi SET view_count = view_count + 1 WHERE id = ?', [materialId]);
};

export const incrementMaterialDownloadQuery = async (materialId) => {
  await pool.query('UPDATE materi SET download_count = download_count + 1 WHERE id = ?', [materialId]);
};

export const createMaterialQuery = async ({
  mata_kuliah_id,
  uploaded_by,
  judul,
  tipe_materi,
  deskripsi = '',
  tags = '',
  tahun_akademik = '',
  angkatan_kontributor = '',
  dosen_pengampu_teks = '',
  sumber_kredit = '',
  external_url = '',
  youtube_video_id = '',
  is_published = 1,
  status = 'pending',
}) => {
  const [result] = await pool.query(
    `INSERT INTO materi (
      mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
      tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
      external_url, youtube_video_id, is_published, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mata_kuliah_id,
      uploaded_by,
      judul,
      tipe_materi,
      deskripsi,
      tags,
      tahun_akademik,
      angkatan_kontributor,
      dosen_pengampu_teks,
      sumber_kredit,
      external_url,
      youtube_video_id,
      is_published,
      status,
    ]
  );
  return result.insertId;
};

export const insertMaterialFilesQuery = async (materiId, files = []) => {
  if (!files || files.length === 0) return;
  const values = files.map((f, idx) => [
    materiId,
    f.file_url,
    f.public_id || null,
    f.file_name,
    f.file_size || 0,
    f.file_format || null,
    idx + 1,
  ]);
  await pool.query(
    'INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan) VALUES ?',
    [values]
  );
};

export const updateMaterialQuery = async (materialId, updateFields) => {
  const allowedKeys = [
    'judul',
    'deskripsi',
    'tags',
    'tahun_akademik',
    'dosen_pengampu_teks',
    'sumber_kredit',
    'external_url',
    'youtube_video_id',
    'is_published',
  ];
  const keys = Object.keys(updateFields).filter((k) => allowedKeys.includes(k));
  if (keys.length === 0) return false;

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => updateFields[k]);
  values.push(materialId);

  const [result] = await pool.query(`UPDATE materi SET ${setClauses} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

export const deleteMaterialQuery = async (materialId) => {
  const [result] = await pool.query('DELETE FROM materi WHERE id = ?', [materialId]);
  return result.affectedRows > 0;
};

export const createMaterialVersionQuery = async ({
  materi_id,
  file_url,
  file_name,
  file_size,
  changelog_note,
  created_by,
}) => {
  // Hitung nomor versi selanjutnya
  const [rows] = await pool.query(
    'SELECT COALESCE(MAX(version_num), 0) + 1 AS next_ver FROM materi_version WHERE materi_id = ?',
    [materi_id]
  );
  const nextVer = rows[0].next_ver;

  const [result] = await pool.query(
    `INSERT INTO materi_version (materi_id, version_num, file_url, file_name, file_size, changelog_note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [materi_id, nextVer, file_url, file_name, file_size, changelog_note, created_by]
  );

  // Perbarui file utama pada materi_file jika ada
  await pool.query(
    'UPDATE materi_file SET file_url = ?, file_name = ?, file_size = ? WHERE materi_id = ? AND urutan = 1',
    [file_url, file_name, file_size, materi_id]
  );

  return result.insertId;
};

export const moderateMaterialQuery = async (materialId, { status, note, moderatorId }) => {
  const [result] = await pool.query(
    `UPDATE materi 
     SET status = ?, moderation_note = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, note, moderatorId, materialId]
  );
  return result.affectedRows > 0;
};

// ============================================================================
// 3. INTERAKSI & GAMIFIKASI (VOTE, KOMENTAR, LAPORAN, LEADERBOARD)
// ============================================================================

export const toggleMaterialVoteQuery = async (materialId, userId) => {
  const [existing] = await pool.query(
    'SELECT id FROM materi_vote WHERE materi_id = ? AND user_id = ? LIMIT 1',
    [materialId, userId]
  );

  if (existing.length > 0) {
    await pool.query('DELETE FROM materi_vote WHERE id = ?', [existing[0].id]);
    return { voted: false };
  } else {
    await pool.query('INSERT INTO materi_vote (materi_id, user_id) VALUES (?, ?)', [
      materialId,
      userId,
    ]);
    return { voted: true };
  }
};

export const getMaterialCommentsQuery = async (materialId) => {
  const sql = `
    SELECT
      mk.*,
      u.full_name AS user_nama,
      u.role AS user_role,
      u.angkatan_year AS user_angkatan,
      u.avatar_url AS user_avatar
    FROM materi_komentar mk
    INNER JOIN users u ON u.id = mk.user_id
    WHERE mk.materi_id = ?
    ORDER BY mk.created_at ASC
  `;
  const [rows] = await pool.query(sql, [materialId]);
  return rows;
};

export const createMaterialCommentQuery = async ({ materialId, userId, parentId = null, konten }) => {
  const [result] = await pool.query(
    'INSERT INTO materi_komentar (materi_id, user_id, parent_id, konten) VALUES (?, ?, ?, ?)',
    [materialId, userId, parentId, konten]
  );
  return result.insertId;
};

export const deleteMaterialCommentQuery = async (commentId, userId, isStaff = false) => {
  let sql = 'DELETE FROM materi_komentar WHERE id = ?';
  const params = [commentId];
  if (!isStaff) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  const [result] = await pool.query(sql, params);
  return result.affectedRows > 0;
};

export const createMaterialReportQuery = async ({ materialId, reporterId, alasan, deskripsi = '' }) => {
  const [result] = await pool.query(
    'INSERT INTO materi_laporan (materi_id, reporter_id, alasan, deskripsi) VALUES (?, ?, ?, ?)',
    [materialId, reporterId, alasan, deskripsi]
  );
  return result.insertId;
};

export const getMaterialReportsQuery = async () => {
  const sql = `
    SELECT
      ml.*,
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
    ORDER BY ml.created_at DESC
  `;
  const [rows] = await pool.query(sql);
  return rows;
};

export const handleMaterialReportQuery = async (reportId, { action, takedownNote, handlerId }) => {
  // Ambil materi_id
  const [rep] = await pool.query('SELECT materi_id FROM materi_laporan WHERE id = ? LIMIT 1', [reportId]);
  if (rep.length === 0) return false;
  const materiId = rep[0].materi_id;

  if (action === 'takedown') {
    await pool.query(
      `UPDATE materi 
       SET status = 'takedown', moderation_note = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [takedownNote || 'Diturunkan karena laporan pelanggaran konten.', handlerId, materiId]
    );
  }

  await pool.query(
    `UPDATE materi_laporan 
     SET status = 'resolved', action_taken = ?, takedown_note = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [action, takedownNote || '', handlerId, reportId]
  );

  return true;
};

/**
 * Papan Peringkat Kontributor Teratas (Gamifikasi)
 * Poin = (Materi Approved * 20) + (Total Helpful Votes * 5)
 */
export const getContributorsLeaderboardQuery = async (limit = 15) => {
  const sql = `
    SELECT
      u.id AS user_id,
      u.full_name AS nama,
      u.role,
      u.angkatan_year AS angkatan,
      u.avatar_url,
      COUNT(DISTINCT m.id) AS approved_materials_count,
      COUNT(DISTINCT mv.id) AS total_helpful_votes,
      ( (COUNT(DISTINCT m.id) * 20) + (COUNT(DISTINCT mv.id) * 5) ) AS total_points
    FROM users u
    INNER JOIN materi m ON m.uploaded_by = u.id AND m.status = 'approved'
    LEFT JOIN materi_vote mv ON mv.materi_id = m.id
    WHERE u.role IN ('mahasiswa', 'alumni')
    GROUP BY u.id
    ORDER BY total_points DESC, approved_materials_count DESC
    LIMIT ?
  `;
  const [rows] = await pool.query(sql, [Number(limit)]);
  return rows;
};

// ============================================================================
// 4. KOLEKSI SAYA (BOOKMARK)
// ============================================================================

export const getUserCollectionsQuery = async (userId) => {
  const sql = `
    SELECT
      mk.*,
      COUNT(mki.id) AS total_items
    FROM materi_koleksi mk
    LEFT JOIN materi_koleksi_item mki ON mki.koleksi_id = mk.id
    WHERE mk.user_id = ?
    GROUP BY mk.id
    ORDER BY mk.created_at DESC
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows;
};

export const createCollectionQuery = async (userId, nama, deskripsi = '') => {
  const [result] = await pool.query(
    'INSERT INTO materi_koleksi (user_id, nama, deskripsi) VALUES (?, ?, ?)',
    [userId, nama, deskripsi]
  );
  return result.insertId;
};

export const toggleCollectionItemQuery = async (koleksiId, materiId) => {
  const [existing] = await pool.query(
    'SELECT id FROM materi_koleksi_item WHERE koleksi_id = ? AND materi_id = ? LIMIT 1',
    [koleksiId, materiId]
  );

  if (existing.length > 0) {
    await pool.query('DELETE FROM materi_koleksi_item WHERE id = ?', [existing[0].id]);
    return { saved: false };
  } else {
    await pool.query(
      'INSERT INTO materi_koleksi_item (koleksi_id, materi_id) VALUES (?, ?)',
      [koleksiId, materiId]
    );
    return { saved: true };
  }
};

export const deleteCollectionQuery = async (koleksiId, userId) => {
  const [result] = await pool.query(
    'DELETE FROM materi_koleksi WHERE id = ? AND user_id = ?',
    [koleksiId, userId]
  );
  return result.affectedRows > 0;
};

// ============================================================================
// 5. PAPAN "MINTA MATERI"
// ============================================================================

export const getMaterialRequestsQuery = async ({ prodiId = null, mataKuliahId = null, search = '' }) => {
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

  if (search && search.trim() !== '') {
    whereClauses.push('(mr.judul LIKE ? OR mr.deskripsi LIKE ? OR mk.nama LIKE ?)');
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      mr.*,
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
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const createMaterialRequestQuery = async ({
  userId,
  mataKuliahId,
  judul,
  deskripsi = '',
  tipe_materi_diminta = '',
}) => {
  const [result] = await pool.query(
    'INSERT INTO materi_request (user_id, mata_kuliah_id, judul, deskripsi, tipe_materi_diminta) VALUES (?, ?, ?, ?, ?)',
    [userId, mataKuliahId, judul, deskripsi, tipe_materi_diminta]
  );
  return result.insertId;
};

export const fulfillMaterialRequestQuery = async (requestId, fulfilledMateriId) => {
  const [result] = await pool.query(
    'UPDATE materi_request SET is_fulfilled = 1, fulfilled_materi_id = ? WHERE id = ?',
    [fulfilledMateriId, requestId]
  );
  return result.affectedRows > 0;
};

// ============================================================================
// 6. PAKET BELAJAR SEMESTER
// ============================================================================

export const getLearningPackagesQuery = async ({ prodiId = null, semester = null }) => {
  const params = [];
  const whereClauses = [];

  if (prodiId) {
    whereClauses.push('(pb.prodi_id = ? OR pb.prodi_id IS NULL)');
    params.push(Number(prodiId));
  }

  if (semester) {
    whereClauses.push('pb.semester = ?');
    params.push(Number(semester));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      pb.*,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS creator_nama,
      (SELECT COUNT(pbi.id) FROM paket_belajar_item pbi WHERE pbi.paket_belajar_id = pb.id) AS total_materials
    FROM paket_belajar pb
    LEFT JOIN prodi p ON p.id = pb.prodi_id
    LEFT JOIN users u ON u.id = pb.created_by
    ${whereSql}
    ORDER BY pb.semester ASC, pb.created_at DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

export const getLearningPackageDetailQuery = async (packageId) => {
  const [rows] = await pool.query(
    `SELECT pb.*, p.kode AS prodi_kode, p.nama AS prodi_nama, u.full_name AS creator_nama
     FROM paket_belajar pb
     LEFT JOIN prodi p ON p.id = pb.prodi_id
     LEFT JOIN users u ON u.id = pb.created_by
     WHERE pb.id = ? LIMIT 1`,
    [packageId]
  );
  if (rows.length === 0) return null;

  const pkg = rows[0];

  const [items] = await pool.query(
    `SELECT
       pbi.id AS item_id,
       pbi.urutan,
       m.*,
       mk.kode AS mata_kuliah_kode,
       mk.nama AS mata_kuliah_nama,
       u_upload.full_name AS uploader_nama
     FROM paket_belajar_item pbi
     INNER JOIN materi m ON m.id = pbi.materi_id
     INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
     LEFT JOIN users u_upload ON u_upload.id = m.uploaded_by
     WHERE pbi.paket_belajar_id = ? AND m.status = 'approved'
     ORDER BY pbi.urutan ASC`,
    [packageId]
  );

  pkg.materials = items;
  return pkg;
};

export const createLearningPackageQuery = async ({
  prodi_id,
  semester,
  judul,
  deskripsi = '',
  created_by,
  materialIds = [],
}) => {
  const [result] = await pool.query(
    'INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by) VALUES (?, ?, ?, ?, ?)',
    [prodi_id, semester, judul, deskripsi, created_by]
  );
  const packageId = result.insertId;

  if (materialIds.length > 0) {
    const values = materialIds.map((matId, idx) => [packageId, matId, idx + 1]);
    await pool.query(
      'INSERT INTO paket_belajar_item (paket_belajar_id, materi_id, urutan) VALUES ?',
      [values]
    );
  }

  return packageId;
};

export const deleteLearningPackageQuery = async (packageId) => {
  const [result] = await pool.query('DELETE FROM paket_belajar WHERE id = ?', [packageId]);
  return result.affectedRows > 0;
};

// ============================================================================
// 7. DOWNLOAD ZIP MATERI TERSETUJUI
// ============================================================================

export const getApprovedMaterialsForCourseDownload = async (courseId) => {
  const sql = `
    SELECT
      m.id AS materi_id,
      m.judul AS materi_judul,
      m.tipe_materi,
      m.external_url,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.semester_rekomendasi,
      p.kode AS prodi_kode,
      mf.id AS file_id,
      mf.file_url,
      mf.file_name,
      mf.file_size,
      mf.file_format
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN materi_file mf ON mf.materi_id = m.id
    WHERE m.mata_kuliah_id = ? AND m.status = 'approved' AND m.is_published = 1
  `;
  const [rows] = await pool.query(sql, [courseId]);
  return rows;
};

export const getApprovedMaterialsForPackageDownload = async (packageId) => {
  const sql = `
    SELECT
      m.id AS materi_id,
      m.judul AS materi_judul,
      m.tipe_materi,
      m.external_url,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.semester_rekomendasi,
      p.kode AS prodi_kode,
      mf.id AS file_id,
      mf.file_url,
      mf.file_name,
      mf.file_size,
      mf.file_format
    FROM paket_belajar_item pbi
    INNER JOIN materi m ON m.id = pbi.materi_id
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN materi_file mf ON mf.materi_id = m.id
    WHERE pbi.paket_belajar_id = ? AND m.status = 'approved' AND m.is_published = 1
  `;
  const [rows] = await pool.query(sql, [packageId]);
  return rows;
};

// FILE: server/src/repositories/material.repository.js
import { pool } from '../config/db.js';

const columnCache = new Map();

/**
 * Cek kompatibilitas kolom opsional secara ter-cache agar query tetap aman
 * sebelum & sesudah migrasi 002 dijalankan.
 */
const hasTableColumn = async (tableName, columnName, db = pool) => {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnCache.has(cacheKey)) return columnCache.get(cacheKey);

  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    const exists = Boolean(rows[0]?.cnt > 0);
    columnCache.set(cacheKey, exists);
    return exists;
  } catch {
    return false;
  }
};

export const getMaterials = async (
  {
    mataKuliahId = null,
    prodiId = null,
    semester = null,
    tipeMateri = null,
    search = '',
    status = null,
    sort = 'terbaru',
    mine = false,
    currentUserId = null,
    isStaff = false,
    page = 1,
    limit = 24,
  },
  db = pool
) => {
  const params = [];
  const whereClauses = [];

  // BUG-BE-01: Hanya staff yang dapat melihat seluruh status atau memfilter pending/rejected/takedown milik siapa pun.
  // Pemilik dapat melihat materinya sendiri melalui ?mine=true, atau melihat status pending miliknya pada daftar mata kuliah.
  if (isStaff) {
    if (status) {
      whereClauses.push('m.status = ?');
      params.push(status);
    }
    if (mine && currentUserId) {
      whereClauses.push('m.uploaded_by = ?');
      params.push(Number(currentUserId));
    }
  } else if (mine && currentUserId) {
    whereClauses.push('m.uploaded_by = ?');
    params.push(Number(currentUserId));
    if (status) {
      whereClauses.push('m.status = ?');
      params.push(status);
    }
  } else {
    whereClauses.push(
      "((m.status = 'approved' AND m.is_published = 1) OR (m.uploaded_by = ? AND m.status = 'pending'))"
    );
    params.push(Number(currentUserId) || 0);
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
    whereClauses.push('mk.semester_rekomendasi = ?');
    params.push(Number(semester));
  }

  if (tipeMateri) {
    whereClauses.push('m.tipe_materi = ?');
    params.push(tipeMateri);
  }

  if (search && search.trim()) {
    whereClauses.push(
      '(m.judul LIKE ? OR m.deskripsi LIKE ? OR m.tags LIKE ? OR m.dosen_pengampu_teks LIKE ? OR mk.nama LIKE ? OR mk.kode LIKE ?)'
    );
    const kw = `%${search.trim()}%`;
    params.push(kw, kw, kw, kw, kw, kw);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM materi m
     INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
     ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 24));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  let orderBySql = 'm.created_at DESC';
  if (sort === 'terpopuler') {
    orderBySql = 'm.view_count DESC, m.download_count DESC, m.created_at DESC';
  } else if (sort === 'paling_bermanfaat') {
    orderBySql = 'helpful_votes DESC, m.view_count DESC, m.created_at DESC';
  }

  const userParam = Number(currentUserId) || 0;
  const sql = `
    SELECT
      m.id,
      m.mata_kuliah_id,
      m.uploaded_by,
      m.judul,
      m.tipe_materi,
      m.deskripsi,
      m.tags,
      m.tahun_akademik,
      m.angkatan_kontributor,
      m.dosen_pengampu_teks,
      m.sumber_kredit,
      m.external_url,
      m.youtube_video_id,
      m.is_published,
      m.status,
      m.moderated_by,
      m.moderated_at,
      m.moderation_note,
      m.view_count,
      m.download_count,
      m.created_at,
      m.updated_at,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.semester_rekomendasi,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS uploader_nama,
      u.nim AS uploader_nim,
      u.role AS uploader_role,
      u.angkatan_year AS uploader_angkatan,
      u.avatar_url AS uploader_avatar,
      COALESCE(mf_cnt.cnt, 0) AS total_files,
      COALESCE(mv_cnt.cnt, 0) AS helpful_votes,
      COALESCE(mc_cnt.cnt, 0) AS total_comments,
      mf_primary.file_url AS primary_file_url,
      mf_primary.file_format AS primary_file_format,
      IF(mv_me.id IS NOT NULL, 1, 0) AS has_voted
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = m.uploaded_by
    LEFT JOIN (
      SELECT materi_id, COUNT(*) AS cnt FROM materi_file GROUP BY materi_id
    ) mf_cnt ON mf_cnt.materi_id = m.id
    LEFT JOIN (
      SELECT materi_id, COUNT(*) AS cnt FROM materi_vote GROUP BY materi_id
    ) mv_cnt ON mv_cnt.materi_id = m.id
    LEFT JOIN (
      SELECT materi_id, COUNT(*) AS cnt FROM materi_komentar GROUP BY materi_id
    ) mc_cnt ON mc_cnt.materi_id = m.id
    LEFT JOIN materi_file mf_primary ON mf_primary.materi_id = m.id AND mf_primary.urutan = 1
    LEFT JOIN materi_vote mv_me ON mv_me.materi_id = m.id AND mv_me.user_id = ?
    ${whereSql}
    ORDER BY ${orderBySql}
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(sql, [userParam, ...params, safeLimit, offset]);
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

export const getMyApprovedMaterials = async (userId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
       m.id,
       m.mata_kuliah_id,
       m.judul,
       m.tipe_materi,
       m.status,
       m.created_at,
       mk.kode AS mata_kuliah_kode,
       mk.nama AS mata_kuliah_nama
     FROM materi m
     INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
     WHERE m.uploaded_by = ? AND m.status = 'approved' AND m.is_published = 1
     ORDER BY m.created_at DESC`,
    [userId]
  );
  return rows;
};

export const getMaterialById = async (materialId, currentUserId = null, db = pool) => {
  const userParam = Number(currentUserId) || 0;
  const sql = `
    SELECT
      m.id,
      m.mata_kuliah_id,
      m.uploaded_by,
      m.judul,
      m.tipe_materi,
      m.deskripsi,
      m.tags,
      m.tahun_akademik,
      m.angkatan_kontributor,
      m.dosen_pengampu_teks,
      m.sumber_kredit,
      m.external_url,
      m.youtube_video_id,
      m.is_published,
      m.status,
      m.moderated_by,
      m.moderated_at,
      m.moderation_note,
      m.view_count,
      m.download_count,
      m.created_at,
      m.updated_at,
      mk.kode AS mata_kuliah_kode,
      mk.nama AS mata_kuliah_nama,
      mk.sks,
      mk.semester_rekomendasi,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS uploader_nama,
      u.nim AS uploader_nim,
      u.role AS uploader_role,
      u.angkatan_year AS uploader_angkatan,
      u.avatar_url AS uploader_avatar,
      u.bio AS uploader_bio,
      (SELECT COUNT(*) FROM materi_vote mv WHERE mv.materi_id = m.id) AS helpful_votes,
      IF(mv_me.id IS NOT NULL, 1, 0) AS has_voted,
      (SELECT COUNT(*)
       FROM materi_koleksi_item mki
       INNER JOIN materi_koleksi mkol ON mkol.id = mki.koleksi_id
       WHERE mki.materi_id = m.id AND mkol.user_id = ?) AS is_bookmarked
    FROM materi m
    INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
    LEFT JOIN prodi p ON p.id = mk.prodi_id
    LEFT JOIN users u ON u.id = m.uploaded_by
    LEFT JOIN materi_vote mv_me ON mv_me.materi_id = m.id AND mv_me.user_id = ?
    WHERE m.id = ?
    LIMIT 1
  `;

  const [rows] = await db.query(sql, [userParam, userParam, materialId]);
  if (rows.length === 0) return null;

  const material = rows[0];

  const [files] = await db.query(
    `SELECT id, materi_id, file_url, file_name, file_size, file_format, urutan, created_at
     FROM materi_file WHERE materi_id = ? ORDER BY urutan ASC, id ASC`,
    [materialId]
  );

  const [versions] = await db.query(
    `SELECT mv.id, mv.materi_id, mv.version_num, mv.file_url, mv.file_name, mv.file_size, mv.changelog_note, mv.created_by, mv.created_at, u.full_name AS creator_nama
     FROM materi_version mv
     LEFT JOIN users u ON u.id = mv.created_by
     WHERE mv.materi_id = ?
     ORDER BY mv.version_num DESC`,
    [materialId]
  );

  material.files = files;
  material.versions = versions;
  return material;
};

export const getMaterialAuthMeta = async (materialId, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, mata_kuliah_id, uploaded_by, judul, tipe_materi, status, is_published, external_url
     FROM materi WHERE id = ? LIMIT 1`,
    [materialId]
  );
  return rows[0] || null;
};

export const getMaterialAssetsForCleanup = async (materialId, db = pool) => {
  const [fileRows] = await db.query(
    'SELECT public_id, file_url, file_format FROM materi_file WHERE materi_id = ?',
    [materialId]
  );

  const hasVersionPublicId = await hasTableColumn('materi_version', 'public_id', db);
  const hasVersionFormat = await hasTableColumn('materi_version', 'file_format', db);

  const versionCols = [
    hasVersionPublicId ? 'public_id' : 'NULL AS public_id',
    'file_url',
    hasVersionFormat ? 'file_format' : 'NULL AS file_format',
  ].join(', ');

  const [versionRows] = await db.query(
    `SELECT ${versionCols} FROM materi_version WHERE materi_id = ?`,
    [materialId]
  );

  return [...fileRows, ...versionRows];
};

export const getApprovedMaterialsByIds = async (materialIds, db = pool) => {
  if (!Array.isArray(materialIds) || materialIds.length === 0) return [];
  const [rows] = await db.query(
    "SELECT id FROM materi WHERE id IN (?) AND status = 'approved' AND is_published = 1",
    [materialIds]
  );
  return rows;
};

export const incrementMaterialView = async (materialId, db = pool) => {
  await db.query('UPDATE materi SET view_count = view_count + 1 WHERE id = ?', [materialId]);
};

export const incrementMaterialDownload = async (materialIds, db = pool) => {
  if (Array.isArray(materialIds)) {
    const cleanIds = [...new Set(materialIds.map(Number).filter((n) => n > 0))];
    if (cleanIds.length === 0) return;
    await db.query('UPDATE materi SET download_count = download_count + 1 WHERE id IN (?)', [cleanIds]);
    return;
  }
  await db.query('UPDATE materi SET download_count = download_count + 1 WHERE id = ?', [materialIds]);
};

export const createMaterial = async (
  {
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
    external_url = null,
    youtube_video_id = null,
    status = 'pending',
  },
  db = pool
) => {
  const [result] = await db.query(
    `INSERT INTO materi (
       mata_kuliah_id, uploaded_by, judul, tipe_materi, deskripsi, tags,
       tahun_akademik, angkatan_kontributor, dosen_pengampu_teks, sumber_kredit,
       external_url, youtube_video_id, is_published, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
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
      external_url || null,
      youtube_video_id || null,
      status,
    ]
  );
  return result.insertId;
};

export const insertMaterialFiles = async (materialId, files = [], db = pool) => {
  if (!files || files.length === 0) return;
  const values = files.map((f, idx) => [
    materialId,
    f.file_url,
    f.public_id || null,
    f.file_name,
    f.file_size || 0,
    f.file_format || null,
    idx + 1,
  ]);
  await db.query(
    'INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan) VALUES ?',
    [values]
  );
};

export const updateMaterial = async (materialId, updateFields, db = pool) => {
  const allowedKeys = [
    'judul',
    'tipe_materi',
    'deskripsi',
    'tags',
    'tahun_akademik',
    'angkatan_kontributor',
    'dosen_pengampu_teks',
    'sumber_kredit',
    'external_url',
    'youtube_video_id',
    'status',
    'moderation_note',
  ];
  const keys = Object.keys(updateFields).filter(
    (k) => allowedKeys.includes(k) && updateFields[k] !== undefined
  );
  if (keys.length === 0) return false;

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => updateFields[k]);
  values.push(materialId);

  const [result] = await db.query(`UPDATE materi SET ${setClauses} WHERE id = ?`, values);
  return result.affectedRows > 0;
};

export const deleteMaterial = async (materialId, db = pool) => {
  const [result] = await db.query('DELETE FROM materi WHERE id = ?', [materialId]);
  return result.affectedRows > 0;
};

export const createMaterialVersion = async (
  {
    materi_id,
    file_url,
    public_id = null,
    file_name,
    file_size = 0,
    file_format = null,
    changelog_note = '',
    created_by,
  },
  db = pool
) => {
  const [rows] = await db.query(
    'SELECT COALESCE(MAX(version_num), 0) + 1 AS next_ver FROM materi_version WHERE materi_id = ?',
    [materi_id]
  );
  const nextVer = rows[0].next_ver;

  const hasPublicId = await hasTableColumn('materi_version', 'public_id', db);
  const hasFileFormat = await hasTableColumn('materi_version', 'file_format', db);

  const cols = ['materi_id', 'version_num', 'file_url', 'file_name', 'file_size', 'changelog_note', 'created_by'];
  const vals = [materi_id, nextVer, file_url, file_name, file_size, changelog_note, created_by];

  if (hasPublicId) {
    cols.push('public_id');
    vals.push(public_id);
  }
  if (hasFileFormat) {
    cols.push('file_format');
    vals.push(file_format);
  }

  const placeholders = cols.map(() => '?').join(', ');
  const [result] = await db.query(
    `INSERT INTO materi_version (${cols.join(', ')}) VALUES (${placeholders})`,
    vals
  );

  // Perbarui atau sisipkan file utama (urutan = 1)
  const [existingPrimary] = await db.query(
    'SELECT id FROM materi_file WHERE materi_id = ? AND urutan = 1 LIMIT 1',
    [materi_id]
  );

  if (existingPrimary.length > 0) {
    await db.query(
      'UPDATE materi_file SET file_url = ?, public_id = ?, file_name = ?, file_size = ?, file_format = ? WHERE id = ?',
      [file_url, public_id, file_name, file_size, file_format, existingPrimary[0].id]
    );
  } else {
    await db.query(
      'INSERT INTO materi_file (materi_id, file_url, public_id, file_name, file_size, file_format, urutan) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [materi_id, file_url, public_id, file_name, file_size, file_format]
    );
  }

  return result.insertId;
};

export const moderateMaterial = async (materialId, { status, note, moderatorId }, db = pool) => {
  const [result] = await db.query(
    `UPDATE materi
     SET status = ?, moderation_note = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, note || null, moderatorId, materialId]
  );
  return result.affectedRows > 0;
};

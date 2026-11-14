// FILE: server/src/repositories/materialPackage.repository.js
import { pool } from '../config/db.js';
import { computeIsKakakTingkat } from '../utils/youtube.js';

export const getLearningPackages = async ({ prodiId = null, semester = null } = {}, db = pool) => {
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
      pb.id,
      pb.prodi_id,
      pb.semester,
      pb.judul,
      pb.deskripsi,
      pb.created_by,
      pb.created_at,
      p.kode AS prodi_kode,
      p.nama AS prodi_nama,
      u.full_name AS creator_nama,
      COALESCE(item_cnt.total_materials, 0) AS total_materials
    FROM paket_belajar pb
    LEFT JOIN prodi p ON p.id = pb.prodi_id
    LEFT JOIN users u ON u.id = pb.created_by
    LEFT JOIN (
      SELECT pbi.paket_belajar_id, COUNT(*) AS total_materials
      FROM paket_belajar_item pbi
      INNER JOIN materi m ON m.id = pbi.materi_id
      WHERE m.status = 'approved' AND m.is_published = 1
      GROUP BY pbi.paket_belajar_id
    ) item_cnt ON item_cnt.paket_belajar_id = pb.id
    ${whereSql}
    ORDER BY pb.semester ASC, pb.created_at DESC
  `;

  const [rows] = await db.query(sql, params);
  return rows;
};

export const getLearningPackageDetail = async (packageId, db = pool) => {
  const [rows] = await db.query(
    `SELECT
       pb.id,
       pb.prodi_id,
       pb.semester,
       pb.judul,
       pb.deskripsi,
       pb.created_by,
       pb.created_at,
       p.kode AS prodi_kode,
       p.nama AS prodi_nama,
       u.full_name AS creator_nama
     FROM paket_belajar pb
     LEFT JOIN prodi p ON p.id = pb.prodi_id
     LEFT JOIN users u ON u.id = pb.created_by
     WHERE pb.id = ? LIMIT 1`,
    [packageId]
  );
  if (rows.length === 0) return null;

  const pkg = rows[0];

  const [items] = await db.query(
    `SELECT
       pbi.id AS item_id,
       pbi.urutan,
       m.id,
       m.mata_kuliah_id,
       m.uploaded_by,
       m.judul,
       m.tipe_materi,
       m.deskripsi,
       m.angkatan_kontributor,
       m.external_url,
       m.youtube_video_id,
       m.view_count,
       m.download_count,
       m.created_at,
       mk.kode AS mata_kuliah_kode,
       mk.nama AS mata_kuliah_nama,
       mk.semester_rekomendasi,
       u_upload.full_name AS uploader_nama,
       u_upload.role AS uploader_role,
       u_upload.angkatan_year AS uploader_angkatan
     FROM paket_belajar_item pbi
     INNER JOIN materi m ON m.id = pbi.materi_id
     INNER JOIN mata_kuliah mk ON mk.id = m.mata_kuliah_id
     LEFT JOIN users u_upload ON u_upload.id = m.uploaded_by
     WHERE pbi.paket_belajar_id = ? AND m.status = 'approved' AND m.is_published = 1
     ORDER BY pbi.urutan ASC`,
    [packageId]
  );

  pkg.materials = items.map((item) => ({
    ...item,
    is_kakak_tingkat: computeIsKakakTingkat(item),
  }));
  return pkg;
};

export const createLearningPackage = async (
  { prodi_id, semester, judul, deskripsi = '', created_by, materialIds = [] },
  db = pool
) => {
  const [result] = await db.query(
    'INSERT INTO paket_belajar (prodi_id, semester, judul, deskripsi, created_by) VALUES (?, ?, ?, ?, ?)',
    [prodi_id, semester, judul, deskripsi, created_by]
  );
  const packageId = result.insertId;

  if (materialIds.length > 0) {
    const uniqueIds = [...new Set(materialIds.map(Number).filter((n) => n > 0))];
    if (uniqueIds.length > 0) {
      const values = uniqueIds.map((matId, idx) => [packageId, matId, idx + 1]);
      await db.query(
        'INSERT INTO paket_belajar_item (paket_belajar_id, materi_id, urutan) VALUES ?',
        [values]
      );
    }
  }

  return packageId;
};

export const updateLearningPackage = async (
  packageId,
  { prodi_id, semester, judul, deskripsi = '', materialIds = null },
  db = pool
) => {
  const [result] = await db.query(
    'UPDATE paket_belajar SET prodi_id = ?, semester = ?, judul = ?, deskripsi = ? WHERE id = ?',
    [prodi_id, semester, judul, deskripsi, packageId]
  );
  if (result.affectedRows === 0) return false;

  if (Array.isArray(materialIds)) {
    await db.query('DELETE FROM paket_belajar_item WHERE paket_belajar_id = ?', [packageId]);
    const uniqueIds = [...new Set(materialIds.map(Number).filter((n) => n > 0))];
    if (uniqueIds.length > 0) {
      const values = uniqueIds.map((matId, idx) => [packageId, matId, idx + 1]);
      await db.query(
        'INSERT INTO paket_belajar_item (paket_belajar_id, materi_id, urutan) VALUES ?',
        [values]
      );
    }
  }

  return true;
};

export const deleteLearningPackage = async (packageId, db = pool) => {
  const [result] = await db.query('DELETE FROM paket_belajar WHERE id = ?', [packageId]);
  return result.affectedRows > 0;
};

export const getApprovedMaterialsForCourseDownload = async (courseId, db = pool) => {
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
    ORDER BY m.id ASC, mf.urutan ASC
  `;
  const [rows] = await db.query(sql, [courseId]);
  return rows;
};

export const getApprovedMaterialsForPackageDownload = async (packageId, db = pool) => {
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
    ORDER BY pbi.urutan ASC, m.id ASC, mf.urutan ASC
  `;
  const [rows] = await db.query(sql, [packageId]);
  return rows;
};

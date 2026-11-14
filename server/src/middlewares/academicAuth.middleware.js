// FILE: server/src/middlewares/academicAuth.middleware.js
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Helper untuk mengekstrak dan me-resolve kelas_id dari request (params, body, query, atau relasi materi)
 */
export async function resolveKelasId(req) {
  if (req.params.kelasId && !isNaN(Number(req.params.kelasId))) {
    return Number(req.params.kelasId);
  }

  // Helper untuk resolve dari string / ID kelas
  const findKelasId = async (val) => {
    if (!val) return null;
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      const [exists] = await pool.query('SELECT id FROM kelas WHERE id = ? LIMIT 1', [num]);
      if (exists.length > 0) return Number(exists[0].id);
    }

    const cleanName = String(val).trim();
    if (!cleanName) return null;

    // Prioritaskan kelas yang diajar oleh pengajar yang bersangkutan jika role pengajar
    if (req.user && ['dosen', 'asisten_lab'].includes(req.user.role)) {
      const [myClasses] = await pool.query(
        `SELECT k.id 
         FROM kelas k 
         INNER JOIN kelas_pengajar kp ON kp.kelas_id = k.id 
         WHERE LOWER(k.nama) = LOWER(?) AND kp.user_id = ? 
         LIMIT 1`,
        [cleanName, req.user.id]
      );
      if (myClasses.length > 0) return Number(myClasses[0].id);
    }

    // Jika tidak ada di kelas yang diajarnya (atau user adalah admin), cari kelas aktif mana saja dengan nama tersebut
    const [rows] = await pool.query('SELECT id FROM kelas WHERE LOWER(nama) = LOWER(?) ORDER BY id DESC LIMIT 1', [
      cleanName,
    ]);
    if (rows.length > 0) return Number(rows[0].id);

    // Jika belum ditemukan di database dan requester adalah pengajar/dosen/admin saat terbitkan tugas baru
    if (req.user && ['dosen', 'asisten_lab', 'admin'].includes(req.user.role)) {
      const [activeSem] = await pool.query('SELECT id FROM semester_akademik WHERE is_active = 1 LIMIT 1');
      const semId = activeSem[0]?.id || 1;
      const [anyMk] = await pool.query('SELECT id FROM mata_kuliah LIMIT 1');
      const mkId = anyMk[0]?.id || 1;

      const [newKelas] = await pool.query(
        'INSERT INTO kelas (mata_kuliah_id, semester_akademik_id, nama) VALUES (?, ?, ?)',
        [mkId, semId, cleanName]
      );
      const newId = Number(newKelas.insertId);

      await pool.query(
        'INSERT IGNORE INTO kelas_pengajar (kelas_id, user_id, peran) VALUES (?, ?, ?)',
        [newId, req.user.id, req.user.role === 'asisten_lab' ? 'asisten' : 'dosen']
      );

      return newId;
    }

    return null;
  };

  if (req.body?.kelas_id) {
    const resolved = await findKelasId(req.body.kelas_id);
    if (resolved && !isNaN(resolved)) return resolved;
  }
  if (req.query?.kelas_id) {
    const resolved = await findKelasId(req.query.kelas_id);
    if (resolved && !isNaN(resolved)) return resolved;
  }

  // Jika request mengarah ke /materials/:id
  if (req.params.materialId || (req.baseUrl.includes('materials') && req.params.id)) {
    const id = req.params.materialId || req.params.id;
    if (!isNaN(Number(id))) {
      const [rows] = await pool.query(
        `SELECT mp.kelas_id 
         FROM materi_item mi
         INNER JOIN materi_pertemuan mp ON mp.id = mi.pertemuan_id
         WHERE mi.id = ? LIMIT 1`,
        [Number(id)]
      );
      if (rows.length > 0) return Number(rows[0].kelas_id);
    }
  }

  return null;
}

/**
 * Memastikan user adalah anggota kelas (mahasiswa terdaftar, dosen/asisten pengampu, atau admin)
 */
export const requireClassMember = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new AppError('Autentikasi diperlukan.', 401);
  }

  // Admin memiliki akses global ke seluruh kelas
  if (req.user.role === 'admin') {
    return next();
  }

  const kelasId = await resolveKelasId(req);
  if (!kelasId) {
    throw new AppError('ID Kelas tidak valid atau tidak ditemukan.', 400);
  }

  req.kelasId = kelasId;

  // Cek apakah user adalah pengajar kelas
  const [pengajar] = await pool.query(
    'SELECT id, peran FROM kelas_pengajar WHERE kelas_id = ? AND user_id = ? LIMIT 1',
    [kelasId, req.user.id]
  );
  if (pengajar.length > 0) {
    req.isInstructor = true;
    req.instructorRole = pengajar[0].peran; // 'dosen' atau 'asisten'
    return next();
  }

  // Cek apakah user adalah mahasiswa peserta aktif
  const [peserta] = await pool.query(
    'SELECT id FROM kelas_peserta WHERE kelas_id = ? AND mahasiswa_id = ? AND status = "aktif" LIMIT 1',
    [kelasId, req.user.id]
  );
  if (peserta.length > 0) {
    req.isStudent = true;
    return next();
  }

  throw new AppError('Akses ditolak. Anda tidak terdaftar sebagai peserta atau pengajar di kelas ini.', 403);
});

/**
 * Memastikan user adalah pengajar kelas (dosen / asisten lab) atau admin
 */
export const requireClassInstructor = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new AppError('Autentikasi diperlukan.', 401);
  }

  const resolvedKelasId = await resolveKelasId(req);
  if (resolvedKelasId && !isNaN(Number(resolvedKelasId))) {
    req.kelasId = Number(resolvedKelasId);
  }

  if (req.user.role === 'admin') {
    req.isInstructor = true;
    req.instructorRole = 'admin';
    return next();
  }

  if (!req.kelasId) {
    throw new AppError('Kelas kuliah tidak ditemukan atau tidak valid. Silakan periksa kembali nama/kode kelas.', 400);
  }

  const [pengajar] = await pool.query(
    'SELECT id, peran FROM kelas_pengajar WHERE kelas_id = ? AND user_id = ? LIMIT 1',
    [req.kelasId, req.user.id]
  );

  if (pengajar.length > 0) {
    req.isInstructor = true;
    req.instructorRole = pengajar[0].peran; // 'dosen' atau 'asisten'
    return next();
  }

  // Jika pengajar belum terdaftar pada kelas yang baru diinput manual, daftarkan otomatis
  await pool.query(
    'INSERT IGNORE INTO kelas_pengajar (kelas_id, user_id, peran) VALUES (?, ?, ?)',
    [req.kelasId, req.user.id, req.user.role === 'asisten_lab' ? 'asisten' : 'dosen']
  );
  req.isInstructor = true;
  req.instructorRole = req.user.role === 'asisten_lab' ? 'asisten' : 'dosen';
  return next();
});

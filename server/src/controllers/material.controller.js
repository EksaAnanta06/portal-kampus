// FILE: server/src/controllers/material.controller.js
import { ZipArchive } from 'archiver';
import https from 'https';
import http from 'http';
import { Readable } from 'stream';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { uploadRawBufferToCloudinary, uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import * as queries from '../queries/material.queries.js';

/**
 * Sanitasi string agar aman dipakai sebagai nama file/folder di ZIP
 * Mencegah path traversal (..) dan karakter terlarang
 */
const sanitizePathSegment = (str) => {
  if (!str) return 'unknown';
  return str
    .replace(/\.\./g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim() || 'item';
};

/**
 * Parser YouTube Video ID (mendukung watch?v=, youtu.be/, embed/, dll.)
 */
const parseYouTubeVideoId = (url) => {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
};

// ============================================================================
// 1. KATALOG AKADEMIK (PRODI & MATA KULIAH)
// ============================================================================

export const getProdiList = async (req, res, next) => {
  try {
    const list = await queries.getProdiListQuery();
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
};

export const createProdi = async (req, res, next) => {
  try {
    const { kode, nama, jenjang, fakultas } = req.body;
    if (!kode || !nama) {
      return next(new AppError('Kode dan nama prodi wajib diisi.', 400));
    }
    const id = await queries.createProdiQuery({ kode, nama, jenjang, fakultas });
    return res.status(201).json({ success: true, message: 'Program studi berhasil dibuat.', data: { id } });
  } catch (error) {
    next(error);
  }
};

export const getCourses = async (req, res, next) => {
  try {
    const { prodiId, semester, search, status, all } = req.query;
    const courses = await queries.getCoursesQuery({
      prodiId: prodiId ? Number(prodiId) : null,
      semesterRekomendasi: semester ? Number(semester) : null,
      search: search || '',
      status: status || 'approved',
      includeAll: all === 'true' && (req.user?.role === 'admin' || req.user?.role === 'moderator'),
    });
    return res.status(200).json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
};

export const getCourseDetail = async (req, res, next) => {
  try {
    const course = await queries.getCourseByIdQuery(Number(req.params.id));
    if (!course) {
      return next(new AppError('Mata kuliah tidak ditemukan.', 404));
    }
    return res.status(200).json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
};

export const createCourse = async (req, res, next) => {
  try {
    const { kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi } = req.body;
    if (!kode || !nama || !prodi_id) {
      return next(new AppError('Kode, nama mata kuliah, dan program studi wajib diisi.', 400));
    }

    const isStaff = req.user.role === 'admin' || req.user.role === 'moderator';
    const status = isStaff ? 'approved' : 'pending';

    const id = await queries.createCourseQuery({
      kode: kode.trim().toUpperCase(),
      nama: nama.trim(),
      sks: Number(sks) || 3,
      prodi_id: Number(prodi_id),
      semester_rekomendasi: Number(semester_rekomendasi) || 1,
      deskripsi: deskripsi || '',
      status,
      proposed_by: isStaff ? null : req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: isStaff
        ? 'Mata kuliah berhasil ditambahkan ke katalog.'
        : 'Usulan mata kuliah berhasil dikirim! Menunggu persetujuan admin/moderator.',
      data: { id, status },
    });
  } catch (error) {
    next(error);
  }
};

export const approveProposedCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = 'approved' } = req.body; // 'approved' atau 'rejected'
    const success = await queries.approveProposedCourseQuery(id, status);
    if (!success) {
      return next(new AppError('Mata kuliah tidak ditemukan.', 404));
    }
    return res.status(200).json({
      success: true,
      message: `Usulan mata kuliah berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}.`,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { kode, nama, sks, prodi_id, semester_rekomendasi, deskripsi, status } = req.body;
    if (!kode || !nama) {
      return next(new AppError('Kode dan nama mata kuliah wajib diisi.', 400));
    }
    const success = await queries.updateCourseQuery(id, {
      kode: kode.trim().toUpperCase(),
      nama: nama.trim(),
      sks: Number(sks) || 3,
      prodi_id: Number(prodi_id) || 1,
      semester_rekomendasi: Number(semester_rekomendasi) || 1,
      deskripsi: deskripsi || '',
      status: status || 'approved',
    });
    if (!success) {
      return next(new AppError('Mata kuliah tidak ditemukan.', 404));
    }
    return res.status(200).json({ success: true, message: 'Mata kuliah berhasil diperbarui.' });
  } catch (error) {
    next(error);
  }
};

export const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const success = await queries.deleteCourseQuery(id);
    if (!success) {
      return next(new AppError('Mata kuliah tidak ditemukan.', 404));
    }
    return res.status(200).json({ success: true, message: 'Mata kuliah berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 2. REPOSITORI & KONTRIBUSI MATERI (PEER-TO-PEER)
// ============================================================================

export const getMaterials = async (req, res, next) => {
  try {
    const { prodiId, semester, mataKuliahId, tipeMateri, tahun, search, sort, status } = req.query;
    const materials = await queries.getMaterialsQuery({
      prodiId: prodiId ? Number(prodiId) : null,
      semester: semester ? Number(semester) : null,
      mataKuliahId: mataKuliahId ? Number(mataKuliahId) : null,
      tipeMateri: tipeMateri || null,
      tahun: tahun || null,
      search: search || '',
      sort: sort || 'terbaru',
      status: status || null,
      currentUserId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : null,
    });

    return res.status(200).json({ success: true, data: materials });
  } catch (error) {
    next(error);
  }
};

export const getMaterialDetail = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const material = await queries.getMaterialByIdQuery(materialId, req.user ? req.user.id : null);
    if (!material) {
      return next(new AppError('Materi tidak ditemukan.', 404));
    }

    // Naikkan view count
    await queries.incrementMaterialViewQuery(materialId);

    // Hitung badge otomatis "Kakak Tingkat"
    // Syarat: role alumni ATAU angkatan uploader lebih tua daripada semester kurikulum target
    const currentYear = new Date().getFullYear();
    const uploaderYear = parseInt(material.uploader_angkatan, 10) || 0;
    const isAlumni = material.uploader_role === 'alumni';
    const isSenior = uploaderYear > 0 && currentYear - uploaderYear >= Math.ceil(material.semester_rekomendasi / 2);
    material.is_kakak_tingkat = isAlumni || isSenior;

    return res.status(200).json({ success: true, data: material });
  } catch (error) {
    next(error);
  }
};

export const createMaterial = async (req, res, next) => {
  try {
    const {
      mata_kuliah_id,
      judul,
      tipe_materi,
      deskripsi,
      tags,
      tahun_akademik,
      angkatan_kontributor,
      dosen_pengampu_teks,
      sumber_kredit,
      external_url,
      agreement_checked,
    } = req.body;

    if (!mata_kuliah_id || !judul || !tipe_materi) {
      return next(new AppError('Mata kuliah, judul, dan tipe materi wajib diisi.', 400));
    }

    // Validasi aturan konten & etika
    if (agreement_checked !== 'true' && agreement_checked !== true && agreement_checked !== 1 && agreement_checked !== '1') {
      return next(
        new AppError('Anda wajib menyetujui Aturan Berbagi Materi (bebas hak cipta bajakan & etika akademik).', 400)
      );
    }

    const isStaff = req.user.role === 'admin' || req.user.role === 'moderator';
    const status = isStaff ? 'approved' : 'pending';

    // Parse YouTube Video ID jika tipe video
    let ytVideoId = null;
    if (external_url) {
      ytVideoId = parseYouTubeVideoId(external_url);
    }

    // 1. Simpan entitas materi utama
    const materialId = await queries.createMaterialQuery({
      mata_kuliah_id: Number(mata_kuliah_id),
      uploaded_by: req.user.id,
      judul: judul.trim(),
      tipe_materi,
      deskripsi: deskripsi || '',
      tags: tags || '',
      tahun_akademik: tahun_akademik || '',
      angkatan_kontributor: angkatan_kontributor || req.user.angkatan_year || req.user.angkatan || '',
      dosen_pengampu_teks: dosen_pengampu_teks || '',
      sumber_kredit: sumber_kredit || '',
      external_url: external_url || '',
      youtube_video_id: ytVideoId,
      is_published: 1,
      status,
    });

    // 2. Upload file-file lampiran jika ada
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let result;
        const isImage = file.mimetype.startsWith('image/');
        if (isImage) {
          result = await uploadBufferToCloudinary(file.buffer, `materials/${materialId}`);
        } else {
          result = await uploadRawBufferToCloudinary(file.buffer, `materials/${materialId}`, {
            accessType: 'upload',
            originalFilename: file.originalname,
          });
        }

        const ext = file.originalname.slice(file.originalname.lastIndexOf('.') + 1).toLowerCase();
        uploadedFiles.push({
          file_url: result.secure_url,
          public_id: result.public_id,
          file_name: file.originalname,
          file_size: file.size || result.bytes,
          file_format: ext,
        });
      }

      await queries.insertMaterialFilesQuery(materialId, uploadedFiles);

      // Catat sebagai versi 1 di history
      if (uploadedFiles.length > 0) {
        await queries.createMaterialVersionQuery({
          materi_id: materialId,
          file_url: uploadedFiles[0].file_url,
          file_name: uploadedFiles[0].file_name,
          file_size: uploadedFiles[0].file_size,
          changelog_note: 'Rilis pertama materi',
          created_by: req.user.id,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: isStaff
        ? 'Materi pembelajaran berhasil dipublikasikan!'
        : 'Materi berhasil diunggah! Berkas Anda akan ditinjau Admin/Moderator sebelum tampil secara publik.',
      data: {
        id: materialId,
        status,
        files_count: uploadedFiles.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMaterial = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const existing = await queries.getMaterialByIdQuery(materialId);
    if (!existing) {
      return next(new AppError('Materi tidak ditemukan.', 404));
    }

    const isOwner = existing.uploaded_by === req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'moderator';

    if (!isOwner && !isStaff) {
      return next(new AppError('Anda tidak memiliki izin mengedit materi ini.', 403));
    }

    const updateFields = {};
    const allowed = [
      'judul',
      'deskripsi',
      'tags',
      'tahun_akademik',
      'dosen_pengampu_teks',
      'sumber_kredit',
      'external_url',
      'is_published',
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updateFields[k] = req.body[k];
    });

    if (updateFields.external_url) {
      updateFields.youtube_video_id = parseYouTubeVideoId(updateFields.external_url);
    }

    await queries.updateMaterialQuery(materialId, updateFields);

    return res.status(200).json({
      success: true,
      message: 'Materi berhasil diperbarui.',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMaterial = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const existing = await queries.getMaterialByIdQuery(materialId);
    if (!existing) {
      return next(new AppError('Materi tidak ditemukan.', 404));
    }

    const isOwner = existing.uploaded_by === req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'moderator';

    if (!isOwner && !isStaff) {
      return next(new AppError('Anda tidak memiliki izin menghapus materi ini.', 403));
    }

    await queries.deleteMaterialQuery(materialId);

    return res.status(200).json({
      success: true,
      message: 'Materi berhasil dihapus.',
    });
  } catch (error) {
    next(error);
  }
};

export const uploadNewVersion = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const existing = await queries.getMaterialByIdQuery(materialId);
    if (!existing) {
      return next(new AppError('Materi tidak ditemukan.', 404));
    }

    const isOwner = existing.uploaded_by === req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'moderator';

    if (!isOwner && !isStaff) {
      return next(new AppError('Anda tidak memiliki izin mengunggah versi baru materi ini.', 403));
    }

    if (!req.file) {
      return next(new AppError('Silakan pilih berkas revisi baru.', 400));
    }

    const { changelog_note } = req.body;

    const isImage = req.file.mimetype.startsWith('image/');
    let result;
    if (isImage) {
      result = await uploadBufferToCloudinary(req.file.buffer, `materials/${materialId}`);
    } else {
      result = await uploadRawBufferToCloudinary(req.file.buffer, `materials/${materialId}`, {
        accessType: 'upload',
        originalFilename: req.file.originalname,
      });
    }

    const versionId = await queries.createMaterialVersionQuery({
      materi_id: materialId,
      file_url: result.secure_url,
      file_name: req.file.originalname,
      file_size: req.file.size || result.bytes,
      changelog_note: changelog_note || 'Pembaruan berkas materi',
      created_by: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Versi baru materi berhasil diunggah!',
      data: { version_id: versionId, file_url: result.secure_url },
    });
  } catch (error) {
    next(error);
  }
};

export const moderateMaterial = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const { status, note } = req.body;

    if (!['approved', 'rejected', 'takedown'].includes(status)) {
      return next(new AppError('Status moderasi tidak valid.', 400));
    }

    const success = await queries.moderateMaterialQuery(materialId, {
      status,
      note: note || '',
      moderatorId: req.user.id,
    });

    if (!success) {
      return next(new AppError('Materi tidak ditemukan.', 404));
    }

    return res.status(200).json({
      success: true,
      message: `Materi berhasil di-${status}.`,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 3. INTERAKSI & GAMIFIKASI (VOTE, KOMENTAR, LAPORAN, LEADERBOARD)
// ============================================================================

export const toggleMaterialVote = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const result = await queries.toggleMaterialVoteQuery(materialId, req.user.id);

    return res.status(200).json({
      success: true,
      message: result.voted
        ? 'Terima kasih! Anda menandai materi ini bermanfaat.'
        : 'Tanda bermanfaat dibatalkan.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMaterialComments = async (req, res, next) => {
  try {
    const comments = await queries.getMaterialCommentsQuery(Number(req.params.id));
    return res.status(200).json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
};

export const addMaterialComment = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const { konten, parent_id } = req.body;

    if (!konten || !konten.trim()) {
      return next(new AppError('Konten komentar tidak boleh kosong.', 400));
    }

    const commentId = await queries.createMaterialCommentQuery({
      materialId,
      userId: req.user.id,
      parentId: parent_id ? Number(parent_id) : null,
      konten: konten.trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Komentar berhasil dipublikasikan.',
      data: { id: commentId },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMaterialComment = async (req, res, next) => {
  try {
    const commentId = Number(req.params.commentId);
    const isStaff = req.user.role === 'admin' || req.user.role === 'moderator';
    const success = await queries.deleteMaterialCommentQuery(commentId, req.user.id, isStaff);

    if (!success) {
      return next(new AppError('Komentar tidak ditemukan atau bukan milik Anda.', 404));
    }

    return res.status(200).json({ success: true, message: 'Komentar berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

export const reportMaterial = async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const { alasan, deskripsi } = req.body;

    if (!alasan) {
      return next(new AppError('Silakan pilih alasan laporan.', 400));
    }

    const reportId = await queries.createMaterialReportQuery({
      materialId,
      reporterId: req.user.id,
      alasan,
      deskripsi: deskripsi || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Laporan Anda telah diterima dan akan ditinjau oleh tim moderator. Terima kasih!',
      data: { id: reportId },
    });
  } catch (error) {
    next(error);
  }
};

export const getMaterialReports = async (req, res, next) => {
  try {
    const reports = await queries.getMaterialReportsQuery();
    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
};

export const handleMaterialReport = async (req, res, next) => {
  try {
    const reportId = Number(req.params.id);
    const { action, takedown_note } = req.body; // 'takedown' atau 'dismissed'

    if (!['takedown', 'dismissed'].includes(action)) {
      return next(new AppError('Tindakan tidak valid.', 400));
    }

    const success = await queries.handleMaterialReportQuery(reportId, {
      action,
      takedownNote: takedown_note,
      handlerId: req.user.id,
    });

    if (!success) {
      return next(new AppError('Laporan tidak ditemukan.', 404));
    }

    return res.status(200).json({
      success: true,
      message: `Laporan berhasil diproses (${action}).`,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 15;
    const leaders = await queries.getContributorsLeaderboardQuery(limit);
    return res.status(200).json({ success: true, data: leaders });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 4. KOLEKSI SAYA (BOOKMARK)
// ============================================================================

export const getUserCollections = async (req, res, next) => {
  try {
    const collections = await queries.getUserCollectionsQuery(req.user.id);
    return res.status(200).json({ success: true, data: collections });
  } catch (error) {
    next(error);
  }
};

export const createCollection = async (req, res, next) => {
  try {
    const { nama, deskripsi } = req.body;
    if (!nama || !nama.trim()) {
      return next(new AppError('Nama koleksi wajib diisi.', 400));
    }
    const id = await queries.createCollectionQuery(req.user.id, nama.trim(), deskripsi || '');
    return res.status(201).json({ success: true, message: 'Koleksi berhasil dibuat.', data: { id } });
  } catch (error) {
    next(error);
  }
};

export const toggleCollectionItem = async (req, res, next) => {
  try {
    const koleksiId = Number(req.params.id);
    const { materi_id } = req.body;
    if (!materi_id) {
      return next(new AppError('ID Materi wajib disertakan.', 400));
    }
    const result = await queries.toggleCollectionItemQuery(koleksiId, Number(materi_id));
    return res.status(200).json({
      success: true,
      message: result.saved ? 'Materi disimpan ke koleksi.' : 'Materi dihapus dari koleksi.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCollection = async (req, res, next) => {
  try {
    const koleksiId = Number(req.params.id);
    const success = await queries.deleteCollectionQuery(koleksiId, req.user.id);
    if (!success) {
      return next(new AppError('Koleksi tidak ditemukan atau bukan milik Anda.', 404));
    }
    return res.status(200).json({ success: true, message: 'Koleksi berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 5. PAPAN "MINTA MATERI"
// ============================================================================

export const getMaterialRequests = async (req, res, next) => {
  try {
    const { prodiId, mataKuliahId, search } = req.query;
    const requests = await queries.getMaterialRequestsQuery({
      prodiId: prodiId ? Number(prodiId) : null,
      mataKuliahId: mataKuliahId ? Number(mataKuliahId) : null,
      search: search || '',
    });
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

export const createMaterialRequest = async (req, res, next) => {
  try {
    const { mata_kuliah_id, judul, deskripsi, tipe_materi_diminta } = req.body;
    if (!mata_kuliah_id || !judul) {
      return next(new AppError('Mata kuliah dan judul permintaan materi wajib diisi.', 400));
    }
    const id = await queries.createMaterialRequestQuery({
      userId: req.user.id,
      mataKuliahId: Number(mata_kuliah_id),
      judul: judul.trim(),
      deskripsi: deskripsi || '',
      tipe_materi_diminta: tipe_materi_diminta || '',
    });
    return res.status(201).json({
      success: true,
      message: 'Permintaan materi berhasil diposting ke papan diskusi!',
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

export const fulfillMaterialRequest = async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    const { fulfilled_materi_id } = req.body;
    if (!fulfilled_materi_id) {
      return next(new AppError('Materi penaut wajib disertakan.', 400));
    }
    const success = await queries.fulfillMaterialRequestQuery(requestId, Number(fulfilled_materi_id));
    if (!success) {
      return next(new AppError('Permintaan materi tidak ditemukan.', 404));
    }
    return res.status(200).json({
      success: true,
      message: 'Permintaan materi telah ditandai terpenuhi!',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 6. PAKET BELAJAR SEMESTER
// ============================================================================

export const getLearningPackages = async (req, res, next) => {
  try {
    const { prodiId, semester } = req.query;
    const packages = await queries.getLearningPackagesQuery({
      prodiId: prodiId ? Number(prodiId) : null,
      semester: semester ? Number(semester) : null,
    });
    return res.status(200).json({ success: true, data: packages });
  } catch (error) {
    next(error);
  }
};

export const getLearningPackageDetail = async (req, res, next) => {
  try {
    const packageId = Number(req.params.id);
    const pkg = await queries.getLearningPackageDetailQuery(packageId);
    if (!pkg) {
      return next(new AppError('Paket belajar tidak ditemukan.', 404));
    }
    return res.status(200).json({ success: true, data: pkg });
  } catch (error) {
    next(error);
  }
};

export const createLearningPackage = async (req, res, next) => {
  try {
    const { prodi_id, semester, judul, deskripsi, material_ids } = req.body;
    if (!prodi_id || !semester || !judul) {
      return next(new AppError('Prodi, semester, dan judul paket belajar wajib diisi.', 400));
    }
    const id = await queries.createLearningPackageQuery({
      prodi_id: Number(prodi_id),
      semester: Number(semester),
      judul: judul.trim(),
      deskripsi: deskripsi || '',
      created_by: req.user.id,
      materialIds: Array.isArray(material_ids) ? material_ids.map(Number) : [],
    });
    return res.status(201).json({
      success: true,
      message: 'Paket Belajar Semester berhasil dikurasi!',
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLearningPackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const success = await queries.deleteLearningPackageQuery(Number(id));
    if (!success) {
      return next(new AppError('Paket belajar tidak ditemukan.', 404));
    }
    return res.status(200).json({ success: true, message: 'Paket belajar berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 7. DOWNLOAD ZIP MATERI DENGAN STREAMING ARCHIVER
// ============================================================================

/**
 * Helper untuk streaming berkas remote ke archiver
 */
const appendRemoteFileToArchive = (archive, fileUrl, zipPath) => {
  return new Promise((resolve, reject) => {
    // Validasi URL
    if (!fileUrl || !fileUrl.startsWith('http')) {
      // Fallback file teks mock jika URL lokal/mock
      archive.append(`Berkas referensi: ${fileUrl}\nUnduh materi pada repositori kampus.`, {
        name: zipPath,
      });
      return resolve();
    }

    const client = fileUrl.startsWith('https') ? https : http;
    client
      .get(fileUrl, (response) => {
        if (response.statusCode >= 400) {
          // Jika 404 atau remote error, catat file info saja agar ZIP tidak crash
          archive.append(`Berkas tidak dapat diakses secara langsung: ${fileUrl}`, {
            name: `${zipPath}.txt`,
          });
          return resolve();
        }
        archive.append(response, { name: zipPath });
        response.on('end', () => resolve());
        response.on('error', (err) => reject(err));
      })
      .on('error', (err) => {
        console.warn(`[ZIP STREAM] Gagal mendownload ${fileUrl}:`, err.message);
        archive.append(`Gagal mengunduh berkas: ${fileUrl}`, { name: `${zipPath}.txt` });
        resolve(); // jangan menggagalkan keseluruhan ZIP
      });
  });
};

/**
 * Unduh Semua Materi 1 Mata Kuliah dalam format ZIP Streaming
 * Struktur Folder: Prodi/Semester-N/MataKuliah/TipeMateri/nama-file.ext
 * Link YouTube/URL eksternal dimasukkan ke link-materi.txt
 */
export const downloadCourseMaterialsZip = async (req, res, next) => {
  try {
    const courseId = Number(req.params.id);
    const course = await queries.getCourseByIdQuery(courseId);
    if (!course) {
      return next(new AppError('Mata kuliah tidak ditemukan.', 404));
    }

    const rows = await queries.getApprovedMaterialsForCourseDownload(courseId);
    if (!rows || rows.length === 0) {
      return next(new AppError('Belum ada materi pembelajaran yang disetujui pada mata kuliah ini.', 404));
    }

    // Set Response Header Streaming ZIP
    const cleanCourseName = sanitizePathSegment(course.nama);
    const zipFilename = `Materi_${course.kode}_${cleanCourseName}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('X-Accel-Buffering', 'no'); // Nonaktifkan buffer Nginx untuk streaming

    const archive = new ZipArchive({
      zlib: { level: 6 }, // Kompresi seimbang
    });

    archive.on('error', (err) => {
      console.error('[Archiver Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Gagal membuat file arsip ZIP.' });
      }
    });

    archive.pipe(res);

    const prodiFolder = sanitizePathSegment(course.prodi_kode || 'UMUM');
    const semFolder = `Semester-${course.semester_rekomendasi || 1}`;
    const courseFolder = `${sanitizePathSegment(course.kode)}_${cleanCourseName}`;

    // Sertakan file informasi akademik materi
    const infoContent =
      `PERPUSTAKAAN MATERI KAMPUS - UNIVERSITAS NASIONAL PASIM\n` +
      `=======================================================\n` +
      `Mata Kuliah  : ${course.kode} - ${course.nama} (${course.sks} SKS)\n` +
      `Program Studi: ${course.prodi_nama || course.prodi_kode || 'Semua Prodi'}\n` +
      `Rekomendasi  : Semester ${course.semester_rekomendasi || 1}\n` +
      `Diunduh oleh : ${req.user.full_name || 'Mahasiswa'} (${req.user.nim || req.user.email})\n` +
      `Waktu Unduh  : ${new Date().toLocaleString('id-ID')}\n\n` +
      `Catatan Etika Pembelajaran:\n` +
      `- Materi ini dibagikan oleh kakak tingkat dan alumni untuk bahan belajar mandiri adik kelas.\n` +
      `- Dilarang keras memperjualbelikan berkas atau menggunakan materi untuk kecurangan ujian aktif.\n`;

    archive.append(infoContent, {
      name: `${prodiFolder}/${semFolder}/${courseFolder}/INFORMASI_MATERI.txt`,
    });

    const linkEntries = [];

    for (const row of rows) {
      const tipeFolder = sanitizePathSegment(row.tipe_materi || 'lainnya');

      // Jika ada berkas file
      if (row.file_url) {
        const cleanFileName = sanitizePathSegment(row.file_name || `berkas_${row.file_id}.${row.file_format || 'pdf'}`);
        const fullZipPath = `${prodiFolder}/${semFolder}/${courseFolder}/${tipeFolder}/${cleanFileName}`;
        await appendRemoteFileToArchive(archive, row.file_url, fullZipPath);
      }

      // Jika ada link YouTube / eksternal
      if (row.external_url) {
        linkEntries.push(`[${row.tipe_materi.toUpperCase()}] ${row.materi_judul}\nURL: ${row.external_url}\n`);
      }
    }

    // Jika ada link, buat file link-materi.txt
    if (linkEntries.length > 0) {
      const linksContent = `DAFTAR TAUTAN MATERI / VIDEO PERKULIAHAN\nMATA KULIAH: ${course.kode} - ${course.nama}\n\n` + linkEntries.join('\n');
      archive.append(linksContent, {
        name: `${prodiFolder}/${semFolder}/${courseFolder}/link-materi.txt`,
      });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};

/**
 * Unduh Semua Materi dalam 1 Paket Belajar Semester dalam format ZIP Streaming
 */
export const downloadPackageMaterialsZip = async (req, res, next) => {
  try {
    const packageId = Number(req.params.id);
    const pkg = await queries.getLearningPackageDetailQuery(packageId);
    if (!pkg) {
      return next(new AppError('Paket belajar tidak ditemukan.', 404));
    }

    const rows = await queries.getApprovedMaterialsForPackageDownload(packageId);
    if (!rows || rows.length === 0) {
      return next(new AppError('Belum ada materi pembelajaran yang disetujui di dalam paket belajar ini.', 404));
    }

    const cleanPkgTitle = sanitizePathSegment(pkg.judul);
    const zipFilename = `PaketBelajar_${cleanPkgTitle}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('X-Accel-Buffering', 'no');

    const archive = new ZipArchive({
      zlib: { level: 6 },
    });

    archive.on('error', (err) => {
      console.error('[Archiver Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Gagal membuat file arsip ZIP.' });
      }
    });

    archive.pipe(res);

    const infoPkgContent =
      `PAKET BELAJAR SEMESTER - UNIVERSITAS NASIONAL PASIM\n` +
      `==================================================\n` +
      `Judul Paket  : ${pkg.judul}\n` +
      `Program Studi: ${pkg.prodi_nama || pkg.prodi_kode || 'Umum'}\n` +
      `Semester     : Semester ${pkg.semester || 1}\n` +
      `Deskripsi    : ${pkg.deskripsi || '-'}\n` +
      `Diunduh oleh : ${req.user.full_name || 'Mahasiswa'} (${req.user.nim || req.user.email})\n` +
      `Waktu Unduh  : ${new Date().toLocaleString('id-ID')}\n\n` +
      `Materi pilihan ini telah dikurasi oleh tim akademik & moderator untuk persiapan belajar.\n`;

    archive.append(infoPkgContent, {
      name: `${cleanPkgTitle}/INFORMASI_PAKET.txt`,
    });

    const linksMap = {}; // courseKey -> [links]

    for (const row of rows) {
      const prodiFolder = sanitizePathSegment(row.prodi_kode || pkg.prodi_kode || 'UMUM');
      const semFolder = `Semester-${row.semester_rekomendasi || pkg.semester || 1}`;
      const courseFolder = `${sanitizePathSegment(row.mata_kuliah_kode)}_${sanitizePathSegment(row.mata_kuliah_nama)}`;
      const tipeFolder = sanitizePathSegment(row.tipe_materi || 'lainnya');

      if (row.file_url) {
        const cleanFileName = sanitizePathSegment(row.file_name || `berkas_${row.file_id}.${row.file_format || 'pdf'}`);
        const fullZipPath = `${cleanPkgTitle}/${prodiFolder}/${semFolder}/${courseFolder}/${tipeFolder}/${cleanFileName}`;
        await appendRemoteFileToArchive(archive, row.file_url, fullZipPath);
      }

      if (row.external_url) {
        const key = `${cleanPkgTitle}/${prodiFolder}/${semFolder}/${courseFolder}`;
        if (!linksMap[key]) linksMap[key] = [];
        linksMap[key].push(`[${row.tipe_materi.toUpperCase()}] ${row.materi_judul}\nURL: ${row.external_url}\n`);
      }
    }

    // Tuliskan file link-materi.txt per mata kuliah
    for (const [folderPath, entries] of Object.entries(linksMap)) {
      const content = `DAFTAR TAUTAN MATERI / VIDEO\n\n` + entries.join('\n');
      archive.append(content, { name: `${folderPath}/link-materi.txt` });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};

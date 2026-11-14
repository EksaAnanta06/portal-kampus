// FILE: server/src/services/material.service.js
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import {
  deleteCloudinaryAsset,
  deleteRawFromCloudinary,
  extractCloudinaryPublicId,
  uploadRawBufferToCloudinary,
} from '../utils/cloudinaryUpload.js';
import { createNotification } from '../queries/campus.queries.js';
import { extractYoutubeVideoId, serializeMaterialDto } from '../utils/youtube.js';
import * as catalogRepo from '../repositories/materialCatalog.repository.js';
import * as materialRepo from '../repositories/material.repository.js';
import * as socialRepo from '../repositories/materialSocial.repository.js';
import * as packageRepo from '../repositories/materialPackage.repository.js';

const STAFF_ROLES = new Set(['admin', 'moderator']);
const isStaffUser = (user) => Boolean(user && STAFF_ROLES.has(user.role));

const getFileExt = (filename = '') => {
  const idx = filename.lastIndexOf('.');
  return idx !== -1 ? filename.slice(idx + 1).toLowerCase() : '';
};

const cleanupCloudinaryAssets = async (assets = []) => {
  const tasks = assets
    .map((item) => {
      const publicId = item?.public_id || extractCloudinaryPublicId(item?.file_url || '');
      if (!publicId || publicId.startsWith('dummy_') || publicId.includes('/mock_')) {
        return null;
      }
      return (async () => {
        const res = await deleteRawFromCloudinary(publicId);
        if (res?.result === 'not found') {
          await deleteCloudinaryAsset(publicId, { resourceType: 'image' });
        }
      })();
    })
    .filter(Boolean);

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
};

// ============================================================================
// 1. KATALOG AKADEMIK (PRODI & MATA KULIAH)
// ============================================================================

export const getProdiListService = async () => catalogRepo.getProdiList();

export const createProdiService = async (payload) => {
  const existing = await catalogRepo.findProdiByKode(payload.kode);
  if (existing) {
    throw new AppError(`Program Studi dengan kode "${payload.kode}" sudah terdaftar.`, 409);
  }
  const id = await catalogRepo.createProdi(payload);
  return { id };
};

export const getCoursesService = async (query, user) => {
  const isStaff = isStaffUser(user);
  return catalogRepo.getCourses({ ...query, isStaff });
};

export const getCourseDetailService = async (courseId, user) => {
  const course = await catalogRepo.getCourseById(courseId);
  if (!course) {
    throw new AppError('Mata kuliah tidak ditemukan.', 404);
  }
  if (!isStaffUser(user) && course.status !== 'approved') {
    throw new AppError('Mata kuliah tidak ditemukan.', 404);
  }
  return course;
};

export const createCourseService = async (payload, user) => {
  const existing = await catalogRepo.findCourseByKode(payload.kode);
  if (existing) {
    throw new AppError(`Mata kuliah dengan kode "${payload.kode}" sudah ada di katalog.`, 409);
  }

  if (payload.prodi_id) {
    const prodi = await catalogRepo.getProdiById(payload.prodi_id);
    if (!prodi) {
      throw new AppError('Program studi tidak ditemukan.', 404);
    }
  }

  const isStaff = isStaffUser(user);
  const initialStatus = isStaff ? 'approved' : 'pending';
  const id = await catalogRepo.createCourse({
    ...payload,
    status: initialStatus,
    proposed_by: user.id,
  });

  return { id, status: initialStatus };
};

export const updateCourseService = async (courseId, payload) => {
  const existing = await catalogRepo.getCourseById(courseId);
  if (!existing) {
    throw new AppError('Mata kuliah tidak ditemukan.', 404);
  }

  if (payload.kode && payload.kode !== existing.kode) {
    const duplicate = await catalogRepo.findCourseByKode(payload.kode, courseId);
    if (duplicate) {
      throw new AppError(`Kode mata kuliah "${payload.kode}" sudah digunakan.`, 409);
    }
  }

  if (payload.prodi_id) {
    const prodi = await catalogRepo.getProdiById(payload.prodi_id);
    if (!prodi) {
      throw new AppError('Program studi tidak ditemukan.', 404);
    }
  }

  await catalogRepo.updateCourse(courseId, payload);
};

export const approveProposedCourseService = async (courseId, status, moderator) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const course = await catalogRepo.getCourseById(courseId, connection);
    if (!course) {
      throw new AppError('Usulan mata kuliah tidak ditemukan.', 404);
    }

    await catalogRepo.updateCourseStatus(courseId, status, connection);

    if (course.proposed_by && course.proposed_by !== moderator.id) {
      await createNotification(
        {
          userId: course.proposed_by,
          type: status === 'approved' ? 'course_approved' : 'course_rejected',
          title:
            status === 'approved'
              ? 'Usulan Mata Kuliah Disetujui!'
              : 'Usulan Mata Kuliah Ditolak',
          message:
            status === 'approved'
              ? `Mata kuliah ${course.kode} - ${course.nama} telah ditambahkan ke katalog Perpustakaan.`
              : `Usulan mata kuliah ${course.kode} - ${course.nama} belum dapat disetujui moderator.`,
          referenceLink: '/akademik/materi',
        },
        connection
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const deleteCourseService = async (courseId) => {
  const existing = await catalogRepo.getCourseById(courseId);
  if (!existing) {
    throw new AppError('Mata kuliah tidak ditemukan.', 404);
  }

  const { materials_count, requests_count } = await catalogRepo.countCourseDependencies(courseId);
  if (materials_count > 0 || requests_count > 0) {
    throw new AppError(
      `Mata kuliah "${existing.kode} - ${existing.nama}" tidak dapat dihapus karena masih memiliki ${materials_count} materi dan ${requests_count} permintaan terkait.`,
      409
    );
  }

  await catalogRepo.deleteCourse(courseId);
};

// ============================================================================
// 2. REPOSITORI & KONTRIBUSI MATERI
// ============================================================================

export const getMaterialsService = async (query, user) => {
  const isStaff = isStaffUser(user);
  const { rows, meta } = await materialRepo.getMaterials({
    ...query,
    currentUserId: user.id,
    isStaff,
  });

  return {
    items: rows.map((row) =>
      serializeMaterialDto(row, { currentUserId: user.id, isStaff })
    ),
    meta,
  };
};

export const getMyApprovedMaterialsService = async (userId) =>
  materialRepo.getMyApprovedMaterials(userId);

export const getMaterialDetailService = async (materialId, user) => {
  const material = await materialRepo.getMaterialById(materialId, user.id);
  if (!material) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }

  const isStaff = isStaffUser(user);
  const isOwner = Number(material.uploaded_by) === Number(user.id);

  // BUG-BE-02: Hanya materi approved/published yang dapat diakses publik; selain itu wajib owner/staff.
  if ((material.status !== 'approved' || !material.is_published) && !isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin mengakses materi ini.', 403);
  }

  if (material.status === 'approved' && material.is_published) {
    await materialRepo.incrementMaterialView(materialId);
    material.view_count = Number(material.view_count || 0) + 1;
  }

  return serializeMaterialDto(material, { currentUserId: user.id, isStaff });
};

export const recordMaterialDownloadService = async (materialId, user) => {
  const meta = await materialRepo.getMaterialAuthMeta(materialId);
  if (!meta) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }

  const isStaff = isStaffUser(user);
  const isOwner = Number(meta.uploaded_by) === Number(user.id);
  if ((meta.status !== 'approved' || !meta.is_published) && !isOwner && !isStaff) {
    throw new AppError('Materi belum tersedia untuk diunduh.', 403);
  }

  if (meta.status === 'approved') {
    await materialRepo.incrementMaterialDownload(materialId);
  }
};

export const createMaterialService = async (payload, files = [], user) => {
  const course = await catalogRepo.getCourseById(payload.mata_kuliah_id);
  if (!course || course.status !== 'approved') {
    throw new AppError('Mata kuliah tidak ditemukan atau belum disetujui di katalog.', 400);
  }

  if (payload.tipe_materi === 'video' && !payload.external_url) {
    throw new AppError('Tautan video YouTube wajib diisi untuk tipe materi Video.', 400);
  }

  if (payload.tipe_materi !== 'video' && files.length === 0 && !payload.external_url) {
    throw new AppError('Harap unggah minimal 1 berkas materi atau masukkan tautan eksternal.', 400);
  }

  const youtubeVideoId = payload.external_url ? extractYoutubeVideoId(payload.external_url) : null;
  const isStaff = isStaffUser(user);
  const initialStatus = isStaff ? 'approved' : 'pending';

  // Upload ke Cloudinary lebih dulu (rollback aset jika transaksi DB gagal)
  const uploadedFilesData = [];
  try {
    for (const file of files) {
      const uploaded = await uploadRawBufferToCloudinary(file.buffer, 'campus-materials', {
        accessType: 'upload',
        originalFilename: file.originalname,
      });
      uploadedFilesData.push({
        file_url: uploaded.secure_url,
        public_id: uploaded.public_id,
        file_name: file.originalname,
        file_size: file.size || uploaded.bytes || 0,
        file_format: getFileExt(file.originalname),
      });
    }
  } catch (err) {
    await cleanupCloudinaryAssets(uploadedFilesData);
    throw err;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const materialId = await materialRepo.createMaterial(
      {
        ...payload,
        uploaded_by: user.id,
        angkatan_kontributor: payload.angkatan_kontributor || String(user.angkatan_year || ''),
        youtube_video_id: youtubeVideoId,
        status: initialStatus,
      },
      connection
    );

    if (uploadedFilesData.length > 0) {
      await materialRepo.insertMaterialFiles(materialId, uploadedFilesData, connection);
    }

    await connection.commit();
    return {
      id: materialId,
      status: initialStatus,
      files: uploadedFilesData,
    };
  } catch (err) {
    await connection.rollback();
    await cleanupCloudinaryAssets(uploadedFilesData);
    throw err;
  } finally {
    connection.release();
  }
};

export const updateMaterialService = async (materialId, payload, user) => {
  const existing = await materialRepo.getMaterialAuthMeta(materialId);
  if (!existing) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }

  const isStaff = isStaffUser(user);
  const isOwner = Number(existing.uploaded_by) === Number(user.id);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin mengubah materi ini.', 403);
  }

  if (existing.status === 'takedown' && !isStaff) {
    throw new AppError('Materi yang sedang di-takedown tidak dapat diedit oleh kontributor.', 403);
  }

  const nextFields = { ...payload };
  if (Object.prototype.hasOwnProperty.call(payload, 'external_url')) {
    nextFields.external_url = payload.external_url || null;
    nextFields.youtube_video_id = payload.external_url
      ? extractYoutubeVideoId(payload.external_url)
      : null;
  }

  let revertedToPending = false;
  if (!isStaff && existing.status === 'approved') {
    nextFields.status = 'pending';
    nextFields.moderation_note = null;
    revertedToPending = true;
  }

  await materialRepo.updateMaterial(materialId, nextFields);
  return { revertedToPending };
};

export const deleteMaterialService = async (materialId, user) => {
  const existing = await materialRepo.getMaterialAuthMeta(materialId);
  if (!existing) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }

  const isStaff = isStaffUser(user);
  const isOwner = Number(existing.uploaded_by) === Number(user.id);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin menghapus materi ini.', 403);
  }

  const assets = await materialRepo.getMaterialAssetsForCleanup(materialId);
  await materialRepo.deleteMaterial(materialId);
  await cleanupCloudinaryAssets(assets);
};

export const uploadNewVersionService = async (materialId, file, changelogNote, user) => {
  if (!file) {
    throw new AppError('Berkas revisi baru wajib dilampirkan.', 400);
  }

  const existing = await materialRepo.getMaterialAuthMeta(materialId);
  if (!existing) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }

  const isStaff = isStaffUser(user);
  const isOwner = Number(existing.uploaded_by) === Number(user.id);
  if (!isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin mengunggah revisi untuk materi ini.', 403);
  }

  if (existing.status === 'takedown' && !isStaff) {
    throw new AppError('Materi yang di-takedown tidak dapat menerima revisi dari kontributor.', 403);
  }

  const uploaded = await uploadRawBufferToCloudinary(file.buffer, 'campus-materials/versions', {
    accessType: 'upload',
    originalFilename: file.originalname,
  });

  const fileFormat = getFileExt(file.originalname);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const versionId = await materialRepo.createMaterialVersion(
      {
        materi_id: materialId,
        file_url: uploaded.secure_url,
        public_id: uploaded.public_id,
        file_name: file.originalname,
        file_size: file.size || uploaded.bytes || 0,
        file_format: fileFormat,
        changelog_note: changelogNote,
        created_by: user.id,
      },
      connection
    );

    if (!isStaff && existing.status === 'approved') {
      await materialRepo.updateMaterial(
        materialId,
        { status: 'pending', moderation_note: null },
        connection
      );
    }

    await connection.commit();
    return {
      version_id: versionId,
      file_url: uploaded.secure_url,
      revertedToPending: !isStaff && existing.status === 'approved',
    };
  } catch (err) {
    await connection.rollback();
    await cleanupCloudinaryAssets([{ public_id: uploaded.public_id, file_url: uploaded.secure_url }]);
    throw err;
  } finally {
    connection.release();
  }
};

export const moderateMaterialService = async (materialId, { status, note }, moderator) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await materialRepo.getMaterialAuthMeta(materialId, connection);
    if (!existing) {
      throw new AppError('Materi tidak ditemukan.', 404);
    }

    await materialRepo.moderateMaterial(
      materialId,
      { status, note, moderatorId: moderator.id },
      connection
    );

    if (existing.uploaded_by && Number(existing.uploaded_by) !== Number(moderator.id)) {
      const notifMeta = {
        approved: {
          type: 'material_approved',
          title: 'Materi Anda Disetujui!',
          message: `Materi "${existing.judul}" telah lolos kurasi dan tayang di Perpustakaan.`,
        },
        rejected: {
          type: 'material_rejected',
          title: 'Materi Ditolak Moderator',
          message: `Materi "${existing.judul}" belum dapat tayang.${note ? ` Alasan: ${note}` : ''}`,
        },
        takedown: {
          type: 'material_takedown',
          title: 'Materi Diturunkan (Takedown)',
          message: `Materi "${existing.judul}" diturunkan oleh moderator.${note ? ` Catatan: ${note}` : ''}`,
        },
      }[status];

      await createNotification(
        {
          userId: existing.uploaded_by,
          ...notifMeta,
          referenceLink: `/akademik/materi/detail/${materialId}`,
        },
        connection
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// ============================================================================
// 3. INTERAKSI & GAMIFIKASI
// ============================================================================

export const toggleMaterialVoteService = async (materialId, user) => {
  const meta = await materialRepo.getMaterialAuthMeta(materialId);
  if (!meta) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }
  if (meta.status !== 'approved' || !meta.is_published) {
    throw new AppError('Hanya materi yang disetujui yang dapat diberi vote.', 403);
  }
  return socialRepo.toggleMaterialVote(materialId, user.id);
};

export const getMaterialCommentsService = async (materialId, user) => {
  const meta = await materialRepo.getMaterialAuthMeta(materialId);
  if (!meta) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }
  const isStaff = isStaffUser(user);
  const isOwner = Number(meta.uploaded_by) === Number(user.id);
  if ((meta.status !== 'approved' || !meta.is_published) && !isOwner && !isStaff) {
    throw new AppError('Anda tidak memiliki izin melihat diskusi materi ini.', 403);
  }
  return socialRepo.getMaterialComments(materialId);
};

export const addMaterialCommentService = async (materialId, { konten, parent_id }, user) => {
  const meta = await materialRepo.getMaterialAuthMeta(materialId);
  if (!meta) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }
  if (meta.status !== 'approved' || !meta.is_published) {
    throw new AppError('Diskusi hanya dibuka untuk materi yang sudah disetujui.', 403);
  }

  if (parent_id) {
    const parent = await socialRepo.getCommentById(parent_id);
    if (!parent || Number(parent.materi_id) !== Number(materialId)) {
      throw new AppError('Komentar induk tidak ditemukan pada materi ini.', 400);
    }
  }

  const commentId = await socialRepo.createMaterialComment({
    materialId,
    userId: user.id,
    parentId: parent_id || null,
    konten,
  });

  if (meta.uploaded_by && Number(meta.uploaded_by) !== Number(user.id)) {
    await createNotification({
      userId: meta.uploaded_by,
      type: 'new_comment',
      title: 'Komentar Baru pada Materi Anda',
      message: `${user.full_name} berdiskusi pada materi "${meta.judul}".`,
      referenceLink: `/akademik/materi/detail/${materialId}`,
    });
  }

  return { id: commentId };
};

export const deleteMaterialCommentService = async (commentId, user) => {
  const success = await socialRepo.deleteMaterialComment(commentId, user.id, isStaffUser(user));
  if (!success) {
    throw new AppError('Komentar tidak ditemukan atau bukan milik Anda.', 404);
  }
};

export const reportMaterialService = async (materialId, { alasan, deskripsi }, user) => {
  const meta = await materialRepo.getMaterialAuthMeta(materialId);
  if (!meta) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }
  if (meta.status !== 'approved') {
    throw new AppError('Hanya materi aktif yang dapat dilaporkan.', 400);
  }

  const existing = await socialRepo.findMaterialReportByReporter(materialId, user.id);
  if (existing) {
    throw new AppError('Anda sudah pernah melaporkan materi ini sebelumnya.', 409);
  }

  const id = await socialRepo.createMaterialReport({
    materialId,
    reporterId: user.id,
    alasan,
    deskripsi,
  });
  return { id };
};

export const getMaterialReportsService = async (query) =>
  socialRepo.getMaterialReports(query);

export const handleMaterialReportService = async (reportId, { action, takedown_note }, handler) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const report = await socialRepo.getMaterialReportById(reportId, connection);
    if (!report) {
      throw new AppError('Laporan tidak ditemukan.', 404);
    }
    if (report.report_status !== 'pending') {
      throw new AppError('Laporan ini sudah diproses sebelumnya.', 400);
    }

    const noteText =
      takedown_note ||
      (action === 'takedown'
        ? 'Diturunkan karena laporan pelanggaran konten.'
        : 'Laporan telah ditinjau oleh moderator.');

    if (action === 'takedown') {
      await materialRepo.moderateMaterial(
        report.materi_id,
        { status: 'takedown', note: noteText, moderatorId: handler.id },
        connection
      );
    }

    await socialRepo.resolveMaterialReport(
      reportId,
      {
        reportStatus: action === 'dismissed' ? 'dismissed' : 'resolved',
        action,
        takedownNote: noteText,
        handlerId: handler.id,
      },
      connection
    );

    if (
      action === 'takedown' &&
      report.uploader_id &&
      Number(report.uploader_id) !== Number(handler.id)
    ) {
      await createNotification(
        {
          userId: report.uploader_id,
          type: 'material_takedown',
          title: 'Materi Diturunkan (Takedown)',
          message: `Materi "${report.materi_judul}" diturunkan berdasarkan laporan pengguna. Catatan: ${noteText}`,
          referenceLink: `/akademik/materi/detail/${report.materi_id}`,
        },
        connection
      );
    }

    if (report.reporter_id && Number(report.reporter_id) !== Number(handler.id)) {
      await createNotification(
        {
          userId: report.reporter_id,
          type: 'system',
          title: 'Laporan Materi Telah Ditindaklanjuti',
          message:
            action === 'takedown'
              ? `Terima kasih. Materi "${report.materi_judul}" telah diturunkan oleh moderator.`
              : `Laporan Anda terkait "${report.materi_judul}" telah ditinjau dan dinyatakan aman oleh moderator.`,
          referenceLink: `/akademik/materi/detail/${report.materi_id}`,
        },
        connection
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const getLeaderboardService = async (limit) =>
  socialRepo.getContributorsLeaderboard(limit);

// ============================================================================
// 4. KOLEKSI SAYA (BOOKMARK)
// ============================================================================

const assertOwnedCollection = async (koleksiId, userId) => {
  const collection = await socialRepo.getCollectionById(koleksiId);
  if (!collection) {
    throw new AppError('Koleksi tidak ditemukan.', 404);
  }
  if (Number(collection.user_id) !== Number(userId)) {
    throw new AppError('Anda tidak memiliki izin mengakses koleksi ini.', 403);
  }
  return collection;
};

export const getUserCollectionsService = async (userId) =>
  socialRepo.getUserCollections(userId);

export const getCollectionItemsService = async (koleksiId, userId) => {
  const collection = await assertOwnedCollection(koleksiId, userId);
  const items = await socialRepo.getCollectionItems(koleksiId);
  return { ...collection, items };
};

export const createCollectionService = async (userId, { nama, deskripsi }) => {
  const id = await socialRepo.createCollection(userId, nama, deskripsi);
  return { id };
};

export const toggleCollectionItemService = async (koleksiId, materiId, userId) => {
  await assertOwnedCollection(koleksiId, userId);

  const meta = await materialRepo.getMaterialAuthMeta(materiId);
  if (!meta) {
    throw new AppError('Materi tidak ditemukan.', 404);
  }
  if (meta.status !== 'approved' || !meta.is_published) {
    throw new AppError('Hanya materi yang disetujui yang dapat disimpan ke koleksi.', 403);
  }

  return socialRepo.toggleCollectionItem(koleksiId, materiId);
};

export const removeCollectionItemService = async (koleksiId, materiId, userId) => {
  await assertOwnedCollection(koleksiId, userId);
  const removed = await socialRepo.removeCollectionItem(koleksiId, materiId);
  if (!removed) {
    throw new AppError('Materi tidak ditemukan dalam koleksi ini.', 404);
  }
};

export const deleteCollectionService = async (koleksiId, userId) => {
  const success = await socialRepo.deleteCollection(koleksiId, userId);
  if (!success) {
    throw new AppError('Koleksi tidak ditemukan atau bukan milik Anda.', 404);
  }
};

// ============================================================================
// 5. PAPAN "MINTA MATERI"
// ============================================================================

export const getMaterialRequestsService = async (query) =>
  socialRepo.getMaterialRequests(query);

export const createMaterialRequestService = async (payload, userId) => {
  const course = await catalogRepo.getCourseById(payload.mata_kuliah_id);
  if (!course || course.status !== 'approved') {
    throw new AppError('Mata kuliah tidak ditemukan atau belum disetujui.', 400);
  }

  const id = await socialRepo.createMaterialRequest({
    userId,
    mataKuliahId: payload.mata_kuliah_id,
    judul: payload.judul,
    deskripsi: payload.deskripsi,
    tipe_materi_diminta: payload.tipe_materi_diminta,
  });
  return { id };
};

export const fulfillMaterialRequestService = async (
  requestId,
  { action = 'link', fulfilled_materi_id },
  user
) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const reqRow = await socialRepo.getMaterialRequestById(requestId, connection);
    if (!reqRow) {
      throw new AppError('Permintaan materi tidak ditemukan.', 404);
    }

    const isRequester = Number(reqRow.user_id) === Number(user.id);
    const isStaff = isStaffUser(user);

    if (action === 'mark_fulfilled' || action === 'reopen') {
      if (!isRequester && !isStaff) {
        throw new AppError(
          'Hanya pembuat permintaan atau moderator yang dapat mengubah status terpenuhi.',
          403
        );
      }

      const nextFulfilled = action === 'mark_fulfilled';
      await socialRepo.updateMaterialRequestFulfillment(
        requestId,
        {
          isFulfilled: nextFulfilled,
          fulfilledMateriId: fulfilled_materi_id || reqRow.fulfilled_materi_id,
        },
        connection
      );
      await connection.commit();
      return { is_fulfilled: nextFulfilled };
    }

    // Mode 'link': tautkan materi approved milik mata kuliah yang sama
    const matMeta = await materialRepo.getMaterialAuthMeta(fulfilled_materi_id, connection);
    if (!matMeta) {
      throw new AppError('Materi penaut tidak ditemukan.', 404);
    }
    if (matMeta.status !== 'approved' || !matMeta.is_published) {
      throw new AppError('Hanya materi berstatus approved yang dapat ditautkan.', 400);
    }
    if (Number(matMeta.mata_kuliah_id) !== Number(reqRow.mata_kuliah_id)) {
      throw new AppError('Materi yang ditautkan harus berasal dari mata kuliah yang sama.', 400);
    }

    const closeImmediately = isRequester || isStaff;
    await socialRepo.updateMaterialRequestFulfillment(
      requestId,
      {
        isFulfilled: closeImmediately,
        fulfilledMateriId: matMeta.id,
      },
      connection
    );

    if (reqRow.user_id && Number(reqRow.user_id) !== Number(user.id)) {
      await createNotification(
        {
          userId: reqRow.user_id,
          type: 'request_fulfilled',
          title: 'Permintaan Materi Mendapat Jawaban!',
          message: `${user.full_name} menautkan materi "${matMeta.judul}" untuk permintaan "${reqRow.judul}".`,
          referenceLink: `/akademik/materi/detail/${matMeta.id}`,
        },
        connection
      );
    }

    await connection.commit();
    return {
      is_fulfilled: closeImmediately,
      fulfilled_materi_id: matMeta.id,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// ============================================================================
// 6. PAKET BELAJAR SEMESTER
// ============================================================================

export const getLearningPackagesService = async (query) =>
  packageRepo.getLearningPackages(query);

export const getLearningPackageDetailService = async (packageId) => {
  const pkg = await packageRepo.getLearningPackageDetail(packageId);
  if (!pkg) {
    throw new AppError('Paket belajar tidak ditemukan.', 404);
  }
  return pkg;
};

const validatePackageMaterials = async (materialIds = [], connection) => {
  const uniqueIds = [...new Set(materialIds.map(Number).filter((n) => n > 0))];
  if (uniqueIds.length === 0) return [];

  const approvedRows = await materialRepo.getApprovedMaterialsByIds(uniqueIds, connection);
  if (approvedRows.length !== uniqueIds.length) {
    throw new AppError(
      'Semua materi dalam Paket Belajar harus tersedia dan berstatus approved.',
      400
    );
  }
  return uniqueIds;
};

export const createLearningPackageService = async (payload, user) => {
  const prodi = await catalogRepo.getProdiById(payload.prodi_id);
  if (!prodi) {
    throw new AppError('Program studi tidak ditemukan.', 404);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const validIds = await validatePackageMaterials(payload.material_ids, connection);
    const id = await packageRepo.createLearningPackage(
      {
        ...payload,
        created_by: user.id,
        materialIds: validIds,
      },
      connection
    );
    await connection.commit();
    return { id };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const updateLearningPackageService = async (packageId, payload) => {
  const prodi = await catalogRepo.getProdiById(payload.prodi_id);
  if (!prodi) {
    throw new AppError('Program studi tidak ditemukan.', 404);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const validIds = await validatePackageMaterials(payload.material_ids, connection);
    const updated = await packageRepo.updateLearningPackage(
      packageId,
      { ...payload, materialIds: validIds },
      connection
    );
    if (!updated) {
      throw new AppError('Paket belajar tidak ditemukan.', 404);
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const deleteLearningPackageService = async (packageId) => {
  const success = await packageRepo.deleteLearningPackage(packageId);
  if (!success) {
    throw new AppError('Paket belajar tidak ditemukan.', 404);
  }
};

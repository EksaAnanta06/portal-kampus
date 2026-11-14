// FILE: server/src/routes/material.routes.js
import { Router } from 'express';
import {
  getProdiList,
  createProdi,
  getCourses,
  getCourseDetail,
  createCourse,
  approveProposedCourse,
  updateCourse,
  deleteCourse,
  getMaterials,
  getMaterialDetail,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  uploadNewVersion,
  moderateMaterial,
  toggleMaterialVote,
  getMaterialComments,
  addMaterialComment,
  deleteMaterialComment,
  reportMaterial,
  getMaterialReports,
  handleMaterialReport,
  getLeaderboard,
  getUserCollections,
  createCollection,
  toggleCollectionItem,
  deleteCollection,
  getMaterialRequests,
  createMaterialRequest,
  fulfillMaterialRequest,
  getLearningPackages,
  getLearningPackageDetail,
  createLearningPackage,
  deleteLearningPackage,
  downloadCourseMaterialsZip,
  downloadPackageMaterialsZip,
} from '../controllers/material.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { uploadMultipleDocuments, uploadSingleDocument } from '../middlewares/upload.middleware.js';
import { zipDownloadLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = Router();

// ============================================================================
// 1. KATALOG AKADEMIK (PRODI & MATA KULIAH)
// ============================================================================
router.get('/catalog/prodi', authenticate, getProdiList);
router.post('/catalog/prodi', authenticate, authorizeRoles('admin', 'moderator'), createProdi);

router.get('/catalog/courses', authenticate, getCourses);
router.get('/catalog/courses/:id', authenticate, getCourseDetail);
router.post('/catalog/courses', authenticate, createCourse); // Mahasiswa bisa mengusulkan, staff langsung approved
router.patch('/catalog/courses/:id/approve', authenticate, authorizeRoles('admin', 'moderator'), approveProposedCourse);
router.put('/catalog/courses/:id', authenticate, authorizeRoles('admin', 'moderator'), updateCourse);
router.delete('/catalog/courses/:id', authenticate, authorizeRoles('admin', 'moderator'), deleteCourse);

// ============================================================================
// 2. REPOSITORI & STATISTIK (GAMIFIKASI, PAPAN MINTA MATERI, PAKET BELAJAR)
// ============================================================================
router.get('/leaderboard', authenticate, getLeaderboard);

// Laporan konten materi (Moderator/Admin)
router.get('/reports', authenticate, authorizeRoles('admin', 'moderator'), getMaterialReports);
router.patch('/reports/:id', authenticate, authorizeRoles('admin', 'moderator'), handleMaterialReport);

// Papan Minta Materi
router.get('/requests', authenticate, getMaterialRequests);
router.post('/requests', authenticate, createMaterialRequest);
router.patch('/requests/:id/fulfill', authenticate, fulfillMaterialRequest);

// Paket Belajar Semester
router.get('/packages', authenticate, getLearningPackages);
router.post('/packages', authenticate, authorizeRoles('admin', 'moderator'), createLearningPackage);
router.get('/packages/:id', authenticate, getLearningPackageDetail);
router.delete('/packages/:id', authenticate, authorizeRoles('admin', 'moderator'), deleteLearningPackage);

// Koleksi Saya (Bookmark)
router.get('/collections', authenticate, getUserCollections);
router.post('/collections', authenticate, createCollection);
router.post('/collections/:id/toggle', authenticate, toggleCollectionItem);
router.delete('/collections/:id', authenticate, deleteCollection);

// Download ZIP Streaming
router.get('/courses/:id/download-zip', authenticate, zipDownloadLimiter, downloadCourseMaterialsZip);
router.get('/packages/:id/download-zip', authenticate, zipDownloadLimiter, downloadPackageMaterialsZip);

// Komentar Global Route
router.delete('/comments/:commentId', authenticate, deleteMaterialComment);

// ============================================================================
// 3. CRUD MATERI & INTERAKSI MATERI
// ============================================================================
router.get('/', authenticate, getMaterials);
router.post('/', authenticate, uploadMultipleDocuments('files', 10), createMaterial);

router.get('/:id', authenticate, getMaterialDetail);
router.put('/:id', authenticate, updateMaterial);
router.delete('/:id', authenticate, deleteMaterial);

// Upload versi baru berkas materi
router.post('/:id/versions', authenticate, uploadSingleDocument('file'), uploadNewVersion);

// Moderasi Materi (ACC / Tolak / Takedown)
router.patch('/:id/moderate', authenticate, authorizeRoles('admin', 'moderator'), moderateMaterial);

// Helpful Vote (Tombol Bermanfaat)
router.post('/:id/vote', authenticate, toggleMaterialVote);

// Komentar & Tanya Jawab
router.get('/:id/comments', authenticate, getMaterialComments);
router.post('/:id/comments', authenticate, addMaterialComment);

// Laporkan Materi
router.post('/:id/report', authenticate, reportMaterial);

export default router;

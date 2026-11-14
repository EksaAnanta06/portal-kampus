// FILE: server/src/routes/material.routes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  uploadMultipleDocuments,
  uploadSingleDocument,
} from '../middlewares/upload.middleware.js';
import {
  approveCourseSchema,
  collectionItemParamSchema,
  commentIdParamSchema,
  coursesQuerySchema,
  createCollectionSchema,
  createCommentSchema,
  createCourseSchema,
  createMaterialSchema,
  createProdiSchema,
  createRequestSchema,
  fulfillRequestSchema,
  handleReportSchema,
  idParamSchema,
  leaderboardQuerySchema,
  materialsQuerySchema,
  moderateMaterialSchema,
  packageBodySchema,
  packagesQuerySchema,
  reportMaterialSchema,
  reportsQuerySchema,
  requestsQuerySchema,
  toggleCollectionItemSchema,
  updateCourseSchema,
  updateMaterialSchema,
  uploadVersionSchema,
} from '../validators/material.validator.js';
import {
  approveProposedCourse,
  createCourse,
  createProdi,
  deleteCourse,
  getCourseDetail,
  getCourses,
  getProdiList,
  updateCourse,
} from '../controllers/materialCatalog.controller.js';
import {
  createMaterial,
  deleteMaterial,
  getMaterialDetail,
  getMaterials,
  getMyApprovedMaterials,
  moderateMaterial,
  recordMaterialDownload,
  updateMaterial,
  uploadNewVersion,
} from '../controllers/material.controller.js';
import {
  addMaterialComment,
  createCollection,
  createMaterialRequest,
  deleteCollection,
  deleteMaterialComment,
  fulfillMaterialRequest,
  getCollectionItems,
  getLeaderboard,
  getMaterialComments,
  getMaterialReports,
  getMaterialRequests,
  getUserCollections,
  handleMaterialReport,
  removeCollectionItem,
  reportMaterial,
  toggleCollectionItem,
  toggleMaterialVote,
} from '../controllers/materialInteraction.controller.js';
import {
  createLearningPackage,
  deleteLearningPackage,
  downloadCourseMaterialsZip,
  downloadPackageMaterialsZip,
  getLearningPackageDetail,
  getLearningPackages,
  updateLearningPackage,
} from '../controllers/materialPackage.controller.js';

const router = Router();

// Seluruh akses perpustakaan materi mewajibkan login & akun aktif
router.use(authenticate);

// ============================================================================
// 1. KATALOG AKADEMIK (PROGRAM STUDI & MATA KULIAH)
// ============================================================================
router.get('/catalog/prodi', getProdiList);
router.post(
  '/catalog/prodi',
  authorizeRoles('admin', 'moderator'),
  validate(createProdiSchema),
  createProdi
);

router.get('/catalog/courses', validate(coursesQuerySchema, 'query'), getCourses);
router.get('/catalog/courses/:id', validate(idParamSchema, 'params'), getCourseDetail);
router.post('/catalog/courses', validate(createCourseSchema), createCourse);
router.patch(
  '/catalog/courses/:id/approve',
  authorizeRoles('admin', 'moderator'),
  validate(idParamSchema, 'params'),
  validate(approveCourseSchema),
  approveProposedCourse
);
router.put(
  '/catalog/courses/:id',
  authorizeRoles('admin', 'moderator'),
  validate(idParamSchema, 'params'),
  validate(updateCourseSchema),
  updateCourse
);
router.delete(
  '/catalog/courses/:id',
  authorizeRoles('admin', 'moderator'),
  validate(idParamSchema, 'params'),
  deleteCourse
);

// ============================================================================
// 2. STATIC / FEATURE SUB-ROUTES (HARUS DI ATAS ROUTE DINAMIS /:id)
// ============================================================================
router.get('/my/approved', getMyApprovedMaterials);
router.get('/leaderboard', validate(leaderboardQuerySchema, 'query'), getLeaderboard);

// Laporan Materi (Admin / Moderator)
router.get(
  '/reports',
  authorizeRoles('admin', 'moderator'),
  validate(reportsQuerySchema, 'query'),
  getMaterialReports
);
router.patch(
  '/reports/:id',
  authorizeRoles('admin', 'moderator'),
  validate(idParamSchema, 'params'),
  validate(handleReportSchema),
  handleMaterialReport
);

// Papan "Minta Materi"
router.get('/requests', validate(requestsQuerySchema, 'query'), getMaterialRequests);
router.post('/requests', validate(createRequestSchema), createMaterialRequest);
router.patch(
  '/requests/:id/fulfill',
  validate(idParamSchema, 'params'),
  validate(fulfillRequestSchema),
  fulfillMaterialRequest
);

// Paket Belajar Semester
router.get('/packages', validate(packagesQuerySchema, 'query'), getLearningPackages);
router.post(
  '/packages',
  authorizeRoles('admin', 'moderator'),
  validate(packageBodySchema),
  createLearningPackage
);
router.get('/packages/:id', validate(idParamSchema, 'params'), getLearningPackageDetail);
router.put(
  '/packages/:id',
  authorizeRoles('admin', 'moderator'),
  validate(idParamSchema, 'params'),
  validate(packageBodySchema),
  updateLearningPackage
);
router.delete(
  '/packages/:id',
  authorizeRoles('admin', 'moderator'),
  validate(idParamSchema, 'params'),
  deleteLearningPackage
);

// Koleksi Saya (Bookmark)
router.get('/collections', getUserCollections);
router.get('/collections/:id/items', validate(idParamSchema, 'params'), getCollectionItems);
router.post('/collections', validate(createCollectionSchema), createCollection);
router.post(
  '/collections/:id/toggle',
  validate(idParamSchema, 'params'),
  validate(toggleCollectionItemSchema),
  toggleCollectionItem
);
router.delete(
  '/collections/:id/items/:materiId',
  validate(collectionItemParamSchema, 'params'),
  removeCollectionItem
);
router.delete('/collections/:id', validate(idParamSchema, 'params'), deleteCollection);

// Download ZIP Streaming
router.get('/courses/:id/download-zip', validate(idParamSchema, 'params'), downloadCourseMaterialsZip);
router.get('/packages/:id/download-zip', validate(idParamSchema, 'params'), downloadPackageMaterialsZip);

// Hapus Komentar Materi
router.delete('/comments/:commentId', validate(commentIdParamSchema, 'params'), deleteMaterialComment);

// ============================================================================
// 3. CRUD MATERI, VERSI, MODERASI & INTERAKSI
// ============================================================================
router.get('/', validate(materialsQuerySchema, 'query'), getMaterials);
router.post(
  '/',
  uploadMultipleDocuments,
  validate(createMaterialSchema),
  createMaterial
);

router.get('/:id', validate(idParamSchema, 'params'), getMaterialDetail);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateMaterialSchema), updateMaterial);
router.delete('/:id', validate(idParamSchema, 'params'), deleteMaterial);

router.post('/:id/download', validate(idParamSchema, 'params'), recordMaterialDownload);

router.post(
  '/:id/versions',
  validate(idParamSchema, 'params'),
  uploadSingleDocument,
  validate(uploadVersionSchema),
  uploadNewVersion
);

router.patch(
  '/:id/moderate',
  authorizeRoles('admin', 'moderator'),
  validate(idParamSchema, 'params'),
  validate(moderateMaterialSchema),
  moderateMaterial
);

router.post('/:id/vote', validate(idParamSchema, 'params'), toggleMaterialVote);
router.get('/:id/comments', validate(idParamSchema, 'params'), getMaterialComments);
router.post(
  '/:id/comments',
  validate(idParamSchema, 'params'),
  validate(createCommentSchema),
  addMaterialComment
);
router.post(
  '/:id/report',
  validate(idParamSchema, 'params'),
  validate(reportMaterialSchema),
  reportMaterial
);

export default router;

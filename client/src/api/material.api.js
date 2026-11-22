// FILE: client/src/api/material.api.js
import axiosInstance from './axiosInstance';
import { unwrap, cleanParams, triggerBlobDownload } from './apiHelpers';

export const materialApi = {
  // ============================================================================
  // 1. KATALOG AKADEMIK (PRODI & MATA KULIAH)
  // ============================================================================
  getProdiList: () => unwrap(axiosInstance.get('/materials/catalog/prodi')),
  createProdi: (payload) => unwrap(axiosInstance.post('/materials/catalog/prodi', payload)),

  getCourses: (params, config = {}) =>
    unwrap(axiosInstance.get('/materials/catalog/courses', { ...config, params: cleanParams(params) })),
  getCourseDetail: (courseId) =>
    unwrap(axiosInstance.get(`/materials/catalog/courses/${courseId}`)),
  createCourse: (payload) =>
    unwrap(axiosInstance.post('/materials/catalog/courses', payload)),
  updateCourse: (courseId, payload) =>
    unwrap(axiosInstance.put(`/materials/catalog/courses/${courseId}`, payload)),
  deleteCourse: (courseId) =>
    unwrap(axiosInstance.delete(`/materials/catalog/courses/${courseId}`)),
  approveProposedCourse: (courseId, payload) =>
    unwrap(axiosInstance.patch(`/materials/catalog/courses/${courseId}/approve`, payload)),

  // ============================================================================
  // 2. REPOSITORI & KONTRIBUSI MATERI (PEER-TO-PEER)
  // ============================================================================
  getMaterials: (params, config = {}) =>
    unwrap(axiosInstance.get('/materials', { ...config, params: cleanParams(params) })),
  getMyApprovedMaterials: (config = {}) =>
    unwrap(axiosInstance.get('/materials/my/approved', config)),
  getMaterialDetail: (materialId) =>
    unwrap(axiosInstance.get(`/materials/${materialId}`)),
  getPendingMaterials: (params = {}, config = {}) =>
    unwrap(
      axiosInstance.get('/materials', {
        ...config,
        params: cleanParams({ ...params, status: 'pending' }),
      })
    ),
  recordDownload: (materialId) =>
    unwrap(axiosInstance.post(`/materials/${materialId}/download`)),

  createMaterial: (formData, onProgress) =>
    unwrap(
      axiosInstance.post('/materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      })
    ),

  updateMaterial: (materialId, payload) =>
    unwrap(axiosInstance.put(`/materials/${materialId}`, payload)),

  deleteMaterial: (materialId) =>
    unwrap(axiosInstance.delete(`/materials/${materialId}`)),

  uploadNewVersion: (materialId, formData, onProgress) =>
    unwrap(
      axiosInstance.post(`/materials/${materialId}/versions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      })
    ),

  moderateMaterial: (materialId, payload) =>
    unwrap(axiosInstance.patch(`/materials/${materialId}/moderate`, payload)),

  // ============================================================================
  // 3. INTERAKSI & GAMIFIKASI (VOTE, KOMENTAR, LAPORAN, LEADERBOARD)
  // ============================================================================
  toggleVote: (materialId) =>
    unwrap(axiosInstance.post(`/materials/${materialId}/vote`)),

  getComments: (materialId) =>
    unwrap(axiosInstance.get(`/materials/${materialId}/comments`)),

  addComment: (materialId, payload) =>
    unwrap(axiosInstance.post(`/materials/${materialId}/comments`, payload)),

  deleteComment: (commentId) =>
    unwrap(axiosInstance.delete(`/materials/comments/${commentId}`)),

  reportMaterial: (materialId, payload) =>
    unwrap(axiosInstance.post(`/materials/${materialId}/report`, payload)),

  getReports: (params, config = {}) =>
    unwrap(axiosInstance.get('/materials/reports', { ...config, params: cleanParams(params) })),
  getMaterialReports: (params, config = {}) =>
    unwrap(axiosInstance.get('/materials/reports', { ...config, params: cleanParams(params) })),

  handleReport: (reportId, payload) =>
    unwrap(axiosInstance.patch(`/materials/reports/${reportId}`, payload)),
  handleMaterialReport: (reportId, payload) =>
    unwrap(axiosInstance.patch(`/materials/reports/${reportId}`, payload)),

  getLeaderboard: (params) =>
    unwrap(axiosInstance.get('/materials/leaderboard', { params: cleanParams(params) })),

  // ============================================================================
  // 4. KOLEKSI SAYA (BOOKMARK)
  // ============================================================================
  getUserCollections: () =>
    unwrap(axiosInstance.get('/materials/collections')),

  getCollectionItems: (collectionId) =>
    unwrap(axiosInstance.get(`/materials/collections/${collectionId}/items`)),

  createCollection: (payload) =>
    unwrap(axiosInstance.post('/materials/collections', payload)),

  toggleCollectionItem: (collectionId, payload) =>
    unwrap(axiosInstance.post(`/materials/collections/${collectionId}/toggle`, payload)),

  removeCollectionItem: (collectionId, materiId) =>
    unwrap(axiosInstance.delete(`/materials/collections/${collectionId}/items/${materiId}`)),

  deleteCollection: (collectionId) =>
    unwrap(axiosInstance.delete(`/materials/collections/${collectionId}`)),

  // ============================================================================
  // 5. PAPAN "MINTA MATERI"
  // ============================================================================
  getRequests: (params) =>
    unwrap(axiosInstance.get('/materials/requests', { params: cleanParams(params) })),

  createRequest: (payload) =>
    unwrap(axiosInstance.post('/materials/requests', payload)),

  fulfillRequest: (requestId, payload) =>
    unwrap(axiosInstance.patch(`/materials/requests/${requestId}/fulfill`, payload)),

  // ============================================================================
  // 6. PAKET BELAJAR SEMESTER
  // ============================================================================
  getLearningPackages: (params) =>
    unwrap(axiosInstance.get('/materials/packages', { params: cleanParams(params) })),

  getLearningPackageDetail: (packageId) =>
    unwrap(axiosInstance.get(`/materials/packages/${packageId}`)),

  createLearningPackage: (payload) =>
    unwrap(axiosInstance.post('/materials/packages', payload)),

  updateLearningPackage: (packageId, payload) =>
    unwrap(axiosInstance.put(`/materials/packages/${packageId}`, payload)),

  deleteLearningPackage: (packageId) =>
    unwrap(axiosInstance.delete(`/materials/packages/${packageId}`)),

  // ============================================================================
  // 7. DOWNLOAD ZIP STREAMING
  // ============================================================================
  downloadCourseZip: async (courseId, courseName = 'materi') => {
    const res = await axiosInstance.get(`/materials/courses/${courseId}/download-zip`, {
      responseType: 'blob',
      timeout: 0,
    });
    return triggerBlobDownload(res.data, `Materi_${courseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`);
  },

  downloadPackageZip: async (packageId, packageName = 'paket_belajar') => {
    const res = await axiosInstance.get(`/materials/packages/${packageId}/download-zip`, {
      responseType: 'blob',
      timeout: 0,
    });
    return triggerBlobDownload(res.data, `Paket_${packageName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`);
  },
};

export default materialApi;

// FILE: client/src/api/material.api.js
import axiosInstance from './axiosInstance';

const unwrap = (promise) => promise.then((res) => res.data);

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );

export const materialApi = {
  // ============================================================================
  // 1. KATALOG AKADEMIK (PRODI & MATA KULIAH)
  // ============================================================================
  getProdiList: () => unwrap(axiosInstance.get('/materials/catalog/prodi')),
  createProdi: (payload) => unwrap(axiosInstance.post('/materials/catalog/prodi', payload)),

  getCourses: (params) =>
    unwrap(axiosInstance.get('/materials/catalog/courses', { params: cleanParams(params) })),
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
  getMaterials: (params) =>
    unwrap(axiosInstance.get('/materials', { params: cleanParams(params) })),
  getMaterialDetail: (materialId) =>
    unwrap(axiosInstance.get(`/materials/${materialId}`)),
  getPendingMaterials: () =>
    unwrap(axiosInstance.get('/materials', { params: { status: 'pending' } })),
  getMaterialClasses: (params) =>
    unwrap(axiosInstance.get('/materials/catalog/courses', { params: cleanParams(params) })),
  getClassMaterials: (courseId) =>
    unwrap(axiosInstance.get(`/materials/catalog/courses/${courseId}`)),

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

  uploadNewVersion: (materialId, formData) =>
    unwrap(
      axiosInstance.post(`/materials/${materialId}/versions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
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

  getReports: () =>
    unwrap(axiosInstance.get('/materials/reports')),
  getMaterialReports: () =>
    unwrap(axiosInstance.get('/materials/reports')),

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

  createCollection: (payload) =>
    unwrap(axiosInstance.post('/materials/collections', payload)),

  toggleCollectionItem: (collectionId, payload) =>
    unwrap(axiosInstance.post(`/materials/collections/${collectionId}/toggle`, payload)),

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

  deleteLearningPackage: (packageId) =>
    unwrap(axiosInstance.delete(`/materials/packages/${packageId}`)),

  // ============================================================================
  // 7. DOWNLOAD ZIP STREAMING
  // ============================================================================
  downloadCourseZip: async (courseId, courseName = 'materi') => {
    const res = await axiosInstance.get(`/materials/courses/${courseId}/download-zip`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Materi_${courseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadPackageZip: async (packageId, packageName = 'paket_belajar') => {
    const res = await axiosInstance.get(`/materials/packages/${packageId}/download-zip`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Paket_${packageName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default materialApi;

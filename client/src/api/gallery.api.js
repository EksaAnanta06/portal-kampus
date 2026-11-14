// FILE: client/src/api/gallery.api.js
import axiosInstance from './axiosInstance';
import { unwrap, cleanParams } from './apiHelpers';

export const galleryApi = {
  // ---------- Angkatan ----------
  getAngkatanList: () => unwrap(axiosInstance.get('/angkatan')),
  getAngkatanDetail: (yearOrId) => unwrap(axiosInstance.get(`/angkatan/${yearOrId}`)),
  /** formData: year, title, description, cover (file) */
  createAngkatan: (formData) => unwrap(axiosInstance.post('/angkatan', formData)),
  updateAngkatan: (id, formData) => unwrap(axiosInstance.put(`/angkatan/${id}`, formData)),
  deleteAngkatan: (id) => unwrap(axiosInstance.delete(`/angkatan/${id}`)),

  // ---------- Album ----------
  getAlbums: (angkatanId) => unwrap(axiosInstance.get('/albums', { params: { angkatan_id: angkatanId } })),
  createAlbum: (payload) => unwrap(axiosInstance.post('/albums', payload)),
  updateAlbum: (id, payload) => unwrap(axiosInstance.put(`/albums/${id}`, payload)),
  deleteAlbum: (id) => unwrap(axiosInstance.delete(`/albums/${id}`)),

  // ---------- Foto ----------
  /** params: angkatan_id, angkatan_year, album_id, uploader_id, status, search, tag, page, limit */
  getPhotos: (params, config = {}) =>
    unwrap(axiosInstance.get('/photos', { ...config, params: cleanParams(params) })),
  getPhotoDetail: (id) => unwrap(axiosInstance.get(`/photos/${id}`)),
  /** formData: photos[] (file), angkatan_id, album_id, caption, tags, taken_date */
  uploadPhotos: (formData, onProgress) =>
    unwrap(
      axiosInstance.post('/photos/upload', formData, {
        timeout: 0,
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
        },
      })
    ),
  updatePhoto: (id, payload) => unwrap(axiosInstance.put(`/photos/${id}`, payload)),
  deletePhoto: (id) => unwrap(axiosInstance.delete(`/photos/${id}`)),
  moderatePhoto: (id, { status, rejection_reason }) =>
    unwrap(axiosInstance.patch(`/photos/${id}/moderate`, { status, rejection_reason })),

  // ---------- Interaksi ----------
  toggleLike: (id) => unwrap(axiosInstance.post(`/photos/${id}/like`)),
  getPhotoLikers: (id) => unwrap(axiosInstance.get(`/photos/${id}/likes`)),
  getComments: (id) => unwrap(axiosInstance.get(`/photos/${id}/comments`)),
  addComment: (id, content) => unwrap(axiosInstance.post(`/photos/${id}/comments`, { content })),
  updateComment: (photoId, commentId, content) =>
    unwrap(axiosInstance.put(`/photos/${photoId}/comments/${commentId}`, { content })),
  deleteComment: (photoId, commentId) =>
    unwrap(axiosInstance.delete(`/photos/${photoId}/comments/${commentId}`)),
  reportPhoto: (id, { reason, description }) =>
    unwrap(axiosInstance.post(`/photos/${id}/report`, { reason, description })),

  // ---------- Laporan (Admin/Moderator) ----------
  getReports: (status = 'open') => unwrap(axiosInstance.get('/photos/reports/list', { params: { status } })),
  resolveReport: (reportId, status = 'resolved') =>
    unwrap(axiosInstance.patch(`/photos/reports/${reportId}/resolve`, { status })),
};

export default galleryApi;

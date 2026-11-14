// FILE: client/src/api/user.api.js
import axiosInstance from './axiosInstance';
import { unwrap, cleanParams } from './apiHelpers';

export const userApi = {
  /** params: search, angkatan, prodi, role, page, limit */
  getDirectory: (params, config = {}) =>
    unwrap(axiosInstance.get('/users/directory', { ...config, params: cleanParams(params) })),
  getUserProfile: (id) => unwrap(axiosInstance.get(`/users/profile/${id}`)),

  /** formData: field profil + avatar (file, opsional) */
  updateProfile: (formData) => unwrap(axiosInstance.put('/users/profile', formData)),

  // ---------- Admin ----------
  /** params: status, search, page, limit */
  getAdminUsers: (params, config = {}) =>
    unwrap(axiosInstance.get('/users/admin/list', { ...config, params: cleanParams(params) })),
  verifyUser: (id, { status, role }) =>
    unwrap(axiosInstance.patch(`/users/admin/${id}/verify`, role ? { status, role } : { status })),
};

export default userApi;

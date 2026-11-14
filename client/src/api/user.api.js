// FILE: client/src/api/user.api.js
import axiosInstance from './axiosInstance';

const unwrap = (promise) => promise.then((res) => res.data);

const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export const userApi = {
  /** params: search, angkatan, prodi, role, page, limit */
  getDirectory: (params) => unwrap(axiosInstance.get('/users/directory', { params: cleanParams(params) })),
  getUserProfile: (id) => unwrap(axiosInstance.get(`/users/profile/${id}`)),

  /** formData: field profil + avatar (file, opsional) */
  updateProfile: (formData) => unwrap(axiosInstance.put('/users/profile', formData)),

  // ---------- Admin ----------
  /** params: status, search, page, limit */
  getAdminUsers: (params) => unwrap(axiosInstance.get('/users/admin/list', { params: cleanParams(params) })),
  verifyUser: (id, { status, role }) =>
    unwrap(axiosInstance.patch(`/users/admin/${id}/verify`, role ? { status, role } : { status })),
};

export default userApi;

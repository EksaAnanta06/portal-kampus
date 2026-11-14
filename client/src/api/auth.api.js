// FILE: client/src/api/auth.api.js
import axiosInstance from './axiosInstance';

// Semua fungsi mengembalikan body response API: { success, message, data, meta }
const unwrap = (promise) => promise.then((res) => res.data);

export const authApi = {
  register: (payload) => unwrap(axiosInstance.post('/auth/register', payload)),
  login: (payload) => unwrap(axiosInstance.post('/auth/login', payload)),
  logout: () => unwrap(axiosInstance.post('/auth/logout')),
  me: () => unwrap(axiosInstance.get('/auth/me')),
  forgotPassword: (email) => unwrap(axiosInstance.post('/auth/forgot-password', { email })),
  resetPassword: ({ token, password }) =>
    unwrap(axiosInstance.post('/auth/reset-password', { token, password })),
};

export default authApi;

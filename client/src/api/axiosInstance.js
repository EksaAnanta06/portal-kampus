// FILE: client/src/api/axiosInstance.js
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // kirim cookie httpOnly refresh token
  timeout: 60000,
});

// Instance terpisah tanpa interceptor untuk memanggil /auth/refresh (mencegah loop)
export const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
});

// ---------- Request: sisipkan access token dari memori (Zustand) ----------
axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Response: auto-refresh token dengan antrean (queueing) ----------
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password'];

/** Memanggil endpoint refresh; satu permintaan saja walau dipanggil bersamaan */
let refreshPromise = null;
export const requestNewAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh')
      .then((res) => {
        const { user, accessToken } = res.data.data;
        useAuthStore.getState().setAuth({ user, accessToken });
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || '';

    const shouldTryRefresh =
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !AUTH_ENDPOINTS_WITHOUT_REFRESH.some((p) => url.includes(p));

    if (!shouldTryRefresh) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Tunggu refresh yang sedang berjalan, lalu ulangi request dengan token baru
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await requestNewAccessToken();
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

/** Mengambil pesan error yang ramah dari response API standar { success, message, meta } */
export const getErrorMessage = (error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') => {
  if (error?.response?.data?.message) {
    const { message, meta } = error.response.data;
    const firstFieldError = meta?.errors?.[0]?.message;
    return firstFieldError && error.response.status === 422 ? `${message} ${firstFieldError}` : message;
  }
  if (error?.code === 'ECONNABORTED') return 'Permintaan melebihi batas waktu. Periksa koneksi Anda.';
  if (error?.message === 'Network Error') return 'Tidak dapat terhubung ke server. Pastikan backend berjalan.';
  return fallback;
};

/** Mengambil error per-field (validasi Zod 422) menjadi object { field: message } */
export const getFieldErrors = (error) => {
  const errors = error?.response?.data?.meta?.errors;
  if (!Array.isArray(errors)) return {};
  return errors.reduce((acc, e) => {
    if (e.field && !acc[e.field]) acc[e.field] = e.message;
    return acc;
  }, {});
};

export default axiosInstance;

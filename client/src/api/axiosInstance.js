// FILE: client/src/api/axiosInstance.js
import axios from 'axios';
import { getAccessToken, setAuthTokens, clearAuthSession } from './authBridge';
import { isNativePlatform } from '../platform/detection';
import {
  getNativeRefreshToken,
  setNativeRefreshToken,
  clearNativeRefreshToken,
} from '../platform/authStorage';

const STATIC_TUNNEL_API_URL = 'https://nondecayed-bodhi-bardier.ngrok-free.dev/api/v1';

const isNonLocalHttpUrl = (url) =>
  Boolean(
    url &&
      (url.startsWith('http://') || url.startsWith('https://')) &&
      !url.includes('localhost') &&
      !url.includes('127.0.0.1')
  );

const getDefaultApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  // Jika VITE_API_BASE_URL berupa URL statis publik (mis. Ngrok/produksi), pakai endpoint yang sama di FE & Android
  if (isNonLocalHttpUrl(envUrl)) {
    return envUrl;
  }

  // Jika di native (Android / iOS), jangan pakai localhost atau path relatif
  if (typeof window !== 'undefined' && isNativePlatform()) {
    if (
      window.location?.origin &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return `${window.location.origin}/api/v1`;
    }
    return STATIC_TUNNEL_API_URL;
  }

  return envUrl || STATIC_TUNNEL_API_URL;
};

export const API_BASE_URL = getDefaultApiBaseUrl();

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // kirim cookie httpOnly refresh token
  timeout: 60000,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Instance terpisah tanpa interceptor untuk memanggil /auth/refresh (mencegah loop)
export const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
    'ngrok-skip-browser-warning': 'true',
  },
});

// ---------- Request: sisipkan header native & access token dari memori (Zustand) ----------
axiosInstance.interceptors.request.use((config) => {
  if (isNativePlatform()) {
    config.headers['X-Client'] = 'native';
  }
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

refreshClient.interceptors.request.use((config) => {
  if (isNativePlatform()) {
    config.headers['X-Client'] = 'native';
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

const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/google/exchange',
  '/auth/google/pending-registration',
  '/auth/google/complete-registration',
];

/** Memanggil endpoint refresh; satu permintaan saja walau dipanggil bersamaan */
let refreshPromise = null;
export const requestNewAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const native = isNativePlatform();
      let payload;
      const headers = {};

      if (native) {
        headers['X-Client'] = 'native';
        const storedRefreshToken = await getNativeRefreshToken();
        if (!storedRefreshToken) {
          const err = new Error('NO_NATIVE_SESSION');
          err.code = 'NO_NATIVE_SESSION';
          throw err;
        }
        payload = { refreshToken: storedRefreshToken };
        headers['X-Refresh-Token'] = storedRefreshToken;
      }

      try {
        const res = await refreshClient.post('/auth/refresh', payload, { headers });
        const { user, accessToken, refreshToken } = res.data.data;
        if (native && refreshToken) {
          await setNativeRefreshToken(refreshToken);
        }
        setAuthTokens({ user, accessToken });
        return accessToken;
      } catch (err) {
        const status = err?.response?.status;
        // Hanya hapus token tersimpan jika server secara eksplisit menolak sesi (401/403),
        // JANGAN hapus saat jaringan/4G putus sementara agar user tidak otomatis logout saat offline.
        if (native && (status === 401 || status === 403)) {
          await clearNativeRefreshToken();
        }
        throw err;
      }
    })().finally(() => {
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
      clearAuthSession();
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

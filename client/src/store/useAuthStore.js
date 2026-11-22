// FILE: client/src/store/useAuthStore.js
import { create } from 'zustand';
import { authApi } from '../api/auth.api';
import { requestNewAccessToken } from '../api/axiosInstance';
import { registerAuthBridge } from '../api/authBridge';
import { STAFF_ROLES } from '../utils/constants';
import { isNativePlatform } from '../platform/detection';
import {
  getNativeRefreshToken,
  setNativeRefreshToken,
  clearNativeRefreshToken,
} from '../platform/authStorage';
import { teardownNativeBackgroundPush } from '../services/nativePushSync';

let initAuthPromise = null;

/**
 * Access token HANYA disimpan di memori (tidak di localStorage) untuk mengurangi risiko XSS.
 * Pada web, sesi dipulihkan via cookie httpOnly refresh token (initAuth).
 * Pada native Android/iOS, refresh token disimpan aman lewat Capacitor Preferences (@capacitor/preferences).
 */
const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isInitialized: false,
  isLoading: false,

  setAuth: ({ user, accessToken }) =>
    set((s) => ({
      user: user ?? s.user,
      accessToken: accessToken ?? s.accessToken,
    })),

  setUser: (user) => set({ user }),

  clearAuth: () => set({ user: null, accessToken: null }),

  /** Memulihkan sesi dari refresh token (cookie di web / Preferences di native) saat aplikasi pertama dimuat */
  initAuth: async () => {
    if (get().isInitialized) return;
    if (initAuthPromise) return initAuthPromise;
    initAuthPromise = (async () => {
      try {
        await requestNewAccessToken();
      } catch {
        if (!get().accessToken) {
          set({ user: null, accessToken: null });
        }
      } finally {
        set({ isInitialized: true });
        initAuthPromise = null;
      }
    })();
    return initAuthPromise;
  },

  login: async ({ identifier, password }) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login({ identifier, password });
      const { user, accessToken, refreshToken } = res.data;
      if (isNativePlatform() && refreshToken) {
        await setNativeRefreshToken(refreshToken);
      }
      set({ user, accessToken, isInitialized: true });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithGoogleCode: async (code) => {
    set({ isLoading: true });
    try {
      const res = await authApi.exchangeGoogleCode(code);
      const { user, accessToken, refreshToken } = res.data;
      if (isNativePlatform() && refreshToken) {
        await setNativeRefreshToken(refreshToken);
      }
      set({ user, accessToken, isInitialized: true });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await teardownNativeBackgroundPush().catch(() => {});
      const nativeToken = isNativePlatform() ? await getNativeRefreshToken() : null;
      await authApi.logout(nativeToken ? { refreshToken: nativeToken } : undefined);
    } catch {
      // abaikan — sesi lokal tetap dihapus
    } finally {
      await clearNativeRefreshToken();
      set({ user: null, accessToken: null });
    }
  },

  refreshMe: async () => {
    const res = await authApi.me();
    set({ user: res.data.user });
    return res.data.user;
  },
}));

registerAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  setAuthTokens: ({ user, accessToken }) => useAuthStore.getState().setAuth({ user, accessToken }),
  clearAuthSession: () => useAuthStore.getState().clearAuth(),
});

// Selector helper
export const selectIsAuthenticated = (s) => Boolean(s.accessToken && s.user);
export const selectIsStaff = (s) => Boolean(s.user && STAFF_ROLES.includes(s.user.role));
export const selectIsAdmin = (s) => s.user?.role === 'admin';

export default useAuthStore;

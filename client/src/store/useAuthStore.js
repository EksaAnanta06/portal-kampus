// FILE: client/src/store/useAuthStore.js
import { create } from 'zustand';
import { authApi } from '../api/auth.api';
import { requestNewAccessToken } from '../api/axiosInstance';
import { registerAuthBridge } from '../api/authBridge';
import { STAFF_ROLES } from '../utils/constants';

/**
 * Access token HANYA disimpan di memori (tidak di localStorage) untuk mengurangi risiko XSS.
 * Saat halaman di-refresh, sesi dipulihkan via cookie httpOnly refresh token (initAuth).
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

  /** Memulihkan sesi dari refresh token cookie saat aplikasi pertama dimuat */
  initAuth: async () => {
    if (get().isInitialized) return;
    try {
      await requestNewAccessToken();
    } catch {
      set({ user: null, accessToken: null });
    } finally {
      set({ isInitialized: true });
    }
  },

  login: async ({ identifier, password }) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login({ identifier, password });
      const { user, accessToken } = res.data;
      set({ user, accessToken });
      return res;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // abaikan — sesi lokal tetap dihapus
    } finally {
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

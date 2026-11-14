// FILE: client/src/store/useThemeStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const getSystemMode = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

/**
 * State tema (dark/light) + snackbar/toast global.
 * Hanya `mode` yang disimpan ke localStorage.
 */
const useThemeStore = create(
  persist(
    (set) => ({
      mode: getSystemMode(),
      toggleMode: () => set((s) => ({ mode: s.mode === 'dark' ? 'light' : 'dark' })),
      setMode: (mode) => set({ mode }),

      snackbar: { open: false, message: '', severity: 'info', key: 0 },
      showToast: (message, severity = 'success') =>
        set({ snackbar: { open: true, message, severity, key: Date.now() } }),
      closeToast: () => set((s) => ({ snackbar: { ...s.snackbar, open: false } })),
    }),
    {
      name: 'pasim-theme',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);

/** Shortcut agar bisa dipanggil di luar komponen React (mis. axios interceptor) */
export const toast = {
  success: (msg) => useThemeStore.getState().showToast(msg, 'success'),
  error: (msg) => useThemeStore.getState().showToast(msg, 'error'),
  info: (msg) => useThemeStore.getState().showToast(msg, 'info'),
  warning: (msg) => useThemeStore.getState().showToast(msg, 'warning'),
};

export default useThemeStore;

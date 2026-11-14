// FILE: client/src/api/authBridge.js
// Memutus ketergantungan sirkular antara axiosInstance dan useAuthStore.
let authHandlers = {
  getAccessToken: () => null,
  setAuthTokens: () => {},
  clearAuthSession: () => {},
};

export function registerAuthBridge(handlers) {
  authHandlers = { ...authHandlers, ...handlers };
}

export function getAccessToken() {
  return authHandlers.getAccessToken();
}

export function setAuthTokens(payload) {
  authHandlers.setAuthTokens(payload);
}

export function clearAuthSession() {
  authHandlers.clearAuthSession();
}

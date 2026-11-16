// FILE: client/src/api/poker.api.js
import axiosInstance from './axiosInstance';
import { unwrap } from './apiHelpers';

export const FEATURE_POKER_ENV_ENABLED = import.meta.env.VITE_FEATURE_POKER !== 'false';

export const pokerApi = {
  getStatus: () => unwrap(axiosInstance.get('/poker/status')),
  reportPlayer: (payload) => unwrap(axiosInstance.post('/poker/report', payload)),
  adminToggleFeature: (enabled) =>
    unwrap(axiosInstance.patch('/poker/admin/feature-flag', { enabled })),
  adminCloseRoom: (roomId) =>
    unwrap(axiosInstance.post(`/poker/admin/rooms/${roomId}/close`)),
};

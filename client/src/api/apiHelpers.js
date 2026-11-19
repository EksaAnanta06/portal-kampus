// FILE: client/src/api/apiHelpers.js
import { downloadBlobFile } from '../platform/fileDownloader';

export const unwrap = (promise) => promise.then((res) => res.data);

export const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );

export const triggerBlobDownload = (blobData, filename) => {
  downloadBlobFile(blobData, filename).catch((err) => {
    console.error('[BlobDownload] Gagal mengunduh berkas:', err);
  });
};

export { getErrorMessage, getFieldErrors } from './axiosInstance';

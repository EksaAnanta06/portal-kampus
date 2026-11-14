// FILE: server/src/utils/apiResponse.js
/**
 * Format response standar: { success, message, data, meta }
 */
export const sendResponse = (res, { statusCode = 200, success = true, message = 'Berhasil', data = null, meta = null }) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
    meta,
  });
};

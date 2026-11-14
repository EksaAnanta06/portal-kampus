// FILE: server/src/controllers/materialPackage.controller.js
import { sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as materialService from '../services/material.service.js';
import * as zipStreamService from '../services/zipStream.service.js';

export const getLearningPackages = asyncHandler(async (req, res) => {
  const packages = await materialService.getLearningPackagesService(req.query);
  return sendResponse(res, {
    message: 'Daftar paket belajar berhasil dimuat.',
    data: packages,
  });
});

export const getLearningPackageDetail = asyncHandler(async (req, res) => {
  const pkg = await materialService.getLearningPackageDetailService(req.params.id);
  return sendResponse(res, {
    message: 'Detail paket belajar berhasil dimuat.',
    data: pkg,
  });
});

export const createLearningPackage = asyncHandler(async (req, res) => {
  const created = await materialService.createLearningPackageService(req.body, req.user);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Paket Belajar Semester berhasil dikurasi!',
    data: created,
  });
});

export const updateLearningPackage = asyncHandler(async (req, res) => {
  await materialService.updateLearningPackageService(req.params.id, req.body);
  return sendResponse(res, { message: 'Paket Belajar Semester berhasil diperbarui!' });
});

export const deleteLearningPackage = asyncHandler(async (req, res) => {
  await materialService.deleteLearningPackageService(req.params.id);
  return sendResponse(res, { message: 'Paket belajar berhasil dihapus.' });
});

export const downloadCourseMaterialsZip = asyncHandler(async (req, res) => {
  await zipStreamService.streamCourseZipService(req.params.id, req.user, res);
});

export const downloadPackageMaterialsZip = asyncHandler(async (req, res) => {
  await zipStreamService.streamPackageZipService(req.params.id, req.user, res);
});

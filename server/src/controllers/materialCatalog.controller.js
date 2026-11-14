// FILE: server/src/controllers/materialCatalog.controller.js
import { sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as materialService from '../services/material.service.js';

export const getProdiList = asyncHandler(async (_req, res) => {
  const prodi = await materialService.getProdiListService();
  return sendResponse(res, { message: 'Daftar program studi berhasil dimuat.', data: prodi });
});

export const createProdi = asyncHandler(async (req, res) => {
  const created = await materialService.createProdiService(req.body);
  return sendResponse(res, {
    statusCode: 201,
    message: 'Program studi berhasil ditambahkan.',
    data: created,
  });
});

export const getCourses = asyncHandler(async (req, res) => {
  const courses = await materialService.getCoursesService(req.query, req.user);
  return sendResponse(res, { message: 'Daftar mata kuliah berhasil dimuat.', data: courses });
});

export const getCourseDetail = asyncHandler(async (req, res) => {
  const course = await materialService.getCourseDetailService(req.params.id, req.user);
  return sendResponse(res, { message: 'Detail mata kuliah berhasil dimuat.', data: course });
});

export const createCourse = asyncHandler(async (req, res) => {
  const created = await materialService.createCourseService(req.body, req.user);
  return sendResponse(res, {
    statusCode: 201,
    message:
      created.status === 'approved'
        ? 'Mata kuliah berhasil ditambahkan ke katalog.'
        : 'Usulan mata kuliah dikirim! Menunggu persetujuan Moderator/Admin.',
    data: created,
  });
});

export const updateCourse = asyncHandler(async (req, res) => {
  await materialService.updateCourseService(req.params.id, req.body);
  return sendResponse(res, { message: 'Mata kuliah berhasil diperbarui.' });
});

export const approveProposedCourse = asyncHandler(async (req, res) => {
  const status = req.body.status || 'approved';
  await materialService.approveProposedCourseService(req.params.id, status, req.user);
  return sendResponse(res, {
    message:
      status === 'approved'
        ? 'Usulan mata kuliah telah disetujui dan tayang di katalog.'
        : 'Usulan mata kuliah telah ditolak.',
  });
});

export const deleteCourse = asyncHandler(async (req, res) => {
  await materialService.deleteCourseService(req.params.id);
  return sendResponse(res, { message: 'Mata kuliah berhasil dihapus.' });
});

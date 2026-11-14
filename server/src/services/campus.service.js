// FILE: server/src/services/campus.service.js
import { AppError } from '../utils/AppError.js';
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  extractCloudinaryPublicId,
} from '../utils/cloudinaryUpload.js';
import {
  getAnnouncementBySlugOrId,
  createAnnouncementRecord,
  updateAnnouncementRecord,
  deleteAnnouncementRecord,
  getEventByIdQuery,
  createEventRecord,
  updateEventRecord,
  deleteEventRecord,
  globalSearchQuery,
} from '../queries/campus.queries.js';

const makeSlug = (title) =>
  `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;

export const createAnnouncementService = async ({ body, file, authorId }) => {
  let banner_url = body.banner_url || null;
  let banner_public_id = null;

  if (file) {
    const uploaded = await uploadBufferToCloudinary(file.buffer, 'announcements');
    banner_url = uploaded.secure_url;
    banner_public_id = uploaded.public_id;
  }

  try {
    const id = await createAnnouncementRecord({
      ...body,
      banner_url,
      banner_public_id,
      slug: makeSlug(body.title),
      author_id: authorId,
    });
    return getAnnouncementBySlugOrId(id);
  } catch (err) {
    if (banner_public_id) {
      await deleteFromCloudinary(banner_public_id);
    }
    throw err;
  }
};

export const updateAnnouncementService = async ({ id, body, file }) => {
  const existing = await getAnnouncementBySlugOrId(id);
  if (!existing) {
    throw new AppError('Pengumuman tidak ditemukan.', 404);
  }

  let banner_url = body.banner_url !== undefined ? body.banner_url || null : existing.banner_url;
  let banner_public_id = existing.banner_public_id || null;
  let uploadedPublicId = null;

  if (file) {
    const uploaded = await uploadBufferToCloudinary(file.buffer, 'announcements');
    banner_url = uploaded.secure_url;
    banner_public_id = uploaded.public_id;
    uploadedPublicId = uploaded.public_id;
  } else if (body.banner_url === '' || body.banner_url === null) {
    banner_public_id = null;
  }

  try {
    await updateAnnouncementRecord(id, {
      ...body,
      banner_url,
      banner_public_id,
    });
  } catch (err) {
    if (uploadedPublicId) {
      await deleteFromCloudinary(uploadedPublicId);
    }
    throw err;
  }

  const oldPublicId = existing.banner_public_id || extractCloudinaryPublicId(existing.banner_url);
  if (
    oldPublicId &&
    (uploadedPublicId || (body.banner_url !== undefined && banner_url !== existing.banner_url))
  ) {
    await deleteFromCloudinary(oldPublicId);
  }

  return getAnnouncementBySlugOrId(id);
};

export const deleteAnnouncementService = async (id) => {
  const existing = await getAnnouncementBySlugOrId(id);
  if (!existing) {
    throw new AppError('Pengumuman tidak ditemukan.', 404);
  }

  const affected = await deleteAnnouncementRecord(id);
  if (affected === 0) {
    throw new AppError('Pengumuman tidak ditemukan.', 404);
  }

  const oldPublicId = existing.banner_public_id || extractCloudinaryPublicId(existing.banner_url);
  if (oldPublicId) {
    await deleteFromCloudinary(oldPublicId);
  }
};

export const createEventService = async ({ body, file, userId }) => {
  let banner_url = body.banner_url || null;
  let banner_public_id = null;

  if (file) {
    const uploaded = await uploadBufferToCloudinary(file.buffer, 'events');
    banner_url = uploaded.secure_url;
    banner_public_id = uploaded.public_id;
  }

  try {
    const id = await createEventRecord({
      ...body,
      banner_url,
      banner_public_id,
      created_by: userId,
    });
    return getEventByIdQuery(id, userId);
  } catch (err) {
    if (banner_public_id) {
      await deleteFromCloudinary(banner_public_id);
    }
    throw err;
  }
};

export const updateEventService = async ({ id, body, file, userId }) => {
  const existing = await getEventByIdQuery(id);
  if (!existing) {
    throw new AppError('Agenda kampus tidak ditemukan.', 404);
  }

  let banner_url = body.banner_url !== undefined ? body.banner_url || null : existing.banner_url;
  let banner_public_id = existing.banner_public_id || null;
  let uploadedPublicId = null;

  if (file) {
    const uploaded = await uploadBufferToCloudinary(file.buffer, 'events');
    banner_url = uploaded.secure_url;
    banner_public_id = uploaded.public_id;
    uploadedPublicId = uploaded.public_id;
  } else if (body.banner_url === '' || body.banner_url === null) {
    banner_public_id = null;
  }

  try {
    await updateEventRecord(id, {
      ...body,
      banner_url,
      banner_public_id,
    });
  } catch (err) {
    if (uploadedPublicId) {
      await deleteFromCloudinary(uploadedPublicId);
    }
    throw err;
  }

  const oldPublicId = existing.banner_public_id || extractCloudinaryPublicId(existing.banner_url);
  if (
    oldPublicId &&
    (uploadedPublicId || (body.banner_url !== undefined && banner_url !== existing.banner_url))
  ) {
    await deleteFromCloudinary(oldPublicId);
  }

  return getEventByIdQuery(id, userId);
};

export const deleteEventService = async (id) => {
  const existing = await getEventByIdQuery(id);
  if (!existing) {
    throw new AppError('Agenda kampus tidak ditemukan.', 404);
  }

  const affected = await deleteEventRecord(id);
  if (affected === 0) {
    throw new AppError('Agenda kampus tidak ditemukan.', 404);
  }

  const oldPublicId = existing.banner_public_id || extractCloudinaryPublicId(existing.banner_url);
  if (oldPublicId) {
    await deleteFromCloudinary(oldPublicId);
  }
};

export const globalSearchService = async (keyword, user) => {
  const q = (keyword || '').trim();
  if (q.length < 2) {
    return { photos: [], announcements: [], users: [], materials: [], courses: [] };
  }
  return globalSearchQuery(q, {
    includeAuthenticatedData: Boolean(user),
  });
};

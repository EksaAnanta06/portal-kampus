// FILE: server/src/controllers/poker.controller.js
import { sendResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { getPokerRoomManager } from '../poker/singleton.js';
import * as pokerRepo from '../repositories/poker.repository.js';
import {
  STARTING_CHIPS_OPTIONS,
  BLIND_LEVEL_OPTIONS,
  TURN_TIMEOUT_OPTIONS,
  QUICK_EMOTES,
} from '../poker/schemas.js';

const POLITE_DISABLED_MSG =
  'Fitur Poker Virtual sedang dinonaktifkan sementara oleh pengelola portal.';

export const getPokerStatus = asyncHandler(async (req, res) => {
  const manager = getPokerRoomManager();
  const enabled = manager.isFeatureEnabled();
  const isStaff = ['admin', 'moderator'].includes(req.user?.role);

  if (!enabled && req.user?.role !== 'admin') {
    return sendResponse(res, {
      statusCode: 503,
      success: false,
      message: POLITE_DISABLED_MSG,
      data: {
        enabled: false,
        disclaimer: 'Game hiburan dengan chip virtual. Tidak ada uang asli.',
      },
    });
  }

  const myStats = await pokerRepo.getUserPokerStats(req.user.id);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: enabled ? 'Fitur Poker Virtual aktif.' : 'Fitur Poker Virtual sedang dinonaktifkan (mode admin).',
    data: {
      enabled,
      envEnabled: manager.envEnabled,
      runtimeEnabled: manager.runtimeEnabled,
      disclaimer: 'Game hiburan dengan chip virtual. Tidak ada uang asli.',
      presets: {
        startingChips: STARTING_CHIPS_OPTIONS,
        blindLevels: BLIND_LEVEL_OPTIONS,
        turnTimeouts: TURN_TIMEOUT_OPTIONS,
        emotes: QUICK_EMOTES,
      },
      activeRoomId: manager.store.getUserRoom(req.user.id),
      activeRoomsCount: manager.store.size(),
      myStats,
      adminRooms: isStaff ? manager.listRoomsForAdmin() : [],
    },
  });
});

export const reportPokerPlayer = asyncHandler(async (req, res) => {
  const manager = getPokerRoomManager();
  if (!manager.isFeatureEnabled()) {
    throw new AppError(POLITE_DISABLED_MSG, 503);
  }

  const { roomId, reportedUserId, reason, description } = req.body;
  if (Number(reportedUserId) === Number(req.user.id)) {
    throw new AppError('Tidak dapat melaporkan diri sendiri.', 400);
  }

  const reportId = await pokerRepo.createPokerReport({
    roomId,
    reporterId: req.user.id,
    reporterName: req.user.full_name,
    reportedUserId,
    reason,
    description,
  });

  console.warn(
    `[POKER] Laporan pemain diterima (ID=${reportId}, room=${roomId}, pelapor=#${req.user.id}, terlapor=#${reportedUserId})`
  );

  return sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Laporan berhasil dikirim ke tim moderator/admin portal.',
    data: { reportId },
  });
});

export const adminTogglePokerFeature = asyncHandler(async (req, res) => {
  const manager = getPokerRoomManager();
  try {
    const enabled = manager.setRuntimeFeatureEnabled(req.body.enabled, req.user.full_name);
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: enabled
        ? 'Fitur Poker Virtual diaktifkan kembali.'
        : 'Fitur Poker Virtual dimatikan sementara.',
      data: {
        enabled,
        envEnabled: manager.envEnabled,
        runtimeEnabled: manager.runtimeEnabled,
      },
    });
  } catch (err) {
    throw new AppError(err.message, err.statusCode || 400);
  }
});

export const adminClosePokerRoom = asyncHandler(async (req, res) => {
  const manager = getPokerRoomManager();
  try {
    const result = manager.endRoomByHostOrAdmin(req.user, req.params.roomId, true);
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: `Room ${result.roomId} telah ditutup paksa oleh pengelola.`,
      data: result,
    });
  } catch (err) {
    throw new AppError(err.message, err.statusCode || 400);
  }
});

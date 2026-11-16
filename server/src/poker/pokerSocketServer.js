// FILE: server/src/poker/pokerSocketServer.js
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { buildAllowedOriginEntries, isOriginAllowed } from '../utils/corsConfig.js';
import * as pokerRepo from '../repositories/poker.repository.js';
import { PokerRoomManager, PokerError } from './roomManager.js';
import {
  WsFrameDecoder,
  WS_OPCODE,
  computeWebSocketAcceptKey,
  encodeWsFrame,
  encodeCloseFrame,
} from './wsFrameCodec.js';
import {
  roomCreateSchema,
  roomJoinSchema,
  roomLeaveSchema,
  roomReadySchema,
  roomControlSchema,
  roomKickSchema,
  gameActionSchema,
  gameSyncSchema,
  reactionSendSchema,
  authRefreshSocketSchema,
} from './schemas.js';

const MAX_WS_PAYLOAD_BYTES = 16 * 1024; // 16 KB batas ukuran payload

const defaultLoadActiveUser = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT id, nim, full_name, role, status, avatar_url FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
};

const rejectHttpUpgrade = (socket, statusCode, message) => {
  try {
    const body = JSON.stringify({ success: false, message });
    socket.write(
      `HTTP/1.1 ${statusCode} ${statusCode === 401 ? 'Unauthorized' : statusCode === 403 ? 'Forbidden' : statusCode === 503 ? 'Service Unavailable' : 'Bad Request'}\r\n` +
        'Content-Type: application/json\r\n' +
        `Content-Length: ${Buffer.byteLength(body)}\r\n` +
        'Connection: close\r\n\r\n' +
        body
    );
  } catch {
    // Abaikan
  } finally {
    socket.destroy();
  }
};

class SlidingRateLimiter {
  constructor(maxCount, windowMs) {
    this.maxCount = maxCount;
    this.windowMs = windowMs;
    this.timestamps = [];
  }

  consume(nowMs = Date.now()) {
    this.timestamps = this.timestamps.filter((t) => nowMs - t < this.windowMs);
    if (this.timestamps.length >= this.maxCount) {
      return false;
    }
    this.timestamps.push(nowMs);
    return true;
  }
}

/**
 * Memasang server WebSocket otoritatif untuk Poker Virtual di atas HTTP server Express yang sama (/socket.io).
 */
export const attachPokerSocketServer = ({
  httpServer,
  roomManager = null,
  verifyTokenFn = verifyAccessToken,
  loadUserFn = defaultLoadActiveUser,
} = {}) => {
  const manager =
    roomManager ||
    new PokerRoomManager({
      envEnabled: env.poker.enabled,
      maxActiveRooms: env.poker.maxActiveRooms,
      maxRoomsPerUserPerHour: env.poker.maxRoomsPerUserPerHour,
      saveHistoryFn: pokerRepo.saveGameHistory,
    });

  const defaultDevOrigins =
    env.nodeEnv === 'development' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [];
  const allowedOriginEntries = buildAllowedOriginEntries(env.clientUrl, defaultDevOrigins);

  const activeSockets = new Set();

  const onUpgrade = async (req, socket, head) => {
    let urlObj;
    try {
      urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    } catch {
      rejectHttpUpgrade(socket, 400, 'URL koneksi tidak valid.');
      return;
    }

    if (urlObj.pathname !== '/socket.io') {
      return;
    }

    if (!manager.isFeatureEnabled()) {
      rejectHttpUpgrade(
        socket,
        503,
        'Fitur Poker Virtual sedang dinonaktifkan sementara oleh pengelola portal.'
      );
      return;
    }

    const origin = req.headers.origin;
    if (
      origin &&
      !isOriginAllowed(origin, {
        allowedEntries: allowedOriginEntries,
        allowDevTunnels: env.security.corsAllowTunnels,
      })
    ) {
      rejectHttpUpgrade(socket, 403, 'Origin WebSocket tidak diizinkan oleh kebijakan CORS.');
      return;
    }

    const wsKey = req.headers['sec-websocket-key'];
    if (!wsKey) {
      rejectHttpUpgrade(socket, 400, 'Header Sec-WebSocket-Key tidak valid.');
      return;
    }

    const authHeader = req.headers.authorization;
    const token =
      urlObj.searchParams.get('token') ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) {
      rejectHttpUpgrade(socket, 401, 'Autentikasi wajib memakai JWT access token yang valid.');
      return;
    }

    let user;
    try {
      const decoded = verifyTokenFn(token);
      user = await loadUserFn(decoded.id);
      if (!user) {
        rejectHttpUpgrade(socket, 401, 'Akun pengguna tidak ditemukan.');
        return;
      }
      if (user.status !== 'active') {
        rejectHttpUpgrade(
          socket,
          403,
          `Akun Anda berstatus "${user.status}". Selesaikan verifikasi akun untuk bermain.`
        );
        return;
      }
    } catch {
      rejectHttpUpgrade(socket, 401, 'Token tidak valid atau telah kedaluwarsa.');
      return;
    }

    const acceptKey = computeWebSocketAcceptKey(wsKey);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
    );

    const decoder = new WsFrameDecoder({
      maxPayloadBytes: MAX_WS_PAYLOAD_BYTES,
      requireMask: true,
    });
    const generalLimiter = new SlidingRateLimiter(30, 10_000);
    const reactionLimiter = new SlidingRateLimiter(4, 5_000);

    let closed = false;
    let currentUser = user;

    const conn = {
      userId: user.id,
      sendEvent: (event, data) => {
        if (closed || socket.destroyed) return;
        try {
          const buf = encodeWsFrame(WS_OPCODE.TEXT, JSON.stringify({ event, data }));
          socket.write(buf);
        } catch {
          // Abaikan error tulis jika socket sudah tutup
        }
      },
      sendAck: (ackId, payload) => {
        if (!ackId || closed || socket.destroyed) return;
        try {
          const buf = encodeWsFrame(
            WS_OPCODE.TEXT,
            JSON.stringify({ type: 'ack', ackId, payload })
          );
          socket.write(buf);
        } catch {
          // Abaikan
        }
      },
      close: (code = 1000, reason = '') => {
        if (closed) return;
        closed = true;
        activeSockets.delete(socket);
        try {
          socket.write(encodeCloseFrame(code, reason));
        } catch {
          // Abaikan
        }
        socket.end();
      },
    };

    activeSockets.add(socket);
    manager.registerUserSocket(user.id, conn);

    // Kirim informasi awal sesi terhubung (serta state meja jika user sedang reconnect ke room)
    conn.sendEvent('socket:ready', {
      userId: user.id,
      activeRoomId: manager.store.getUserRoom(user.id),
      serverNow: Date.now(),
    });
    const rejoinRoomId = manager.store.getUserRoom(user.id);
    if (rejoinRoomId && manager.store.has(rejoinRoomId)) {
      try {
        const synced = manager.syncViewer(user.id, rejoinRoomId);
        conn.sendEvent('game:state', synced);
      } catch {
        // Abaikan jika bukan peserta
      }
    }

    const heartbeat = setInterval(() => {
      if (closed || socket.destroyed) return;
      try {
        socket.write(encodeWsFrame(WS_OPCODE.PING, Buffer.from('hb')));
      } catch {
        // Abaikan
      }
    }, 25_000);
    heartbeat.unref?.();

    const handleClientMessage = async ({ event, data, ackId }) => {
      const replyErr = (err) => {
        const message = err?.message || 'Terjadi kesalahan pada permintaan Poker.';
        const code = err?.code || 'BAD_REQUEST';
        if (ackId) {
          conn.sendAck(ackId, { success: false, code, message, data: null });
        } else {
          conn.sendEvent('error', { code, message });
        }
      };

      if (!generalLimiter.consume()) {
        return replyErr(
          new PokerError('Terlalu banyak aksi dalam waktu singkat. Pelankan sebentar.', 'RATE_LIMITED', 429)
        );
      }

      try {
        if (event === 'auth:refresh') {
          const parsed = authRefreshSocketSchema.parse(data);
          const decoded = verifyTokenFn(parsed.token);
          if (Number(decoded.id) !== Number(currentUser.id)) {
            throw new PokerError('Token tidak cocok dengan pemilik sesi saat ini.', 'TOKEN_MISMATCH', 403);
          }
          const refreshedUser = await loadUserFn(decoded.id);
          if (!refreshedUser || refreshedUser.status !== 'active') {
            throw new PokerError('Akun tidak aktif lagi.', 'USER_INACTIVE', 403);
          }
          currentUser = refreshedUser;
          return conn.sendAck(ackId, { success: true, message: 'Token koneksi diperbarui.', data: { ok: true } });
        }

        if (event === 'room:create') {
          const parsed = roomCreateSchema.parse(data || {});
          const projected = manager.createRoom(currentUser, parsed);
          return conn.sendAck(ackId, {
            success: true,
            message: `Room ${projected.roomId} berhasil dibuat.`,
            data: projected,
          });
        }

        if (event === 'room:join') {
          const parsed = roomJoinSchema.parse(data);
          const projected = manager.joinRoom(currentUser, parsed.roomId);
          return conn.sendAck(ackId, {
            success: true,
            message: `Berhasil bergabung ke room ${projected.roomId}.`,
            data: projected,
          });
        }

        if (event === 'room:leave') {
          const parsed = roomLeaveSchema.parse(data || {});
          const res = manager.leaveRoom(currentUser.id, parsed.roomId);
          return conn.sendAck(ackId, {
            success: true,
            message: 'Anda keluar dari room.',
            data: res,
          });
        }

        if (event === 'room:ready') {
          const parsed = roomReadySchema.parse(data);
          const projected = manager.setReady(currentUser.id, parsed.roomId, parsed.ready);
          return conn.sendAck(ackId, {
            success: true,
            message: parsed.ready ? 'Status siap diaktifkan.' : 'Status siap dibatalkan.',
            data: projected,
          });
        }

        if (event === 'room:start') {
          const parsed = roomControlSchema.parse(data);
          const projected = manager.startGame(currentUser.id, parsed.roomId);
          return conn.sendAck(ackId, {
            success: true,
            message: 'Permainan dimulai.',
            data: projected,
          });
        }

        if (event === 'room:kick') {
          const parsed = roomKickSchema.parse(data);
          const projected = manager.kickPlayer(currentUser.id, parsed.roomId, parsed.targetUserId);
          return conn.sendAck(ackId, {
            success: true,
            message: 'Pemain berhasil dikeluarkan.',
            data: projected,
          });
        }

        if (event === 'room:end') {
          const parsed = roomControlSchema.parse(data);
          const isStaff = ['admin', 'moderator'].includes(currentUser.role);
          const res = manager.endRoomByHostOrAdmin(currentUser, parsed.roomId, isStaff);
          return conn.sendAck(ackId, {
            success: true,
            message: 'Permainan diakhiri.',
            data: res,
          });
        }

        if (event === 'game:action') {
          const parsed = gameActionSchema.parse(data);
          const projected = manager.handleAction(currentUser.id, parsed);
          return conn.sendAck(ackId, {
            success: true,
            message: 'Aksi diterima.',
            data: projected,
          });
        }

        if (event === 'game:sync') {
          const parsed = gameSyncSchema.parse(data);
          const projected = manager.syncViewer(currentUser.id, parsed.roomId);
          return conn.sendAck(ackId, {
            success: true,
            message: 'Sinkronisasi state selesai.',
            data: projected,
          });
        }

        if (event === 'reaction:send') {
          if (!reactionLimiter.consume()) {
            throw new PokerError('Reaksi cepat sedang dibatasi sementara. Tunggu sebentar.', 'REACTION_RATE_LIMIT', 429);
          }
          const parsed = reactionSendSchema.parse(data);
          const emitted = manager.sendReaction(currentUser.id, parsed.roomId, parsed.emote);
          return conn.sendAck(ackId, {
            success: true,
            message: 'Reaksi dikirim.',
            data: emitted,
          });
        }

        throw new PokerError(`Event "${event}" tidak dikenali.`, 'UNKNOWN_EVENT', 400);
      } catch (err) {
        if (err?.name === 'ZodError') {
          const firstMsg = err.errors?.[0]?.message || 'Format payload tidak valid.';
          return replyErr(new PokerError(firstMsg, 'VALIDATION_ERROR', 400));
        }
        return replyErr(err);
      }
    };

    const handleRawChunk = (chunk) => {
      if (!chunk || chunk.length === 0 || closed) return;
      const { frames, error } = decoder.push(chunk);
      if (error) {
        conn.sendEvent('error', { code: error, message: 'Frame data terlalu besar atau tidak valid.' });
        conn.close(1009, error);
        return;
      }

      for (const frame of frames) {
        if (frame.opcode === WS_OPCODE.PING) {
          socket.write(encodeWsFrame(WS_OPCODE.PONG, frame.payload));
        } else if (frame.opcode === WS_OPCODE.CLOSE) {
          conn.close(1000, 'client_closed');
          return;
        } else if (frame.opcode === WS_OPCODE.TEXT) {
          let parsedJson;
          try {
            parsedJson = JSON.parse(frame.payload.toString('utf8'));
          } catch {
            conn.sendEvent('error', { code: 'INVALID_JSON', message: 'Payload JSON tidak valid.' });
            continue;
          }
          if (!parsedJson || typeof parsedJson.event !== 'string') {
            conn.sendEvent('error', { code: 'MISSING_EVENT', message: 'Nama event wajib diisi.' });
            continue;
          }
          void handleClientMessage(parsedJson);
        }
      }
    };

    socket.on('data', handleRawChunk);
    socket.on('error', () => {
      // Abaikan ECONNRESET mendadak
    });
    socket.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      activeSockets.delete(socket);
      manager.handleSocketDisconnect(currentUser.id, conn);
    });

    if (head && head.length > 0) {
      handleRawChunk(head);
    }
  };

  httpServer.on('upgrade', onUpgrade);

  const shutdown = () => {
    httpServer.off('upgrade', onUpgrade);
    manager.shutdown();
    for (const sock of activeSockets) {
      try {
        sock.destroy();
      } catch {
        // Abaikan
      }
    }
    activeSockets.clear();
  };

  return {
    manager,
    shutdown,
  };
};

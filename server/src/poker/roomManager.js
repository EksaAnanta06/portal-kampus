// FILE: server/src/poker/roomManager.js
import { generateRoomId, defaultRandomInt } from './deck.js';
import { chooseBotMove } from './handEvaluator.js';
import { InMemoryRoomStore } from './roomStore.js';
import {
  POKER_PHASES,
  createTableState,
  addSeatToLobby,
  setPlayerReady,
  startNextHand,
  applyAction,
  handleTurnTimeout,
  handlePlayerLeaveOrForfeit,
  forceEndRoom,
  projectStateForViewer,
} from './stateMachine.js';

const IDLE_EXPIRE_MS = 30 * 60 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
const BETWEEN_HANDS_DELAY_MS = 6 * 1000;
const DEFAULT_BOT_THINK_MS = 600;

export class PokerError extends Error {
  constructor(message, code = 'POKER_ERROR', statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class PokerRoomManager {
  constructor({
    store = new InMemoryRoomStore(),
    randomInt = defaultRandomInt,
    envEnabled = true,
    maxActiveRooms = 50,
    maxRoomsPerUserPerHour = 10,
    reconnectGraceMs = RECONNECT_GRACE_MS,
    betweenHandsDelayMs = BETWEEN_HANDS_DELAY_MS,
    botThinkMs = DEFAULT_BOT_THINK_MS,
    idleExpireMs = IDLE_EXPIRE_MS,
    saveHistoryFn = null,
  } = {}) {
    this.store = store;
    this.randomInt = randomInt;
    this.envEnabled = Boolean(envEnabled);
    this.runtimeEnabled = Boolean(envEnabled);
    this.maxActiveRooms = maxActiveRooms;
    this.maxRoomsPerUserPerHour = maxRoomsPerUserPerHour;
    this.reconnectGraceMs = reconnectGraceMs;
    this.betweenHandsDelayMs = betweenHandsDelayMs;
    this.botThinkMs = botThinkMs;
    this.idleExpireMs = idleExpireMs;
    this.saveHistoryFn = saveHistoryFn;

    this.userSockets = new Map();
    this.expiredRoomIds = new Set();

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredRooms();
    }, 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  isFeatureEnabled() {
    return Boolean(this.envEnabled && this.runtimeEnabled);
  }

  setRuntimeFeatureEnabled(enabled, adminName = 'Admin') {
    if (!this.envEnabled && enabled) {
      throw new PokerError(
        'Fitur Poker Capsa Banting dinonaktifkan melalui environment server (FEATURE_POKER=false).',
        'FEATURE_ENV_DISABLED',
        400
      );
    }
    this.runtimeEnabled = Boolean(enabled);
    console.info(
      `[POKER] Feature flag runtime diubah menjadi ${this.runtimeEnabled ? 'AKTIF' : 'NONAKTIF'} oleh ${adminName}`
    );

    if (!this.runtimeEnabled) {
      this.closeAllActiveRooms('Fitur Poker Capsa Banting dinonaktifkan sementara oleh admin.');
    }
    return this.isFeatureEnabled();
  }

  assertEnabled() {
    if (!this.isFeatureEnabled()) {
      throw new PokerError(
        'Fitur Poker Capsa Banting sedang dinonaktifkan sementara oleh pengelola portal.',
        'FEATURE_DISABLED',
        503
      );
    }
  }

  registerUserSocket(userId, socketConn) {
    const uid = Number(userId);
    const prev = this.userSockets.get(uid);
    if (prev && prev !== socketConn) {
      try {
        prev.sendEvent('session:replaced', {
          roomId: this.store.getUserRoom(uid),
          message: 'Sesi Anda dibuka di tab atau perangkat lain. Koneksi ini ditutup.',
        });
        prev.close(4001, 'session_replaced');
      } catch {
        // Abaikan
      }
    }
    this.userSockets.set(uid, socketConn);

    const roomId = this.store.getUserRoom(uid);
    if (roomId) {
      const entry = this.store.get(roomId);
      const seat = entry?.state?.seats.find((s) => s.userId === uid);
      if (seat && !seat.connected) {
        this._clearDisconnectTimer(entry, uid);
        seat.connected = true;
        seat.disconnectedAt = null;
        entry.state.stateVersion += 1;
        this._emitEvents(entry, [
          {
            type: 'player_reconnected',
            payload: { seatIndex: seat.seatIndex, userId: uid, fullName: seat.fullName },
          },
        ]);
        this.broadcastRoomState(entry);
      }
    }
  }

  handleSocketDisconnect(userId, socketConn) {
    const uid = Number(userId);
    const current = this.userSockets.get(uid);
    if (current !== socketConn) return;

    this.userSockets.delete(uid);

    const roomId = this.store.getUserRoom(uid);
    if (!roomId) return;

    const entry = this.store.get(roomId);
    if (!entry || entry.state.phase === POKER_PHASES.SELESAI) return;

    const seat = entry.state.seats.find((s) => s.userId === uid);
    if (!seat) return;

    seat.connected = false;
    seat.disconnectedAt = Date.now();
    entry.state.stateVersion += 1;
    this._emitEvents(entry, [
      {
        type: 'player_disconnected',
        payload: {
          seatIndex: seat.seatIndex,
          userId: uid,
          fullName: seat.fullName,
          graceSeconds: Math.round(this.reconnectGraceMs / 1000),
        },
      },
    ]);
    this.broadcastRoomState(entry);

    this._clearDisconnectTimer(entry, uid);
    const timer = setTimeout(() => {
      entry.disconnectTimers.delete(uid);
      const stillSeat = entry.state.seats.find((s) => s.userId === uid);
      if (!stillSeat || stillSeat.connected) return;

      const events = handlePlayerLeaveOrForfeit(entry.state, uid);
      this.store.deleteUserRoom(uid);
      console.info(`[POKER] Masa tenggang habis (${uid}) keluar dari room ${entry.state.roomId}`);
      this._emitEvents(entry, events);

      const remainingHumans = entry.state.seats.filter((s) => !s.isBot);
      if (remainingHumans.length === 0) {
        if (entry.state.handNumber >= 1 && !entry.historySaved) {
          this._persistHistory(entry);
        }
        this._destroyRoom(entry.state.roomId);
        return;
      }

      this._afterRoomMutation(entry);
    }, this.reconnectGraceMs);
    timer.unref?.();
    entry.disconnectTimers.set(uid, timer);
  }

  _clearDisconnectTimer(entry, userId) {
    const uid = Number(userId);
    const existing = entry.disconnectTimers.get(uid);
    if (existing) {
      clearTimeout(existing);
      entry.disconnectTimers.delete(uid);
    }
  }

  _clearRoomTimers(entry) {
    if (entry.turnTimer) {
      clearTimeout(entry.turnTimer);
      entry.turnTimer = null;
    }
    if (entry.botTimer) {
      clearTimeout(entry.botTimer);
      entry.botTimer = null;
    }
    if (entry.nextHandTimer) {
      clearTimeout(entry.nextHandTimer);
      entry.nextHandTimer = null;
    }
    for (const timer of entry.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    entry.disconnectTimers.clear();
  }

  _freeFinishedRoomMembershipIfNeeded(userId) {
    const existingId = this.store.getUserRoom(userId);
    if (!existingId) return null;
    const entry = this.store.get(existingId);
    if (!entry) {
      this.store.deleteUserRoom(userId);
      return null;
    }
    if (entry.state.phase === POKER_PHASES.SELESAI) {
      handlePlayerLeaveOrForfeit(entry.state, userId);
      this.store.deleteUserRoom(userId);
      if (entry.state.seats.filter((s) => !s.isBot).length === 0) {
        this._destroyRoom(existingId);
      }
      return null;
    }
    return existingId;
  }

  createRoom(user, config) {
    this.assertEnabled();

    const activeRoomId = this._freeFinishedRoomMembershipIfNeeded(user.id);
    if (activeRoomId) {
      throw new PokerError(
        `Anda masih tergabung di room ${activeRoomId}. Keluar terlebih dahulu sebelum membuat room baru.`,
        'ALREADY_IN_ROOM',
        409
      );
    }

    if (this.store.size() >= this.maxActiveRooms) {
      throw new PokerError(
        'Kapasitas room server sedang penuh. Silakan coba beberapa menit lagi.',
        'ROOM_LIMIT_REACHED',
        429
      );
    }

    const recentCreations = this.store.countUserRecentCreations(user.id);
    if (recentCreations >= this.maxRoomsPerUserPerHour) {
      throw new PokerError(
        'Batas pembuatan room per jam telah tercapai. Silakan gabung room yang ada atau tunggu sebentar.',
        'USER_CREATE_RATE_LIMIT',
        429
      );
    }

    let roomId = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = generateRoomId(this.randomInt, 6);
      if (!this.store.has(candidate)) {
        roomId = candidate;
        break;
      }
    }
    if (!roomId) {
      throw new PokerError('Gagal membuat ID room unik, coba lagi.', 'ROOM_ID_GEN_FAIL', 500);
    }

    const state = createTableState({
      roomId,
      hostUser: user,
      startingChips: config.startingChips,
      blindLevel: config.blindLevel,
      turnTimeoutSec: config.turnTimeoutSec,
    });

    const entry = {
      state,
      turnTimer: null,
      botTimer: null,
      nextHandTimer: null,
      disconnectTimers: new Map(),
      historySaved: false,
    };

    this.store.set(roomId, entry);
    this.store.setUserRoom(user.id, roomId);
    this.store.recordUserCreation(user.id);

    console.info(`[POKER] Room Capsa Banting ${roomId} dibuat oleh user #${user.id} (${user.full_name})`);

    if (config.quickBotMode) {
      const events = startNextHand(entry.state, { randomInt: this.randomInt, fillBots: true });
      this._emitEvents(entry, events);
      this._afterRoomMutation(entry);
      return projectStateForViewer(entry.state, user.id);
    }

    const projected = projectStateForViewer(entry.state, user.id);
    this.sendStateToUser(user.id, projected);
    return projected;
  }

  joinRoom(user, roomIdInput) {
    this.assertEnabled();
    const roomId = String(roomIdInput || '').trim().toUpperCase();

    const currentRoomId = this._freeFinishedRoomMembershipIfNeeded(user.id);
    if (currentRoomId && currentRoomId !== roomId) {
      throw new PokerError(
        `Anda masih tergabung di room ${currentRoomId}. Keluar dulu sebelum bergabung ke room lain.`,
        'ALREADY_IN_ROOM',
        409
      );
    }

    const entry = this.store.get(roomId);
    if (!entry) {
      if (this.expiredRoomIds.has(roomId)) {
        throw new PokerError(
          'Room tersebut sudah kadaluarsa karena tidak aktif atau telah ditutup.',
          'ROOM_EXPIRED',
          410
        );
      }
      throw new PokerError(
        'Room tidak ditemukan. Periksa kembali kode ID 6 karakter.',
        'ROOM_NOT_FOUND',
        404
      );
    }

    if (entry.state.phase === POKER_PHASES.SELESAI) {
      throw new PokerError('Permainan di room ini telah selesai.', 'ROOM_FINISHED', 409);
    }

    const existingSeat = entry.state.seats.find((s) => s.userId === user.id);
    if (existingSeat) {
      this._clearDisconnectTimer(entry, user.id);
      existingSeat.connected = true;
      existingSeat.disconnectedAt = null;
      existingSeat.fullName = user.full_name || existingSeat.fullName;
      existingSeat.avatarUrl = user.avatar_url || existingSeat.avatarUrl;
      entry.state.stateVersion += 1;
      this.store.setUserRoom(user.id, roomId);
      this.broadcastRoomState(entry);
      return projectStateForViewer(entry.state, user.id);
    }

    if (entry.state.phase !== POKER_PHASES.LOBBY) {
      throw new PokerError(
        'Permainan sedang berjalan dan penonton tidak diizinkan.',
        'GAME_ALREADY_STARTED',
        409
      );
    }

    if (entry.state.seats.length >= 4) {
      throw new PokerError('Room sudah penuh (maksimal 4 pemain).', 'ROOM_FULL', 409);
    }

    const seat = addSeatToLobby(entry.state, user);
    this.store.setUserRoom(user.id, roomId);
    this._emitEvents(entry, [
      {
        type: 'player_joined',
        payload: { seatIndex: seat.seatIndex, userId: user.id, fullName: seat.fullName },
      },
    ]);
    this.broadcastRoomState(entry);
    return projectStateForViewer(entry.state, user.id);
  }

  leaveRoom(userId, roomIdInput) {
    const uid = Number(userId);
    const activeRoomId = roomIdInput
      ? String(roomIdInput).trim().toUpperCase()
      : this.store.getUserRoom(uid);

    if (!activeRoomId) {
      return { left: false };
    }

    const entry = this.store.get(activeRoomId);
    this.store.deleteUserRoom(uid);

    if (!entry) {
      return { left: true, roomId: activeRoomId };
    }

    this._clearDisconnectTimer(entry, uid);
    const events = handlePlayerLeaveOrForfeit(entry.state, uid);
    this._emitEvents(entry, events);

    const remainingHumans = entry.state.seats.filter((s) => !s.isBot);
    if (remainingHumans.length === 0) {
      if (entry.state.handNumber >= 1 && !entry.historySaved) {
        this._persistHistory(entry);
      }
      this._destroyRoom(activeRoomId);
      console.info(`[POKER] Room ${activeRoomId} ditutup karena semua pemain telah keluar`);
      return { left: true, roomId: activeRoomId };
    }

    this._afterRoomMutation(entry);
    return { left: true, roomId: activeRoomId };
  }

  setReady(userId, roomId, ready) {
    this.assertEnabled();
    const entry = this._requireRoomAndSeat(userId, roomId);
    try {
      setPlayerReady(entry.state, userId, ready);
    } catch (err) {
      throw new PokerError(err.message, 'INVALID_STATE', 400);
    }
    this.broadcastRoomState(entry);
    return projectStateForViewer(entry.state, userId);
  }

  startGame(userId, roomId) {
    this.assertEnabled();
    const entry = this._requireRoomAndSeat(userId, roomId);
    if (entry.state.hostUserId !== userId) {
      throw new PokerError('Hanya host room yang dapat memulai permainan.', 'NOT_HOST', 403);
    }
    if (entry.state.phase !== POKER_PHASES.LOBBY) {
      throw new PokerError('Permainan sudah dimulai.', 'ALREADY_STARTED', 409);
    }

    try {
      const events = startNextHand(entry.state, {
        randomInt: this.randomInt,
        fillBots: true,
      });
      this._emitEvents(entry, events);
      this._afterRoomMutation(entry);
      console.info(`[POKER] Capsa Banting dimulai di room ${entry.state.roomId} (4 kursi)`);
      return projectStateForViewer(entry.state, userId);
    } catch (err) {
      throw new PokerError(err.message, 'CANNOT_START', 400);
    }
  }

  kickPlayer(hostUserId, roomId, targetUserId) {
    this.assertEnabled();
    const entry = this._requireRoomAndSeat(hostUserId, roomId);
    if (entry.state.hostUserId !== hostUserId) {
      throw new PokerError('Hanya host yang dapat mengeluarkan pemain.', 'NOT_HOST', 403);
    }
    if (Number(targetUserId) === Number(hostUserId)) {
      throw new PokerError('Host tidak dapat mengeluarkan dirinya sendiri.', 'CANNOT_KICK_SELF', 400);
    }

    const targetSeat = entry.state.seats.find((s) => s.userId === Number(targetUserId));
    if (!targetSeat || targetSeat.isBot) {
      throw new PokerError('Pemain target tidak berada di room ini.', 'TARGET_NOT_FOUND', 404);
    }

    const canKickInPhase =
      entry.state.phase === POKER_PHASES.LOBBY ||
      entry.state.phase === POKER_PHASES.ANTAR_TANGAN ||
      targetSeat.isAway ||
      !targetSeat.connected;

    if (!canKickInPhase) {
      throw new PokerError(
        'Pemain hanya bisa dikeluarkan saat lobby, antar ronde, atau jika berstatus away/terputus.',
        'KICK_RESTRICTED',
        409
      );
    }

    this._clearDisconnectTimer(entry, targetUserId);
    const events = handlePlayerLeaveOrForfeit(entry.state, Number(targetUserId));
    this.store.deleteUserRoom(Number(targetUserId));
    console.info(
      `[POKER] Kick pemain #${targetUserId} dari room ${entry.state.roomId} oleh host #${hostUserId}`
    );

    const targetSock = this.userSockets.get(Number(targetUserId));
    if (targetSock) {
      targetSock.sendEvent('room:kicked', {
        roomId: entry.state.roomId,
        message: 'Anda telah dikeluarkan dari room oleh host.',
      });
    }

    this._emitEvents(entry, [
      {
        type: 'player_kicked',
        payload: { userId: Number(targetUserId), fullName: targetSeat.fullName },
      },
      ...events,
    ]);
    this._afterRoomMutation(entry);
    return projectStateForViewer(entry.state, hostUserId);
  }

  endRoomByHostOrAdmin(callerUser, roomId, isStaff = false) {
    const entry = this.store.get(roomId);
    if (!entry) {
      throw new PokerError('Room tidak ditemukan.', 'ROOM_NOT_FOUND', 404);
    }
    if (!isStaff && entry.state.hostUserId !== callerUser.id) {
      throw new PokerError('Hanya host atau pengelola yang dapat mengakhiri room.', 'FORBIDDEN', 403);
    }

    const reason =
      isStaff && entry.state.hostUserId !== callerUser.id
        ? `Room ditutup paksa oleh pengelola (${callerUser.full_name}).`
        : 'Room diakhiri oleh host.';

    const events = forceEndRoom(entry.state, reason);
    this._clearRoomTimers(entry);
    this._emitEvents(entry, events);
    this._afterRoomMutation(entry);
    console.info(`[POKER] Room ${entry.state.roomId} diakhiri oleh user #${callerUser.id}: ${reason}`);
    return { closed: true, roomId: entry.state.roomId };
  }

  handleAction(userId, payload) {
    this.assertEnabled();
    const entry = this._requireRoomAndSeat(userId, payload.roomId);

    if (entry.state.handNumber !== payload.handNumber) {
      throw new PokerError('Nomor ronde sudah berganti. Menyinkronkan ulang state.', 'STALE_HAND', 409);
    }

    try {
      const events = applyAction(entry.state, {
        userId,
        action: payload.action,
        cards: payload.cards || [],
        turnToken: payload.turnToken,
      });
      this._emitEvents(entry, events);
      this._afterRoomMutation(entry);
      return projectStateForViewer(entry.state, userId);
    } catch (err) {
      throw new PokerError(err.message, 'INVALID_ACTION', 400);
    }
  }

  syncViewer(userId, roomId) {
    const entry = this._requireRoomAndSeat(userId, roomId);
    return projectStateForViewer(entry.state, userId);
  }

  sendReaction(userId, roomId, emote) {
    this.assertEnabled();
    const entry = this._requireRoomAndSeat(userId, roomId);
    const seat = entry.state.seats.find((s) => s.userId === Number(userId));
    entry.state.lastActivityAt = Date.now();

    const payload = {
      roomId: entry.state.roomId,
      userId: Number(userId),
      fullName: seat.fullName,
      seatIndex: seat.seatIndex,
      emote,
      timestamp: Date.now(),
    };
    for (const s of entry.state.seats) {
      if (s.isBot) continue;
      const sock = this.userSockets.get(s.userId);
      if (sock) sock.sendEvent('reaction:broadcast', payload);
    }
    return payload;
  }

  _requireRoomAndSeat(userId, roomId) {
    const normalized = String(roomId || '').trim().toUpperCase();
    const entry = this.store.get(normalized);
    if (!entry) {
      throw new PokerError('Room tidak ditemukan atau telah berakhir.', 'ROOM_NOT_FOUND', 404);
    }
    const seat = entry.state.seats.find((s) => s.userId === Number(userId));
    if (!seat) {
      throw new PokerError('Anda bukan peserta di room ini.', 'NOT_IN_ROOM', 403);
    }
    return entry;
  }

  _afterRoomMutation(entry) {
    if (entry.turnTimer) {
      clearTimeout(entry.turnTimer);
      entry.turnTimer = null;
    }
    if (entry.botTimer) {
      clearTimeout(entry.botTimer);
      entry.botTimer = null;
    }

    const { phase } = entry.state;

    if (phase === POKER_PHASES.BERMAIN && entry.state.currentTurnSeat !== null) {
      const expectedToken = entry.state.turnToken;
      const activeSeat = entry.state.seats.find(
        (s) => s.seatIndex === entry.state.currentTurnSeat
      );

      if (activeSeat?.isBot) {
        entry.botTimer = setTimeout(() => {
          entry.botTimer = null;
          if (
            entry.state.phase !== POKER_PHASES.BERMAIN ||
            entry.state.turnToken !== expectedToken
          ) {
            return;
          }
          const must3D = Boolean(
            entry.state.mustIncludeThreeDiamond && !entry.state.currentPlay
          );
          const botMove = chooseBotMove(activeSeat.holeCards, entry.state.currentPlay, {
            mustIncludeThreeDiamond: must3D,
          });
          const events = botMove
            ? applyAction(entry.state, {
                userId: activeSeat.userId,
                action: 'play',
                cards: botMove.cards.map((c) => c.code),
                turnToken: expectedToken,
                isTimeoutAuto: false,
              })
            : applyAction(entry.state, {
                userId: activeSeat.userId,
                action: 'pass',
                turnToken: expectedToken,
                isTimeoutAuto: false,
              });
          this._emitEvents(entry, events);
          this._afterRoomMutation(entry);
        }, this.botThinkMs);
        entry.botTimer.unref?.();
      } else {
        const delay = Math.max(1000, (entry.state.turnDeadlineAt || Date.now()) - Date.now());
        entry.turnTimer = setTimeout(() => {
          entry.turnTimer = null;
          if (entry.state.turnToken !== expectedToken) return;
          const events = handleTurnTimeout(entry.state);
          this._emitEvents(entry, events);
          this._afterRoomMutation(entry);
        }, delay);
        entry.turnTimer.unref?.();
      }
    } else if (phase === POKER_PHASES.ANTAR_TANGAN) {
      if (!entry.nextHandTimer) {
        entry.nextHandTimer = setTimeout(() => {
          entry.nextHandTimer = null;
          if (entry.state.phase !== POKER_PHASES.ANTAR_TANGAN) return;
          try {
            const events = startNextHand(entry.state, {
              randomInt: this.randomInt,
              fillBots: true,
            });
            this._emitEvents(entry, events);
            this._afterRoomMutation(entry);
          } catch (err) {
            console.error(
              `[POKER] Gagal memulai ronde berikutnya di ${entry.state.roomId}:`,
              err.message
            );
          }
        }, this.betweenHandsDelayMs);
        entry.nextHandTimer.unref?.();
      }
    } else if (phase === POKER_PHASES.SELESAI) {
      this._clearRoomTimers(entry);
      if (entry.state.handNumber >= 1 && !entry.historySaved) {
        this._persistHistory(entry);
      }
    }

    this.broadcastRoomState(entry);
  }

  _persistHistory(entry) {
    entry.historySaved = true;
    if (typeof this.saveHistoryFn !== 'function') return;
    Promise.resolve(
      this.saveHistoryFn({
        roomId: entry.state.roomId,
        startedAtMs: entry.state.startedAt || entry.state.createdAt,
        endedAtMs: entry.state.endedAt || Date.now(),
        players: entry.state.seats.filter((s) => !s.isBot),
        winnerUserId:
          entry.state.winnerUserId && entry.state.winnerUserId > 0
            ? entry.state.winnerUserId
            : null,
        totalHands: entry.state.handNumber,
      })
    ).catch((err) => {
      console.error(`[POKER] Gagal menyimpan riwayat room ${entry.state.roomId}:`, err.message);
    });
  }

  _emitEvents(entry, events = []) {
    if (!events || events.length === 0) return;
    for (const ev of events) {
      const packet = {
        roomId: entry.state.roomId,
        stateVersion: entry.state.stateVersion,
        type: ev.type,
        payload: ev.payload,
        timestamp: Date.now(),
      };
      for (const s of entry.state.seats) {
        if (s.isBot) continue;
        const sock = this.userSockets.get(s.userId);
        if (sock) sock.sendEvent('game:event', packet);
      }
    }
  }

  broadcastRoomState(entry) {
    const nowMs = Date.now();
    for (const s of entry.state.seats) {
      if (s.isBot) continue;
      const sock = this.userSockets.get(s.userId);
      if (sock) {
        const viewerState = projectStateForViewer(entry.state, s.userId, nowMs);
        sock.sendEvent('game:state', viewerState);
      }
    }
  }

  sendStateToUser(userId, viewerState) {
    const sock = this.userSockets.get(Number(userId));
    if (sock) {
      sock.sendEvent('game:state', viewerState);
    }
  }

  _destroyRoom(roomId) {
    const entry = this.store.get(roomId);
    if (!entry) return;
    this._clearRoomTimers(entry);
    for (const s of entry.state.seats) {
      if (!s.isBot && this.store.getUserRoom(s.userId) === entry.state.roomId) {
        this.store.deleteUserRoom(s.userId);
      }
    }
    this.store.delete(roomId);
  }

  closeAllActiveRooms(reason) {
    for (const entry of this.store.values()) {
      const events = forceEndRoom(entry.state, reason);
      this._clearRoomTimers(entry);
      this._emitEvents(entry, events);
      this.broadcastRoomState(entry);
      for (const s of entry.state.seats) {
        if (!s.isBot) this.store.deleteUserRoom(s.userId);
      }
      this.store.delete(entry.state.roomId);
    }
  }

  cleanupExpiredRooms(nowMs = Date.now()) {
    for (const entry of this.store.values()) {
      const idleDuration = nowMs - entry.state.lastActivityAt;
      const humanSeats = entry.state.seats.filter((s) => !s.isBot);
      const allDisconnected =
        humanSeats.length === 0 || humanSeats.every((s) => !s.connected);
      const isFinishedOld =
        entry.state.phase === POKER_PHASES.SELESAI &&
        nowMs - (entry.state.endedAt || nowMs) > 5 * 60 * 1000;

      if (
        isFinishedOld ||
        idleDuration > this.idleExpireMs ||
        (humanSeats.length === 0 && idleDuration > 60_000) ||
        (allDisconnected && idleDuration > this.idleExpireMs)
      ) {
        const rid = entry.state.roomId;
        const events = forceEndRoom(entry.state, 'Room ditutup otomatis karena tidak aktif.');
        this._emitEvents(entry, events);
        this.expiredRoomIds.add(rid);
        this._destroyRoom(rid);
        console.info(`[POKER] Room ${rid} dibersihkan otomatis (idle/kosong)`);
      }
    }
  }

  listRoomsForAdmin() {
    return this.store.values().map((entry) => ({
      roomId: entry.state.roomId,
      phase: entry.state.phase,
      playerCount: entry.state.seats.length,
      handNumber: entry.state.handNumber,
      hostUserId: entry.state.hostUserId,
      createdAt: entry.state.createdAt,
      lastActivityAt: entry.state.lastActivityAt,
    }));
  }

  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.closeAllActiveRooms('Server sedang dimuat ulang. Silakan masuk kembali sebentar lagi.');
    for (const sock of this.userSockets.values()) {
      try {
        sock.close(1001, 'server_shutdown');
      } catch {
        // Abaikan
      }
    }
    this.userSockets.clear();
  }
}

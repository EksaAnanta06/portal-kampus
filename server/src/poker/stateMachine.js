// FILE: server/src/poker/stateMachine.js
import crypto from 'node:crypto';
import {
  createShuffledDeck,
  defaultRandomInt,
  sortCapsaCards,
} from './deck.js';
import {
  classifyCapsaPlay,
  canBeatPlay,
  findValidMoves,
} from './handEvaluator.js';
import { calculateCapsaRoundSettlement } from './potCalculator.js';

export const MAX_SEATS = 4;
export const CARDS_PER_PLAYER = 13;

export const POKER_PHASES = Object.freeze({
  LOBBY: 'lobby',
  MENUNGGU_MULAI: 'menunggu_mulai',
  BERMAIN: 'bermain',
  ANTAR_TANGAN: 'antar_tangan',
  SELESAI: 'selesai',
});

export const ALLOWED_TRANSITIONS = Object.freeze({
  [POKER_PHASES.LOBBY]: [POKER_PHASES.MENUNGGU_MULAI, POKER_PHASES.SELESAI],
  [POKER_PHASES.MENUNGGU_MULAI]: [POKER_PHASES.BERMAIN, POKER_PHASES.SELESAI],
  [POKER_PHASES.BERMAIN]: [POKER_PHASES.ANTAR_TANGAN, POKER_PHASES.SELESAI],
  [POKER_PHASES.ANTAR_TANGAN]: [POKER_PHASES.MENUNGGU_MULAI, POKER_PHASES.BERMAIN, POKER_PHASES.SELESAI],
  [POKER_PHASES.SELESAI]: [],
});

export const STARTING_CHIP_PRESETS = Object.freeze([500, 1000, 2000]);
export const BLIND_LEVEL_PRESETS = Object.freeze({
  '5/10': { smallBlind: 5, bigBlind: 10, baseStake: 5 },
  '10/20': { smallBlind: 10, bigBlind: 20, baseStake: 10 },
  '25/50': { smallBlind: 25, bigBlind: 50, baseStake: 25 },
});
export const TURN_TIMEOUT_PRESETS = Object.freeze([15, 30, 45]);

const BOT_PROFILES = [
  { userId: -1, fullName: 'Bot Dika', role: 'bot' },
  { userId: -2, fullName: 'Bot Rani', role: 'bot' },
  { userId: -3, fullName: 'Bot Bima', role: 'bot' },
  { userId: -4, fullName: 'Bot Sinta', role: 'bot' },
];

export const assertValidTransition = (fromPhase, toPhase) => {
  const allowed = ALLOWED_TRANSITIONS[fromPhase] || [];
  if (!allowed.includes(toPhase)) {
    throw new Error(`Transisi state Capsa Banting tidak valid: ${fromPhase} -> ${toPhase}`);
  }
};

const transitionPhase = (state, nextPhase) => {
  assertValidTransition(state.phase, nextPhase);
  state.phase = nextPhase;
};

const createTurnToken = () => crypto.randomBytes(8).toString('hex');

const bumpVersion = (state) => {
  state.stateVersion += 1;
  state.lastActivityAt = Date.now();
};

const getSeat = (state, seatIndex) =>
  state.seats.find((s) => s.seatIndex === seatIndex) || null;

const nextSeatClockwise = (seatsSubset, afterSeatIndex) => {
  const ordered = [...seatsSubset].sort((a, b) => a.seatIndex - b.seatIndex);
  if (ordered.length === 0) return null;
  const higher = ordered.find((s) => s.seatIndex > afterSeatIndex);
  return higher ? higher.seatIndex : ordered[0].seatIndex;
};

export const createTableState = ({
  roomId,
  hostUser,
  startingChips = 1000,
  blindLevel = '10/20',
  turnTimeoutSec = 30,
  nowMs = Date.now(),
}) => {
  const chips = STARTING_CHIP_PRESETS.includes(Number(startingChips))
    ? Number(startingChips)
    : 1000;
  const stakeCfg = BLIND_LEVEL_PRESETS[blindLevel] || BLIND_LEVEL_PRESETS['10/20'];
  const timeoutSec = TURN_TIMEOUT_PRESETS.includes(Number(turnTimeoutSec))
    ? Number(turnTimeoutSec)
    : 30;

  const state = {
    roomId,
    gameVariant: 'capsa_banting',
    phase: POKER_PHASES.LOBBY,
    stateVersion: 1,
    createdAt: nowMs,
    startedAt: null,
    endedAt: null,
    lastActivityAt: nowMs,
    hostUserId: hostUser.id,
    nextJoinOrder: 1,
    config: {
      startingChips: chips,
      blindLevel: BLIND_LEVEL_PRESETS[blindLevel] ? blindLevel : '10/20',
      baseStake: stakeCfg.baseStake,
      turnTimeoutSec: timeoutSec,
    },
    handNumber: 0,
    lastWinnerSeat: null,
    starterSeat: null,
    mustIncludeThreeDiamond: false,
    currentTurnSeat: null,
    turnToken: null,
    turnDeadlineAt: null,
    currentPlay: null, // { seatIndex, userId, fullName, cards, classified }
    passedSeats: [],
    lastHandResult: null,
    winnerUserId: null,
    seats: [],
  };

  addSeatToLobby(state, hostUser);
  return state;
};

export const addSeatToLobby = (state, user) => {
  if (state.phase !== POKER_PHASES.LOBBY) {
    throw new Error('Permainan sudah dimulai. Tidak dapat bergabung ke meja ini.');
  }
  const existing = state.seats.find((s) => s.userId === user.id);
  if (existing) {
    existing.connected = true;
    existing.disconnectedAt = null;
    bumpVersion(state);
    return existing;
  }
  if (state.seats.length >= MAX_SEATS) {
    throw new Error('Room sudah penuh (maksimal 4 pemain).');
  }

  const occupied = new Set(state.seats.map((s) => s.seatIndex));
  let seatIndex = 0;
  while (occupied.has(seatIndex) && seatIndex < MAX_SEATS) {
    seatIndex += 1;
  }

  const seat = {
    seatIndex,
    userId: user.id,
    fullName: user.full_name || user.fullName || `Pemain ${user.id}`,
    avatarUrl: user.avatar_url || user.avatarUrl || null,
    role: user.role || 'mahasiswa',
    isBot: false,
    chips: state.config.startingChips,
    ready: user.id === state.hostUserId,
    eliminated: false,
    inHand: false,
    holeCards: [],
    consecutiveTimeouts: 0,
    isAway: false,
    connected: true,
    disconnectedAt: null,
    joinOrder: state.nextJoinOrder++,
  };

  state.seats.push(seat);
  state.seats.sort((a, b) => a.seatIndex - b.seatIndex);
  bumpVersion(state);
  return seat;
};

export const fillEmptySeatsWithBots = (state) => {
  const occupied = new Set(state.seats.map((s) => s.seatIndex));
  let botIdx = 0;
  for (let slot = 0; slot < MAX_SEATS; slot += 1) {
    if (occupied.has(slot)) continue;
    const profile = BOT_PROFILES[botIdx] || BOT_PROFILES[0];
    botIdx += 1;
    state.seats.push({
      seatIndex: slot,
      userId: profile.userId - slot * 10,
      fullName: profile.fullName,
      avatarUrl: null,
      role: 'bot',
      isBot: true,
      chips: state.config.startingChips,
      ready: true,
      eliminated: false,
      inHand: false,
      holeCards: [],
      consecutiveTimeouts: 0,
      isAway: false,
      connected: true,
      disconnectedAt: null,
      joinOrder: state.nextJoinOrder++,
    });
  }
  state.seats.sort((a, b) => a.seatIndex - b.seatIndex);
};

export const setPlayerReady = (state, userId, ready) => {
  if (state.phase !== POKER_PHASES.LOBBY) {
    throw new Error('Status siap hanya dapat diubah saat berada di ruang tunggu.');
  }
  const seat = state.seats.find((s) => s.userId === userId);
  if (!seat) throw new Error('Pemain tidak ditemukan di room ini.');
  seat.ready = Boolean(ready);
  bumpVersion(state);
  return seat;
};

const assignTurnToSeat = (state, seatIndex, nowMs = Date.now()) => {
  state.currentTurnSeat = seatIndex;
  state.turnToken = seatIndex !== null ? createTurnToken() : null;
  state.turnDeadlineAt =
    seatIndex !== null ? nowMs + state.config.turnTimeoutSec * 1000 : null;
};

/**
 * Memulai 1 ronde Capsa Banting: 4 kursi × 13 kartu = 52 kartu.
 */
export const startNextHand = (
  state,
  { randomInt = defaultRandomInt, fillBots = true, nowMs = Date.now() } = {}
) => {
  if (
    state.phase !== POKER_PHASES.LOBBY &&
    state.phase !== POKER_PHASES.ANTAR_TANGAN
  ) {
    throw new Error(`Tidak dapat memulai ronde baru pada fase ${state.phase}.`);
  }

  if (state.phase === POKER_PHASES.LOBBY) {
    const humans = state.seats.filter((s) => !s.isBot);
    if (humans.length === 0) {
      throw new Error('Minimal 1 pemain manusia harus berada di meja.');
    }
    const notReadyHumans = humans.filter((s) => !s.ready && s.userId !== state.hostUserId);
    if (!fillBots && humans.length < 2) {
      throw new Error('Minimal 2 pemain manusia siap untuk memulai tanpa bot.');
    }
    if (notReadyHumans.length > 0 && humans.length > 1) {
      throw new Error('Semua pemain di room harus menekan tombol Siap terlebih dahulu.');
    }
    if (fillBots) {
      fillEmptySeatsWithBots(state);
    }
    if (!state.startedAt) state.startedAt = nowMs;
  }

  const eligibleSeats = state.seats
    .filter((s) => !s.eliminated && s.chips > 0)
    .sort((a, b) => a.seatIndex - b.seatIndex);

  const events = [];
  if (eligibleSeats.length < 2) {
    transitionPhase(state, POKER_PHASES.SELESAI);
    state.endedAt = nowMs;
    state.winnerUserId = eligibleSeats[0]?.userId || null;
    state.currentTurnSeat = null;
    state.turnToken = null;
    state.turnDeadlineAt = null;
    bumpVersion(state);
    return events;
  }

  // Capsa Banting selalu membagi 52 kartu ke 4 kursi (13 kartu per kursi)
  if (state.seats.length < MAX_SEATS && fillBots) {
    fillEmptySeatsWithBots(state);
  }

  transitionPhase(state, POKER_PHASES.MENUNGGU_MULAI);
  transitionPhase(state, POKER_PHASES.BERMAIN);

  state.handNumber += 1;
  state.lastHandResult = null;
  state.currentPlay = null;
  state.passedSeats = [];

  const deck = createShuffledDeck(randomInt);
  let threeDiamondSeatIndex = state.seats[0].seatIndex;

  for (let i = 0; i < state.seats.length; i += 1) {
    const seat = state.seats[i];
    const dealt = sortCapsaCards(deck.slice(i * CARDS_PER_PLAYER, (i + 1) * CARDS_PER_PLAYER), 'rank');
    seat.inHand = true;
    seat.eliminated = false;
    seat.holeCards = dealt;
    if (dealt.some((c) => c.rank === 3 && c.suit === 'D')) {
      threeDiamondSeatIndex = seat.seatIndex;
    }
  }

  // Ronde #1: pemegang 3♦ jalan pertama dan wajib menyertakan 3♦
  // Ronde berikutnya: pemenang ronde sebelumnya memimpin bebas
  const canPreviousWinnerStart =
    state.handNumber > 1 &&
    state.lastWinnerSeat !== null &&
    Boolean(getSeat(state, state.lastWinnerSeat));

  state.starterSeat = canPreviousWinnerStart ? state.lastWinnerSeat : threeDiamondSeatIndex;
  state.mustIncludeThreeDiamond = !canPreviousWinnerStart;

  assignTurnToSeat(state, state.starterSeat, nowMs);

  events.push({
    type: 'hand_started',
    payload: {
      handNumber: state.handNumber,
      starterSeat: state.starterSeat,
      mustIncludeThreeDiamond: state.mustIncludeThreeDiamond,
    },
  });

  bumpVersion(state);
  return events;
};

/**
 * Aksi yang valid untuk pemain aktif saat ini (beserta 5 saran langkah untuk tombol Hint).
 */
export const getValidActions = (state, seatIndex) => {
  const seat = getSeat(state, seatIndex);
  if (
    !seat ||
    state.phase !== POKER_PHASES.BERMAIN ||
    state.currentTurnSeat !== seatIndex ||
    !seat.inHand
  ) {
    return null;
  }

  const must3D = Boolean(state.mustIncludeThreeDiamond && !state.currentPlay);
  const validMoves = findValidMoves(seat.holeCards, state.currentPlay, {
    mustIncludeThreeDiamond: must3D,
  });

  return {
    canPlay: validMoves.length > 0,
    canPass: Boolean(state.currentPlay !== null),
    mustIncludeThreeDiamond: must3D,
    suggestedMoves: validMoves.slice(0, 6).map((m) => ({
      codes: m.cards.map((c) => c.code),
      label: m.classified.label,
      type: m.classified.type,
    })),
  };
};

const resolveRoundWin = (state, winnerSeat, events, nowMs) => {
  const settlement = calculateCapsaRoundSettlement({
    seats: state.seats,
    winnerSeatIndex: winnerSeat.seatIndex,
    baseStake: state.config.baseStake,
  });

  for (const pen of settlement.penalties) {
    const loserSeat = getSeat(state, pen.seatIndex);
    if (loserSeat) {
      loserSeat.chips = Math.max(0, loserSeat.chips - pen.penaltyAmount);
      if (loserSeat.chips === 0) loserSeat.eliminated = true;
    }
  }
  winnerSeat.chips += settlement.totalWon;
  state.lastWinnerSeat = winnerSeat.seatIndex;
  state.currentTurnSeat = null;
  state.turnToken = null;
  state.turnDeadlineAt = null;
  state.mustIncludeThreeDiamond = false;

  state.lastHandResult = {
    handNumber: state.handNumber,
    winnerSeat: winnerSeat.seatIndex,
    winnerUserId: winnerSeat.userId,
    winnerName: winnerSeat.fullName,
    totalWon: settlement.totalWon,
    penalties: settlement.penalties.map((p) => ({
      seatIndex: p.seatIndex,
      userId: p.userId,
      fullName: p.fullName,
      remainingCount: p.remainingCount,
      multiplier: p.multiplier,
      penaltyAmount: p.penaltyAmount,
      remainingCards: p.remainingCards,
    })),
  };

  events.push({
    type: 'round_won',
    payload: {
      handNumber: state.handNumber,
      winnerSeat: winnerSeat.seatIndex,
      winnerName: winnerSeat.fullName,
      totalWon: settlement.totalWon,
    },
  });

  const anyBankrupt = state.seats.some((s) => s.chips <= 0);
  const topChipSeat = [...state.seats].sort((a, b) => b.chips - a.chips)[0];

  if (anyBankrupt) {
    transitionPhase(state, POKER_PHASES.SELESAI);
    state.endedAt = nowMs;
    state.winnerUserId = topChipSeat?.userId || winnerSeat.userId;
    events.push({
      type: 'game_finished',
      payload: {
        winnerUserId: state.winnerUserId,
        winnerName: topChipSeat?.fullName || winnerSeat.fullName,
        totalHands: state.handNumber,
      },
    });
  } else {
    transitionPhase(state, POKER_PHASES.ANTAR_TANGAN);
  }

  bumpVersion(state);
};

/**
 * Menerapkan aksi `play` (banting kartu) atau `pass` (lewat) pada meja Capsa Banting.
 */
export const applyAction = (
  state,
  { userId, action, cards: cardCodes = [], turnToken, isTimeoutAuto = false, nowMs = Date.now() }
) => {
  if (state.phase !== POKER_PHASES.BERMAIN) {
    throw new Error('Tidak sedang dalam ronde permainan aktif.');
  }
  if (state.turnToken && turnToken !== state.turnToken) {
    throw new Error('Token giliran tidak cocok atau aksi sudah diproses.');
  }

  const seat = getSeat(state, state.currentTurnSeat);
  if (!seat || seat.userId !== userId) {
    throw new Error('Bukan giliran Anda saat ini.');
  }

  if (!isTimeoutAuto && !seat.isBot) {
    seat.consecutiveTimeouts = 0;
    seat.isAway = false;
  }

  const events = [];
  const inHandSeats = state.seats.filter((s) => s.inHand).sort((a, b) => a.seatIndex - b.seatIndex);

  if (action === 'pass') {
    if (!state.currentPlay) {
      throw new Error('Anda memimpin putaran saat meja kosong sehingga tidak bisa Lewat (Pass).');
    }

    if (!state.passedSeats.includes(seat.seatIndex)) {
      state.passedSeats.push(seat.seatIndex);
    }

    events.push({
      type: 'player_pass',
      payload: {
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        fullName: seat.fullName,
        auto: isTimeoutAuto,
      },
    });

    // Jika semua pemain lain (3 kursi lain) sudah pass -> meja bersih, pemegang play terakhir memimpin bebas!
    const otherSeatsCount = Math.max(1, inHandSeats.length - 1);
    if (state.passedSeats.length >= otherSeatsCount) {
      const trickWinnerSeat = state.currentPlay.seatIndex;
      state.currentPlay = null;
      state.passedSeats = [];
      state.mustIncludeThreeDiamond = false;
      assignTurnToSeat(state, trickWinnerSeat, nowMs);

      events.push({
        type: 'trick_cleared',
        payload: {
          nextLeaderSeat: trickWinnerSeat,
        },
      });
    } else {
      const nextSeat = nextSeatClockwise(inHandSeats, seat.seatIndex);
      assignTurnToSeat(state, nextSeat, nowMs);
    }

    bumpVersion(state);
    return events;
  }

  if (action === 'play') {
    const requestedCodes = Array.isArray(cardCodes)
      ? cardCodes.map((c) => String(c).trim().toUpperCase())
      : [];
    if (requestedCodes.length === 0) {
      throw new Error('Pilih minimal 1 kartu untuk diturunkan.');
    }

    // Pastikan semua kartu benar-benar ada di tangan pemain saat ini
    const selectedObjects = [];
    const availableMap = new Map(seat.holeCards.map((c) => [c.code, c]));
    for (const code of requestedCodes) {
      const cardObj = availableMap.get(code);
      if (!cardObj) {
        throw new Error(`Kartu ${code} tidak dimiliki di tangan Anda.`);
      }
      availableMap.delete(code);
      selectedObjects.push(cardObj);
    }

    const must3D = Boolean(state.mustIncludeThreeDiamond && !state.currentPlay);
    if (!canBeatPlay(selectedObjects, state.currentPlay, { mustIncludeThreeDiamond: must3D })) {
      if (must3D) {
        throw new Error('Pembukaan ronde pertama wajib menyertakan 3♦.');
      }
      throw new Error('Kombinasi kartu tidak sah atau nilainya belum cukup kuat untuk membanting kartu di meja.');
    }

    const classified = classifyCapsaPlay(selectedObjects);
    const playedCodeSet = new Set(selectedObjects.map((c) => c.code));
    seat.holeCards = seat.holeCards.filter((c) => !playedCodeSet.has(c.code));

    state.mustIncludeThreeDiamond = false;
    state.passedSeats = [];
    state.currentPlay = {
      seatIndex: seat.seatIndex,
      userId: seat.userId,
      fullName: seat.fullName,
      type: classified.type,
      label: classified.label,
      isBomb: classified.isBomb,
      cards: classified.cards,
      classified,
    };

    events.push({
      type: 'cards_played',
      payload: {
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        fullName: seat.fullName,
        label: classified.label,
        cards: classified.cards,
        remainingCount: seat.holeCards.length,
        auto: isTimeoutAuto,
      },
    });

    // Jika kartu habis -> langsung menang ronde ini!
    if (seat.holeCards.length === 0) {
      resolveRoundWin(state, seat, events, nowMs);
      return events;
    }

    const nextSeat = nextSeatClockwise(inHandSeats, seat.seatIndex);
    assignTurnToSeat(state, nextSeat, nowMs);
    bumpVersion(state);
    return events;
  }

  throw new Error(`Aksi Capsa Banting tidak dikenal: ${action}`);
};

/**
 * Penanganan timeout giliran:
 * - Meja kosong (harus lead): otomatis banting kombinasi sah terkecil.
 * - Ada kartu di meja: otomatis Lewat (Pass) dan tandai away setelah >= 2x timeout.
 */
export const handleTurnTimeout = (state, nowMs = Date.now()) => {
  if (state.phase !== POKER_PHASES.BERMAIN || state.currentTurnSeat === null) {
    return [];
  }
  const seat = getSeat(state, state.currentTurnSeat);
  if (!seat) return [];

  if (!seat.isBot) {
    seat.consecutiveTimeouts += 1;
    if (seat.consecutiveTimeouts >= 2) {
      seat.isAway = true;
    }
  }

  if (!state.currentPlay) {
    const must3D = Boolean(state.mustIncludeThreeDiamond);
    const moves = findValidMoves(seat.holeCards, null, { mustIncludeThreeDiamond: must3D });
    const fallbackMove = moves[0];
    if (fallbackMove) {
      return applyAction(state, {
        userId: seat.userId,
        action: 'play',
        cards: fallbackMove.cards.map((c) => c.code),
        turnToken: state.turnToken,
        isTimeoutAuto: true,
        nowMs,
      });
    }
  }

  return applyAction(state, {
    userId: seat.userId,
    action: 'pass',
    turnToken: state.turnToken,
    isTimeoutAuto: true,
    nowMs,
  });
};

const reassignHostToOldest = (state) => {
  const humanSeats = state.seats.filter((s) => !s.isBot);
  if (humanSeats.length === 0) {
    state.hostUserId = null;
    return null;
  }
  const oldest = [...humanSeats].sort((a, b) => a.joinOrder - b.joinOrder)[0];
  state.hostUserId = oldest.userId;
  return oldest;
};

/**
 * Saat pemain manusia keluar di tengah permainan Capsa Banting, kursinya diambil alih Bot AI
 * agar 52 kartu (4 × 13) tetap berjalan seimbang tanpa merusak putaran 3 pemain tersisa.
 */
export const handlePlayerLeaveOrForfeit = (state, userId, { nowMs = Date.now() } = {}) => {
  const seat = state.seats.find((s) => s.userId === userId);
  if (!seat) return [];

  const events = [];

  if (state.phase === POKER_PHASES.LOBBY) {
    state.seats = state.seats.filter((s) => s.userId !== userId);
  } else if (state.phase === POKER_PHASES.BERMAIN || state.phase === POKER_PHASES.ANTAR_TANGAN) {
    // Jika masih ada pemain manusia lain di meja, ubah kursi menjadi Bot sementara agar 52 kartu tetap utuh
    const remainingHumans = state.seats.filter((s) => !s.isBot && s.userId !== userId);
    if (remainingHumans.length > 0) {
      seat.isBot = true;
      seat.role = 'bot';
      seat.userId = -100 - seat.seatIndex;
      seat.fullName = `${seat.fullName} (Bot)`;
      seat.connected = true;
      events.push({
        type: 'player_left_bot_takeover',
        payload: { seatIndex: seat.seatIndex, formerName: seat.fullName },
      });
    } else {
      // Pemain manusia terakhir keluar -> akhiri room dengan bersih
      state.seats = state.seats.filter((s) => s.userId !== userId);
      state.phase = POKER_PHASES.SELESAI;
      state.endedAt = nowMs;
      state.currentTurnSeat = null;
      state.turnToken = null;
      state.turnDeadlineAt = null;
    }
  } else {
    state.seats = state.seats.filter((s) => s.userId !== userId);
  }

  if (state.hostUserId === userId) {
    const newHost = reassignHostToOldest(state);
    if (newHost) {
      events.push({
        type: 'host_migrated',
        payload: { newHostUserId: newHost.userId, fullName: newHost.fullName },
      });
    }
  }

  bumpVersion(state);
  return events;
};

export const forceEndRoom = (
  state,
  reason = 'Room ditutup oleh penyelenggara.',
  nowMs = Date.now()
) => {
  if (state.phase === POKER_PHASES.SELESAI) return [];
  state.phase = POKER_PHASES.SELESAI;
  state.endedAt = nowMs;
  state.currentTurnSeat = null;
  state.turnToken = null;
  state.turnDeadlineAt = null;
  const topHuman = [...state.seats]
    .filter((s) => !s.isBot)
    .sort((a, b) => b.chips - a.chips)[0] || [...state.seats].sort((a, b) => b.chips - a.chips)[0];
  state.winnerUserId = topHuman?.userId || null;
  bumpVersion(state);
  return [{ type: 'room_closed', payload: { reason } }];
};

/**
 * Menyaring state meja KHUSUS per pemain:
 * Kartu tangan lawan SELALU `null` saat ronde berjalan (`bermain`). Hanya jumlah kartu (`cardCount`) yang dikirim.
 */
export const projectStateForViewer = (state, viewerUserId, nowMs = Date.now()) => {
  const viewerSeat = state.seats.find((s) => s.userId === viewerUserId) || null;
  const canRevealRemainingAtRoundEnd =
    state.phase === POKER_PHASES.ANTAR_TANGAN || state.phase === POKER_PHASES.SELESAI;

  const projectedSeats = state.seats.map((s) => {
    const isSelf = s.userId === viewerUserId;
    const canSee = isSelf || canRevealRemainingAtRoundEnd;

    return {
      seatIndex: s.seatIndex,
      userId: s.userId,
      fullName: s.fullName,
      avatarUrl: s.avatarUrl,
      role: s.role,
      isBot: Boolean(s.isBot),
      chips: s.chips,
      ready: s.ready,
      eliminated: s.eliminated,
      inHand: s.inHand,
      hasPassed: state.passedSeats.includes(s.seatIndex),
      cardCount: s.holeCards.length,
      isAway: s.isAway,
      connected: s.connected,
      holeCards: canSee ? s.holeCards : null,
    };
  });

  const validActions =
    viewerSeat && state.currentTurnSeat === viewerSeat.seatIndex
      ? getValidActions(state, viewerSeat.seatIndex)
      : null;

  return {
    roomId: state.roomId,
    gameVariant: 'capsa_banting',
    stateVersion: state.stateVersion,
    serverNow: nowMs,
    room: {
      phase: state.phase,
      hostUserId: state.hostUserId,
      config: state.config,
      handNumber: state.handNumber,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      winnerUserId: state.winnerUserId,
      playerCount: state.seats.length,
    },
    table: {
      currentTurnSeat: state.currentTurnSeat,
      turnToken:
        viewerSeat && state.currentTurnSeat === viewerSeat.seatIndex ? state.turnToken : null,
      turnDeadlineAt: state.turnDeadlineAt,
      starterSeat: state.starterSeat,
      mustIncludeThreeDiamond: state.mustIncludeThreeDiamond,
      currentPlay: state.currentPlay
        ? {
            seatIndex: state.currentPlay.seatIndex,
            userId: state.currentPlay.userId,
            fullName: state.currentPlay.fullName,
            type: state.currentPlay.type,
            label: state.currentPlay.label,
            isBomb: state.currentPlay.isBomb,
            cards: state.currentPlay.cards,
          }
        : null,
      passedSeats: [...state.passedSeats],
      lastHandResult: state.lastHandResult,
      seats: projectedSeats,
    },
    viewerSeat: viewerSeat ? viewerSeat.seatIndex : null,
    myHoleCards: viewerSeat ? viewerSeat.holeCards : null,
    validActions,
  };
};

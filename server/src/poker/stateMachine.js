// FILE: server/src/poker/stateMachine.js
import crypto from 'node:crypto';
import { createShuffledDeck, defaultRandomInt } from './deck.js';
import { evaluateSevenCards } from './handEvaluator.js';
import { calculateSidePots, distributePots } from './potCalculator.js';

export const MAX_SEATS = 4;
export const MIN_PLAYERS_TO_START = 2;

export const POKER_PHASES = Object.freeze({
  LOBBY: 'lobby',
  MENUNGGU_MULAI: 'menunggu_mulai',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  ANTAR_TANGAN: 'antar_tangan',
  SELESAI: 'selesai',
});

export const BETTING_PHASES = Object.freeze([
  POKER_PHASES.PREFLOP,
  POKER_PHASES.FLOP,
  POKER_PHASES.TURN,
  POKER_PHASES.RIVER,
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  [POKER_PHASES.LOBBY]: [POKER_PHASES.MENUNGGU_MULAI, POKER_PHASES.SELESAI],
  [POKER_PHASES.MENUNGGU_MULAI]: [POKER_PHASES.PREFLOP, POKER_PHASES.SELESAI],
  [POKER_PHASES.PREFLOP]: [
    POKER_PHASES.FLOP,
    POKER_PHASES.SHOWDOWN,
    POKER_PHASES.ANTAR_TANGAN,
    POKER_PHASES.SELESAI,
  ],
  [POKER_PHASES.FLOP]: [
    POKER_PHASES.TURN,
    POKER_PHASES.SHOWDOWN,
    POKER_PHASES.ANTAR_TANGAN,
    POKER_PHASES.SELESAI,
  ],
  [POKER_PHASES.TURN]: [
    POKER_PHASES.RIVER,
    POKER_PHASES.SHOWDOWN,
    POKER_PHASES.ANTAR_TANGAN,
    POKER_PHASES.SELESAI,
  ],
  [POKER_PHASES.RIVER]: [
    POKER_PHASES.SHOWDOWN,
    POKER_PHASES.ANTAR_TANGAN,
    POKER_PHASES.SELESAI,
  ],
  [POKER_PHASES.SHOWDOWN]: [POKER_PHASES.ANTAR_TANGAN, POKER_PHASES.SELESAI],
  [POKER_PHASES.ANTAR_TANGAN]: [
    POKER_PHASES.MENUNGGU_MULAI,
    POKER_PHASES.PREFLOP,
    POKER_PHASES.SELESAI,
  ],
  [POKER_PHASES.SELESAI]: [],
});

export const STARTING_CHIP_PRESETS = Object.freeze([500, 1000, 2000]);
export const BLIND_LEVEL_PRESETS = Object.freeze({
  '5/10': { smallBlind: 5, bigBlind: 10 },
  '10/20': { smallBlind: 10, bigBlind: 20 },
  '25/50': { smallBlind: 25, bigBlind: 50 },
});
export const TURN_TIMEOUT_PRESETS = Object.freeze([15, 30, 45]);

export const assertValidTransition = (fromPhase, toPhase) => {
  const allowed = ALLOWED_TRANSITIONS[fromPhase] || [];
  if (!allowed.includes(toPhase)) {
    throw new Error(`Transisi state poker tidak valid: ${fromPhase} -> ${toPhase}`);
  }
};

const transitionPhase = (state, nextPhase) => {
  assertValidTransition(state.phase, nextPhase);
  state.phase = nextPhase;
};

const nextSeatClockwise = (seatsSubset, afterSeatIndex) => {
  const ordered = [...seatsSubset].sort((a, b) => a.seatIndex - b.seatIndex);
  if (ordered.length === 0) return null;
  const higher = ordered.find((s) => s.seatIndex > afterSeatIndex);
  return higher ? higher.seatIndex : ordered[0].seatIndex;
};

const createTurnToken = () => crypto.randomBytes(8).toString('hex');

const bumpVersion = (state) => {
  state.stateVersion += 1;
  state.lastActivityAt = Date.now();
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
  const blindCfg = BLIND_LEVEL_PRESETS[blindLevel] || BLIND_LEVEL_PRESETS['10/20'];
  const timeoutSec = TURN_TIMEOUT_PRESETS.includes(Number(turnTimeoutSec))
    ? Number(turnTimeoutSec)
    : 30;

  const state = {
    roomId,
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
      smallBlind: blindCfg.smallBlind,
      bigBlind: blindCfg.bigBlind,
      turnTimeoutSec: timeoutSec,
    },
    handNumber: 0,
    dealerSeat: null,
    sbSeat: null,
    bbSeat: null,
    currentTurnSeat: null,
    turnToken: null,
    turnDeadlineAt: null,
    deck: [],
    burnCards: [],
    communityCards: [],
    currentBet: 0,
    minRaiseDelta: blindCfg.bigBlind,
    forfeitedContributions: [],
    showdownRevealed: false,
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
    chips: state.config.startingChips,
    ready: user.id === state.hostUserId,
    eliminated: false,
    inHand: false,
    folded: false,
    allIn: false,
    actedThisStreet: false,
    lockedFromReraise: false,
    streetBet: 0,
    totalHandBet: 0,
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

const getSeat = (state, seatIndex) => state.seats.find((s) => s.seatIndex === seatIndex) || null;

const getActiveHandSeats = (state) =>
  state.seats.filter((s) => s.inHand && !s.folded).sort((a, b) => a.seatIndex - b.seatIndex);

const getCanActSeats = (state) =>
  state.seats.filter((s) => s.inHand && !s.folded && !s.allIn).sort((a, b) => a.seatIndex - b.seatIndex);

const postForcedBlind = (seat, amount) => {
  const posted = Math.min(seat.chips, amount);
  seat.chips -= posted;
  seat.streetBet += posted;
  seat.totalHandBet += posted;
  if (seat.chips === 0) {
    seat.allIn = true;
  }
  return posted;
};

const assignTurnToSeat = (state, seatIndex, nowMs = Date.now()) => {
  state.currentTurnSeat = seatIndex;
  state.turnToken = seatIndex !== null ? createTurnToken() : null;
  state.turnDeadlineAt =
    seatIndex !== null ? nowMs + state.config.turnTimeoutSec * 1000 : null;
};

const getHandContributions = (state) => [
  ...state.seats
    .filter((s) => s.inHand)
    .map((s) => ({
      seatIndex: s.seatIndex,
      userId: s.userId,
      amount: s.totalHandBet,
      folded: s.folded,
    })),
  ...(state.forfeitedContributions || []),
];

const finishHandToEarlyWinner = (state, survivorSeat, events, nowMs) => {
  const contributions = getHandContributions(state);
  const totalPot = contributions.reduce((sum, c) => sum + c.amount, 0);
  survivorSeat.chips += totalPot;
  state.showdownRevealed = false;
  state.currentTurnSeat = null;
  state.turnToken = null;
  state.turnDeadlineAt = null;
  state.lastHandResult = {
    handNumber: state.handNumber,
    reason: 'fold',
    totalPot,
    winnerSeats: [survivorSeat.seatIndex],
    winnerUserIds: [survivorSeat.userId],
    potBreakdowns: [
      {
        potIndex: 0,
        amount: totalPot,
        eligibleSeats: [survivorSeat.seatIndex],
        winnerSeats: [survivorSeat.seatIndex],
        payouts: { [survivorSeat.seatIndex]: totalPot },
      },
    ],
    revealedHands: {},
  };

  events.push({
    type: 'hand_won_by_fold',
    payload: {
      handNumber: state.handNumber,
      winnerSeat: survivorSeat.seatIndex,
      winnerName: survivorSeat.fullName,
      amount: totalPot,
    },
  });

  finalizeHandEliminations(state, events, nowMs);
};

const resolveShowdown = (state, events, nowMs) => {
  transitionPhase(state, POKER_PHASES.SHOWDOWN);
  const inHandSeats = state.seats.filter((s) => s.inHand);
  const survivingSeats = inHandSeats.filter((s) => !s.folded);

  const evaluatedBySeat = new Map();
  const revealedHands = {};
  for (const s of survivingSeats) {
    const evalRes = evaluateSevenCards([...s.holeCards, ...state.communityCards]);
    evaluatedBySeat.set(s.seatIndex, evalRes);
    revealedHands[s.seatIndex] = {
      userId: s.userId,
      fullName: s.fullName,
      holeCards: s.holeCards,
      categoryName: evalRes.categoryName,
      categoryRank: evalRes.categoryRank,
      bestFiveCodes: evalRes.bestFive.map((c) => c.code),
    };
  }

  const contributions = getHandContributions(state);
  const pots = calculateSidePots(contributions);
  const { payoutsBySeat, potBreakdowns } = distributePots({
    pots,
    evaluatedBySeat,
    dealerSeat: state.dealerSeat ?? 0,
    maxSeats: MAX_SEATS,
  });

  for (const [seatIdx, won] of payoutsBySeat.entries()) {
    const seat = getSeat(state, seatIdx);
    if (seat) seat.chips += won;
  }

  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
  const winnerSeats = [...payoutsBySeat.keys()];
  const winnerUserIds = winnerSeats
    .map((idx) => getSeat(state, idx)?.userId)
    .filter(Boolean);

  state.showdownRevealed = true;
  state.currentTurnSeat = null;
  state.turnToken = null;
  state.turnDeadlineAt = null;
  state.lastHandResult = {
    handNumber: state.handNumber,
    reason: 'showdown',
    totalPot,
    winnerSeats,
    winnerUserIds,
    potBreakdowns,
    revealedHands,
  };

  events.push({
    type: 'hand_showdown',
    payload: {
      handNumber: state.handNumber,
      potBreakdowns,
      revealedHands,
    },
  });

  finalizeHandEliminations(state, events, nowMs);
};

const finalizeHandEliminations = (state, events, nowMs) => {
  for (const s of state.seats) {
    if (s.chips <= 0) {
      s.chips = 0;
      s.eliminated = true;
    }
  }

  const remaining = state.seats.filter((s) => !s.eliminated && s.chips > 0);
  if (remaining.length <= 1) {
    transitionPhase(state, POKER_PHASES.SELESAI);
    state.endedAt = nowMs;
    state.winnerUserId = remaining[0]?.userId || null;
    events.push({
      type: 'game_finished',
      payload: {
        winnerUserId: state.winnerUserId,
        winnerName: remaining[0]?.fullName || null,
        totalHands: state.handNumber,
      },
    });
  } else {
    transitionPhase(state, POKER_PHASES.ANTAR_TANGAN);
  }
  bumpVersion(state);
};

const findNextActionSeat = (state, fromSeatIndex) => {
  const ordered = [...state.seats].sort((a, b) => a.seatIndex - b.seatIndex);
  const len = ordered.length;
  if (len === 0) return null;

  let startPos = ordered.findIndex((s) => s.seatIndex > fromSeatIndex);
  if (startPos === -1) startPos = 0;

  for (let offset = 0; offset < len; offset += 1) {
    const candidate = ordered[(startPos + offset) % len];
    if (!candidate.inHand || candidate.folded || candidate.allIn) continue;
    if (!candidate.actedThisStreet || candidate.streetBet < state.currentBet) {
      return candidate.seatIndex;
    }
  }
  return null;
};

const isStreetBettingComplete = (state) => {
  const actionable = getCanActSeats(state);
  return actionable.every((s) => s.actedThisStreet && s.streetBet === state.currentBet);
};

const dealStreetWithBurn = (state, targetPhase, count, events) => {
  transitionPhase(state, targetPhase);
  if (state.deck.length < count + 1) {
    throw new Error('Dek kartu habis secara tidak terduga.');
  }
  // Burn 1 kartu sebelum setiap pembagian community card
  state.burnCards.push(state.deck.pop());
  const dealt = [];
  for (let i = 0; i < count; i += 1) {
    const card = state.deck.pop();
    state.communityCards.push(card);
    dealt.push(card);
  }
  events.push({
    type: 'community_dealt',
    payload: {
      phase: targetPhase,
      cards: dealt,
      burnCount: state.burnCards.length,
    },
  });
};

const advanceAfterAction = (state, lastActorSeatIndex, events, nowMs) => {
  const surviving = getActiveHandSeats(state);
  if (surviving.length === 1) {
    finishHandToEarlyWinner(state, surviving[0], events, nowMs);
    return;
  }

  if (!isStreetBettingComplete(state)) {
    const nextSeat = findNextActionSeat(state, lastActorSeatIndex);
    if (nextSeat !== null) {
      assignTurnToSeat(state, nextSeat, nowMs);
      bumpVersion(state);
      return;
    }
  }

  // Jalan taruhan saat ini selesai -> cek apakah masih ada minimal 2 pemain yang bisa bertaruh
  if (state.phase === POKER_PHASES.RIVER) {
    resolveShowdown(state, events, nowMs);
    return;
  }

  const nonAllInCount = getCanActSeats(state).length;
  if (nonAllInCount <= 1) {
    // Runout otomatis hingga river lalu showdown (semua / sisa all-in)
    if (state.phase === POKER_PHASES.PREFLOP) {
      dealStreetWithBurn(state, POKER_PHASES.FLOP, 3, events);
    }
    if (state.phase === POKER_PHASES.FLOP) {
      dealStreetWithBurn(state, POKER_PHASES.TURN, 1, events);
    }
    if (state.phase === POKER_PHASES.TURN) {
      dealStreetWithBurn(state, POKER_PHASES.RIVER, 1, events);
    }
    resolveShowdown(state, events, nowMs);
    return;
  }

  // Lanjut ke street berikutnya secara normal
  if (state.phase === POKER_PHASES.PREFLOP) {
    dealStreetWithBurn(state, POKER_PHASES.FLOP, 3, events);
  } else if (state.phase === POKER_PHASES.FLOP) {
    dealStreetWithBurn(state, POKER_PHASES.TURN, 1, events);
  } else if (state.phase === POKER_PHASES.TURN) {
    dealStreetWithBurn(state, POKER_PHASES.RIVER, 1, events);
  }

  state.currentBet = 0;
  state.minRaiseDelta = state.config.bigBlind;
  for (const s of state.seats) {
    s.streetBet = 0;
    s.actedThisStreet = false;
    s.lockedFromReraise = false;
  }

  // Pertama bertindak post-flop: kursi aktif pertama di sebelah kiri dealer
  const firstPostFlop = findNextActionSeat(state, state.dealerSeat ?? 0);
  if (firstPostFlop === null) {
    resolveShowdown(state, events, nowMs);
    return;
  }
  assignTurnToSeat(state, firstPostFlop, nowMs);
  bumpVersion(state);
};

/**
 * Memulai tangan baru (dari lobby atau antar_tangan).
 */
export const startNextHand = (state, { randomInt = defaultRandomInt, nowMs = Date.now() } = {}) => {
  if (
    state.phase !== POKER_PHASES.LOBBY &&
    state.phase !== POKER_PHASES.ANTAR_TANGAN
  ) {
    throw new Error(`Tidak dapat memulai tangan baru pada fase ${state.phase}.`);
  }

  if (state.phase === POKER_PHASES.LOBBY) {
    const readyCount = state.seats.filter((s) => s.ready).length;
    if (readyCount < MIN_PLAYERS_TO_START) {
      throw new Error('Minimal 2 pemain siap untuk memulai permainan.');
    }
    if (!state.startedAt) state.startedAt = nowMs;
  }

  for (const s of state.seats) {
    if (s.chips <= 0) {
      s.chips = 0;
      s.eliminated = true;
    }
    s.inHand = false;
    s.folded = false;
    s.allIn = false;
    s.actedThisStreet = false;
    s.lockedFromReraise = false;
    s.streetBet = 0;
    s.totalHandBet = 0;
    s.holeCards = [];
  }

  const eligibleSeats = state.seats
    .filter((s) => !s.eliminated && s.chips > 0)
    .sort((a, b) => a.seatIndex - b.seatIndex);

  const events = [];
  if (eligibleSeats.length < MIN_PLAYERS_TO_START) {
    transitionPhase(state, POKER_PHASES.SELESAI);
    state.endedAt = nowMs;
    state.winnerUserId = eligibleSeats[0]?.userId || null;
    state.currentTurnSeat = null;
    state.turnToken = null;
    state.turnDeadlineAt = null;
    bumpVersion(state);
    return events;
  }

  transitionPhase(state, POKER_PHASES.MENUNGGU_MULAI);
  transitionPhase(state, POKER_PHASES.PREFLOP);

  state.handNumber += 1;
  state.showdownRevealed = false;
  state.lastHandResult = null;
  state.forfeitedContributions = [];
  state.burnCards = [];
  state.communityCards = [];
  state.deck = createShuffledDeck(randomInt);

  const prevDealer = state.dealerSeat;
  state.dealerSeat =
    prevDealer === null || state.handNumber === 1
      ? eligibleSeats[0].seatIndex
      : nextSeatClockwise(eligibleSeats, prevDealer);

  const isHeadsUp = eligibleSeats.length === 2;
  // Aturan Heads-Up: Dealer = Small Blind, lawan = Big Blind
  state.sbSeat = isHeadsUp
    ? state.dealerSeat
    : nextSeatClockwise(eligibleSeats, state.dealerSeat);
  state.bbSeat = nextSeatClockwise(eligibleSeats, state.sbSeat);

  for (const seat of eligibleSeats) {
    seat.inHand = true;
    seat.holeCards = [state.deck.pop(), state.deck.pop()];
  }

  const sbSeatObj = getSeat(state, state.sbSeat);
  const bbSeatObj = getSeat(state, state.bbSeat);
  const sbPosted = postForcedBlind(sbSeatObj, state.config.smallBlind);
  const bbPosted = postForcedBlind(bbSeatObj, state.config.bigBlind);

  state.currentBet = Math.max(sbPosted, bbPosted);
  state.minRaiseDelta = state.config.bigBlind;

  events.push({
    type: 'hand_started',
    payload: {
      handNumber: state.handNumber,
      dealerSeat: state.dealerSeat,
      sbSeat: state.sbSeat,
      bbSeat: state.bbSeat,
      sbPosted,
      bbPosted,
    },
  });

  // Heads-up preflop: Dealer (SB) bertindak pertama. 3-4 pemain: UTG (sebelah BB) bertindak pertama.
  const firstPreflopAnchor = isHeadsUp ? state.dealerSeat - 1 : state.bbSeat;
  const candidateFirst = nextSeatClockwise(eligibleSeats, firstPreflopAnchor);

  const nonAllInSeats = eligibleSeats.filter((s) => !s.allIn);
  if (
    nonAllInSeats.length === 0 ||
    (nonAllInSeats.length === 1 && nonAllInSeats[0].streetBet >= state.currentBet)
  ) {
    // Kasus langka semua blind langsung all-in menutup taruhan
    dealStreetWithBurn(state, POKER_PHASES.FLOP, 3, events);
    dealStreetWithBurn(state, POKER_PHASES.TURN, 1, events);
    dealStreetWithBurn(state, POKER_PHASES.RIVER, 1, events);
    resolveShowdown(state, events, nowMs);
    return events;
  }

  let firstActorSeat = candidateFirst;
  const firstCandidateObj = getSeat(state, firstActorSeat);
  if (!firstCandidateObj || firstCandidateObj.allIn) {
    firstActorSeat = findNextActionSeat(state, candidateFirst);
  }

  assignTurnToSeat(state, firstActorSeat, nowMs);
  bumpVersion(state);
  return events;
};

/**
 * Menghitung daftar aksi sah dan batas nominal untuk kursi tertentu pada state saat ini.
 */
export const getValidActions = (state, seatIndex) => {
  const seat = getSeat(state, seatIndex);
  if (
    !seat ||
    !BETTING_PHASES.includes(state.phase) ||
    state.currentTurnSeat !== seatIndex ||
    !seat.inHand ||
    seat.folded ||
    seat.allIn
  ) {
    return null;
  }

  const maxTotal = seat.chips + seat.streetBet;
  const toCall = Math.max(0, state.currentBet - seat.streetBet);
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && seat.chips > toCall;
  const canAllIn = seat.chips > 0;

  const isOpeningBet = state.currentBet === 0;
  const minRaiseTarget = isOpeningBet
    ? state.config.bigBlind
    : state.currentBet + state.minRaiseDelta;

  const canBetOrRaiseFull =
    !seat.lockedFromReraise && seat.chips > toCall && maxTotal >= minRaiseTarget;

  return {
    canFold: true,
    canCheck,
    canCall,
    callAmount: Math.min(toCall, seat.chips),
    canBet: isOpeningBet && canBetOrRaiseFull,
    canRaise: !isOpeningBet && canBetOrRaiseFull,
    minBetOrRaiseTo: canBetOrRaiseFull ? minRaiseTarget : null,
    maxBetOrRaiseTo: maxTotal,
    canAllIn,
    allInToTotal: maxTotal,
    allInChips: seat.chips,
  };
};

/**
 * Menerapkan aksi pemain pada meja (100% otoritatif di server).
 */
export const applyAction = (
  state,
  { userId, action, amount = undefined, turnToken, isTimeoutAuto = false, nowMs = Date.now() }
) => {
  if (!BETTING_PHASES.includes(state.phase)) {
    throw new Error('Tidak sedang dalam fase taruhan.');
  }
  if (state.turnToken && turnToken !== state.turnToken) {
    throw new Error('Token giliran tidak cocok atau aksi sudah diproses (basi).');
  }

  const seat = getSeat(state, state.currentTurnSeat);
  if (!seat || seat.userId !== userId) {
    throw new Error('Bukan giliran Anda saat ini.');
  }

  const valid = getValidActions(state, seat.seatIndex);
  if (!valid) {
    throw new Error('Tidak ada aksi sah yang tersedia pada giliran ini.');
  }

  if (!isTimeoutAuto) {
    seat.consecutiveTimeouts = 0;
    seat.isAway = false;
  }

  const events = [];

  if (action === 'fold') {
    seat.folded = true;
    seat.actedThisStreet = true;
    events.push({
      type: 'player_action',
      payload: { seatIndex: seat.seatIndex, userId, fullName: seat.fullName, action: 'fold', amount: 0, auto: isTimeoutAuto },
    });
    advanceAfterAction(state, seat.seatIndex, events, nowMs);
    return events;
  }

  if (action === 'check') {
    if (!valid.canCheck) {
      throw new Error('Tidak bisa check karena ada taruhan yang harus diikuti.');
    }
    seat.actedThisStreet = true;
    events.push({
      type: 'player_action',
      payload: { seatIndex: seat.seatIndex, userId, fullName: seat.fullName, action: 'check', amount: 0, auto: isTimeoutAuto },
    });
    advanceAfterAction(state, seat.seatIndex, events, nowMs);
    return events;
  }

  if (action === 'call') {
    if (valid.callAmount <= 0) {
      throw new Error('Tidak ada nominal call yang perlu dibayar.');
    }
    const added = Math.min(seat.chips, valid.callAmount);
    seat.chips -= added;
    seat.streetBet += added;
    seat.totalHandBet += added;
    if (seat.chips === 0) seat.allIn = true;
    seat.actedThisStreet = true;
    events.push({
      type: 'player_action',
      payload: {
        seatIndex: seat.seatIndex,
        userId,
        fullName: seat.fullName,
        action: seat.allIn ? 'all_in' : 'call',
        amount: added,
        streetBet: seat.streetBet,
      },
    });
    advanceAfterAction(state, seat.seatIndex, events, nowMs);
    return events;
  }

  if (action === 'bet' || action === 'raise') {
    if (action === 'bet' && !valid.canBet) {
      throw new Error('Tidak dapat melakukan bet pada kondisi taruhan saat ini.');
    }
    if (action === 'raise' && !valid.canRaise) {
      throw new Error('Tidak memenuhi syarat minimum raise (gunakan all-in jika chip kurang).');
    }

    const targetTotal = Math.floor(Number(amount));
    if (!Number.isFinite(targetTotal)) {
      throw new Error('Nominal taruhan tidak valid.');
    }
    if (targetTotal < valid.minBetOrRaiseTo) {
      throw new Error(`Taruhan minimal ke ${valid.minBetOrRaiseTo} chip.`);
    }
    if (targetTotal > valid.maxBetOrRaiseTo) {
      throw new Error('Taruhan tidak boleh melebihi sisa chip Anda.');
    }

    const added = targetTotal - seat.streetBet;
    const raiseDelta = targetTotal - state.currentBet;
    seat.chips -= added;
    seat.streetBet = targetTotal;
    seat.totalHandBet += added;
    if (seat.chips === 0) seat.allIn = true;
    seat.actedThisStreet = true;
    seat.lockedFromReraise = false;

    state.currentBet = targetTotal;
    state.minRaiseDelta = Math.max(state.config.bigBlind, raiseDelta);
    for (const other of state.seats) {
      if (other.seatIndex !== seat.seatIndex && other.inHand && !other.folded && !other.allIn) {
        other.actedThisStreet = false;
        other.lockedFromReraise = false;
      }
    }

    events.push({
      type: 'player_action',
      payload: {
        seatIndex: seat.seatIndex,
        userId,
        fullName: seat.fullName,
        action: seat.allIn ? 'all_in' : action,
        amount: added,
        streetBet: seat.streetBet,
      },
    });
    advanceAfterAction(state, seat.seatIndex, events, nowMs);
    return events;
  }

  if (action === 'all_in') {
    if (!valid.canAllIn) {
      throw new Error('Chip Anda sudah habis.');
    }
    const added = seat.chips;
    const targetTotal = seat.streetBet + added;
    seat.chips = 0;
    seat.streetBet = targetTotal;
    seat.totalHandBet += added;
    seat.allIn = true;
    seat.actedThisStreet = true;

    if (targetTotal > state.currentBet) {
      const raiseDelta = targetTotal - state.currentBet;
      const isFullRaise =
        state.currentBet === 0
          ? raiseDelta >= state.config.bigBlind
          : raiseDelta >= state.minRaiseDelta;

      state.currentBet = targetTotal;
      if (isFullRaise) {
        state.minRaiseDelta = Math.max(state.config.bigBlind, raiseDelta);
      }

      for (const other of state.seats) {
        if (other.seatIndex !== seat.seatIndex && other.inHand && !other.folded && !other.allIn) {
          if (!isFullRaise && other.actedThisStreet) {
            // Incomplete all-in raise: pemain yang sudah bertindak tetap boleh call/fold, namun hak re-raise tidak terbuka kembali
            other.lockedFromReraise = true;
          } else if (isFullRaise) {
            other.lockedFromReraise = false;
          }
          other.actedThisStreet = false;
        }
      }
    }

    events.push({
      type: 'player_action',
      payload: {
        seatIndex: seat.seatIndex,
        userId,
        fullName: seat.fullName,
        action: 'all_in',
        amount: added,
        streetBet: seat.streetBet,
      },
    });
    advanceAfterAction(state, seat.seatIndex, events, nowMs);
    return events;
  }

  throw new Error(`Aksi tidak dikenal: ${action}`);
};

/**
 * Penanganan timer giliran habis: auto-check jika boleh, selain itu auto-fold.
 * Pemain yang berkali-kali timeout beruntun ditandai "away".
 */
export const handleTurnTimeout = (state, nowMs = Date.now()) => {
  if (!BETTING_PHASES.includes(state.phase) || state.currentTurnSeat === null) {
    return [];
  }
  const seat = getSeat(state, state.currentTurnSeat);
  if (!seat) return [];

  seat.consecutiveTimeouts += 1;
  if (seat.consecutiveTimeouts >= 2) {
    seat.isAway = true;
  }

  const valid = getValidActions(state, seat.seatIndex);
  const autoAction = valid?.canCheck ? 'check' : 'fold';

  return applyAction(state, {
    userId: seat.userId,
    action: autoAction,
    turnToken: state.turnToken,
    isTimeoutAuto: true,
    nowMs,
  });
};

const reassignHostToOldest = (state) => {
  if (state.seats.length === 0) {
    state.hostUserId = null;
    return null;
  }
  const oldest = [...state.seats].sort((a, b) => a.joinOrder - b.joinOrder)[0];
  state.hostUserId = oldest.userId;
  return oldest;
};

/**
 * Menghapus pemain dari room atau memaksa fold di tengah tangan dengan menjaga kontribusi potnya tetap utuh.
 */
export const handlePlayerLeaveOrForfeit = (
  state,
  userId,
  { nowMs = Date.now() } = {}
) => {
  const seat = state.seats.find((s) => s.userId === userId);
  if (!seat) return [];

  const events = [];
  const inBettingPhase = BETTING_PHASES.includes(state.phase);

  if (inBettingPhase && seat.inHand && seat.totalHandBet > 0) {
    state.forfeitedContributions.push({
      seatIndex: seat.seatIndex,
      userId: seat.userId,
      amount: seat.totalHandBet,
      folded: true,
    });
    seat.totalHandBet = 0;
  }

  if (inBettingPhase && seat.inHand && !seat.folded) {
    seat.folded = true;
    seat.actedThisStreet = true;
    events.push({
      type: 'player_left_fold',
      payload: { seatIndex: seat.seatIndex, userId, fullName: seat.fullName },
    });

    if (state.currentTurnSeat === seat.seatIndex) {
      advanceAfterAction(state, seat.seatIndex, events, nowMs);
    } else {
      const surviving = getActiveHandSeats(state);
      if (surviving.length === 1) {
        finishHandToEarlyWinner(state, surviving[0], events, nowMs);
      } else if (isStreetBettingComplete(state)) {
        advanceAfterAction(state, seat.seatIndex, events, nowMs);
      }
    }
  }

  // Hapus kursi saat lobby, antar_tangan, atau selesai; di tengah tangan tetap lepas kursi setelah fold jika sisa pemain masih ada
  state.seats = state.seats.filter((s) => s.userId !== userId);

  if (state.hostUserId === userId) {
    const newHost = reassignHostToOldest(state);
    if (newHost) {
      events.push({
        type: 'host_migrated',
        payload: { newHostUserId: newHost.userId, fullName: newHost.fullName },
      });
    }
  }

  if (
    state.phase !== POKER_PHASES.LOBBY &&
    state.phase !== POKER_PHASES.SELESAI &&
    state.seats.filter((s) => !s.eliminated && s.chips > 0).length <= 1
  ) {
    const lastStanding = state.seats.find((s) => !s.eliminated && s.chips > 0) || null;
    if (BETTING_PHASES.includes(state.phase) || state.phase === POKER_PHASES.ANTAR_TANGAN) {
      state.phase = POKER_PHASES.SELESAI;
      state.endedAt = nowMs;
      state.winnerUserId = lastStanding?.userId || null;
      state.currentTurnSeat = null;
      state.turnToken = null;
      state.turnDeadlineAt = null;
      events.push({
        type: 'game_finished',
        payload: {
          winnerUserId: state.winnerUserId,
          winnerName: lastStanding?.fullName || null,
          totalHands: state.handNumber,
        },
      });
    }
  }

  bumpVersion(state);
  return events;
};

export const forceEndRoom = (state, reason = 'Room ditutup oleh penyelenggara.', nowMs = Date.now()) => {
  if (state.phase === POKER_PHASES.SELESAI) return [];
  state.phase = POKER_PHASES.SELESAI;
  state.endedAt = nowMs;
  state.currentTurnSeat = null;
  state.turnToken = null;
  state.turnDeadlineAt = null;
  const topSeat = [...state.seats].sort((a, b) => b.chips - a.chips)[0];
  state.winnerUserId = topSeat?.userId || null;
  bumpVersion(state);
  return [{ type: 'room_closed', payload: { reason } }];
};

/**
 * Menyaring state meja KHUSUS untuk satu viewer tertentu.
 * KRITIS: hole cards pemain lain SELALU null sebelum showdown. Deck & burn cards tidak pernah disertakan.
 */
export const projectStateForViewer = (state, viewerUserId, nowMs = Date.now()) => {
  const viewerSeat = state.seats.find((s) => s.userId === viewerUserId) || null;
  const contributions = getHandContributions(state);
  const totalPot = contributions.reduce((sum, c) => sum + c.amount, 0);
  const sidePots = calculateSidePots(contributions);

  const canRevealOtherCards =
    state.showdownRevealed &&
    (state.phase === POKER_PHASES.SHOWDOWN ||
      state.phase === POKER_PHASES.ANTAR_TANGAN ||
      state.phase === POKER_PHASES.SELESAI);

  const projectedSeats = state.seats.map((s) => {
    const isSelf = s.userId === viewerUserId;
    const canSeeCards =
      (isSelf && s.holeCards.length > 0) ||
      (canRevealOtherCards && s.inHand && !s.folded && s.holeCards.length > 0);

    return {
      seatIndex: s.seatIndex,
      userId: s.userId,
      fullName: s.fullName,
      avatarUrl: s.avatarUrl,
      role: s.role,
      chips: s.chips,
      ready: s.ready,
      eliminated: s.eliminated,
      inHand: s.inHand,
      folded: s.folded,
      allIn: s.allIn,
      streetBet: s.streetBet,
      totalHandBet: s.totalHandBet,
      isAway: s.isAway,
      connected: s.connected,
      hasCards: s.inHand && !s.folded && s.holeCards.length > 0,
      holeCards: canSeeCards ? s.holeCards : null,
    };
  });

  const validActions =
    viewerSeat && state.currentTurnSeat === viewerSeat.seatIndex
      ? getValidActions(state, viewerSeat.seatIndex)
      : null;

  return {
    roomId: state.roomId,
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
      dealerSeat: state.dealerSeat,
      sbSeat: state.sbSeat,
      bbSeat: state.bbSeat,
      currentTurnSeat: state.currentTurnSeat,
      turnToken: viewerSeat && state.currentTurnSeat === viewerSeat.seatIndex ? state.turnToken : null,
      turnDeadlineAt: state.turnDeadlineAt,
      communityCards: state.communityCards,
      burnCount: state.burnCards.length,
      currentBet: state.currentBet,
      minRaiseDelta: state.minRaiseDelta,
      totalPot,
      sidePots,
      lastHandResult: state.lastHandResult,
      seats: projectedSeats,
    },
    viewerSeat: viewerSeat ? viewerSeat.seatIndex : null,
    myHoleCards: viewerSeat && viewerSeat.holeCards.length > 0 ? viewerSeat.holeCards : null,
    validActions,
  };
};

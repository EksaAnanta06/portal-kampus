// FILE: server/scripts/test-poker-feature.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  cardFromCode,
  createOrderedDeck,
  createShuffledDeck,
  generateRoomId,
} from '../src/poker/deck.js';
import {
  evaluateFiveCards,
  evaluateSevenCards,
  compareEvaluatedHands,
} from '../src/poker/handEvaluator.js';
import { calculateSidePots, distributePots } from '../src/poker/potCalculator.js';
import {
  POKER_PHASES,
  createTableState,
  addSeatToLobby,
  setPlayerReady,
  startNextHand,
  applyAction,
  handleTurnTimeout,
  handlePlayerLeaveOrForfeit,
  projectStateForViewer,
} from '../src/poker/stateMachine.js';
import { PokerRoomManager } from '../src/poker/roomManager.js';
import { attachPokerSocketServer } from '../src/poker/pokerSocketServer.js';
import { createNodeWsClient } from '../src/poker/wsFrameCodec.js';

const cards = (...codes) => codes.map((c) => cardFromCode(c));

// RNG LCG deterministik sederhana untuk test reproducible
const makeSeededRng = (seed = 1234567) => {
  let state = seed >>> 0;
  return (max) => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state % max;
  };
};

// ----------------------------------------------------------------------------
// PASS 1: Deck & Hand Evaluator (9 kategori, Wheel A-2-3-4-5, kicker, tie)
// ----------------------------------------------------------------------------
{
  const deckA = createShuffledDeck(makeSeededRng(42));
  const deckB = createShuffledDeck(makeSeededRng(42));
  assert.equal(deckA.length, 52);
  assert.equal(new Set(deckA.map((c) => c.code)).size, 52);
  assert.deepEqual(deckA.map((c) => c.code), deckB.map((c) => c.code));

  const rid = generateRoomId(makeSeededRng(99), 6);
  assert.equal(rid.length, 6);
  assert.equal(/[0O1IL]/.test(rid), false, 'Room ID tidak boleh memuat 0/O/1/I/L');

  const ordered = createOrderedDeck();
  assert.equal(ordered.length, 52);

  const royalFlush = evaluateSevenCards(cards('AS', 'KS', 'QS', 'JS', '10S', '2D', '3C'));
  const straightFlush = evaluateSevenCards(cards('9H', '8H', '7H', '6H', '5H', 'AS', 'KC'));
  const fourKind = evaluateSevenCards(cards('KC', 'KD', 'KH', 'KS', '2C', 'AS', '3D'));
  const fullHouse = evaluateSevenCards(cards('QC', 'QD', 'QH', 'JC', 'JD', '2S', '5C'));
  const flush = evaluateSevenCards(cards('AD', 'JD', '9D', '4D', '2D', 'KS', 'QC'));
  const sixHighStraight = evaluateSevenCards(cards('6C', '5D', '4H', '3S', '2C', 'AS', 'KH'));
  const wheelStraight = evaluateSevenCards(cards('AS', '5D', '4H', '3S', '2C', 'KD', 'QC'));
  const trips = evaluateSevenCards(cards('10C', '10D', '10H', 'AS', '8C', '4D', '2S'));
  const twoPairHighKicker = evaluateSevenCards(cards('KS', 'KH', 'QD', 'QC', 'AS', '3D', '2C'));
  const twoPairLowKicker = evaluateSevenCards(cards('KD', 'KC', 'QS', 'QH', 'JD', '3S', '2H'));
  const onePairHighKicker = evaluateSevenCards(cards('AS', 'AD', 'KC', 'QH', '10S', '3D', '2C'));
  const onePairLowKicker = evaluateSevenCards(cards('AH', 'AC', 'KD', 'QS', '9D', '3S', '2H'));
  const highCardA = evaluateFiveCards(cards('AS', 'JD', '9C', '5H', '2D'));
  const highCardB = evaluateFiveCards(cards('AS', 'JD', '8C', '5H', '2D'));

  assert.equal(royalFlush.categoryName, 'Royal Flush');
  assert.equal(wheelStraight.categoryRank, 5);
  assert.equal(wheelStraight.tiebreakers[0], 5);
  assert.equal(compareEvaluatedHands(royalFlush, straightFlush), 1);
  assert.equal(compareEvaluatedHands(straightFlush, fourKind), 1);
  assert.equal(compareEvaluatedHands(fourKind, fullHouse), 1);
  assert.equal(compareEvaluatedHands(fullHouse, flush), 1);
  assert.equal(compareEvaluatedHands(flush, sixHighStraight), 1);
  assert.equal(compareEvaluatedHands(sixHighStraight, wheelStraight), 1);
  assert.equal(compareEvaluatedHands(wheelStraight, trips), 1);
  assert.equal(compareEvaluatedHands(trips, twoPairHighKicker), 1);
  assert.equal(compareEvaluatedHands(twoPairHighKicker, twoPairLowKicker), 1);
  assert.equal(compareEvaluatedHands(twoPairLowKicker, onePairHighKicker), 1);
  assert.equal(compareEvaluatedHands(onePairHighKicker, onePairLowKicker), 1);
  assert.equal(compareEvaluatedHands(onePairLowKicker, highCardA), 1);
  assert.equal(compareEvaluatedHands(highCardA, highCardB), 1);

  // Split pot identik (board plays / flush board sama)
  const board = cards('AS', 'KS', 'QS', 'JS', '2S');
  const tieHandA = evaluateSevenCards([...board, ...cards('3D', '4C')]);
  const tieHandB = evaluateSevenCards([...board, ...cards('5H', '6D')]);
  assert.equal(compareEvaluatedHands(tieHandA, tieHandB), 0);

  console.log('PASS 1: Deck determinism, room ID alphabet & complete 7-card evaluator (categories/wheel/kickers/ties)');
}

// ----------------------------------------------------------------------------
// PASS 2: Side Pot Multi All-In (2 & 3 pemain) + Folded Dead Money + Odd Chip
// ----------------------------------------------------------------------------
{
  const contributions = [
    { seatIndex: 0, userId: 10, amount: 50, folded: true }, // dead money
    { seatIndex: 1, userId: 11, amount: 100, folded: false }, // short all-in
    { seatIndex: 2, userId: 12, amount: 300, folded: false }, // mid all-in
    { seatIndex: 3, userId: 13, amount: 500, folded: false }, // big stack / uncalled slice
  ];
  const pots = calculateSidePots(contributions);
  // 0..50 + 50..100 -> eligible [1,2,3] -> 4*50 + 3*50 = 350
  // 100..300 -> eligible [2,3] -> 2*200 = 400
  // 300..500 -> eligible [3] -> 1*200 = 200
  assert.equal(pots.length, 3);
  assert.equal(pots[0].amount, 350);
  assert.deepEqual(pots[0].eligibleSeats, [1, 2, 3]);
  assert.equal(pots[1].amount, 400);
  assert.deepEqual(pots[1].eligibleSeats, [2, 3]);
  assert.equal(pots[2].amount, 200);
  assert.deepEqual(pots[2].eligibleSeats, [3]);

  const evaluatedBySeat = new Map([
    [1, evaluateFiveCards(cards('AS', 'AH', 'AD', 'AC', '2S'))], // menang main pot
    [2, evaluateFiveCards(cards('KS', 'KH', 'KD', 'QS', 'QH'))], // menang side pot 1 vs seat 3
    [3, evaluateFiveCards(cards('JS', 'JH', '4D', '5C', '6S'))], // dapat uncalled slice 200
  ]);

  const { payoutsBySeat } = distributePots({
    pots,
    evaluatedBySeat,
    dealerSeat: 0,
    maxSeats: 4,
  });
  assert.equal(payoutsBySeat.get(1), 350);
  assert.equal(payoutsBySeat.get(2), 400);
  assert.equal(payoutsBySeat.get(3), 200);

  // Uji odd chip split pot (pot = 101, seri antara seat 1 & seat 3, dealer = 0 -> seat 1 dapat 51)
  const splitRes = distributePots({
    pots: [{ potIndex: 0, amount: 101, eligibleSeats: [1, 3] }],
    evaluatedBySeat: new Map([
      [1, evaluateFiveCards(cards('AS', 'KS', 'QS', 'JS', '10S'))],
      [3, evaluateFiveCards(cards('AH', 'KH', 'QH', 'JH', '10H'))],
    ]),
    dealerSeat: 0,
    maxSeats: 4,
  });
  assert.equal(splitRes.payoutsBySeat.get(1), 51);
  assert.equal(splitRes.payoutsBySeat.get(3), 50);

  console.log('PASS 2: Multi all-in side pots, folded dead money & clockwise odd-chip split pot');
}

// ----------------------------------------------------------------------------
// PASS 3: State Machine (Heads-Up, Dealer Rotation, Min Raise, Burn Cards, Game End)
// ----------------------------------------------------------------------------
{
  const state = createTableState({
    roomId: 'ABC234',
    hostUser: { id: 1, full_name: 'Host Satu' },
    startingChips: 1000,
    blindLevel: '10/20',
    turnTimeoutSec: 30,
  });
  addSeatToLobby(state, { id: 2, full_name: 'Lawan Dua' });
  setPlayerReady(state, 2, true);

  startNextHand(state, { randomInt: makeSeededRng(777) });
  assert.equal(state.phase, POKER_PHASES.PREFLOP);
  assert.equal(state.dealerSeat, 0);
  // Heads-Up: dealer (seat 0) adalah SB dan bertindak pertama pada preflop
  assert.equal(state.sbSeat, 0);
  assert.equal(state.bbSeat, 1);
  assert.equal(state.currentTurnSeat, 0);

  // Raise di bawah minimum (currentBet=20, minRaiseTo=40 -> 30 harus ditolak)
  assert.throws(
    () =>
      applyAction(state, {
        userId: 1,
        action: 'raise',
        amount: 30,
        turnToken: state.turnToken,
      }),
    /minimal ke 40/
  );

  // Seat 0 raise sah ke 60 (minRaiseDelta berikutnya naik ke 40 -> min reraise jadi 100)
  applyAction(state, {
    userId: 1,
    action: 'raise',
    amount: 60,
    turnToken: state.turnToken,
  });
  assert.equal(state.currentTurnSeat, 1);
  assert.throws(
    () =>
      applyAction(state, {
        userId: 2,
        action: 'raise',
        amount: 80,
        turnToken: state.turnToken,
      }),
    /minimal ke 100/
  );

  // Seat 1 call -> lanjut ke FLOP (burn 1 + community 3), post-flop pertama bertindak: BB (seat 1)
  applyAction(state, {
    userId: 2,
    action: 'call',
    turnToken: state.turnToken,
  });
  assert.equal(state.phase, POKER_PHASES.FLOP);
  assert.equal(state.communityCards.length, 3);
  assert.equal(state.burnCards.length, 1);
  assert.equal(state.currentTurnSeat, 1, 'Post-flop heads-up harus BB bertindak dulu');

  // Check-check di Flop -> Turn (burn 2, community 4)
  applyAction(state, { userId: 2, action: 'check', turnToken: state.turnToken });
  applyAction(state, { userId: 1, action: 'check', turnToken: state.turnToken });
  assert.equal(state.phase, POKER_PHASES.TURN);
  assert.equal(state.communityCards.length, 4);
  assert.equal(state.burnCards.length, 2);

  // Check-check di Turn -> River (burn 3, community 5)
  applyAction(state, { userId: 2, action: 'check', turnToken: state.turnToken });
  applyAction(state, { userId: 1, action: 'check', turnToken: state.turnToken });
  assert.equal(state.phase, POKER_PHASES.RIVER);
  assert.equal(state.communityCards.length, 5);
  assert.equal(state.burnCards.length, 3);

  // Check-check di River -> Showdown -> ANTAR_TANGAN (konservasi chip 2000)
  applyAction(state, { userId: 2, action: 'check', turnToken: state.turnToken });
  applyAction(state, { userId: 1, action: 'check', turnToken: state.turnToken });
  assert.equal(state.phase, POKER_PHASES.ANTAR_TANGAN);
  const totalChipsAfterHand1 = state.seats.reduce((sum, s) => sum + s.chips, 0);
  assert.equal(totalChipsAfterHand1, 2000);

  // Hand 2: dealer berpindah ke seat 1
  startNextHand(state, { randomInt: makeSeededRng(888) });
  assert.equal(state.dealerSeat, 1);
  assert.equal(state.sbSeat, 1);
  assert.equal(state.bbSeat, 0);
  assert.equal(state.currentTurnSeat, 1);

  console.log('PASS 3: Minimum raise, burn cards, heads-up SB=Dealer rule, dealer rotation & chip conservation');
}

// ----------------------------------------------------------------------------
// PASS 4: Timeout Auto-Check / Auto-Fold / Away Status & Mid-Hand Leave + Pot Intact
// ----------------------------------------------------------------------------
{
  const state = createTableState({
    roomId: 'XYZ789',
    hostUser: { id: 101, full_name: 'Pemain A' },
    startingChips: 1000,
    blindLevel: '10/20',
  });
  addSeatToLobby(state, { id: 102, full_name: 'Pemain B' });
  addSeatToLobby(state, { id: 103, full_name: 'Pemain C' });
  setPlayerReady(state, 102, true);
  setPlayerReady(state, 103, true);
  startNextHand(state, { randomInt: makeSeededRng(321) });

  // Seat 0 dealer, Seat 1 SB, Seat 2 BB -> UTG adalah Seat 0 (facing bet 20 -> timeout auto-fold)
  assert.equal(state.currentTurnSeat, 0);
  handleTurnTimeout(state);
  const seat0 = state.seats.find((s) => s.seatIndex === 0);
  assert.equal(seat0.folded, true);
  assert.equal(seat0.consecutiveTimeouts, 1);
  assert.equal(seat0.isAway, false);

  // Sekarang Seat 1 (SB) call 10 agar jadi 20, lalu Seat 2 (BB) facing 0 -> timeout auto-check!
  assert.equal(state.currentTurnSeat, 1);
  applyAction(state, { userId: 102, action: 'call', turnToken: state.turnToken });
  assert.equal(state.currentTurnSeat, 2);
  handleTurnTimeout(state); // check otomatis -> masuk flop
  const seat2 = state.seats.find((s) => s.seatIndex === 2);
  assert.equal(seat2.consecutiveTimeouts, 1);
  assert.equal(state.phase, POKER_PHASES.FLOP);

  // Seat 1 keluar di tengah FLOP (masih membawa kontribusi 20 di pot), Seat 2 harus otomatis menang 40!
  handlePlayerLeaveOrForfeit(state, 102);
  assert.equal(state.phase, POKER_PHASES.ANTAR_TANGAN);
  assert.equal(seat2.chips, 1020); // 1000 awal - 20 bet + 40 pot = 1020

  // Simulasi timeout beruntun ke-2 pada seat2 di hand berikutnya -> marked AWAY
  startNextHand(state, { randomInt: makeSeededRng(654) });
  // Heads up antara seat0 & seat2 -> dealer rotasi ke seat 2 (currentTurnSeat)
  assert.equal(state.currentTurnSeat, 2);
  handleTurnTimeout(state);
  assert.equal(seat2.consecutiveTimeouts, 2);
  assert.equal(seat2.isAway, true);

  console.log('PASS 4: Timeout auto-check/fold, away marking after repeated timeouts & mid-hand forfeit pot retention');
}

// ----------------------------------------------------------------------------
// PASS 5: Privacy Filtering — Hole cards lawan & deck tidak pernah bocor sebelum showdown
// ----------------------------------------------------------------------------
{
  const state = createTableState({
    roomId: 'SEC999',
    hostUser: { id: 201, full_name: 'Alpha' },
    startingChips: 1000,
    blindLevel: '10/20',
  });
  addSeatToLobby(state, { id: 202, full_name: 'Beta' });
  setPlayerReady(state, 202, true);
  startNextHand(state, { randomInt: makeSeededRng(555) });

  const viewA = projectStateForViewer(state, 201);
  const viewB = projectStateForViewer(state, 202);
  const rawStrA = JSON.stringify(viewA);
  const rawStrB = JSON.stringify(viewB);

  const betaCardsCodes = state.seats.find((s) => s.userId === 202).holeCards.map((c) => c.code);
  const alphaCardsCodes = state.seats.find((s) => s.userId === 201).holeCards.map((c) => c.code);

  assert.equal(viewA.seats ? false : true, true);
  assert.equal(viewA.table.seats.find((s) => s.userId === 201).holeCards.length, 2);
  assert.equal(viewA.table.seats.find((s) => s.userId === 202).holeCards, null);
  assert.equal(viewB.table.seats.find((s) => s.userId === 201).holeCards, null);
  assert.equal(viewB.table.seats.find((s) => s.userId === 202).holeCards.length, 2);
  assert.equal(viewA.deck, undefined);
  assert.equal(viewA.burnCards, undefined);
  assert.equal(
    rawStrA.includes(betaCardsCodes[0]) && rawStrA.includes(betaCardsCodes[1]),
    false,
    'Hole cards Beta tidak boleh ada di payload Alpha sebelum showdown'
  );
  assert.equal(
    rawStrB.includes(alphaCardsCodes[0]) && rawStrB.includes(alphaCardsCodes[1]),
    false,
    'Hole cards Alpha tidak boleh ada di payload Beta sebelum showdown'
  );

  console.log('PASS 5: Strict hole-card & deck filtering verified for all players');
}

// ----------------------------------------------------------------------------
// PASS 6: Multi-Client Real WebSocket Integration (Auth, Anti-Multi-Tab, Kick,
// Reconnect, Turn Action & Feature Flag Kill-Switch)
// ----------------------------------------------------------------------------
{
  const usersById = new Map([
    [1, { id: 1, full_name: 'Budi Host', role: 'mahasiswa', status: 'active', avatar_url: null }],
    [2, { id: 2, full_name: 'Sari Player', role: 'mahasiswa', status: 'active', avatar_url: null }],
    [3, { id: 3, full_name: 'Andi Player', role: 'alumni', status: 'active', avatar_url: null }],
    [4, { id: 4, full_name: 'Pending User', role: 'mahasiswa', status: 'pending', avatar_url: null }],
  ]);

  const verifyFakeToken = (tok) => {
    if (!tok.startsWith('valid-user-')) throw new Error('Invalid token');
    return { id: Number(tok.replace('valid-user-', '')) };
  };

  const roomManager = new PokerRoomManager({
    randomInt: makeSeededRng(2026),
    envEnabled: true,
    reconnectGraceMs: 2000,
    betweenHandsDelayMs: 5000,
    saveHistoryFn: async () => {},
  });

  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end('ok');
  });

  const wsServer = attachPokerSocketServer({
    httpServer: server,
    roomManager,
    verifyTokenFn: verifyFakeToken,
    loadUserFn: async (id) => usersById.get(id) || null,
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const wsUrl = (tok) => `ws://127.0.0.1:${port}/socket.io?token=${encodeURIComponent(tok)}`;

  // 1) Tolak tanpa token / akun pending
  await assert.rejects(
    () => createNodeWsClient(wsUrl('invalid-token')),
    (err) => err.statusCode === 401
  );
  await assert.rejects(
    () => createNodeWsClient(wsUrl('valid-user-4')),
    (err) => err.statusCode === 403
  );

  // 2) Hubungkan 3 pemain aktif secara bersamaan
  const c1 = await createNodeWsClient(wsUrl('valid-user-1'));
  const c2 = await createNodeWsClient(wsUrl('valid-user-2'));
  const c3 = await createNodeWsClient(wsUrl('valid-user-3'));

  // 3) Anti multi-tab: koneksi tab-2 untuk user 1 menggantikan tab-1
  const replacedPromise = c1.waitForEvent('session:replaced');
  const c1Tab2 = await createNodeWsClient(wsUrl('valid-user-1'));
  const replacedPayload = await replacedPromise;
  assert.ok(replacedPayload.message.includes('tab'), 'Harus menerima notifikasi session:replaced');

  // 4) Buat room, gabung huruf kecil, kick & gabung lagi
  const createAck = await c1Tab2.emit('room:create', {
    startingChips: 1000,
    blindLevel: '10/20',
    turnTimeoutSec: 30,
  });
  assert.equal(createAck.success, true);
  const roomId = createAck.data.roomId;

  const join2Ack = await c2.emit('room:join', { roomId: roomId.toLowerCase() });
  assert.equal(join2Ack.success, true);
  assert.equal(join2Ack.data.roomId, roomId);

  const join3Ack = await c3.emit('room:join', { roomId });
  assert.equal(join3Ack.success, true);

  const kickedWait = c3.waitForEvent('room:kicked');
  const kickAck = await c1Tab2.emit('room:kick', { roomId, targetUserId: 3 });
  assert.equal(kickAck.success, true);
  await kickedWait;

  // Gabung kembali & set ready semua
  await c3.emit('room:join', { roomId });
  await c2.emit('room:ready', { roomId, ready: true });
  await c3.emit('room:ready', { roomId, ready: true });

  // 5) Mulai permainan & verifikasi penyaringan kartu lewat state WebSocket langsung
  const c2StateWait = c2.waitForEvent('game:state', (s) => s.room.phase === POKER_PHASES.PREFLOP);
  const startAck = await c1Tab2.emit('room:start', { roomId });
  assert.equal(startAck.success, true);
  const c2PreflopState = await c2StateWait;

  assert.equal(c2PreflopState.myHoleCards.length, 2);
  assert.equal(c2PreflopState.table.seats.find((s) => s.userId === 1).holeCards, null);
  assert.equal(c2PreflopState.table.seats.find((s) => s.userId === 3).holeCards, null);

  // Emote reaction broadcast
  const emoteWait = c3.waitForEvent('reaction:broadcast', (r) => r.emote === '👍');
  const reactAck = await c2.emit('reaction:send', { roomId, emote: '👍' });
  assert.equal(reactAck.success, true);
  await emoteWait;

  // 6) Reconnect test: c2 putus sementara lalu masuk kembali dengan token sama sebelum grace habis
  c2.close();
  await new Promise((r) => setTimeout(r, 120));
  const c2Reconnected = await createNodeWsClient(wsUrl('valid-user-2'));
  const syncAck = await c2Reconnected.emit('game:sync', { roomId });
  assert.equal(syncAck.success, true);
  assert.equal(syncAck.data.myHoleCards.length, 2);

  // 7) Feature flag dimatikan runtime -> tutup room aktif & tolak koneksi baru (503)
  const roomClosedWait = c1Tab2.waitForEvent('game:event', (ev) => ev.type === 'room_closed');
  roomManager.setRuntimeFeatureEnabled(false, 'TestAdmin');
  await roomClosedWait;

  await assert.rejects(
    () => createNodeWsClient(wsUrl('valid-user-1')),
    (err) => err.statusCode === 503
  );

  c1Tab2.close();
  c2Reconnected.close();
  c3.close();
  wsServer.shutdown();
  await new Promise((resolve) => server.close(resolve));

  console.log('PASS 6: Multi-client RFC 6455 WebSocket integration, anti-multi-tab, kick, reconnect & feature flag');
}

console.log('\nALL TEXAS HOLDEM POKER TESTS PASSED!');

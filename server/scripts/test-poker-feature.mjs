// FILE: server/scripts/test-poker-feature.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  cardFromCode,
  createOrderedDeck,
  createShuffledDeck,
  generateRoomId,
  getCardPower,
  compareSingleCards,
  sortCapsaCards,
} from '../src/poker/deck.js';
import {
  classifyCapsaPlay,
  canBeatPlay,
  findValidMoves,
  chooseBotMove,
} from '../src/poker/handEvaluator.js';
import {
  computeCapsaCardMultiplier,
  calculateCapsaRoundSettlement,
} from '../src/poker/potCalculator.js';
import {
  POKER_PHASES,
  createTableState,
  addSeatToLobby,
  setPlayerReady,
  startNextHand,
  applyAction,
  handleTurnTimeout,
  projectStateForViewer,
} from '../src/poker/stateMachine.js';
import { PokerRoomManager } from '../src/poker/roomManager.js';
import { attachPokerSocketServer } from '../src/poker/pokerSocketServer.js';
import { createNodeWsClient } from '../src/poker/wsFrameCodec.js';

const cards = (...codes) => codes.map((c) => cardFromCode(c));

const makeSeededRng = (seed = 1234567) => {
  let state = seed >>> 0;
  return (max) => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state % max;
  };
};

// ----------------------------------------------------------------------------
// PASS 1: Hirarki Kartu & Kembang Capsa Banting (3♦=0 s/d 2♠=51) + 4x13=52
// ----------------------------------------------------------------------------
{
  const deckA = createShuffledDeck(makeSeededRng(42));
  const deckB = createShuffledDeck(makeSeededRng(42));
  assert.equal(deckA.length, 52);
  assert.equal(new Set(deckA.map((c) => c.code)).size, 52);
  assert.deepEqual(deckA.map((c) => c.code), deckB.map((c) => c.code));

  const rid = generateRoomId(makeSeededRng(99), 6);
  assert.equal(rid.length, 6);
  assert.equal(/[0O1IL]/.test(rid), false, 'Room ID tidak boleh mengandung 0/O/1/I/L');

  const ordered = createOrderedDeck();
  assert.equal(ordered.length, 52);

  // Urutan angka & kembang Capsa Banting: 3 < ... < A < 2 dan ♦ < ♣ < ♥ < ♠
  assert.equal(getCardPower(cardFromCode('3D')), 0);
  assert.equal(getCardPower(cardFromCode('3S')), 3);
  assert.equal(getCardPower(cardFromCode('AS')), 47);
  assert.equal(getCardPower(cardFromCode('2D')), 48);
  assert.equal(getCardPower(cardFromCode('2S')), 51);
  assert.equal(compareSingleCards(cardFromCode('2D'), cardFromCode('AS')), 1);
  assert.equal(compareSingleCards(cardFromCode('3S'), cardFromCode('3H')), 1);

  const sorted = sortCapsaCards(cards('2S', '3D', 'AS', 'KC', '3S'), 'rank');
  assert.deepEqual(sorted.map((c) => c.code), ['3D', '3S', 'KC', 'AS', '2S']);

  console.log('PASS 1: Capsa Banting hierarchy (3D lowest, 2S highest, D<C<H<S) & deterministic 52-card deck');
}

// ----------------------------------------------------------------------------
// PASS 2: Kombinasi Capsa (Single, Pair, Tris, 5-Kartu & Aturan Bom)
// ----------------------------------------------------------------------------
{
  const single2D = classifyCapsaPlay(cards('2D'));
  const singleAS = classifyCapsaPlay(cards('AS'));
  const pair3 = classifyCapsaPlay(cards('3D', '3S'));
  const pairK = classifyCapsaPlay(cards('KH', 'KC'));
  const tris5 = classifyCapsaPlay(cards('5D', '5C', '5H'));

  const straight = classifyCapsaPlay(cards('3D', '4C', '5H', '6S', '7D'));
  const flush = classifyCapsaPlay(cards('3D', '5D', '8D', 'JD', 'KD'));
  const fullHouse = classifyCapsaPlay(cards('7D', '7C', '7H', '9S', '9D'));
  const bombFourKind = classifyCapsaPlay(cards('4D', '4C', '4H', '4S', '9D'));
  const straightFlush = classifyCapsaPlay(cards('5H', '6H', '7H', '8H', '9H'));

  assert.equal(single2D.type, 'single');
  assert.equal(pair3.type, 'pair');
  assert.equal(tris5.type, 'tris');
  assert.equal(straight.comboCategory, 1);
  assert.equal(flush.comboCategory, 2);
  assert.equal(fullHouse.comboCategory, 3);
  assert.equal(bombFourKind.comboCategory, 4);
  assert.equal(bombFourKind.isBomb, true);
  assert.equal(straightFlush.comboCategory, 5);
  assert.equal(straightFlush.isBomb, true);

  assert.equal(canBeatPlay(cards('2D'), { cards: cards('AS'), classified: singleAS }), true);
  assert.equal(canBeatPlay(cards('KH', 'KC'), { cards: cards('3D', '3S'), classified: pair3 }), true);
  assert.equal(canBeatPlay(cards('3D', '5D', '8D', 'JD', 'KD'), { cards: cards('3D', '4C', '5H', '6S', '7D'), classified: straight }), true);
  assert.equal(canBeatPlay(cards('7D', '7C', '7H', '9S', '9D'), { cards: cards('3D', '5D', '8D', 'JD', 'KD'), classified: flush }), true);
  assert.equal(canBeatPlay(cards('4D', '4C', '4H', '4S', '9D'), { cards: cards('7D', '7C', '7H', '9S', '9D'), classified: fullHouse }), true);
  assert.equal(canBeatPlay(cards('5H', '6H', '7H', '8H', '9H'), { cards: cards('4D', '4C', '4H', '4S', '9D'), classified: bombFourKind }), true);

  // Bom dapat memotong Single 2, dan Straight Flush dapat memotong Pair 2
  assert.equal(canBeatPlay(cards('4D', '4C', '4H', '4S', '9D'), { cards: cards('2S'), classified: classifyCapsaPlay(cards('2S')) }), true);
  assert.equal(canBeatPlay(cards('5H', '6H', '7H', '8H', '9H'), { cards: cards('2D', '2C'), classified: classifyCapsaPlay(cards('2D', '2C')) }), true);
  assert.equal(canBeatPlay(cards('4D', '4C', '4H', '4S', '9D'), { cards: cards('2D', '2C'), classified: classifyCapsaPlay(cards('2D', '2C')) }), false);

  // Kombinasi tidak sah harus ditolak (misal 2 kartu beda angka, atau 4 kartu langsung)
  assert.equal(classifyCapsaPlay(cards('3D', '4D')), null);
  assert.equal(classifyCapsaPlay(cards('4D', '4C', '4H', '4S')), null);

  // Cari saran & bot move wajib menyertakan 3♦ saat pembukaan
  const handSample = cards('3D', '4C', '4H', '5S', '7D', '8C', '9H', '10S', 'JD', 'QC', 'KH', 'AS', '2D');
  const openMoves = findValidMoves(handSample, null, { mustIncludeThreeDiamond: true });
  assert.ok(openMoves.length > 0);
  assert.ok(openMoves.every((m) => m.cards.some((c) => c.code === '3D')));
  const botPick = chooseBotMove(handSample, null, { mustIncludeThreeDiamond: true });
  assert.ok(botPick.cards.some((c) => c.code === '3D'));

  console.log('PASS 2: Capsa Banting combinations, bomb cuts over 2, invalid hand rejection & 3D opening hints');
}

// ----------------------------------------------------------------------------
// PASS 3: State Machine Capsa Banting (3♦ Pembuka, Siklus 3 Pass Meja Bersih)
// ----------------------------------------------------------------------------
{
  const state = createTableState({
    roomId: 'BIG201',
    hostUser: { id: 1, full_name: 'Pemain Satu' },
    startingChips: 1000,
    blindLevel: '10/20',
  });
  addSeatToLobby(state, { id: 2, full_name: 'Pemain Dua' });
  setPlayerReady(state, 2, true);

  startNextHand(state, { randomInt: makeSeededRng(777), fillBots: true });
  assert.equal(state.phase, POKER_PHASES.BERMAIN);
  assert.equal(state.seats.length, 4, 'Meja Capsa Banting harus berjumlah 4 kursi × 13 kartu');
  assert.ok(state.seats.every((s) => s.holeCards.length === 13));

  const starterSeat = state.seats.find((s) => s.seatIndex === state.currentTurnSeat);
  assert.ok(
    starterSeat.holeCards.some((c) => c.code === '3D'),
    'Pembuka ronde 1 wajib pemegang 3♦'
  );
  assert.equal(state.mustIncludeThreeDiamond, true);

  // Tidak boleh Lewat saat meja kosong
  assert.throws(
    () =>
      applyAction(state, {
        userId: starterSeat.userId,
        action: 'pass',
        turnToken: state.turnToken,
      }),
    /tidak bisa Lewat/
  );

  // Tidak boleh turun kartu pembuka tanpa 3♦
  const non3D = starterSeat.holeCards.find((c) => c.code !== '3D');
  assert.throws(
    () =>
      applyAction(state, {
        userId: starterSeat.userId,
        action: 'play',
        cards: [non3D.code],
        turnToken: state.turnToken,
      }),
    /3♦/
  );

  // Pemegang 3♦ menurunkan 3♦ -> kursi berkurang jadi 12 kartu & berlanjut ke kursi berikutnya
  applyAction(state, {
    userId: starterSeat.userId,
    action: 'play',
    cards: ['3D'],
    turnToken: state.turnToken,
  });
  assert.equal(starterSeat.holeCards.length, 12);
  assert.equal(state.currentPlay.cards[0].code, '3D');

  // Jika 3 pemain lain berturut-turut Pass -> meja bersih dan starter memimpin bebas
  for (let i = 0; i < 3; i += 1) {
    const actor = state.seats.find((s) => s.seatIndex === state.currentTurnSeat);
    applyAction(state, {
      userId: actor.userId,
      action: 'pass',
      turnToken: state.turnToken,
    });
  }
  assert.equal(state.currentPlay, null, 'Meja harus bersih setelah 3 pemain pass');
  assert.equal(state.currentTurnSeat, starterSeat.seatIndex);

  console.log('PASS 3: Mandatory 3♦ opener, 4×13 deal, pass restrictions & 3-pass trick reset');
}

// ----------------------------------------------------------------------------
// PASS 4: Skor Big 2 Offline (Multiplier 1x/2x/3x/4x & Bonus Kartu '2') + Timeout/Privacy
// ----------------------------------------------------------------------------
{
  assert.equal(computeCapsaCardMultiplier(cards('3D', '5C', '8H')), 1); // 3 kartu -> 1x
  assert.equal(computeCapsaCardMultiplier(cards('3D', '4C', '5H', '6S', '7D', '8C', '9H', '10S')), 2); // 8 kartu -> 2x
  assert.equal(computeCapsaCardMultiplier(new Array(13).fill(cardFromCode('3D'))), 4); // 13 kartu Congkak -> 4x
  assert.equal(computeCapsaCardMultiplier(cards('2S', '2D', '4C')), 3); // 1x base + 2 kartu angka 2 = 3x

  const settle = calculateCapsaRoundSettlement({
    winnerSeatIndex: 0,
    baseStake: 10,
    seats: [
      { seatIndex: 0, userId: 1, fullName: 'Juara', inHand: true, chips: 1000, holeCards: [] },
      { seatIndex: 1, userId: 2, fullName: 'Sisa3', inHand: true, chips: 1000, holeCards: cards('4D', '6C', '9H') }, // 3*10*1 = 30
      { seatIndex: 2, userId: 3, fullName: 'Ada2', inHand: true, chips: 1000, holeCards: cards('4D', '2S') }, // 2*10*(1+1) = 40
    ],
  });
  assert.equal(settle.totalWon, 70);

  // Uji Timeout Auto-Play & Privacy Filtering
  const sState = createTableState({
    roomId: 'PRV404',
    hostUser: { id: 10, full_name: 'Viewer A' },
  });
  addSeatToLobby(sState, { id: 11, full_name: 'Viewer B' });
  setPlayerReady(sState, 11, true);
  startNextHand(sState, { randomInt: makeSeededRng(88), fillBots: true });

  const viewA = projectStateForViewer(sState, 10);
  assert.equal(viewA.myHoleCards.length, 13);
  const oppSeats = viewA.table.seats.filter((s) => s.userId !== 10);
  assert.equal(oppSeats.length, 3);
  assert.ok(oppSeats.every((s) => s.holeCards === null && s.cardCount === 13));

  const starterId = sState.seats.find((s) => s.seatIndex === sState.currentTurnSeat).userId;
  handleTurnTimeout(sState);
  const updatedStarter = sState.seats.find((s) => s.userId === starterId);
  assert.ok(updatedStarter.holeCards.length < 13, 'Timeout di meja kosong harus otomatis menurunkan kartu');
  if (!updatedStarter.isBot) {
    assert.equal(updatedStarter.consecutiveTimeouts, 1);
  }

  console.log('PASS 4: Big 2 Offline scoring multipliers, timeout auto-play & strict opponent card privacy');
}

// ----------------------------------------------------------------------------
// PASS 5: Multi-Client Real WebSocket Integration (Quick Bot Mode + Mabar + Kill-Switch)
// ----------------------------------------------------------------------------
{
  const usersById = new Map([
    [1, { id: 1, full_name: 'Budi', role: 'mahasiswa', status: 'active', avatar_url: null }],
    [2, { id: 2, full_name: 'Sari', role: 'mahasiswa', status: 'active', avatar_url: null }],
    [4, { id: 4, full_name: 'Pending', role: 'mahasiswa', status: 'pending', avatar_url: null }],
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
    botThinkMs: 20, // Bot cepat selama integration test
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

  // 1) Tolak token tidak valid & akun belum verifikasi
  await assert.rejects(() => createNodeWsClient(wsUrl('bad')), (e) => e.statusCode === 401);
  await assert.rejects(() => createNodeWsClient(wsUrl('valid-user-4')), (e) => e.statusCode === 403);

  // 2) Solo Quick Bot Mode (ala Big 2 Offline) langsung main lawan 3 Bot AI
  const c1 = await createNodeWsClient(wsUrl('valid-user-1'));
  const botRoomAck = await c1.emit('room:create', {
    startingChips: 1000,
    blindLevel: '10/20',
    turnTimeoutSec: 30,
    quickBotMode: true,
  });
  assert.equal(botRoomAck.success, true);
  assert.equal(botRoomAck.data.room.phase, POKER_PHASES.BERMAIN);
  assert.equal(botRoomAck.data.myHoleCards.length, 13);
  assert.equal(botRoomAck.data.table.seats.filter((s) => s.isBot).length, 3);

  // Tunggu bot berjalan sampai giliran kembali ke manusia atau ronde berprogres
  await new Promise((r) => setTimeout(r, 150));
  const leaveBotAck = await c1.emit('room:leave', { roomId: botRoomAck.data.roomId });
  assert.equal(leaveBotAck.success, true);

  // 3) Room Mabar + Anti Multi-Tab + Reconnect + Kill-Switch Admin
  const c2 = await createNodeWsClient(wsUrl('valid-user-2'));
  const mabarAck = await c1.emit('room:create', {
    startingChips: 1000,
    blindLevel: '10/20',
    turnTimeoutSec: 30,
    quickBotMode: false,
  });
  const roomId = mabarAck.data.roomId;

  const replacedWait = c1.waitForEvent('session:replaced');
  const c1Tab2 = await createNodeWsClient(wsUrl('valid-user-1'));
  await replacedWait;

  const joinAck = await c2.emit('room:join', { roomId: roomId.toLowerCase() });
  assert.equal(joinAck.success, true);
  await c2.emit('room:ready', { roomId, ready: true });

  const c2PlayingWait = c2.waitForEvent('game:state', (s) => s.room.phase === POKER_PHASES.BERMAIN);
  const startAck = await c1Tab2.emit('room:start', { roomId });
  assert.equal(startAck.success, true);
  const c2State = await c2PlayingWait;
  assert.equal(c2State.myHoleCards.length, 13);
  assert.equal(c2State.table.seats.find((s) => s.userId === 1).holeCards, null);

  // Feature flag kill-switch
  const closedWait = c2.waitForEvent('game:event', (ev) => ev.type === 'room_closed');
  roomManager.setRuntimeFeatureEnabled(false, 'Admin');
  await closedWait;

  await assert.rejects(() => createNodeWsClient(wsUrl('valid-user-1')), (e) => e.statusCode === 503);

  c1Tab2.close();
  c2.close();
  wsServer.shutdown();
  await new Promise((resolve) => server.close(resolve));

  console.log('PASS 5: Multi-client WebSocket integration (Solo 3-Bot Big 2, Mabar, Anti-Multi-Tab & Kill-Switch)');
}

console.log('\nALL CAPSA BANTING (BIG 2) TESTS PASSED!');

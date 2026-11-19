// FILE: server/scripts/test-poker-ui.mjs
import assert from 'node:assert/strict';
import {
  mapSeatsRelativeToViewer,
  computeViewportLayoutMode,
  computeHandCardOverlapClass,
  clampBetAmount,
  computeBetSliderBounds,
  resolvePreActionTrigger,
  createInitialAnimationQueueState,
  normalizeAnimationStep,
  reduceAnimationQueue,
  computeDealCardTransform,
  DEFAULT_POKER_PREFERENCES,
  sanitizePokerPreferences,
  loadPokerPreferences,
  savePokerPreferences,
  formatAriaLiveAnnouncement,
  formatCompactChips,
  formatPlayerShortName,
  createSeededRandom,
  computeArcThrowParams,
  reorderArray,
  autoOrderHandCards,
  findAvailableCombosInHand,
  classifyCapsaPlay,
  canBeatPlay,
} from '../../client/src/utils/pokerUiHelpers.js';
import {
  TABLE_THEMES,
  CARD_BACK_DESIGNS,
} from '../../client/src/components/poker/pokerThemes.js';

// PASS 1: Pemetaan kursi relatif agar pemain lokal selalu di posisi bawah (`bottom`)
{
  const seats = [
    { seatIndex: 0, userId: 10 },
    { seatIndex: 1, userId: 20 },
    { seatIndex: 2, userId: 30 },
    { seatIndex: 3, userId: 40 },
  ];

  const view0 = mapSeatsRelativeToViewer(seats, 0);
  assert.equal(view0.bottom.userId, 10);
  assert.equal(view0.left.userId, 20);
  assert.equal(view0.top.userId, 30);
  assert.equal(view0.right.userId, 40);

  const view2 = mapSeatsRelativeToViewer(seats, 2);
  assert.equal(view2.bottom.userId, 30);
  assert.equal(view2.left.userId, 40);
  assert.equal(view2.top.userId, 10);
  assert.equal(view2.right.userId, 20);

  const viewFallback = mapSeatsRelativeToViewer(seats, null);
  assert.equal(viewFallback.bottom.userId, 10);

  console.log('PASS 1: Relative seat mapping anchors viewer at bottom across all seats');
}

// PASS 2: Klasifikasi breakpoint & mode landscape mobile
{
  assert.equal(computeViewportLayoutMode(320, 568), 'mobile_portrait');
  assert.equal(computeViewportLayoutMode(360, 640), 'mobile_portrait');
  assert.equal(computeViewportLayoutMode(375, 667), 'mobile_portrait');
  assert.equal(computeViewportLayoutMode(390, 844), 'mobile_portrait');
  assert.equal(computeViewportLayoutMode(412, 915), 'mobile_portrait');
  assert.equal(computeViewportLayoutMode(640, 360), 'mobile_landscape');
  assert.equal(computeViewportLayoutMode(760, 360), 'mobile_landscape');
  assert.equal(computeViewportLayoutMode(844, 390), 'mobile_landscape');
  assert.equal(computeViewportLayoutMode(768, 1024), 'tablet');
  assert.equal(computeViewportLayoutMode(1280, 800), 'desktop');
  assert.equal(computeViewportLayoutMode(1920, 1080), 'desktop');

  assert.equal(computeHandCardOverlapClass(13, 'mobile_portrait'), '-space-x-4');
  assert.equal(computeHandCardOverlapClass(4, 'mobile_landscape'), 'gap-1');

  console.log('PASS 2: Responsive viewport mode detection (360..1920 + mobile landscape)');
}

// PASS 3: Integritas metadata tema meja & desain punggung kartu minimalis
{
  assert.equal(TABLE_THEMES.length, 3);
  assert.equal(CARD_BACK_DESIGNS.length, 3);
  assert.ok(TABLE_THEMES.every((t) => t.id && t.name && t.subtitle && t.swatch));
  assert.ok(CARD_BACK_DESIGNS.every((b) => b.id && b.name && b.subtitle));

  console.log('PASS 3: Minimalist theme & card back design metadata integrity');
}

// PASS 4: Matematika BetSlider, short-stack clamping, dan resolve pre-action
{
  assert.equal(clampBetAmount(5, 20, 1000), 20);
  assert.equal(clampBetAmount(1500, 20, 1000), 1000);
  assert.equal(clampBetAmount('not-a-number', 40, 500), 40);

  const normalBounds = computeBetSliderBounds({
    minBetOrRaiseTo: 80,
    maxBetOrRaiseTo: 1000,
    callAmount: 40,
    totalPot: 160,
    step: 10,
  });
  assert.equal(normalBounds.min, 80);
  assert.equal(normalBounds.max, 1000);
  assert.equal(normalBounds.canSlide, true);
  assert.equal(normalBounds.step, 10);
  assert.deepEqual(normalBounds.presets, {
    min: 80,
    halfPot: 140,
    pot: 240,
    allIn: 1000,
  });

  // Short-stack: sisa chip lebih kecil dari min raise standar -> semua preset di-clamp ke allIn
  const shortStackBounds = computeBetSliderBounds({
    minBetOrRaiseTo: 200,
    maxBetOrRaiseTo: 75,
    callAmount: 50,
    totalPot: 300,
    step: 5,
  });
  assert.equal(shortStackBounds.min, 75);
  assert.equal(shortStackBounds.max, 75);
  assert.equal(shortStackBounds.canSlide, false);
  assert.deepEqual(shortStackBounds.presets, {
    min: 75,
    halfPot: 75,
    pot: 75,
    allIn: 75,
  });

  // Pre-action triggers
  const idleWait = resolvePreActionTrigger({
    preAction: 'auto_pass',
    isMyTurn: false,
    canPass: true,
  });
  assert.equal(idleWait.shouldFire, false);
  assert.equal(idleWait.nextPreAction, 'auto_pass');

  const passFire = resolvePreActionTrigger({
    preAction: 'auto_pass',
    isMyTurn: true,
    canPass: true,
  });
  assert.deepEqual(passFire, {
    shouldFire: true,
    actionToRun: 'pass',
    nextPreAction: null,
  });

  const checkCancelledWhenFacingBet = resolvePreActionTrigger({
    preAction: 'auto_check',
    isMyTurn: true,
    canCheck: false,
  });
  assert.deepEqual(checkCancelledWhenFacingBet, {
    shouldFire: false,
    actionToRun: null,
    nextPreAction: null,
  });

  const checkFoldFallsBackToFold = resolvePreActionTrigger({
    preAction: 'auto_check_fold',
    isMyTurn: true,
    canCheck: false,
  });
  assert.deepEqual(checkFoldFallsBackToFold, {
    shouldFire: true,
    actionToRun: 'fold',
    nextPreAction: null,
  });

  console.log('PASS 4: BetSlider bounds, short-stack clamping, and pre-action resolution');
}

// PASS 5: Antrean animasi tahan update cepat, fast-forward, dan prefers-reduced-motion
{
  let q = createInitialAnimationQueueState({ reducedMotion: false, tabHidden: false });

  q = reduceAnimationQueue(q, {
    type: 'ENQUEUE_STEPS',
    stateVersion: 1,
    steps: [
      { id: 'deal-1', type: 'deal', durationMs: 400 },
      { id: 'flip-1', type: 'community_flip', durationMs: 350 },
      { id: 'bet-1', type: 'bet_chips', durationMs: 300 },
    ],
  });
  assert.equal(q.activeStep.id, 'deal-1');
  assert.equal(q.pendingSteps.length, 2);
  assert.equal(q.completedCount, 0);

  // State baru (version 2) masuk saat deal-1 masih berjalan -> semua step version 1 wajib di-fast-forward
  q = reduceAnimationQueue(q, {
    type: 'ENQUEUE_STEPS',
    stateVersion: 2,
    replaceStale: true,
    steps: [{ id: 'showdown-2', type: 'showdown_reveal', durationMs: 500 }],
  });
  assert.equal(q.activeStep.id, 'showdown-2');
  assert.equal(q.pendingSteps.length, 0);
  assert.equal(q.completedCount, 3); // 3 step lama langsung selesai tanpa nyangkut

  // Selesaikan step showdown-2
  q = reduceAnimationQueue(q, { type: 'STEP_COMPLETE', stepId: 'showdown-2' });
  assert.equal(q.activeStep, null);
  assert.equal(q.completedCount, 4);

  // Saat prefers-reduced-motion aktif, step baru langsung selesai secara instan
  q = reduceAnimationQueue(q, {
    type: 'SET_ENVIRONMENT',
    reducedMotion: true,
  });
  q = reduceAnimationQueue(q, {
    type: 'ENQUEUE_STEPS',
    stateVersion: 3,
    steps: [
      { id: 'deal-rm', type: 'deal' },
      { id: 'sweep-rm', type: 'pot_sweep' },
    ],
  });
  assert.equal(q.activeStep, null);
  assert.equal(q.pendingSteps.length, 0);
  assert.equal(q.completedCount, 6);

  // Jeda bagi kartu di-cap <= 180ms & durasi <= 250ms sesuai aturan minimalis mobile
  const dealCard0 = computeDealCardTransform('bottom', 0);
  const dealCard12 = computeDealCardTransform('bottom', 12);
  assert.equal(dealCard0['--deal-delay-ms'], '0ms');
  assert.equal(dealCard12['--deal-delay-ms'], '180ms');
  const cappedStep = normalizeAnimationStep({ type: 'deal', durationMs: 600 });
  assert.equal(cappedStep.durationMs, 250);

  console.log('PASS 5: Animation queue fast-forward on rapid state updates & prefers-reduced-motion');
}

// PASS 6: Preferensi tema, kartu, SFX/haptik default MATI, dan persistensi localStorage
{
  assert.equal(DEFAULT_POKER_PREFERENCES.sfxEnabled, false);
  assert.equal(DEFAULT_POKER_PREFERENCES.hapticsEnabled, false);
  assert.equal(DEFAULT_POKER_PREFERENCES.tableTheme, 'emerald_royal');
  assert.equal(DEFAULT_POKER_PREFERENCES.cardBack, 'pasim_crest');

  const sanitizedInvalid = sanitizePokerPreferences({
    tableTheme: 'unknown_theme',
    cardBack: 'invalid_back',
    sfxVolume: 9.5,
    sfxEnabled: 0,
    hapticsEnabled: null,
  });
  assert.equal(sanitizedInvalid.tableTheme, 'emerald_royal');
  assert.equal(sanitizedInvalid.cardBack, 'pasim_crest');
  assert.equal(sanitizedInvalid.sfxVolume, 1);
  assert.equal(sanitizedInvalid.sfxEnabled, false);
  assert.equal(sanitizedInvalid.hapticsEnabled, false);

  const memMap = new Map();
  const mockStorage = {
    getItem: (k) => (memMap.has(k) ? memMap.get(k) : null),
    setItem: (k, v) => memMap.set(k, String(v)),
  };

  savePokerPreferences(
    {
      tableTheme: 'crimson_velvet',
      cardBack: 'royal_compass',
      fourColorDeck: true,
      sfxEnabled: true,
      sfxVolume: 0.45,
      hapticsEnabled: true,
    },
    mockStorage
  );

  const loaded = loadPokerPreferences(mockStorage);
  assert.deepEqual(loaded, {
    tableTheme: 'crimson_velvet',
    cardBack: 'royal_compass',
    fourColorDeck: true,
    sfxEnabled: true,
    sfxVolume: 0.45,
    hapticsEnabled: true,
    animationSpeed: 'full',
  });

  console.log('PASS 6: Theme & audio preferences (default OFF) + localStorage persistence');
}

// PASS 7: Pengumuman aksesibilitas aria-live ringkas (giliran, aksi lawan, dan pemenang)
{
  const msgMyTurn3D = formatAriaLiveAnnouncement({
    isMyTurn: true,
    mustIncludeThreeDiamond: true,
  });
  assert.equal(msgMyTurn3D, 'Giliran Anda, wajib sertakan 3 Wajik.');

  const msgOpponentPlay = formatAriaLiveAnnouncement({
    isMyTurn: false,
    activeTurnName: 'Nadia Sari',
    currentPlay: { fullName: 'Raka Putra', label: 'Pair As' },
  });
  assert.equal(msgOpponentPlay, 'Raka Putra membanting Pair As. Giliran Nadia Sari.');

  const msgWinner = formatAriaLiveAnnouncement({
    lastHandResult: {
      handNumber: 3,
      winnerName: 'Budi Santoso',
      totalWon: 450,
    },
    isMyTurn: true,
  });
  assert.equal(msgWinner, 'Ronde #3 dimenangkan oleh Budi Santoso (+450 chip).');

  console.log('PASS 7: Concise aria-live announcements for turn, opponent play & hand winner');
}

// PASS 8: Format chip ringkas (1,2K / 12K / 1,2M) & pemotongan nama panjang / inisial 320px
{
  assert.equal(formatCompactChips(0), '0');
  assert.equal(formatCompactChips(950), '950');
  assert.equal(formatCompactChips(1000), '1K');
  assert.equal(formatCompactChips(1200), '1,2K');
  assert.equal(formatCompactChips(12500), '13K');
  assert.equal(formatCompactChips(12000), '12K');
  assert.equal(formatCompactChips(1200000), '1,2M');

  assert.equal(
    formatPlayerShortName('Muhammad Raka Pratama Putra', { ultraCompact: false, maxChars: 10 }),
    'Muhammad…'
  );
  assert.equal(
    formatPlayerShortName('Muhammad Raka Pratama Putra', { ultraCompact: true }),
    'MR'
  );
  assert.equal(formatPlayerShortName('Budi', { ultraCompact: true }), 'BU');

  console.log('PASS 8: Compact chip formatting (1,2K/12K/1,2M) & player name ellipsis/initials');
}

// PASS 9: Susun Kartu Horizontal & Auto-Urut Kombinasi Deterministik
{
  // Test reorderArray
  const orig = ['A', 'B', 'C', 'D'];
  assert.deepEqual(reorderArray(orig, 0, 2), ['B', 'C', 'A', 'D']);
  assert.deepEqual(reorderArray(orig, 3, 1), ['A', 'D', 'B', 'C']);
  assert.deepEqual(reorderArray(orig, 1, 1), ['A', 'B', 'C', 'D']);

  // Four of a Kind (4 + kicker)
  const fockCards = [
    { rank: 5, suit: 'D', code: '5D' },
    { rank: 9, suit: 'S', code: '9S' },
    { rank: 9, suit: 'H', code: '9H' },
    { rank: 9, suit: 'C', code: '9C' },
    { rank: 9, suit: 'D', code: '9D' },
    { rank: 3, suit: 'S', code: '3S' },
  ];
  const fockRes = autoOrderHandCards(fockCards);
  assert.equal(fockRes.comboType, 'four_of_a_kind');
  assert.equal(fockRes.orderedCards.slice(0, 4).every((c) => c.rank === 9), true);
  assert.equal(fockRes.orderedCards[4].rank, 5); // kicker highest first
  assert.equal(fockRes.orderedCards[5].rank, 3);

  // Full House (3 + 2)
  const fhCards = [
    { rank: 7, suit: 'D', code: '7D' },
    { rank: 10, suit: 'S', code: '10S' },
    { rank: 7, suit: 'H', code: '7H' },
    { rank: 10, suit: 'H', code: '10H' },
    { rank: 7, suit: 'C', code: '7C' },
    { rank: 2, suit: 'S', code: '2S' },
  ];
  const fhRes = autoOrderHandCards(fhCards);
  assert.equal(fhRes.comboType, 'full_house');
  assert.equal(fhRes.orderedCards.slice(0, 3).every((c) => c.rank === 7), true);
  assert.equal(fhRes.orderedCards.slice(3, 5).every((c) => c.rank === 10), true);
  assert.equal(fhRes.orderedCards[5].rank, 2);

  // Straight Wheel (A-2-3-4-5) urut menaik
  const wheelCards = [
    { rank: 14, suit: 'S', code: 'AS' },
    { rank: 3, suit: 'H', code: '3H' },
    { rank: 5, suit: 'D', code: '5D' },
    { rank: 2, suit: 'C', code: '2C' },
    { rank: 4, suit: 'S', code: '4S' },
    { rank: 12, suit: 'C', code: 'QC' },
  ];
  const wheelRes = autoOrderHandCards(wheelCards);
  assert.equal(wheelRes.comboType, 'straight');
  assert.deepEqual(wheelRes.orderedCards.slice(0, 5).map((c) => c.rank), [14, 2, 3, 4, 5]);
  assert.equal(wheelRes.orderedCards[5].rank, 12);

  // Flush urut menurun
  const flushCards = [
    { rank: 4, suit: 'H', code: '4H' },
    { rank: 13, suit: 'H', code: 'KH' },
    { rank: 8, suit: 'H', code: '8H' },
    { rank: 2, suit: 'H', code: '2H' },
    { rank: 11, suit: 'H', code: 'JH' },
  ];
  const flushRes = autoOrderHandCards(flushCards);
  assert.equal(flushRes.comboType, 'flush');
  assert.deepEqual(flushRes.orderedCards.map((c) => c.rank), [13, 11, 8, 4, 2]);

  // Two Pair & One Pair & High Card
  const tpCards = [
    { rank: 8, suit: 'D', code: '8D' },
    { rank: 11, suit: 'S', code: 'JS' },
    { rank: 8, suit: 'H', code: '8H' },
    { rank: 11, suit: 'C', code: 'JC' },
    { rank: 4, suit: 'S', code: '4S' },
  ];
  const tpRes = autoOrderHandCards(tpCards);
  assert.equal(tpRes.comboType, 'two_pair');
  assert.deepEqual(tpRes.orderedCards.slice(0, 4).map((c) => c.rank), [11, 11, 8, 8]);
  assert.equal(tpRes.orderedCards[4].rank, 4);

  console.log('PASS 9: Drag & drop reorderArray & deterministic autoOrderHandCards combo grouping');
}

// PASS 10: Seeded PRNG & Parabolic Arc Throw Dynamics
{
  const rng1a = createSeededRandom('test-hand-seed-123');
  const rng1b = createSeededRandom('test-hand-seed-123');
  assert.equal(rng1a(), rng1b());
  assert.equal(rng1a(), rng1b());

  const paramsFull = computeArcThrowParams({
    handId: 'hand_99',
    cardIndex: 2,
    slotPosition: 'bottom',
    animationSpeed: 'full',
  });
  assert.equal(paramsFull.isInstant, false);
  assert.ok(paramsFull.durationMs >= 150 && paramsFull.durationMs <= 250);
  assert.ok(Math.abs(paramsFull.initialRotationDeg) >= 20 && Math.abs(paramsFull.initialRotationDeg) <= 30);
  assert.ok(Math.abs(paramsFull.settleRotationDeg) >= 2 && Math.abs(paramsFull.settleRotationDeg) <= 4);
  assert.equal(paramsFull.peakScale, 1.12);

  const paramsFast = computeArcThrowParams({
    handId: 'hand_99',
    cardIndex: 2,
    slotPosition: 'bottom',
    animationSpeed: 'fast',
  });
  assert.equal(paramsFast.durationMs, Math.round(paramsFull.durationMs * 0.5));

  const paramsOff = computeArcThrowParams({
    handId: 'hand_99',
    cardIndex: 2,
    slotPosition: 'bottom',
    animationSpeed: 'off',
  });
  assert.equal(paramsOff.isInstant, true);
  assert.equal(paramsOff.durationMs, 0);

  console.log('PASS 10: Seeded PRNG & parabolic arc throw parameter dynamics (full/fast/off)');
}

// PASS 11: Dynamic detection of all 10 poker hand combinations & real-time PLAY validation
{
  // 1. Uji kartu dari screenshot pengguna:
  // 3♠, 5♣, 5♠, 8♣, 9♥, 9♠, J♣, J♥, J♠, Q♦, Q♣, Q♥, 2♦
  const screenshotCards = [
    { rank: 3, suit: 'S', code: '3S' },
    { rank: 5, suit: 'C', code: '5C' },
    { rank: 5, suit: 'S', code: '5S' },
    { rank: 8, suit: 'C', code: '8C' },
    { rank: 9, suit: 'H', code: '9H' },
    { rank: 9, suit: 'S', code: '9S' },
    { rank: 11, suit: 'C', code: 'JC' },
    { rank: 11, suit: 'H', code: 'JH' },
    { rank: 11, suit: 'S', code: 'JS' },
    { rank: 12, suit: 'D', code: 'QD' },
    { rank: 12, suit: 'C', code: 'QC' },
    { rank: 12, suit: 'H', code: 'QH' },
    { rank: 2, suit: 'D', code: '2D' },
  ];

  // Tiger membanting Single 10♣ di meja
  const tableSingle10 = {
    cards: [{ rank: 10, suit: 'C', code: '10C' }],
    label: 'Single',
  };

  const detected = findAvailableCombosInHand(screenshotCards, [], { currentPlay: tableSingle10 });

  // Harus mendeteksi hanya kombinasi yang benar-benar ada di tangan:
  // Ada: Full House, Three of a Kind, One Pair, High Card (Two Pair dihapus karena bukan kombinasi Capsa)
  // TIDAK ada: Royal Flush, Straight Flush, Four of a Kind, Flush, Straight, Two Pair
  const detectedKeys = detected.detectedList.map((c) => c.key);
  assert.deepEqual(detectedKeys, [
    'full_house',
    'three_of_a_kind',
    'one_pair',
    'high_card',
  ]);

  assert.equal(detected.royal_flush.hasInHand, false);
  assert.equal(detected.straight_flush.hasInHand, false);
  assert.equal(detected.four_of_a_kind.hasInHand, false);
  assert.equal(detected.flush.hasInHand, false);
  assert.equal(detected.straight.hasInHand, false);
  assert.equal(detected.two_pair.hasInHand, false);

  assert.equal(detected.full_house.hasInHand, true);
  assert.equal(detected.three_of_a_kind.hasInHand, true);
  assert.equal(detected.one_pair.hasInHand, true);
  assert.equal(detected.high_card.hasInHand, true);

  // Validasi giliran melawan Single 10♣:
  // Hanya High Card yang bisa membanting (2♦, Q, J) -> isValidToPlay === true
  assert.equal(detected.high_card.isValidToPlay, true);
  // Full House, Tris, One Pair tidak bisa membanting Single -> isValidToPlay === false
  assert.equal(detected.full_house.isValidToPlay, false);
  assert.equal(detected.three_of_a_kind.isValidToPlay, false);
  assert.equal(detected.two_pair.isValidToPlay, false);
  assert.equal(detected.one_pair.isValidToPlay, false);

  // Kartu High Card yang sah harus diprioritaskan di awal daftar moves
  const firstHighCardMove = detected.high_card.moves[0];
  const firstHighCardObj = screenshotCards.find((c) => c.code === firstHighCardMove[0]);
  assert.ok(canBeatPlay([firstHighCardObj], tableSingle10));

  // 2. Uji Royal Flush
  const royalFlushHand = [
    { rank: 10, suit: 'S', code: '10S' },
    { rank: 11, suit: 'S', code: 'JS' },
    { rank: 12, suit: 'S', code: 'QS' },
    { rank: 13, suit: 'S', code: 'KS' },
    { rank: 14, suit: 'S', code: 'AS' },
  ];
  const rfResult = findAvailableCombosInHand(royalFlushHand);
  assert.equal(rfResult.royal_flush.hasInHand, true);
  assert.deepEqual(rfResult.royal_flush.moves[0], ['10S', 'JS', 'QS', 'KS', 'AS']);
  assert.equal(rfResult.detectedList[0].key, 'royal_flush');

  // 3. Uji Four of a Kind (Bom)
  const fourHand = [
    { rank: 7, suit: 'D', code: '7D' },
    { rank: 7, suit: 'C', code: '7C' },
    { rank: 7, suit: 'H', code: '7H' },
    { rank: 7, suit: 'S', code: '7S' },
    { rank: 3, suit: 'S', code: '3S' },
  ];
  const fourResult = findAvailableCombosInHand(fourHand);
  assert.equal(fourResult.four_of_a_kind.hasInHand, true);
  assert.equal(fourResult.four_of_a_kind.moves[0].length, 5); // 4 + kicker
  assert.ok(fourResult.four_of_a_kind.moves[0].includes('7D'));
  assert.ok(fourResult.four_of_a_kind.moves[0].includes('3S'));

  // 4. Uji Straight dan Flush
  const straightCards = [
    { rank: 3, suit: 'D', code: '3D' },
    { rank: 4, suit: 'C', code: '4C' },
    { rank: 5, suit: 'H', code: '5H' },
    { rank: 6, suit: 'S', code: '6S' },
    { rank: 7, suit: 'D', code: '7D' },
  ];
  const straightRes = findAvailableCombosInHand(straightCards);
  assert.equal(straightRes.straight.hasInHand, true);
  assert.equal(straightRes.flush.hasInHand, false);

  const flushCards = [
    { rank: 2, suit: 'C', code: '2C' },
    { rank: 5, suit: 'C', code: '5C' },
    { rank: 8, suit: 'C', code: '8C' },
    { rank: 11, suit: 'C', code: 'JC' },
    { rank: 13, suit: 'C', code: 'KC' },
  ];
  const flushRes = findAvailableCombosInHand(flushCards);
  assert.equal(flushRes.flush.hasInHand, true);
  assert.equal(flushRes.straight.hasInHand, false);

  // 5. Uji canBeatPlay rules:
  // Two Pair (4 kartu) TIDAK sah untuk dibanting langsung di Capsa Banting
  const twoPairCards = [
    { rank: 9, suit: 'D', code: '9D' },
    { rank: 9, suit: 'C', code: '9C' },
    { rank: 4, suit: 'H', code: '4H' },
    { rank: 4, suit: 'S', code: '4S' },
  ];
  assert.equal(canBeatPlay(twoPairCards, null), false);

  // Single 2♦ mengalahkan Single 10♣
  assert.equal(
    canBeatPlay([{ rank: 2, suit: 'D', code: '2D' }], tableSingle10),
    true
  );
  // Single 3♠ kalah dari Single 10♣
  assert.equal(
    canBeatPlay([{ rank: 3, suit: 'S', code: '3S' }], tableSingle10),
    false
  );

  console.log('PASS 11: Dynamic detection of all 10 poker hand combinations & real-time PLAY validation');
}

console.log('\nALL POKER UI MINIMALIST FOUNDATION TESTS PASSED!');

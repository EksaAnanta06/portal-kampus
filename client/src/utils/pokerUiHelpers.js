// FILE: client/src/utils/pokerUiHelpers.js

/**
 * Memetakan 4 kursi meja secara relatif agar kursi viewer selalu berada di posisi bawah (`bottom`).
 */
export const mapSeatsRelativeToViewer = (seats = [], viewerSeatIndex = 0, maxSeats = 4) => {
  const base =
    viewerSeatIndex !== null && viewerSeatIndex !== undefined
      ? ((Number(viewerSeatIndex) % maxSeats) + maxSeats) % maxSeats
      : 0;

  const atOffset = (offset) =>
    seats.find((s) => Number(s.seatIndex) === (base + offset) % maxSeats) || null;

  const bottom = atOffset(0);
  const left = atOffset(1);
  const top = atOffset(2);
  const right = atOffset(3);

  return {
    bottom,
    left,
    top,
    right,
    ordered: [bottom, left, top, right],
  };
};

/**
 * Mengklasifikasikan mode tata letak responsif berdasarkan ukuran viewport.
 */
export const computeViewportLayoutMode = (width = 1280, height = 800) => {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (h > 0 && h <= 500 && w > h) {
    return 'mobile_landscape';
  }
  if (w < 768) {
    return 'mobile_portrait';
  }
  if (w < 1200) {
    return 'tablet';
  }
  return 'desktop';
};

/**
 * Menghitung kelas jarak antar kartu tangan agar 13 kartu tetap muat rapi tanpa scroll horizontal
 * di layar sempit (360px) maupun landscape HP, sekaligus menjaga target sentuh >= 44px.
 */
export const computeHandCardOverlapClass = (cardCount = 13, layoutMode = 'mobile_portrait') => {
  const count = Math.max(0, Number(cardCount) || 0);
  if (layoutMode === 'mobile_landscape') {
    return count > 7 ? '-space-x-4 sm:-space-x-3' : 'gap-1';
  }
  if (layoutMode === 'mobile_portrait') {
    if (count >= 10) return '-space-x-4';
    if (count >= 6) return '-space-x-2.5';
    return 'gap-1';
  }
  if (layoutMode === 'tablet') {
    return count >= 10 ? '-space-x-2.5' : 'gap-1.5';
  }
  return count >= 11 ? '-space-x-1.5' : 'gap-2';
};

/**
 * Clamp a numeric bet/raise amount strictly within [min, max].
 */
export const clampBetAmount = (value, min = 0, max = 0) => {
  const lo = Number.isFinite(Number(min)) ? Math.round(Number(min)) : 0;
  const hi = Number.isFinite(Number(max)) ? Math.max(lo, Math.round(Number(max))) : lo;
  const raw = Number.isFinite(Number(value)) ? Math.round(Number(value)) : lo;
  return Math.min(hi, Math.max(lo, raw));
};

/**
 * Compute slider boundaries and preset targets (Min, 1/2 Pot, Pot, All-In)
 * safely handling short-stack cases where maxBetOrRaiseTo <= minBetOrRaiseTo.
 */
export const computeBetSliderBounds = ({
  minBetOrRaiseTo = 0,
  maxBetOrRaiseTo = 0,
  callAmount = 0,
  totalPot = 0,
  step = 5,
} = {}) => {
  const max = Math.max(0, Math.round(Number(maxBetOrRaiseTo) || 0));
  const rawMin = Math.max(0, Math.round(Number(minBetOrRaiseTo) || 0));
  const min = Math.min(rawMin, max);
  const canSlide = max > min;
  const safeStep = Math.max(1, Math.round(Number(step) || 1));

  const safeCall = Math.max(0, Math.round(Number(callAmount) || 0));
  const safePot = Math.max(0, Math.round(Number(totalPot) || 0));
  const effectivePot = safePot + safeCall;

  const halfPot = clampBetAmount(Math.round(safeCall + effectivePot * 0.5), min, max);
  const pot = clampBetAmount(Math.round(safeCall + effectivePot), min, max);

  return {
    min,
    max,
    canSlide,
    step: safeStep,
    presets: {
      min,
      halfPot,
      pot,
      allIn: max,
    },
  };
};

/**
 * Resolve optional pre-action queue when the local player's turn arrives.
 * Pre-actions are single-shot and always reset once the turn starts.
 */
export const resolvePreActionTrigger = ({
  preAction = null,
  isMyTurn = false,
  canCheck = false,
  canPass = false,
} = {}) => {
  if (!isMyTurn || !preAction) {
    return {
      shouldFire: false,
      actionToRun: null,
      nextPreAction: preAction || null,
    };
  }

  if (preAction === 'auto_pass') {
    return {
      shouldFire: Boolean(canPass),
      actionToRun: canPass ? 'pass' : null,
      nextPreAction: null,
    };
  }

  if (preAction === 'auto_check') {
    return {
      shouldFire: Boolean(canCheck),
      actionToRun: canCheck ? 'check' : null,
      nextPreAction: null,
    };
  }

  if (preAction === 'auto_check_fold') {
    return {
      shouldFire: true,
      actionToRun: canCheck ? 'check' : 'fold',
      nextPreAction: null,
    };
  }

  return {
    shouldFire: false,
    actionToRun: null,
    nextPreAction: null,
  };
};

const DEFAULT_ANIMATION_DURATIONS = {
  deal: 220,
  community_flip: 200,
  bet_chips: 180,
  pot_collect: 200,
  turn_change: 150,
  showdown_reveal: 240,
  pot_sweep: 220,
};

export const createInitialAnimationQueueState = ({
  reducedMotion = false,
  tabHidden = false,
} = {}) => ({
  activeStep: null,
  pendingSteps: [],
  completedCount: 0,
  lastStateVersion: 0,
  reducedMotion: Boolean(reducedMotion),
  tabHidden: Boolean(tabHidden),
});

export const normalizeAnimationStep = (rawStep = {}, index = 0) => {
  const type = String(rawStep.type || 'deal');
  const defaultDuration = DEFAULT_ANIMATION_DURATIONS[type] || 200;
  const rawDuration = Number.isFinite(Number(rawStep.durationMs))
    ? Math.round(Number(rawStep.durationMs))
    : defaultDuration;
  const durationMs = Math.min(250, Math.max(40, rawDuration));
  return {
    id: rawStep.id || `${type}-${Date.now()}-${index}`,
    type,
    durationMs,
    payload: rawStep.payload || {},
    stateVersion: Number.isFinite(Number(rawStep.stateVersion))
      ? Number(rawStep.stateVersion)
      : 0,
  };
};

/**
 * Pure reducer for the poker animation queue.
 * - Fast-forwards stale animations when a newer server stateVersion arrives.
 * - Completes steps instantaneously when prefers-reduced-motion or tabHidden is active.
 */
export const reduceAnimationQueue = (state = createInitialAnimationQueueState(), action = {}) => {
  const current = state || createInitialAnimationQueueState();

  switch (action.type) {
    case 'SET_ENVIRONMENT': {
      const reducedMotion =
        action.reducedMotion !== undefined ? Boolean(action.reducedMotion) : current.reducedMotion;
      const tabHidden =
        action.tabHidden !== undefined ? Boolean(action.tabHidden) : current.tabHidden;

      if (reducedMotion || tabHidden) {
        const flushed = (current.activeStep ? 1 : 0) + current.pendingSteps.length;
        return {
          ...current,
          reducedMotion,
          tabHidden,
          activeStep: null,
          pendingSteps: [],
          completedCount: current.completedCount + flushed,
        };
      }
      return {
        ...current,
        reducedMotion,
        tabHidden,
      };
    }

    case 'FAST_FORWARD_ALL': {
      const flushed = (current.activeStep ? 1 : 0) + current.pendingSteps.length;
      return {
        ...current,
        activeStep: null,
        pendingSteps: [],
        completedCount: current.completedCount + flushed,
      };
    }

    case 'STEP_COMPLETE': {
      if (!current.activeStep) return current;
      if (action.stepId && current.activeStep.id !== action.stepId) {
        return current;
      }
      const [nextActive = null, ...restPending] = current.pendingSteps;
      return {
        ...current,
        activeStep: nextActive,
        pendingSteps: restPending,
        completedCount: current.completedCount + 1,
      };
    }

    case 'ENQUEUE_STEPS': {
      const rawSteps = Array.isArray(action.steps) ? action.steps : [];
      if (rawSteps.length === 0) return current;

      const incomingVersion = Number.isFinite(Number(action.stateVersion))
        ? Number(action.stateVersion)
        : current.lastStateVersion;
      const replaceStale = action.replaceStale !== false;
      const isNewerState = incomingVersion > current.lastStateVersion;
      const shouldFlushExisting = Boolean(action.flushExisting || (replaceStale && isNewerState));

      const normalized = rawSteps.map((s, idx) =>
        normalizeAnimationStep({ ...s, stateVersion: incomingVersion }, idx)
      );

      const flushedExisting = shouldFlushExisting
        ? (current.activeStep ? 1 : 0) + current.pendingSteps.length
        : 0;

      // Instant completion when reduced-motion or background tab is active
      if (current.reducedMotion || current.tabHidden) {
        return {
          ...current,
          activeStep: null,
          pendingSteps: [],
          lastStateVersion: Math.max(current.lastStateVersion, incomingVersion),
          completedCount: current.completedCount + flushedExisting + normalized.length,
        };
      }

      if (shouldFlushExisting || !current.activeStep) {
        const [firstStep = null, ...remaining] = normalized;
        return {
          ...current,
          activeStep: firstStep,
          pendingSteps: remaining,
          lastStateVersion: Math.max(current.lastStateVersion, incomingVersion),
          completedCount: current.completedCount + flushedExisting,
        };
      }

      return {
        ...current,
        pendingSteps: [...current.pendingSteps, ...normalized],
        lastStateVersion: Math.max(current.lastStateVersion, incomingVersion),
      };
    }

    default:
      return current;
  }
};

/**
 * Compute GPU-friendly CSS custom properties for staggered card deal from center deck.
 */
export const computeDealCardTransform = (slotPosition = 'bottom', cardIndex = 0) => {
  const vectors = {
    bottom: { x: 0, y: -48 },
    top: { x: 0, y: 42 },
    left: { x: 56, y: 0 },
    right: { x: -56, y: 0 },
  };
  const vec = vectors[slotPosition] || vectors.bottom;
  const delayMs = Math.min(180, Math.max(0, Number(cardIndex) || 0) * 20);

  return {
    '--deal-from-x': `${vec.x}px`,
    '--deal-from-y': `${vec.y}px`,
    '--deal-delay-ms': `${delayMs}ms`,
  };
};

/**
 * Menghitung rotasi kipas halus (gentle fan ±3-4°) untuk kartu sendiri di kondisi landscape.
 */
export const computeLandscapeFanRotation = (index = 0, totalCards = 2) => {
  if (totalCards <= 1 || totalCards > 5) return null;
  const mid = (totalCards - 1) / 2;
  const offset = index - mid;
  const rotDeg = Math.round(offset * 3.5 * 10) / 10;
  return {
    transform: `rotate(${rotDeg}deg)`,
  };
};

export const POKER_PREFS_STORAGE_KEY = 'pasim_poker_preferences_v1';

const VALID_TABLE_THEMES = new Set(['emerald_royal', 'midnight_sapphire', 'crimson_velvet']);
const VALID_CARD_BACKS = new Set([
  'pasim_crest',
  'emerald_lattice',
  'midnight_rosette',
  'gold_lattice',
  'royal_compass',
]);
export const VALID_ANIMATION_SPEEDS = new Set(['full', 'fast', 'off']);

/**
 * Default user preferences: SFX and Haptics MUST default to OFF (false).
 * Kecepatan animasi default Penuh ('full').
 */
export const DEFAULT_POKER_PREFERENCES = Object.freeze({
  tableTheme: 'emerald_royal',
  cardBack: 'pasim_crest',
  fourColorDeck: false,
  sfxEnabled: false,
  sfxVolume: 0.65,
  hapticsEnabled: false,
  animationSpeed: 'full',
});

export const sanitizePokerPreferences = (raw = {}) => {
  const input = raw && typeof raw === 'object' ? raw : {};
  const tableTheme = VALID_TABLE_THEMES.has(input.tableTheme)
    ? input.tableTheme
    : DEFAULT_POKER_PREFERENCES.tableTheme;
  const cardBack = VALID_CARD_BACKS.has(input.cardBack)
    ? input.cardBack
    : DEFAULT_POKER_PREFERENCES.cardBack;
  const animationSpeed = VALID_ANIMATION_SPEEDS.has(input.animationSpeed)
    ? input.animationSpeed
    : DEFAULT_POKER_PREFERENCES.animationSpeed;
  const rawVol = Number(input.sfxVolume);
  const sfxVolume = Number.isFinite(rawVol)
    ? Math.min(1, Math.max(0, Math.round(rawVol * 100) / 100))
    : DEFAULT_POKER_PREFERENCES.sfxVolume;

  return {
    tableTheme,
    cardBack,
    fourColorDeck: Boolean(input.fourColorDeck),
    sfxEnabled: Boolean(input.sfxEnabled),
    sfxVolume,
    hapticsEnabled: Boolean(input.hapticsEnabled),
    animationSpeed,
  };
};

const resolveStorage = (storage) => {
  if (storage && typeof storage.getItem === 'function') return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

export const loadPokerPreferences = (storage = null) => {
  try {
    const store = resolveStorage(storage);
    if (!store) return { ...DEFAULT_POKER_PREFERENCES };
    const serialized = store.getItem(POKER_PREFS_STORAGE_KEY);
    if (!serialized) return { ...DEFAULT_POKER_PREFERENCES };
    const parsed = JSON.parse(serialized);
    return sanitizePokerPreferences(parsed);
  } catch (_err) {
    return { ...DEFAULT_POKER_PREFERENCES };
  }
};

export const savePokerPreferences = (prefs = {}, storage = null) => {
  const sanitized = sanitizePokerPreferences(prefs);
  try {
    const store = resolveStorage(storage);
    if (store && typeof store.setItem === 'function') {
      store.setItem(POKER_PREFS_STORAGE_KEY, JSON.stringify(sanitized));
    }
  } catch (_err) {
    // Ignore storage quota / private mode restrictions safely
  }
  return sanitized;
};

/**
 * Build a concise, non-spammy screen-reader announcement for turn changes,
 * opponent actions, and hand outcomes.
 */
export const formatAriaLiveAnnouncement = ({
  lastHandResult = null,
  currentPlay = null,
  isMyTurn = false,
  activeTurnName = '',
  mustIncludeThreeDiamond = false,
} = {}) => {
  if (lastHandResult && lastHandResult.winnerName) {
    const won = Number(lastHandResult.totalWon || 0);
    return `Ronde #${lastHandResult.handNumber || 1} dimenangkan oleh ${
      lastHandResult.winnerName
    }${won > 0 ? ` (+${won} chip)` : ''}.`;
  }

  const playPart =
    currentPlay && currentPlay.fullName && currentPlay.label
      ? `${currentPlay.fullName} membanting ${currentPlay.label}. `
      : '';

  if (isMyTurn) {
    return `${playPart}Giliran Anda${
      mustIncludeThreeDiamond ? ', wajib sertakan 3 Wajik.' : '.'
    }`;
  }

  if (activeTurnName) {
    return `${playPart}Giliran ${activeTurnName}.`;
  }

  return playPart.trim();
};

/**
 * Format large chip values concisely (e.g., 950 -> "950", 1200 -> "1,2K", 12000 -> "12K", 1200000 -> "1,2M")
 * so numbers never overflow mobile containers.
 */
export const formatCompactChips = (amount = 0) => {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return '0';
  const abs = Math.round(num);

  if (abs < 1000) {
    return String(abs);
  }

  if (abs < 1000000) {
    const kVal = abs >= 10000 ? Math.round(abs / 1000) : Math.round((abs / 1000) * 10) / 10;
    return `${String(kVal).replace('.', ',')}K`;
  }

  const mVal = abs >= 10000000 ? Math.round(abs / 1000000) : Math.round((abs / 1000000) * 10) / 10;
  return `${String(mVal).replace('.', ',')}M`;
};

/**
 * Format player name safely for narrow mobile slots without pushing layout:
 * - ultraCompact (320px width): returns 1-2 character initials
 * - normal: returns truncated first/short name with ellipsis up to maxChars
 */
export const formatPlayerShortName = (
  fullName = '',
  { ultraCompact = false, maxChars = 10 } = {}
) => {
  const cleaned = String(fullName || '').trim();
  if (!cleaned) return 'Pemain';

  if (ultraCompact) {
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase();
  }

  const limit = Math.max(4, Number(maxChars) || 10);
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, limit - 1).trimEnd()}…`;
};

/**
 * Pembangkit angka acak ber-seed deterministik (Mulberry32)
 * Digunakan agar variasi acak rotasi dan busur animasi kartu/chip dapat direproduksi di unit test.
 */
export const createSeededRandom = (seedStr = 'pasim-poker-seed') => {
  let h = 2166136261 >>> 0;
  const s = String(seedStr || 'seed');
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Parameter lemparan melengkung (arc throw) ber-seed deterministik:
 * - Rotasi awal acak (±20° s.d. ±30°)
 * - Sudut akhir natural kecil (±2° s.d. ±4°)
 * - Durasi per kartu ±10%, jeda clockwise per kartu ~90-120ms
 * - Puncak busur Y (-24px s.d. -34px) dan scale depth (1.0 -> 1.12 -> 1.0)
 */
export const computeArcThrowParams = ({
  handId = 1,
  cardIndex = 0,
  slotPosition = 'bottom',
  animationSpeed = 'full',
} = {}) => {
  if (animationSpeed === 'off') {
    return {
      durationMs: 0,
      staggerMs: 0,
      initialRotationDeg: 0,
      settleRotationDeg: 0,
      arcApexY: 0,
      peakScale: 1,
      targetOffsetPx: { x: 0, y: 0 },
      isInstant: true,
    };
  }

  const rng = createSeededRandom(`${handId}-card-${cardIndex}-${slotPosition}`);
  const speedFactor = animationSpeed === 'fast' ? 0.5 : 1;

  const initialSign = rng() > 0.5 ? 1 : -1;
  const initialRotationDeg = Math.round((20 + rng() * 10) * initialSign);

  const finalSign = rng() > 0.5 ? 1 : -1;
  const settleRotationDeg = Math.round((2 + rng() * 2) * finalSign * 10) / 10;

  const targetOffsetPx = {
    x: Math.round((rng() * 4 - 2) * 10) / 10,
    y: Math.round((rng() * 4 - 2) * 10) / 10,
  };

  const baseDuration = 200 + Math.round(rng() * 40 - 20);
  const durationMs = Math.round(baseDuration * speedFactor);
  const staggerMs = Math.round((90 + Math.round(rng() * 30)) * speedFactor);

  const arcApexY = Math.round(-24 - rng() * 10);
  const peakScale = 1.12;

  return {
    durationMs,
    staggerMs,
    initialRotationDeg,
    settleRotationDeg,
    arcApexY,
    peakScale,
    targetOffsetPx,
    isInstant: false,
  };
};

/**
 * Pindahkan elemen list dari indeks fromIndex ke toIndex (Live reorder drag-and-drop).
 */
export const reorderArray = (list = [], fromIndex = 0, toIndex = 0) => {
  if (!Array.isArray(list)) return [];
  const result = [...list];
  if (
    fromIndex < 0 ||
    fromIndex >= result.length ||
    toIndex < 0 ||
    toIndex >= result.length ||
    fromIndex === toIndex
  ) {
    return result;
  }
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
};

/**
 * Auto-urut pengelompokan kombinasi tangan:
 * - Kombinasi terbaik di kiri, kicker di kanan
 * - Kelompok kemunculan angka terbanyak lebih dulu:
 *   Four of a Kind (4 + kicker), Full House (3 + 2), Three of a Kind (3 + kicker),
 *   Two Pair (pasangan tinggi, pasangan rendah, kicker), One Pair (2 + kicker)
 * - Straight / Straight Flush: urut dari terendah ke tertinggi (As rendah pada A-2-3-4-5)
 * - Flush: urut dari tertinggi ke terendah
 * - High Card: urut dari tertinggi ke terendah
 * - Kartu di luar kombinasi berada di kanan dalam urutan menurun dan ditandai (isDimmed / non-best)
 */
export const autoOrderHandCards = (cards = []) => {
  if (!Array.isArray(cards) || cards.length === 0) {
    return { orderedCards: [], comboType: 'none', label: '', bestComboCardCodes: new Set() };
  }

  const validCards = cards.filter((c) => c && c.code);
  if (validCards.length <= 1) {
    return {
      orderedCards: [...validCards],
      comboType: 'single',
      label: 'Single',
      bestComboCardCodes: new Set(validCards.map((c) => c.code)),
    };
  }

  const getRankNum = (c) => {
    const r = Number(c.rank);
    return Number.isFinite(r) ? r : 0;
  };

  // Cek apakah ada Flush (>= 5 kartu kembang sama)
  const bySuit = new Map();
  for (const c of validCards) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit).push(c);
  }
  const flushSuitGroup = [...bySuit.values()].find((g) => g.length >= 5) || null;

  // Cek apakah ada Straight (5 kartu berurutan)
  const detectStraight = (candidateList) => {
    const sorted = [...candidateList].sort((a, b) => getRankNum(a) - getRankNum(b));
    const rankMap = new Map();
    for (const c of sorted) {
      if (!rankMap.has(getRankNum(c))) rankMap.set(getRankNum(c), c);
    }
    const uniqueRanks = [...rankMap.keys()];

    // Cek straight reguler dari tertinggi ke terendah
    for (let i = uniqueRanks.length - 1; i >= 4; i -= 1) {
      if (uniqueRanks[i] - uniqueRanks[i - 4] === 4) {
        const straightCards = [];
        for (let j = i - 4; j <= i; j += 1) {
          straightCards.push(rankMap.get(uniqueRanks[j]));
        }
        return { isStraight: true, isWheel: false, cards: straightCards };
      }
    }

    // Cek wheel straight (A-2-3-4-5) -> As rendah (A, 2, 3, 4, 5)
    if (
      rankMap.has(14) &&
      rankMap.has(2) &&
      rankMap.has(3) &&
      rankMap.has(4) &&
      rankMap.has(5)
    ) {
      return {
        isStraight: true,
        isWheel: true,
        cards: [
          rankMap.get(14),
          rankMap.get(2),
          rankMap.get(3),
          rankMap.get(4),
          rankMap.get(5),
        ],
      };
    }

    return null;
  };

  // 1. Straight Flush
  if (flushSuitGroup) {
    const sf = detectStraight(flushSuitGroup);
    if (sf) {
      const bestCodes = new Set(sf.cards.map((c) => c.code));
      const kickers = validCards
        .filter((c) => !bestCodes.has(c.code))
        .sort((a, b) => getRankNum(b) - getRankNum(a));
      return {
        orderedCards: [...sf.cards, ...kickers],
        comboType: 'straight_flush',
        label: sf.isWheel ? 'Baby Straight Flush' : 'Straight Flush',
        bestComboCardCodes: bestCodes,
      };
    }
  }

  // Kelompokkan kemunculan rank (countMap)
  const countMap = new Map();
  for (const c of validCards) {
    const r = getRankNum(c);
    if (!countMap.has(r)) countMap.set(r, []);
    countMap.get(r).push(c);
  }

  // Urutkan kelompok: frekuensi terbanyak dulu, jika sama urutkan rank tertinggi dulu
  const groups = [...countMap.entries()]
    .map(([rank, items]) => ({
      rank,
      count: items.length,
      items: items.sort((a, b) => (b.suit > a.suit ? 1 : -1)),
    }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.rank - a.rank));

  // 2. Four of a Kind (4 + kickers)
  if (groups[0]?.count === 4) {
    const bestFour = groups[0].items;
    const bestCodes = new Set(bestFour.map((c) => c.code));
    const kickers = validCards
      .filter((c) => !bestCodes.has(c.code))
      .sort((a, b) => getRankNum(b) - getRankNum(a));
    return {
      orderedCards: [...bestFour, ...kickers],
      comboType: 'four_of_a_kind',
      label: 'Four of a Kind',
      bestComboCardCodes: bestCodes,
    };
  }

  // 3. Full House (3 + 2)
  if (groups[0]?.count === 3 && groups[1]?.count >= 2) {
    const triplet = groups[0].items;
    const pair = groups[1].items.slice(0, 2);
    const bestFive = [...triplet, ...pair];
    const bestCodes = new Set(bestFive.map((c) => c.code));
    const kickers = validCards
      .filter((c) => !bestCodes.has(c.code))
      .sort((a, b) => getRankNum(b) - getRankNum(a));
    return {
      orderedCards: [...bestFive, ...kickers],
      comboType: 'full_house',
      label: 'Full House',
      bestComboCardCodes: bestCodes,
    };
  }

  // 4. Flush (5 kartu satu kembang, urut menurun)
  if (flushSuitGroup) {
    const bestFlush = [...flushSuitGroup]
      .sort((a, b) => getRankNum(b) - getRankNum(a))
      .slice(0, 5);
    const bestCodes = new Set(bestFlush.map((c) => c.code));
    const kickers = validCards
      .filter((c) => !bestCodes.has(c.code))
      .sort((a, b) => getRankNum(b) - getRankNum(a));
    return {
      orderedCards: [...bestFlush, ...kickers],
      comboType: 'flush',
      label: 'Flush',
      bestComboCardCodes: bestCodes,
    };
  }

  // 5. Straight (5 kartu berurutan, urut terendah ke tertinggi)
  const st = detectStraight(validCards);
  if (st) {
    const bestCodes = new Set(st.cards.map((c) => c.code));
    const kickers = validCards
      .filter((c) => !bestCodes.has(c.code))
      .sort((a, b) => getRankNum(b) - getRankNum(a));
    return {
      orderedCards: [...st.cards, ...kickers],
      comboType: 'straight',
      label: st.isWheel ? 'Wheel Straight (A-5)' : 'Straight',
      bestComboCardCodes: bestCodes,
    };
  }

  // 6. Three of a Kind (3 + kickers menurun)
  if (groups[0]?.count === 3) {
    const triplet = groups[0].items;
    const bestCodes = new Set(triplet.map((c) => c.code));
    const kickers = validCards
      .filter((c) => !bestCodes.has(c.code))
      .sort((a, b) => getRankNum(b) - getRankNum(a));
    return {
      orderedCards: [...triplet, ...kickers],
      comboType: 'three_of_a_kind',
      label: 'Three of a Kind',
      bestComboCardCodes: bestCodes,
    };
  }

  // 7. Two Pair (pair tinggi + pair rendah + kickers menurun)
  if (groups[0]?.count === 2 && groups[1]?.count === 2) {
    const pairs = [...groups[0].items, ...groups[1].items];
    const bestCodes = new Set(pairs.map((c) => c.code));
    const kickers = validCards
      .filter((c) => !bestCodes.has(c.code))
      .sort((a, b) => getRankNum(b) - getRankNum(a));
    return {
      orderedCards: [...pairs, ...kickers],
      comboType: 'two_pair',
      label: 'Two Pair',
      bestComboCardCodes: bestCodes,
    };
  }

  // 8. One Pair (2 + kickers menurun)
  if (groups[0]?.count === 2) {
    const pair = groups[0].items;
    const bestCodes = new Set(pair.map((c) => c.code));
    const kickers = validCards
      .filter((c) => !bestCodes.has(c.code))
      .sort((a, b) => getRankNum(b) - getRankNum(a));
    return {
      orderedCards: [...pair, ...kickers],
      comboType: 'one_pair',
      label: 'One Pair',
      bestComboCardCodes: bestCodes,
    };
  }

  // 9. High Card (semua kartu urut dari tertinggi ke terendah)
  const highCardList = [...validCards].sort((a, b) => getRankNum(b) - getRankNum(a));
  const bestCodes = new Set(highCardList.slice(0, 5).map((c) => c.code));
  return {
    orderedCards: highCardList,
    comboType: 'high_card',
    label: 'High Card',
    bestComboCardCodes: bestCodes,
  };
};

export const CAPSA_RANK_POWER = Object.freeze({
  3: 0,
  4: 1,
  5: 2,
  6: 3,
  7: 4,
  8: 5,
  9: 6,
  10: 7,
  11: 8, // J
  12: 9, // Q
  13: 10, // K
  14: 11, // A
  2: 12, // 2 paling tinggi di Capsa Banting (Big 2)
});

export const CAPSA_SUIT_POWER = Object.freeze({
  D: 0, // ♦ Wajik
  C: 1, // ♣ Keriting
  H: 2, // ♥ Hati
  S: 3, // ♠ Sekop
});

export const getCapsaCardPower = (card) => {
  if (!card) return -1;
  const rank = Number(card.rank) || 0;
  const suit = String(card.suit || '').toUpperCase();
  const rp = CAPSA_RANK_POWER[rank] ?? 0;
  const sp = CAPSA_SUIT_POWER[suit] ?? 0;
  return rp * 4 + sp;
};

/**
 * Mengklasifikasikan susunan 1, 2, 3, atau 5 kartu sesuai aturan Capsa Banting (Big 2).
 */
export const classifyCapsaPlay = (cards = []) => {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const valid = cards.filter((c) => c && c.code);
  if (valid.length !== cards.length) return null;

  // Single (1 kartu)
  if (cards.length === 1) {
    const power = getCapsaCardPower(cards[0]);
    return {
      type: 'single',
      count: 1,
      comboCategory: 1,
      label: 'Single',
      power,
      tiebreakers: [power],
      isBomb: false,
      cards: [cards[0]],
    };
  }

  // Pair (2 kartu rank sama)
  if (cards.length === 2) {
    if (cards[0].rank !== cards[1].rank) return null;
    const power = Math.max(getCapsaCardPower(cards[0]), getCapsaCardPower(cards[1]));
    return {
      type: 'pair',
      count: 2,
      comboCategory: 1,
      label: 'Pair (2 Kembar)',
      power,
      tiebreakers: [power],
      isBomb: false,
      cards: [...cards],
    };
  }

  // Tris (3 kartu rank sama)
  if (cards.length === 3) {
    if (cards[0].rank !== cards[1].rank || cards[1].rank !== cards[2].rank) return null;
    const power = Math.max(
      getCapsaCardPower(cards[0]),
      getCapsaCardPower(cards[1]),
      getCapsaCardPower(cards[2])
    );
    return {
      type: 'tris',
      count: 3,
      comboCategory: 1,
      label: 'Tris (3 Kembar)',
      power,
      tiebreakers: [power],
      isBomb: false,
      cards: [...cards],
    };
  }

  // 5 Kartu (Straight, Flush, Full House, Four of a Kind, Straight Flush, Royal Flush)
  if (cards.length === 5) {
    const isFlush = new Set(cards.map((c) => String(c.suit || '').toUpperCase())).size === 1;

    // Straight check
    const numericRanks = [...new Set(cards.map((c) => Number(c.rank)))].sort((a, b) => a - b);
    let straightDetails = null;
    if (numericRanks.length === 5) {
      if (numericRanks[4] - numericRanks[0] === 4) {
        const highCard = cards.reduce(
          (best, cur) => (getCapsaCardPower(cur) > getCapsaCardPower(best) ? cur : best),
          cards[0]
        );
        straightDetails = {
          isStraight: true,
          power: getCapsaCardPower(highCard),
          subOrder: numericRanks[4],
        };
      } else if (
        numericRanks[0] === 2 &&
        numericRanks[1] === 3 &&
        numericRanks[2] === 4 &&
        numericRanks[3] === 5 &&
        numericRanks[4] === 14
      ) {
        // Wheel straight A-2-3-4-5
        const highCard = cards.reduce(
          (best, cur) => (getCapsaCardPower(cur) > getCapsaCardPower(best) ? cur : best),
          cards[0]
        );
        straightDetails = {
          isStraight: true,
          power: getCapsaCardPower(highCard),
          subOrder: 5,
        };
      }
    }

    const countMap = new Map();
    for (const c of cards) {
      const r = Number(c.rank);
      countMap.set(r, (countMap.get(r) || 0) + 1);
    }
    const groups = [...countMap.entries()]
      .map(([rank, count]) => ({ rank, count, rankPower: CAPSA_RANK_POWER[rank] ?? 0 }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.rankPower - a.rankPower));

    // Straight Flush / Royal Flush (Bom)
    if (isFlush && straightDetails) {
      const isRoyal = cards.every((c) => [10, 11, 12, 13, 14].includes(Number(c.rank)));
      return {
        type: 'five_card',
        count: 5,
        comboCategory: isRoyal ? 6 : 5,
        label: isRoyal ? 'Royal Flush' : 'Straight Flush',
        power: straightDetails.power,
        tiebreakers: [straightDetails.power, straightDetails.subOrder],
        isBomb: true,
        cards: [...cards],
      };
    }

    // Four of a Kind (Bom / Piting)
    if (groups[0]?.count === 4) {
      return {
        type: 'five_card',
        count: 5,
        comboCategory: 4,
        label: 'Four of a Kind',
        power: groups[0].rankPower,
        tiebreakers: [groups[0].rankPower, groups[1]?.rankPower ?? 0],
        isBomb: true,
        cards: [...cards],
      };
    }

    // Full House (Polo)
    if (groups[0]?.count === 3 && groups[1]?.count === 2) {
      return {
        type: 'five_card',
        count: 5,
        comboCategory: 3,
        label: 'Full House',
        power: groups[0].rankPower,
        tiebreakers: [groups[0].rankPower, groups[1].rankPower],
        isBomb: false,
        cards: [...cards],
      };
    }

    // Flush (Warna)
    if (isFlush) {
      const descPowers = [...cards]
        .map((c) => getCapsaCardPower(c))
        .sort((a, b) => b - a);
      return {
        type: 'five_card',
        count: 5,
        comboCategory: 2,
        label: 'Flush',
        power: descPowers[0],
        tiebreakers: descPowers,
        isBomb: false,
        cards: [...cards],
      };
    }

    // Straight (Seri)
    if (straightDetails) {
      return {
        type: 'five_card',
        count: 5,
        comboCategory: 1,
        label: 'Straight',
        power: straightDetails.power,
        tiebreakers: [straightDetails.power, straightDetails.subOrder],
        isBomb: false,
        cards: [...cards],
      };
    }
  }

  return null;
};

/**
 * Memvalidasi apakah candidateCards sah dimainkan dan mengalahkan currentPlay (jika ada).
 */
export const canBeatPlay = (
  candidateCards = [],
  currentPlay = null,
  { mustIncludeThreeDiamond = false } = {}
) => {
  const candidate = classifyCapsaPlay(candidateCards);
  if (!candidate) return false;

  if (mustIncludeThreeDiamond) {
    const has3D = candidateCards.some(
      (c) => Number(c.rank) === 3 && String(c.suit || '').toUpperCase() === 'D'
    );
    if (!has3D) return false;
  }

  if (!currentPlay) return true;

  let target = currentPlay.classified;
  if (!target && Array.isArray(currentPlay.cards) && currentPlay.cards.length > 0) {
    target = classifyCapsaPlay(currentPlay.cards);
    if (!target && currentPlay.label === 'Single' && currentPlay.cards[0]) {
      target = classifyCapsaPlay([currentPlay.cards[0]]);
    }
  }
  if (!target) return true;

  // Bom Big 2: Four of a Kind / Straight Flush memotong Single 2, Straight Flush memotong Pair 2
  if (candidate.isBomb && target.type !== 'five_card') {
    if (target.type === 'single' && Number(target.cards[0]?.rank) === 2) {
      return candidate.comboCategory >= 4;
    }
    if (target.type === 'pair' && Number(target.cards[0]?.rank) === 2) {
      return candidate.comboCategory >= 5;
    }
    return false;
  }

  if (candidate.type !== target.type) return false;

  if (candidate.comboCategory !== target.comboCategory) {
    return candidate.comboCategory > target.comboCategory;
  }

  if (candidate.power !== target.power) {
    return candidate.power > target.power;
  }

  const ta = candidate.tiebreakers || [];
  const tb = target.tiebreakers || [];
  const len = Math.max(ta.length, tb.length);
  for (let i = 0; i < len; i += 1) {
    const a = ta[i] ?? 0;
    const b = tb[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
};

/**
 * Mencari seluruh kombinasi Capsa Banting di tangan pemain secara dinamis:
 * 1. Royal Flush — 5 kartu berurutan 10, J, Q, K, A jenis kembang sama
 * 2. Straight Flush — 5 kartu berurutan jenis kembang sama
 * 3. Four of a Kind (Bom) — 4 kartu angka/nilai sama (+ kicker)
 * 4. Full House (Polo) — 3 kartu angka sama dan 2 kartu angka sama
 * 5. Flush (Warna) — 5 kartu jenis kembang sama
 * 6. Straight (Seri) — 5 kartu angka berurutan
 * 7. Three of a Kind — 3 kartu angka sama
 * 8. One Pair (Pair) — 2 kartu angka sama
 * 9. High Card (Single) — kartu tunggal/nilai tertinggi jika tidak ada kombinasi lain
 *
 * Catatan: Two Pair bukan kombinasi sah yang dapat dimainkan di Capsa Banting,
 * sehingga ditiadakan dari daftar kombinasi.
 *
 * Mengembalikan objek berisi info per kombinasi dan `detectedList`
 * yang HANYA berisi kombinasi yang benar-benar dimiliki pemain (hasInHand === true),
 * terurut dari peringkat tertinggi ke terendah.
 */
export const findAvailableCombosInHand = (
  cards = [],
  suggestedMoves = [],
  options = {}
) => {
  const currentPlay = options?.currentPlay ?? null;
  const mustIncludeThreeDiamond = Boolean(options?.mustIncludeThreeDiamond);

  const emptyResult = {
    detectedList: [],
    royal_flush: { key: 'royal_flush', label: 'Royal Flush', rankOrder: 1, hasInHand: false, isValidToPlay: false, moves: [] },
    straight_flush: { key: 'straight_flush', label: 'Straight Flush', rankOrder: 2, hasInHand: false, isValidToPlay: false, moves: [] },
    four_of_a_kind: { key: 'four_of_a_kind', label: 'Four of a Kind', rankOrder: 3, hasInHand: false, isValidToPlay: false, moves: [] },
    full_house: { key: 'full_house', label: 'Full House', rankOrder: 4, hasInHand: false, isValidToPlay: false, moves: [] },
    flush: { key: 'flush', label: 'Flush', rankOrder: 5, hasInHand: false, isValidToPlay: false, moves: [] },
    straight: { key: 'straight', label: 'Straight', rankOrder: 6, hasInHand: false, isValidToPlay: false, moves: [] },
    three_of_a_kind: { key: 'three_of_a_kind', label: 'Three of a Kind', rankOrder: 7, hasInHand: false, isValidToPlay: false, moves: [] },
    two_pair: { key: 'two_pair', label: 'Two Pair', rankOrder: 0, hasInHand: false, isValidToPlay: false, moves: [] },
    one_pair: { key: 'one_pair', label: 'One Pair', rankOrder: 8, hasInHand: false, isValidToPlay: false, moves: [] },
    high_card: { key: 'high_card', label: 'High Card', rankOrder: 9, hasInHand: false, isValidToPlay: false, moves: [] },
  };
  emptyResult.pair = emptyResult.one_pair;
  emptyResult.single = emptyResult.high_card;

  if (!Array.isArray(cards) || cards.length === 0) {
    return emptyResult;
  }

  const validCards = cards.filter((c) => c && c.code);
  if (validCards.length === 0) {
    return emptyResult;
  }

  const cardMap = new Map();
  for (const c of validCards) {
    cardMap.set(c.code, c);
  }

  // Pengelompokan berdasarkan rank dan suit
  const countMap = new Map();
  const bySuit = new Map();

  for (const c of validCards) {
    const r = Number(c.rank) || 0;
    const s = String(c.suit || '').toUpperCase();

    if (!countMap.has(r)) countMap.set(r, []);
    countMap.get(r).push(c);

    if (!bySuit.has(s)) bySuit.set(s, []);
    bySuit.get(s).push(c);
  }

  // Urutkan tiap grup rank & suit berdasarkan kekuatan Capsa
  for (const list of countMap.values()) {
    list.sort((a, b) => getCapsaCardPower(a) - getCapsaCardPower(b));
  }
  for (const list of bySuit.values()) {
    list.sort((a, b) => getCapsaCardPower(a) - getCapsaCardPower(b));
  }

  // Semua rank unik untuk pendeteksian straight
  const uniqueRanks = [...countMap.keys()].sort((a, b) => a - b);
  const possibleStraights = [
    [14, 2, 3, 4, 5], // Wheel straight
  ];
  for (let r = 2; r <= 10; r += 1) {
    possibleStraights.push([r, r + 1, r + 2, r + 3, r + 4]);
  }

  // 1. Royal Flush (10, J, Q, K, A satu kembang)
  const royalFlushMoves = [];
  for (const suitCards of bySuit.values()) {
    if (suitCards.length >= 5) {
      const hasAllRoyal = [10, 11, 12, 13, 14].every((r) =>
        suitCards.some((c) => Number(c.rank) === r)
      );
      if (hasAllRoyal) {
        const rf = [10, 11, 12, 13, 14].map((r) =>
          suitCards.find((c) => Number(c.rank) === r).code
        );
        royalFlushMoves.push(rf);
      }
    }
  }

  // 2. Straight Flush (5 berurutan satu kembang selain 10-J-Q-K-A)
  const straightFlushMoves = [];
  for (const suitCards of bySuit.values()) {
    if (suitCards.length >= 5) {
      const sRanks = new Set(suitCards.map((c) => Number(c.rank)));
      for (const stSeq of possibleStraights) {
        const isRoyal = stSeq.every((r) => [10, 11, 12, 13, 14].includes(r));
        if (isRoyal) continue; // Royal Flush terpisah
        if (stSeq.every((r) => sRanks.has(r))) {
          const sf = stSeq.map((r) => suitCards.find((c) => Number(c.rank) === r).code);
          straightFlushMoves.push(sf);
        }
      }
    }
  }

  // 3. Four of a Kind (Bom — 4 kartu rank sama)
  const fourOfAKindMoves = [];
  for (const [r, list] of countMap.entries()) {
    if (list.length >= 4) {
      const fourCodes = list.slice(0, 4).map((c) => c.code);
      if (validCards.length >= 5) {
        const kickers = validCards
          .filter((c) => Number(c.rank) !== r)
          .sort((a, b) => getCapsaCardPower(a) - getCapsaCardPower(b));
        for (const k of kickers.slice(0, 3)) {
          fourOfAKindMoves.push([...fourCodes, k.code]);
        }
      } else {
        fourOfAKindMoves.push(fourCodes);
      }
    }
  }

  // 4. Full House (Polo — 3 kembar + 2 kembar)
  const fullHouseMoves = [];
  for (const [rTri, tCards] of countMap.entries()) {
    if (tCards.length >= 3) {
      for (const [rPair, pCards] of countMap.entries()) {
        if (rPair !== rTri && pCards.length >= 2) {
          const fh = [
            ...tCards.slice(0, 3).map((c) => c.code),
            ...pCards.slice(0, 2).map((c) => c.code),
          ];
          fullHouseMoves.push(fh);
        }
      }
    }
  }

  // 5. Flush (Warna — 5 kartu kembang sama)
  const flushMoves = [];
  for (const suitCards of bySuit.values()) {
    if (suitCards.length >= 5) {
      const sortedDesc = [...suitCards].sort(
        (a, b) => getCapsaCardPower(b) - getCapsaCardPower(a)
      );
      const topFiveCodes = sortedDesc.slice(0, 5).map((c) => c.code);
      // Kecualikan jika merupakan Straight Flush
      const isSF = straightFlushMoves.some(
        (sf) => sf.every((code) => topFiveCodes.includes(code))
      );
      const isRF = royalFlushMoves.some(
        (rf) => rf.every((code) => topFiveCodes.includes(code))
      );
      if (!isSF && !isRF) {
        flushMoves.push(topFiveCodes);
      }
    }
  }

  // 6. Straight (Seri — 5 kartu angka berurutan)
  const straightMoves = [];
  const rankSet = new Set(uniqueRanks);
  for (const stSeq of possibleStraights) {
    if (stSeq.every((r) => rankSet.has(r))) {
      const stCards = stSeq.map((r) => countMap.get(r)[countMap.get(r).length - 1]);
      const stCodes = stCards.map((c) => c.code);
      const isFlush = new Set(stCards.map((c) => c.suit)).size === 1;
      if (!isFlush) {
        straightMoves.push(stCodes);
      }
    }
  }

  // 7. Three of a Kind (3 kartu angka sama)
  const tripleMoves = [];
  for (const list of countMap.values()) {
    if (list.length >= 3) {
      tripleMoves.push(list.slice(0, 3).map((c) => c.code));
    }
  }

  // 8. One Pair (2 kartu angka sama)
  const pairMoves = [];
  for (const list of countMap.values()) {
    if (list.length >= 2) {
      pairMoves.push(list.slice(0, 2).map((c) => c.code));
    }
  }

  // 9. High Card (kartu tunggal/nilai tertinggi)
  const highCardMoves = [...validCards]
    .sort((a, b) => getCapsaCardPower(b) - getCapsaCardPower(a))
    .map((c) => [c.code]);

  // Filter suggested moves dari server berdasarkan kategori
  const filterSuggested = (categoryKey, targetCount = null) => {
    return (suggestedMoves || [])
      .filter((m) => {
        const type = String(m.type || '').toLowerCase();
        const label = String(m.label || '').toLowerCase();
        const codeCount = Array.isArray(m.codes) ? m.codes.length : 0;

        if (targetCount !== null && codeCount !== targetCount) return false;

        switch (categoryKey) {
          case 'royal_flush':
            return label.includes('royal');
          case 'straight_flush':
            return label.includes('straight flush');
          case 'four_of_a_kind':
            return label.includes('four') || label.includes('bom') || label.includes('piting');
          case 'full_house':
            return label.includes('full house') || label.includes('polo');
          case 'flush':
            return label.includes('flush') && !label.includes('straight');
          case 'straight':
            return label.includes('straight') && !label.includes('flush');
          case 'three_of_a_kind':
            return type === 'tris' || type === 'three_of_a_kind' || codeCount === 3;
          case 'one_pair':
            return type === 'pair' || codeCount === 2;
          case 'high_card':
            return type === 'single' || codeCount === 1;
          default:
            return false;
        }
      })
      .map((m) => m.codes);
  };

  // Helper untuk memproses validitas bermain dan penggabungan urutan move
  const processCombo = (key, label, rankOrder, rawMoves, targetCount) => {
    const sug = filterSuggested(key, targetCount);

    const validRawMoves = [];
    const otherRawMoves = [];

    for (const move of rawMoves) {
      const moveCards = move.map((code) => cardMap.get(code)).filter(Boolean);
      if (moveCards.length === move.length) {
        if (canBeatPlay(moveCards, currentPlay, { mustIncludeThreeDiamond })) {
          validRawMoves.push(move);
        } else {
          otherRawMoves.push(move);
        }
      } else {
        otherRawMoves.push(move);
      }
    }

    const seen = new Set();
    const finalMoves = [];
    for (const m of [...sug, ...validRawMoves, ...otherRawMoves]) {
      const sig = [...m].sort().join(',');
      if (!seen.has(sig)) {
        seen.add(sig);
        finalMoves.push(m);
      }
    }

    const hasInHand = rawMoves.length > 0 || sug.length > 0;
    const isValidToPlay = sug.length > 0 || validRawMoves.length > 0;

    return {
      key,
      label,
      rankOrder,
      hasInHand,
      isValidToPlay,
      moves: finalMoves,
    };
  };

  const royalFlush = processCombo('royal_flush', 'Royal Flush', 1, royalFlushMoves, 5);
  const straightFlush = processCombo('straight_flush', 'Straight Flush', 2, straightFlushMoves, 5);
  const fourOfAKind = processCombo('four_of_a_kind', 'Four of a Kind', 3, fourOfAKindMoves, 5);
  const fullHouse = processCombo('full_house', 'Full House', 4, fullHouseMoves, 5);
  const flush = processCombo('flush', 'Flush', 5, flushMoves, 5);
  const straight = processCombo('straight', 'Straight', 6, straightMoves, 5);
  const threeOfAKind = processCombo('three_of_a_kind', 'Three of a Kind', 7, tripleMoves, 3);
  const onePair = processCombo('one_pair', 'One Pair', 8, pairMoves, 2);
  const highCard = processCombo('high_card', 'High Card', 9, highCardMoves, 1);

  // Urutan peringkat kombinasi sah Capsa Banting dari tertinggi ke terendah (Tanpa Two Pair)
  const comboRanking = [
    royalFlush,
    straightFlush,
    fourOfAKind,
    fullHouse,
    flush,
    straight,
    threeOfAKind,
    onePair,
    highCard,
  ];

  // HANYA tampilkan kombinasi yang benar-benar dimiliki pemain (hasInHand === true)
  const detectedList = comboRanking.filter((c) => c.hasInHand);

  return {
    detectedList,
    royal_flush: royalFlush,
    straight_flush: straightFlush,
    four_of_a_kind: fourOfAKind,
    full_house: fullHouse,
    flush: flush,
    straight: straight,
    three_of_a_kind: threeOfAKind,
    two_pair: { key: 'two_pair', label: 'Two Pair', rankOrder: 0, hasInHand: false, isValidToPlay: false, moves: [] },
    one_pair: onePair,
    high_card: highCard,
    // Alias untuk kompatibilitas ke belakang
    pair: onePair,
    single: highCard,
  };
};

// FILE: server/src/poker/handEvaluator.js
import { getCardPower, getRankPower, sortCapsaCards } from './deck.js';

export const FIVE_CARD_CATEGORY_NAMES = Object.freeze({
  1: 'Straight (Seri)',
  2: 'Flush (Warna)',
  3: 'Full House (Polo)',
  4: 'Four of a Kind (Bom)',
  5: 'Straight Flush',
});

const hasDuplicateCodes = (cards) => {
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c.code)) return true;
    seen.add(c.code);
  }
  return false;
};

const getStraightDetails = (fiveCards) => {
  const numericRanks = [...new Set(fiveCards.map((c) => Number(c.rank)))].sort((a, b) => a - b);
  if (numericRanks.length !== 5) return null;

  // Urutan standar berurutan: 2-3-4-5-6 s/d 10-J-Q-K-A
  if (numericRanks[4] - numericRanks[0] === 4) {
    const highCard = fiveCards.reduce(
      (best, cur) => (getCardPower(cur) > getCardPower(best) ? cur : best),
      fiveCards[0]
    );
    return {
      isStraight: true,
      power: getCardPower(highCard),
      subOrder: numericRanks[4],
    };
  }

  // Wheel straight: A-2-3-4-5 ([2, 3, 4, 5, 14])
  if (
    numericRanks[0] === 2 &&
    numericRanks[1] === 3 &&
    numericRanks[2] === 4 &&
    numericRanks[3] === 5 &&
    numericRanks[4] === 14
  ) {
    const highCard = fiveCards.reduce(
      (best, cur) => (getCardPower(cur) > getCardPower(best) ? cur : best),
      fiveCards[0]
    );
    return {
      isStraight: true,
      power: getCardPower(highCard),
      subOrder: 5,
    };
  }

  return null;
};

const classifyFiveCards = (fiveCards) => {
  const sortedCapsa = sortCapsaCards(fiveCards, 'rank');
  const isFlush = new Set(fiveCards.map((c) => c.suit)).size === 1;
  const straight = getStraightDetails(fiveCards);

  const countMap = new Map();
  for (const card of fiveCards) {
    countMap.set(card.rank, (countMap.get(card.rank) || 0) + 1);
  }
  const groups = [...countMap.entries()]
    .map(([rank, count]) => ({ rank, count, rankPower: getRankPower(rank) }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.rankPower - a.rankPower));

  // 5. Straight Flush / Royal Flush (Bom Utama)
  if (isFlush && straight) {
    const isRoyal = fiveCards.every((c) => [10, 11, 12, 13, 14].includes(c.rank));
    return {
      type: 'five_card',
      count: 5,
      comboCategory: 5,
      label: isRoyal ? 'Royal Flush (Bom)' : 'Straight Flush (Bom)',
      power: straight.power,
      tiebreakers: [straight.power, straight.subOrder],
      isBomb: true,
      cards: sortedCapsa,
    };
  }

  // 4. Four of a Kind + 1 Kicker (Bom / Piting)
  if (groups[0].count === 4) {
    return {
      type: 'five_card',
      count: 5,
      comboCategory: 4,
      label: FIVE_CARD_CATEGORY_NAMES[4],
      power: groups[0].rankPower,
      tiebreakers: [groups[0].rankPower, groups[1].rankPower],
      isBomb: true,
      cards: sortedCapsa,
    };
  }

  // 3. Full House / Polo (3 kartu kembar + 2 kartu kembar)
  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      type: 'five_card',
      count: 5,
      comboCategory: 3,
      label: FIVE_CARD_CATEGORY_NAMES[3],
      power: groups[0].rankPower,
      tiebreakers: [groups[0].rankPower, groups[1].rankPower],
      isBomb: false,
      cards: sortedCapsa,
    };
  }

  // 2. Flush / Warna (5 kartu suit sama)
  if (isFlush) {
    const descPowers = [...sortedCapsa].reverse().map((c) => getCardPower(c));
    return {
      type: 'five_card',
      count: 5,
      comboCategory: 2,
      label: FIVE_CARD_CATEGORY_NAMES[2],
      power: descPowers[0],
      tiebreakers: descPowers,
      isBomb: false,
      cards: sortedCapsa,
    };
  }

  // 1. Straight / Seri
  if (straight) {
    return {
      type: 'five_card',
      count: 5,
      comboCategory: 1,
      label: FIVE_CARD_CATEGORY_NAMES[1],
      power: straight.power,
      tiebreakers: [straight.power, straight.subOrder],
      isBomb: false,
      cards: sortedCapsa,
    };
  }

  return null;
};

/**
 * Mengklasifikasikan 1, 2, 3, atau 5 kartu sesuai aturan Capsa Banting (Big 2).
 * Mengembalikan null bila susunan kartu tidak sah.
 */
export const classifyCapsaPlay = (cards) => {
  if (!Array.isArray(cards) || hasDuplicateCodes(cards)) return null;

  if (cards.length === 1) {
    const c = cards[0];
    const power = getCardPower(c);
    return {
      type: 'single',
      count: 1,
      comboCategory: 1,
      label: 'Single',
      power,
      tiebreakers: [power],
      isBomb: false,
      cards: [c],
    };
  }

  if (cards.length === 2) {
    if (cards[0].rank !== cards[1].rank) return null;
    const sorted = sortCapsaCards(cards, 'rank');
    const power = Math.max(getCardPower(sorted[0]), getCardPower(sorted[1]));
    return {
      type: 'pair',
      count: 2,
      comboCategory: 1,
      label: 'Pair (2 Kembar)',
      power,
      tiebreakers: [power],
      isBomb: false,
      cards: sorted,
    };
  }

  if (cards.length === 3) {
    if (cards[0].rank !== cards[1].rank || cards[1].rank !== cards[2].rank) return null;
    const sorted = sortCapsaCards(cards, 'rank');
    const power = getCardPower(sorted[2]);
    return {
      type: 'tris',
      count: 3,
      comboCategory: 1,
      label: 'Tris (3 Kembar)',
      power,
      tiebreakers: [power],
      isBomb: false,
      cards: sorted,
    };
  }

  if (cards.length === 5) {
    return classifyFiveCards(cards);
  }

  return null;
};

const compareTiebreakers = (ta, tb) => {
  const len = Math.max(ta.length, tb.length);
  for (let i = 0; i < len; i += 1) {
    const a = ta[i] ?? 0;
    const b = tb[i] ?? 0;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
};

/**
 * Memvalidasi apakah candidateCards sah dimainkan dan mengalahkan currentPlay (jika ada).
 */
export const canBeatPlay = (
  candidateCards,
  currentPlay = null,
  { mustIncludeThreeDiamond = false } = {}
) => {
  const candidate = classifyCapsaPlay(candidateCards);
  if (!candidate) return false;

  if (mustIncludeThreeDiamond) {
    const has3D = candidateCards.some((c) => c.rank === 3 && c.suit === 'D');
    if (!has3D) return false;
  }

  if (!currentPlay) return true;

  const target = currentPlay.classified || classifyCapsaPlay(currentPlay.cards || []);
  if (!target) return false;

  // Aturan Bom Big 2 Offline:
  // - Four of a Kind (4) & Straight Flush (5) dapat memotong Single 2
  // - Straight Flush (5) dapat memotong Pair 2
  if (candidate.isBomb && target.type !== 'five_card') {
    if (target.type === 'single' && target.cards[0].rank === 2) {
      return candidate.comboCategory >= 4;
    }
    if (target.type === 'pair' && target.cards[0].rank === 2) {
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

  return compareTiebreakers(candidate.tiebreakers, target.tiebreakers) > 0;
};

/**
 * Menghasilkan seluruh kombinasi sah dari kartu di tangan yang bisa dimainkan saat ini.
 */
export const findValidMoves = (
  handCards = [],
  currentPlay = null,
  { mustIncludeThreeDiamond = false } = {}
) => {
  const sorted = sortCapsaCards(handCards, 'rank');
  const results = [];
  const opts = { mustIncludeThreeDiamond };

  const targetType = currentPlay?.type || null;

  // 1. Single
  if (!targetType || targetType === 'single') {
    for (const c of sorted) {
      const move = [c];
      if (canBeatPlay(move, currentPlay, opts)) {
        results.push({ cards: move, classified: classifyCapsaPlay(move) });
      }
    }
  }

  // Kelompokkan berdasarkan rank untuk Pair & Tris cepat
  const byRank = new Map();
  for (const c of sorted) {
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank).push(c);
  }

  // 2. Pair
  if (!targetType || targetType === 'pair') {
    for (const group of byRank.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const move = [group[i], group[j]];
          if (canBeatPlay(move, currentPlay, opts)) {
            results.push({ cards: move, classified: classifyCapsaPlay(move) });
          }
        }
      }
    }
  }

  // 3. Tris
  if (!targetType || targetType === 'tris') {
    for (const group of byRank.values()) {
      if (group.length < 3) continue;
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          for (let k = j + 1; k < group.length; k += 1) {
            const move = [group[i], group[j], group[k]];
            if (canBeatPlay(move, currentPlay, opts)) {
              results.push({ cards: move, classified: classifyCapsaPlay(move) });
            }
          }
        }
      }
    }
  }

  // 4. 5-Kartu (dan Bom jika melawan 2)
  const needsFiveCardSearch =
    !targetType ||
    targetType === 'five_card' ||
    ((targetType === 'single' || targetType === 'pair') && currentPlay?.cards?.[0]?.rank === 2);

  if (needsFiveCardSearch && sorted.length >= 5) {
    const n = sorted.length;
    for (let a = 0; a < n - 4; a += 1) {
      for (let b = a + 1; b < n - 3; b += 1) {
        for (let c = b + 1; c < n - 2; c += 1) {
          for (let d = c + 1; d < n - 1; d += 1) {
            for (let e = d + 1; e < n; e += 1) {
              const move = [sorted[a], sorted[b], sorted[c], sorted[d], sorted[e]];
              if (canBeatPlay(move, currentPlay, opts)) {
                results.push({ cards: move, classified: classifyCapsaPlay(move) });
              }
            }
          }
        }
      }
    }
  }

  // Urutkan dari yang paling ekonomis agar Hint & Bot cerdas
  results.sort((x, y) => {
    const cx = x.classified;
    const cy = y.classified;
    if (cx.isBomb !== cy.isBomb) return cx.isBomb ? 1 : -1;
    if (cx.comboCategory !== cy.comboCategory) return cx.comboCategory - cy.comboCategory;
    return cx.power - cy.power;
  });

  return results;
};

/**
 * Memilih langkah cerdas Bot AI gaya Big 2 Offline.
 */
export const chooseBotMove = (
  handCards = [],
  currentPlay = null,
  { mustIncludeThreeDiamond = false } = {}
) => {
  const valid = findValidMoves(handCards, currentPlay, { mustIncludeThreeDiamond });
  if (valid.length === 0) return null;

  // Saat memimpin meja kosong: prioritaskan habiskan kombinasi 5-kartu/Tris/Pair non-bom dahulu jika ada
  if (!currentPlay) {
    const fiveCard = valid.find((m) => m.classified.type === 'five_card' && !m.classified.isBomb);
    if (fiveCard) return fiveCard;
    const tris = valid.find((m) => m.classified.type === 'tris');
    if (tris) return tris;
    const pair = valid.find((m) => m.classified.type === 'pair');
    if (pair) return pair;
  }

  return valid[0];
};

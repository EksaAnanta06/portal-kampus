// FILE: server/src/poker/handEvaluator.js

export const HAND_CATEGORY_NAMES = Object.freeze({
  1: 'High Card',
  2: 'One Pair',
  3: 'Two Pair',
  4: 'Three of a Kind',
  5: 'Straight',
  6: 'Flush',
  7: 'Full House',
  8: 'Four of a Kind',
  9: 'Straight Flush',
});

const getStraightInfo = (sortedCardsDesc) => {
  const uniqueRanks = [];
  const seen = new Set();
  for (const c of sortedCardsDesc) {
    if (!seen.has(c.rank)) {
      seen.add(c.rank);
      uniqueRanks.push(c.rank);
    }
  }
  if (uniqueRanks.length !== 5) return null;

  if (uniqueRanks[0] - uniqueRanks[4] === 4) {
    return {
      highRank: uniqueRanks[0],
      orderedCards: sortedCardsDesc,
    };
  }

  // Wheel straight: A-2-3-4-5 (Ace dihitung sebagai 1 di bawah 2)
  if (
    uniqueRanks[0] === 14 &&
    uniqueRanks[1] === 5 &&
    uniqueRanks[2] === 4 &&
    uniqueRanks[3] === 3 &&
    uniqueRanks[4] === 2
  ) {
    const ace = sortedCardsDesc.find((c) => c.rank === 14);
    const rest = sortedCardsDesc.filter((c) => c.rank !== 14);
    return {
      highRank: 5,
      orderedCards: [...rest, ace],
    };
  }

  return null;
};

/**
 * Membandingkan dua hasil evaluasi tangan.
 * @returns {number} 1 jika a > b, -1 jika a < b, 0 jika seri (split pot)
 */
export const compareEvaluatedHands = (a, b) => {
  if (a.categoryRank !== b.categoryRank) {
    return a.categoryRank > b.categoryRank ? 1 : -1;
  }
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i += 1) {
    const va = a.tiebreakers[i] ?? 0;
    const vb = b.tiebreakers[i] ?? 0;
    if (va !== vb) {
      return va > vb ? 1 : -1;
    }
  }
  return 0;
};

/**
 * Mengevaluasi tepat 5 kartu poker standar.
 */
export const evaluateFiveCards = (fiveCards) => {
  if (!Array.isArray(fiveCards) || fiveCards.length !== 5) {
    throw new Error('evaluateFiveCards membutuhkan tepat 5 kartu.');
  }

  const sortedDesc = [...fiveCards].sort((a, b) => b.rank - a.rank);
  const isFlush = new Set(sortedDesc.map((c) => c.suit)).size === 1;
  const straight = getStraightInfo(sortedDesc);

  const countMap = new Map();
  for (const card of sortedDesc) {
    countMap.set(card.rank, (countMap.get(card.rank) || 0) + 1);
  }
  const groups = [...countMap.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.rank - a.rank));

  // 9. Straight Flush & Royal Flush
  if (isFlush && straight) {
    const isRoyal = straight.highRank === 14;
    return {
      categoryRank: 9,
      categoryName: isRoyal ? 'Royal Flush' : HAND_CATEGORY_NAMES[9],
      isRoyal,
      tiebreakers: [straight.highRank],
      bestFive: straight.orderedCards,
    };
  }

  // 8. Four of a Kind
  if (groups[0].count === 4) {
    return {
      categoryRank: 8,
      categoryName: HAND_CATEGORY_NAMES[8],
      isRoyal: false,
      tiebreakers: [groups[0].rank, groups[1].rank],
      bestFive: sortedDesc,
    };
  }

  // 7. Full House
  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      categoryRank: 7,
      categoryName: HAND_CATEGORY_NAMES[7],
      isRoyal: false,
      tiebreakers: [groups[0].rank, groups[1].rank],
      bestFive: sortedDesc,
    };
  }

  // 6. Flush
  if (isFlush) {
    return {
      categoryRank: 6,
      categoryName: HAND_CATEGORY_NAMES[6],
      isRoyal: false,
      tiebreakers: sortedDesc.map((c) => c.rank),
      bestFive: sortedDesc,
    };
  }

  // 5. Straight (termasuk A-2-3-4-5)
  if (straight) {
    return {
      categoryRank: 5,
      categoryName: HAND_CATEGORY_NAMES[5],
      isRoyal: false,
      tiebreakers: [straight.highRank],
      bestFive: straight.orderedCards,
    };
  }

  // 4. Three of a Kind
  if (groups[0].count === 3) {
    return {
      categoryRank: 4,
      categoryName: HAND_CATEGORY_NAMES[4],
      isRoyal: false,
      tiebreakers: [groups[0].rank, groups[1].rank, groups[2].rank],
      bestFive: sortedDesc,
    };
  }

  // 3. Two Pair
  if (groups[0].count === 2 && groups[1].count === 2) {
    return {
      categoryRank: 3,
      categoryName: HAND_CATEGORY_NAMES[3],
      isRoyal: false,
      tiebreakers: [groups[0].rank, groups[1].rank, groups[2].rank],
      bestFive: sortedDesc,
    };
  }

  // 2. One Pair
  if (groups[0].count === 2) {
    return {
      categoryRank: 2,
      categoryName: HAND_CATEGORY_NAMES[2],
      isRoyal: false,
      tiebreakers: [groups[0].rank, groups[1].rank, groups[2].rank, groups[3].rank],
      bestFive: sortedDesc,
    };
  }

  // 1. High Card
  return {
    categoryRank: 1,
    categoryName: HAND_CATEGORY_NAMES[1],
    isRoyal: false,
    tiebreakers: sortedDesc.map((c) => c.rank),
    bestFive: sortedDesc,
  };
};

/**
 * Mencari kombinasi 5 kartu terbaik dari 5 s/d 7 kartu (Texas Hold'em: 2 hole + 5 community).
 */
export const evaluateSevenCards = (cards) => {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) {
    throw new Error('evaluateSevenCards membutuhkan 5 sampai 7 kartu.');
  }

  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }

  const n = cards.length;
  let best = null;
  for (let a = 0; a < n - 4; a += 1) {
    for (let b = a + 1; b < n - 3; b += 1) {
      for (let c = b + 1; c < n - 2; c += 1) {
        for (let d = c + 1; d < n - 1; d += 1) {
          for (let e = d + 1; e < n; e += 1) {
            const candidate = evaluateFiveCards([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareEvaluatedHands(candidate, best) > 0) {
              best = candidate;
            }
          }
        }
      }
    }
  }
  return best;
};

// FILE: server/src/poker/potCalculator.js
import { compareEvaluatedHands } from './handEvaluator.js';

/**
 * Menghitung main pot dan seluruh side pot berdasarkan total kontribusi tiap kursi di satu tangan.
 * @param {Array<{ seatIndex: number, userId: number, amount: number, folded: boolean }>} contributions
 * @returns {Array<{ potIndex: number, amount: number, eligibleSeats: number[] }>}
 */
export const calculateSidePots = (contributions = []) => {
  const normalized = contributions
    .map((c) => ({
      seatIndex: c.seatIndex,
      userId: c.userId,
      amount: Math.max(0, Math.floor(Number(c.amount) || 0)),
      folded: Boolean(c.folded),
    }))
    .filter((c) => c.amount > 0);

  if (normalized.length === 0) return [];

  const levels = [...new Set(normalized.map((c) => c.amount))].sort((a, b) => a - b);
  const rawSlices = [];
  let prevLevel = 0;

  for (const level of levels) {
    const delta = level - prevLevel;
    if (delta <= 0) continue;

    let sliceAmount = 0;
    const eligibleSeats = [];
    for (const c of normalized) {
      if (c.amount >= level) {
        sliceAmount += delta;
        if (!c.folded) {
          eligibleSeats.push(c.seatIndex);
        }
      }
    }

    eligibleSeats.sort((a, b) => a - b);
    rawSlices.push({ amount: sliceAmount, eligibleSeats });
    prevLevel = level;
  }

  // Gabungkan lapisan pot bersebelahan bila daftar pemain yang berhak identik
  const merged = [];
  for (const slice of rawSlices) {
    if (slice.amount <= 0) continue;
    const prev = merged[merged.length - 1];
    const sameEligible =
      prev &&
      prev.eligibleSeats.length === slice.eligibleSeats.length &&
      prev.eligibleSeats.every((s, idx) => s === slice.eligibleSeats[idx]);

    if (sameEligible) {
      prev.amount += slice.amount;
    } else {
      merged.push({
        potIndex: merged.length,
        amount: slice.amount,
        eligibleSeats: slice.eligibleSeats,
      });
    }
  }

  return merged.map((pot, idx) => ({ ...pot, potIndex: idx }));
};

/**
 * Membagikan setiap lapisan pot (main & side pot) ke pemenang yang berhak.
 * Jika terjadi seri (split pot), chip sisa (odd chip) dibagi satu per satu searah jarum jam
 * mulai dari kursi pertama di sebelah kiri tombol dealer.
 */
export const distributePots = ({ pots = [], evaluatedBySeat = new Map(), dealerSeat = 0, maxSeats = 4 }) => {
  const payoutsBySeat = new Map();
  const potBreakdowns = [];

  const clockwiseDistFromLeftOfDealer = (seatIdx) =>
    (seatIdx - dealerSeat - 1 + maxSeats * 4) % maxSeats;

  for (const pot of pots) {
    if (pot.amount <= 0 || !pot.eligibleSeats || pot.eligibleSeats.length === 0) {
      continue;
    }

    let winners = [];
    if (pot.eligibleSeats.length === 1) {
      winners = [pot.eligibleSeats[0]];
    } else {
      let bestEval = null;
      for (const seatIdx of pot.eligibleSeats) {
        const evalHand = evaluatedBySeat.get(seatIdx);
        if (!evalHand) continue;
        if (!bestEval) {
          bestEval = evalHand;
          winners = [seatIdx];
        } else {
          const cmp = compareEvaluatedHands(evalHand, bestEval);
          if (cmp > 0) {
            bestEval = evalHand;
            winners = [seatIdx];
          } else if (cmp === 0) {
            winners.push(seatIdx);
          }
        }
      }
    }

    if (winners.length === 0) {
      winners = [pot.eligibleSeats[0]];
    }

    const sortedWinners = [...winners].sort(
      (a, b) => clockwiseDistFromLeftOfDealer(a) - clockwiseDistFromLeftOfDealer(b)
    );

    const baseShare = Math.floor(pot.amount / sortedWinners.length);
    let oddChips = pot.amount % sortedWinners.length;

    const payouts = {};
    for (const seatIdx of sortedWinners) {
      const bonus = oddChips > 0 ? 1 : 0;
      if (oddChips > 0) oddChips -= 1;
      const totalForSeat = baseShare + bonus;
      payouts[seatIdx] = totalForSeat;
      payoutsBySeat.set(seatIdx, (payoutsBySeat.get(seatIdx) || 0) + totalForSeat);
    }

    potBreakdowns.push({
      potIndex: pot.potIndex,
      amount: pot.amount,
      eligibleSeats: [...pot.eligibleSeats],
      winnerSeats: sortedWinners,
      payouts,
    });
  }

  return {
    payoutsBySeat,
    potBreakdowns,
  };
};

// FILE: server/src/poker/potCalculator.js

/**
 * Menghitung pengali penalti gaya Big 2 Offline berdasarkan jumlah kartu tersisa di tangan pemain kalah:
 * - 1 s/d 7 kartu  -> 1x tarif per kartu tersisa
 * - 8 s/d 10 kartu -> 2x
 * - 11 s/d 12 kartu -> 3x
 * - 13 kartu (Congkak / tidak sempat turun) -> 4x
 * Tambahan: setiap kartu angka '2' yang tersisa di tangan menggandakan penalti (+1x per kartu 2).
 */
export const computeCapsaCardMultiplier = (remainingCards = []) => {
  const count = Array.isArray(remainingCards) ? remainingCards.length : Math.max(0, Number(remainingCards) || 0);
  if (count <= 0) return 0;

  let mult = 1;
  if (count >= 13) mult = 4;
  else if (count >= 11) mult = 3;
  else if (count >= 8) mult = 2;

  const unplayedTwos = Array.isArray(remainingCards)
    ? remainingCards.filter((c) => Number(c.rank) === 2).length
    : 0;

  return mult + unplayedTwos;
};

/**
 * Menghitung penyelesaian chip virtual di akhir satu ronde Capsa Banting.
 */
export const calculateCapsaRoundSettlement = ({
  seats = [],
  winnerSeatIndex,
  baseStake = 10,
}) => {
  const stake = Math.max(1, Number(baseStake) || 10);
  const penalties = [];
  let totalWon = 0;

  for (const s of seats) {
    if (!s.inHand || s.seatIndex === winnerSeatIndex || s.eliminated) continue;
    const cardsLeft = s.holeCards || [];
    const remainingCount = cardsLeft.length;
    const multiplier = computeCapsaCardMultiplier(cardsLeft);
    const rawPenalty = remainingCount * stake * Math.max(1, multiplier);
    const actualPaid = Math.min(Math.max(0, Number(s.chips) || 0), rawPenalty);

    totalWon += actualPaid;
    penalties.push({
      seatIndex: s.seatIndex,
      userId: s.userId,
      fullName: s.fullName,
      remainingCount,
      multiplier,
      penaltyAmount: actualPaid,
      remainingCards: cardsLeft,
    });
  }

  return {
    winnerSeatIndex,
    baseStake: stake,
    totalWon,
    penalties,
  };
};

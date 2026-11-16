// FILE: server/src/poker/deck.js
import crypto from 'node:crypto';

export const SUITS = Object.freeze(['D', 'C', 'H', 'S']); //Urutan Capsa Banting: Wajik < Keriting < Hati < Sekop
export const RANKS = Object.freeze([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2]);
export const CAPSA_RANK_ORDER = RANKS;
export const CAPSA_SUIT_ORDER = SUITS;
export const ROOM_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const RANK_POWER_MAP = Object.freeze({
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

const SUIT_POWER_MAP = Object.freeze({
  D: 0, // ♦ Wajik
  C: 1, // ♣ Keriting
  H: 2, // ♥ Hati
  S: 3, // ♠ Sekop
});

const RANK_LABELS = Object.freeze({
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
});

const LABEL_TO_RANK = Object.freeze({
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
});

export const defaultRandomInt = (max) => {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`Nilai batas randomInt tidak valid: ${max}`);
  }
  return crypto.randomInt(0, max);
};

export const rankToLabel = (rank) => RANK_LABELS[rank] || String(rank);

export const getRankPower = (rank) => {
  const val = RANK_POWER_MAP[Number(rank)];
  if (val === undefined) throw new Error(`Rank tidak dikenal: ${rank}`);
  return val;
};

export const getSuitPower = (suit) => {
  const val = SUIT_POWER_MAP[String(suit).toUpperCase()];
  if (val === undefined) throw new Error(`Suit tidak dikenal: ${suit}`);
  return val;
};

/**
 * Kekuatan absolut 1 kartu di Capsa Banting (0 = 3♦ terendah, 51 = 2♠ tertinggi).
 */
export const getCardPower = (card) =>
  getRankPower(card.rank) * 4 + getSuitPower(card.suit);

export const compareSingleCards = (a, b) => {
  const pa = getCardPower(a);
  const pb = getCardPower(b);
  if (pa === pb) return 0;
  return pa > pb ? 1 : -1;
};

export const sortCapsaCards = (cards = [], mode = 'rank') => {
  const copy = [...cards];
  if (mode === 'suit') {
    return copy.sort((a, b) => {
      const sa = getSuitPower(a.suit);
      const sb = getSuitPower(b.suit);
      if (sa !== sb) return sa - sb;
      return getRankPower(a.rank) - getRankPower(b.rank);
    });
  }
  return copy.sort((a, b) => getCardPower(a) - getCardPower(b));
};

export const makeCard = (rank, suit) => {
  const r = Number(rank);
  const s = String(suit).toUpperCase();
  if (RANK_POWER_MAP[r] === undefined || SUIT_POWER_MAP[s] === undefined) {
    throw new Error(`Kartu tidak valid: rank=${rank}, suit=${suit}`);
  }
  return Object.freeze({
    rank: r,
    suit: s,
    code: `${rankToLabel(r)}${s}`,
  });
};

export const cardFromCode = (code) => {
  const raw = String(code || '').trim().toUpperCase();
  if (raw.length < 2) {
    throw new Error(`Kode kartu tidak valid: ${code}`);
  }
  const suit = raw.slice(-1);
  const rankPart = raw.slice(0, -1);
  const rank = LABEL_TO_RANK[rankPart];
  if (!rank || SUIT_POWER_MAP[suit] === undefined) {
    throw new Error(`Kode kartu tidak dikenali: ${code}`);
  }
  return makeCard(rank, suit);
};

export const createOrderedDeck = () => {
  const deck = [];
  for (const rank of CAPSA_RANK_ORDER) {
    for (const suit of CAPSA_SUIT_ORDER) {
      deck.push(makeCard(rank, suit));
    }
  }
  return deck;
};

export const createShuffledDeck = (randomInt = defaultRandomInt) => {
  const deck = createOrderedDeck();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
};

export const generateRoomId = (randomInt = defaultRandomInt, length = 6) => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
  }
  return out;
};

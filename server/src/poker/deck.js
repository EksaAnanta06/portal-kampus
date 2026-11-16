// FILE: server/src/poker/deck.js
import crypto from 'node:crypto';

export const SUITS = Object.freeze(['S', 'H', 'D', 'C']);
export const RANKS = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
export const ROOM_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

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

/**
 * RNG kriptografis default menggunakan crypto.randomInt(0, max).
 * Dipisahkan agar test dapat menginjeksikan RNG deterministik.
 */
export const defaultRandomInt = (max) => {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`Nilai batas randomInt tidak valid: ${max}`);
  }
  return crypto.randomInt(0, max);
};

export const rankToLabel = (rank) => RANK_LABELS[rank] || String(rank);

export const makeCard = (rank, suit) => {
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) {
    throw new Error(`Kartu tidak valid: rank=${rank}, suit=${suit}`);
  }
  return Object.freeze({
    rank,
    suit,
    code: `${rankToLabel(rank)}${suit}`,
  });
};

/**
 * Membantu pembuatan kartu dari kode ringkas seperti "AS", "10H", "TH", "KD".
 */
export const cardFromCode = (code) => {
  const raw = String(code || '').trim().toUpperCase();
  if (raw.length < 2) {
    throw new Error(`Kode kartu tidak valid: ${code}`);
  }
  const suit = raw.slice(-1);
  const rankPart = raw.slice(0, -1);
  const rank = LABEL_TO_RANK[rankPart];
  if (!rank || !SUITS.includes(suit)) {
    throw new Error(`Kode kartu tidak dikenali: ${code}`);
  }
  return makeCard(rank, suit);
};

export const createOrderedDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(rank, suit));
    }
  }
  return deck;
};

/**
 * Mengocok 52 kartu standar menggunakan Fisher-Yates dengan RNG terinjeksi (default: crypto.randomInt).
 */
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

/**
 * Membuat ID room 6 karakter acak tanpa karakter membingungkan (0/O/1/I/L).
 */
export const generateRoomId = (randomInt = defaultRandomInt, length = 6) => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
  }
  return out;
};

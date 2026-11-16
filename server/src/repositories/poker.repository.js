// FILE: server/src/repositories/poker.repository.js
import { pool, ensurePokerSchema } from '../config/db.js';

const toMysqlUtcDatetime = (ms) =>
  new Date(ms || Date.now()).toISOString().slice(0, 19).replace('T', ' ');

/**
 * Mencatat ringkasan akhir satu room permainan (tanpa data kartu detail atau nilai chip dibawa pulang).
 */
export const saveGameHistory = async (
  { roomId, startedAtMs, endedAtMs, players, winnerUserId, totalHands },
  db = pool
) => {
  if (!totalHands || totalHands < 1) return null;
  if (db === pool) await ensurePokerSchema();

  const summaryPlayers = (players || []).map((p) => ({
    userId: p.userId,
    fullName: p.fullName,
    eliminated: Boolean(p.eliminated),
  }));

  const [res] = await db.query(
    `INSERT INTO poker_riwayat (room_id, mulai_at, selesai_at, pemain, pemenang_user_id, jumlah_tangan)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(roomId).toUpperCase().slice(0, 6),
      toMysqlUtcDatetime(startedAtMs || endedAtMs),
      toMysqlUtcDatetime(endedAtMs || Date.now()),
      JSON.stringify(summaryPlayers),
      winnerUserId || null,
      Math.max(1, Number(totalHands) || 1),
    ]
  );
  return res.insertId || null;
};

/**
 * Mengambil statistik ringan ("main berapa kali & menang berapa kali") untuk seorang pengguna.
 */
export const getUserPokerStats = async (userId, db = pool) => {
  if (db === pool) await ensurePokerSchema();
  const uid = Number(userId);

  const [rows] = await db.query(
    `SELECT id, room_id, mulai_at, selesai_at, pemain, pemenang_user_id, jumlah_tangan
     FROM poker_riwayat
     WHERE JSON_CONTAINS(pemain, JSON_OBJECT('userId', ?), '$')
     ORDER BY selesai_at DESC
     LIMIT 30`,
    [uid]
  );

  let totalPlayed = 0;
  let totalWins = 0;
  try {
    const [countRows] = await db.query(
      `SELECT
          COUNT(*) AS total_played,
          SUM(CASE WHEN pemenang_user_id = ? THEN 1 ELSE 0 END) AS total_wins
       FROM poker_riwayat
       WHERE JSON_CONTAINS(pemain, JSON_OBJECT('userId', ?), '$')`,
      [uid, uid]
    );
    totalPlayed = Number(countRows[0]?.total_played || 0);
    totalWins = Number(countRows[0]?.total_wins || 0);
  } catch {
    totalPlayed = rows.length;
    totalWins = rows.filter((r) => Number(r.pemenang_user_id) === uid).length;
  }

  const recentMatches = rows.slice(0, 8).map((r) => {
    let parsedPlayers = [];
    try {
      parsedPlayers = typeof r.pemain === 'string' ? JSON.parse(r.pemain) : r.pemain || [];
    } catch {
      parsedPlayers = [];
    }
    return {
      id: r.id,
      room_id: r.room_id,
      mulai_at: r.mulai_at,
      selesai_at: r.selesai_at,
      jumlah_tangan: Number(r.jumlah_tangan || 0),
      is_winner: Number(r.pemenang_user_id) === uid,
      player_count: Array.isArray(parsedPlayers) ? parsedPlayers.length : 0,
    };
  });

  return {
    total_played: totalPlayed,
    total_wins: totalWins,
    recent_matches: recentMatches,
  };
};

/**
 * Menyimpan laporan perilaku pemain di meja poker dan memberi notifikasi ke staff admin/moderator.
 */
export const createPokerReport = async (
  { roomId, reporterId, reporterName, reportedUserId, reason, description },
  db = pool
) => {
  if (db === pool) await ensurePokerSchema();

  const [res] = await db.query(
    `INSERT INTO poker_laporan (room_id, reporter_id, reported_user_id, reason, description)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(roomId).toUpperCase().slice(0, 6),
      Number(reporterId),
      Number(reportedUserId),
      reason,
      description ? String(description).slice(0, 500) : null,
    ]
  );

  // Kirim notifikasi ke seluruh admin & moderator aktif memakai sistem notifications yang ada
  const [staffRows] = await db.query(
    `SELECT id FROM users WHERE role IN ('admin', 'moderator') AND status = 'active'`
  );
  if (staffRows.length > 0) {
    const title = `Laporan Pemain Poker (Room ${String(roomId).toUpperCase()})`;
    const msg = `${reporterName || 'Pengguna'} melaporkan pemain #${reportedUserId} atas alasan "${reason}".`;
    for (const staff of staffRows) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_link)
         VALUES (?, 'system', ?, ?, ?)`,
        [staff.id, title, msg.slice(0, 300), '/poker']
      );
    }
  }

  return res.insertId;
};

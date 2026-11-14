// FILE: server/src/queries/auth.queries.js
import { pool } from '../config/db.js';

export const findUserByEmailOrNim = async (identifier) => {
  const [rows] = await pool.execute(
    'SELECT id, nim, full_name, email, password_hash, role, status, prodi, angkatan_year FROM users WHERE email = ? OR nim = ? LIMIT 1',
    [identifier, identifier]
  );
  return rows[0] || null;
};

export const findUserById = async (id, db = pool) => {
  const [rows] = await db.execute(
    `SELECT id, nim, full_name, email, role, status, prodi, angkatan_year,
            avatar_url, bio, current_job, linkedin_url, instagram_url, github_url,
            is_public_profile, verified_at, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const findUserAuthById = async (id, db = pool) => {
  const [rows] = await db.execute(
    'SELECT id, nim, role, status, password_hash FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
};

export const ensureAngkatanExists = async (year, db = pool) => {
  if (!year) return;
  await db.execute(
    `INSERT IGNORE INTO angkatan (year, title, description)
     VALUES (?, CONCAT('Angkatan ', ?), CONCAT('Keluarga besar mahasiswa dan alumni UNAS PASIM Bandung Angkatan ', ?))`,
    [year, year, year]
  );
};

export const createUserRecord = async ({ nim, full_name, email, password_hash, role, prodi, angkatan_year }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureAngkatanExists(angkatan_year, connection);
    const [result] = await connection.execute(
      `INSERT INTO users (nim, full_name, email, password_hash, role, status, prodi, angkatan_year)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [nim, full_name, email, password_hash, role, prodi, angkatan_year]
    );
    await connection.commit();
    return result.insertId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const saveRefreshToken = async ({ userId, tokenHash, userAgent, ipAddress, expiresAt }, db = pool) => {
  await db.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, userAgent || null, ipAddress || null, expiresAt]
  );
};

export const findRefreshTokenByHash = async (tokenHash, db = pool) => {
  const [rows] = await db.execute(
    `SELECT id, user_id, token_hash, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
};

export const revokeRefreshTokenByHash = async (tokenHash, db = pool) => {
  await db.execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
    [tokenHash]
  );
};

export const revokeAllUserRefreshTokens = async (userId, db = pool) => {
  await db.execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );
};

export const createPasswordResetToken = async ({ userId, tokenHash, expiresAt }, db = pool) => {
  await db.execute(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
};

export const findValidPasswordReset = async (tokenHash, db = pool) => {
  const [rows] = await db.execute(
    `SELECT id, user_id, token_hash, expires_at, used_at
     FROM password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
};

export const markPasswordResetUsed = async (id, db = pool) => {
  await db.execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [id]);
};

export const updateUserPassword = async (userId, passwordHash, db = pool) => {
  await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  await revokeAllUserRefreshTokens(userId, db);
};

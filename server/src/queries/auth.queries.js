// FILE: server/src/queries/auth.queries.js
import { pool } from '../config/db.js';

export const findUserByEmailOrNim = async (identifier) => {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE email = ? OR nim = ? LIMIT 1',
    [identifier, identifier]
  );
  return rows[0] || null;
};

export const findUserById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT id, nim, full_name, email, role, status, prodi, angkatan_year,
            avatar_url, bio, current_job, linkedin_url, instagram_url, github_url,
            is_public_profile, verified_at, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const ensureAngkatanExists = async (year) => {
  if (!year) return;
  await pool.execute(
    `INSERT IGNORE INTO angkatan (year, title, description)
     VALUES (?, CONCAT('Angkatan ', ?), CONCAT('Keluarga besar mahasiswa dan alumni UNAS PASIM Bandung Angkatan ', ?))`,
    [year, year, year]
  );
};

export const createUserRecord = async ({ nim, full_name, email, password_hash, role, prodi, angkatan_year }) => {
  await ensureAngkatanExists(angkatan_year);
  const [result] = await pool.execute(
    `INSERT INTO users (nim, full_name, email, password_hash, role, status, prodi, angkatan_year)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [nim, full_name, email, password_hash, role, prodi, angkatan_year]
  );
  return result.insertId;
};

export const saveRefreshToken = async ({ userId, tokenHash, userAgent, ipAddress, expiresAt }) => {
  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, userAgent || null, ipAddress || null, expiresAt]
  );
};

export const findValidRefreshToken = async (tokenHash) => {
  const [rows] = await pool.execute(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
};

export const revokeRefreshTokenByHash = async (tokenHash) => {
  await pool.execute(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
    [tokenHash]
  );
};

export const createPasswordResetToken = async ({ userId, tokenHash, expiresAt }) => {
  await pool.execute(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
};

export const findValidPasswordReset = async (tokenHash) => {
  const [rows] = await pool.execute(
    `SELECT * FROM password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
};

export const markPasswordResetUsed = async (id) => {
  await pool.execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [id]);
};

export const updateUserPassword = async (userId, passwordHash) => {
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  await pool.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
};

import { pool } from '../config/db.js';

async function check() {
  try {
    const [users] = await pool.query('SELECT id, nim, email, role, status, password_hash FROM users');
    console.log(`\nBerhasil terhubung ke database. Ditemukan ${users.length} akun pengguna:`);
    console.table(users.map(u => ({
      ID: u.id,
      NIM: u.nim,
      Email: u.email,
      Role: u.role,
      Status: u.status,
      HashValid: u.password_hash.startsWith('$2b$10$hUL4') || u.password_hash.length === 60 ? 'YA (Valid)' : 'TIDAK (Perlu update)'
    })));
  } catch (error) {
    console.error('\nGagal terhubung ke database MySQL:', error.message);
  } finally {
    process.exit(0);
  }
}

check();

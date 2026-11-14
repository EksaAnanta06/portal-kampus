// FILE: server/src/utils/seedPasswords.js
// Utilitas opsional untuk menyamakan password seluruh user seed menjadi "Pasim123!"
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';

const run = async () => {
  try {
    const hash = await bcrypt.hash('Pasim123!', 10);
    const [result] = await pool.execute('UPDATE users SET password_hash = ?', [hash]);
    console.log(`Berhasil memperbarui password ${result.affectedRows} akun demo menjadi: Pasim123!`);
    process.exit(0);
  } catch (error) {
    console.error('Gagal memperbarui password seeder:', error.message);
    process.exit(1);
  }
};

run();

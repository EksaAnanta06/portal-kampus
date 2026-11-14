// FILE: server/src/server.js
import app from './app.js';
import { env } from './config/env.js';
import { testDbConnection, pool } from './config/db.js';
import { initCronJobs } from './utils/cronJobs.js';

const startServer = async () => {
  try {
    await testDbConnection();

    // Inisialisasi background tasks / cron jobs (pengingat deadline)
    initCronJobs();

    const server = app.listen(env.port, () => {
      console.log(`🚀 [SERVER] Portal Kampus UNAS PASIM berjalan di http://localhost:${env.port}/api/v1`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[${signal}] Menutup server dan koneksi database...`);
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ [FATAL] Gagal menjalankan server:', error.message);
    process.exit(1);
  }
};

startServer();

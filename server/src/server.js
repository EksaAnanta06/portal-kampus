// FILE: server/src/server.js
import app from './app.js';
import { env } from './config/env.js';
import { testDbConnection, pool } from './config/db.js';
import { initCronJobs, stopCronJobs } from './utils/cronJobs.js';
import { registerGracefulShutdown } from './utils/gracefulShutdown.js';

const startServer = async () => {
  try {
    await testDbConnection();

    // Inisialisasi background tasks / cron jobs (pembersihan token kadaluarsa)
    initCronJobs();

    const server = app.listen(env.port, () => {
      console.log(`🚀 [SERVER] Portal Kampus UNAS PASIM berjalan di http://localhost:${env.port}/api/v1`);
    });

    registerGracefulShutdown({
      server,
      stopBackgroundJobs: stopCronJobs,
      closeDatabase: () => pool.end(),
    });
  } catch (error) {
    console.error('❌ [FATAL] Gagal menjalankan server:', error.message);
    process.exit(1);
  }
};

startServer();

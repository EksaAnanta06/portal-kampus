// FILE: server/src/utils/gracefulShutdown.js

/**
 * Menutup pool/resource database dengan batas waktu agar shutdown tidak macet.
 */
const closeResourceWithTimeout = async (closeResource, timeoutMs, label) => {
  if (typeof closeResource !== 'function') return;

  let timer;
  try {
    const resourcePromise = Promise.resolve().then(() => closeResource());
    // Cegah unhandled rejection bila timeout menang lebih dulu lalu resource reject belakangan
    resourcePromise.catch(() => {});
    await Promise.race([
      resourcePromise,
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref?.();
      }),
    ]);
  } catch (err) {
    console.warn(`⚠️ [${label}] Gagal menutup resource saat shutdown:`, err.message);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Mendaftarkan handler SIGINT/SIGTERM agar HTTP server dan koneksi database tertutup cepat & aman.
 */
export const registerGracefulShutdown = ({
  server,
  stopBackgroundJobs,
  closeDatabase,
  forceTimeoutMs = 3000,
  dbTimeoutMs = 2000,
  exit = process.exit,
}) => {
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[${signal}] Menutup server dan koneksi database...`);

    // Batas waktu paksa agar socket keep-alive/tunnel atau request macet tidak menahan restart
    const forceExitTimer = setTimeout(async () => {
      console.warn('⚠️ [SERVER] Batas waktu penutupan tercapai, memutus sisa koneksi...');
      server.closeAllConnections?.();
      await closeResourceWithTimeout(closeDatabase, Math.min(dbTimeoutMs, 1000), 'DB');
      exit(0);
    }, forceTimeoutMs);
    forceExitTimer.unref?.();

    await closeResourceWithTimeout(stopBackgroundJobs, 1500, 'CRON');

    server.close(async (closeErr) => {
      clearTimeout(forceExitTimer);
      await closeResourceWithTimeout(closeDatabase, dbTimeoutMs, 'DB');
      if (closeErr) {
        console.error('❌ [SERVER] Error saat menutup HTTP server:', closeErr.message);
        exit(1);
        return;
      }
      exit(0);
    });

    // Tutup koneksi keep-alive yang menganggur segera tanpa memutus request aktif
    server.closeIdleConnections?.();
  };

  const onSigint = () => void shutdown('SIGINT');
  const onSigterm = () => void shutdown('SIGTERM');

  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);

  return {
    shutdown,
    cleanupListeners: () => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
    },
  };
};

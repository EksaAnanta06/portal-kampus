// FILE: server/src/app.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { generalLimiter } from './middlewares/rateLimiter.middleware.js';
import { sanitizeRequest } from './middlewares/validate.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';
import { buildAllowedOriginEntries, isOriginAllowed } from './utils/corsConfig.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, '../../client/dist');
const clientIndexHtml = path.join(clientDistDir, 'index.html');

const app = express();

if (env.security.trustProxy !== false) {
  app.set('trust proxy', env.security.trustProxy);
}

// Logger Aktivitas Pengunjung (Mendeteksi Real IP dari Cloudflare/Tunnel & Device)
app.use((req, res, next) => {
  const start = Date.now();
  const clientIp =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'Unknown IP';

  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  const deviceType = isMobile
    ? `📱 Mobile (${userAgent.includes('Android') ? 'Android' : userAgent.includes('iPhone') ? 'iPhone' : 'HP'})`
    : '💻 Desktop / PC';

  res.on('finish', () => {
    // Abaikan logging aset internal jika ada
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(
      `[${new Date().toLocaleTimeString('id-ID')}] ${statusColor}${req.method} ${req.originalUrl} (${res.statusCode})${reset} - IP: \x1b[36m${clientIp}\x1b[0m | ${deviceType} | ${duration}ms`
    );
  });
  next();
});

// 1. Keamanan HTTP Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.nodeEnv === 'production' ? undefined : false,
  })
);

// 2. CORS Whitelist Origin (mendukung wildcard & quick tunnel dev seperti trycloudflare.com)
const defaultDevOrigins =
  env.nodeEnv === 'development' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [];
const allowedOriginEntries = buildAllowedOriginEntries(env.clientUrl, defaultDevOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        isOriginAllowed(origin, {
          allowedEntries: allowedOriginEntries,
          allowDevTunnels: env.security.corsAllowTunnels,
        })
      ) {
        callback(null, true);
      } else {
        console.warn(
          `[CORS] Origin ditolak: ${origin}. Tambahkan ke CLIENT_URL atau aktifkan CORS_ALLOW_TUNNELS=true bila memakai tunnel sementara.`
        );
        callback(new Error(`Origin ${origin} tidak diizinkan oleh kebijakan CORS.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// 3. Rate Limiter, Body Parser, Cookie Parser, dan Sanitasi Input
app.use('/api', generalLimiter);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(sanitizeRequest);

// Health Check untuk Cloud Platform (Koyeb, Render, AWS, Docker)
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Portal Kampus UNAS PASIM API is running.',
    timestamp: new Date().toISOString(),
  });
});

// 4. Endpoint REST API Utama (/api/v1)
app.use('/api/v1', apiRoutes);

// 5. Penyajian Frontend SPA statis (client/dist) dengan no-cache untuk index.html agar update langsung aktif di Android WebView
app.use(
  express.static(clientDistDir, {
    index: false,
    setHeaders: (res, filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      if (
        normalized.endsWith('/index.html') ||
        normalized.endsWith('/sw.js') ||
        normalized.endsWith('/manifest.webmanifest')
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (normalized.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// SPA Fallback (hindari /api dan /socket.io agar tetap JSON 404; fallback JSON health di '/' jika dist belum ada mis. deploy backend-only Docker/Koyeb)
app.get('*', (req, res, next) => {
  if (
    req.path === '/api' ||
    req.path.startsWith('/api/') ||
    req.path.startsWith('/socket.io')
  ) {
    return next();
  }
  if (fs.existsSync(clientIndexHtml)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(clientIndexHtml);
  }
  if (req.path === '/') {
    return res.status(200).json({
      success: true,
      message: 'Portal Kampus UNAS PASIM API is running.',
      timestamp: new Date().toISOString(),
    });
  }
  return next();
});

// 6. Penanganan 404 & Error Terpusat
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

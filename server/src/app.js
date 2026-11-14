// FILE: server/src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { generalLimiter } from './middlewares/rateLimiter.middleware.js';
import { sanitizeRequest } from './middlewares/validate.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';
import apiRoutes from './routes/index.js';

const app = express();

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
  })
);

// 2. CORS Whitelist Origin dengan dukungan Cookie (credentials: true)
const allowedOrigins = env.clientUrl.split(',').map((url) => url.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.nodeEnv === 'development' || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
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

// 4. Endpoint REST API Utama (/api/v1)
app.use('/api/v1', apiRoutes);

// 5. Penanganan 404 & Error Terpusat
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

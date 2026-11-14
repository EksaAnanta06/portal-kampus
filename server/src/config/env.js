// FILE: server/src/config/env.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat .env dari folder server dan root sebagai fallback
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const requiredVars = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    console.warn(`[WARN] Environment variable ${key} belum diatur di file .env`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_portal_pasim',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_key_change_in_prod',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_key_change_in_prod',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    refreshCookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari dalam milidetik
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'portal-unas-pasim',
  },

  upload: {
    maxPhotoBytes: (Number(process.env.MAX_PHOTO_FILE_SIZE_MB) || 5) * 1024 * 1024,
    maxDocBytes:
      Number(process.env.MAX_FILE_SIZE_BYTES) ||
      (Number(process.env.MAX_DOC_FILE_SIZE_MB) || 10) * 1024 * 1024,
  },

  security: {
    trustProxy:
      process.env.TRUST_PROXY === 'false' || process.env.TRUST_PROXY === '0'
        ? false
        : Number(process.env.TRUST_PROXY) || 1,
    corsAllowTunnels:
      process.env.CORS_ALLOW_TUNNELS === 'true' ||
      (process.env.CORS_ALLOW_TUNNELS !== 'false' && process.env.NODE_ENV !== 'production'),
    allowDevResetTokenResponse:
      process.env.NODE_ENV !== 'production' &&
      process.env.ENABLE_DEV_RESET_TOKEN_RESPONSE === 'true',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Portal Kampus UNAS PASIM <no-reply@pasim.ac.id>',
  },
};

// FILE: server/src/services/googleAuth.service.js
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { buildAllowedOriginEntries, isOriginAllowed } from '../utils/corsConfig.js';
import { generateAccessToken, generateRefreshToken, hashToken } from '../utils/jwt.js';
import {
  findUserByEmailOrNim,
  findUserById,
  findUserByGoogleIdOrEmail,
  linkUserGoogleAccount,
  createGoogleUserRecord,
  saveRefreshToken,
} from '../queries/auth.queries.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 60 * 1000;
const REG_TTL_MS = 15 * 60 * 1000;
const MAX_STORE_SIZE = 2000;
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

const oauthStates = new Map();
const exchangeCodes = new Map();
const pendingRegistrations = new Map();

function pruneMap(store) {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (!val || val.expiresAt <= now) {
      store.delete(key);
    }
  }
  while (store.size > MAX_STORE_SIZE) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }
}

export function isGoogleOAuthConfigured() {
  return Boolean(env.google.clientId && env.google.clientSecret);
}

function getDefaultWebOrigin() {
  const entries = buildAllowedOriginEntries(env.clientUrl, ['http://localhost:5173']);
  const concreteEntries = entries.filter((entry) => !entry.includes('*'));
  const httpsEntry = concreteEntries.find((entry) => entry.startsWith('https://'));
  return httpsEntry || concreteEntries[0] || 'http://localhost:5173';
}

function resolveSafeWebOrigin(candidateOrigin) {
  const defaultDevOrigins =
    env.nodeEnv === 'development' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [];
  const allowedEntries = buildAllowedOriginEntries(env.clientUrl, defaultDevOrigins);

  if (typeof candidateOrigin === 'string') {
    const trimmed = candidateOrigin.trim().replace(/\/+$/, '');
    if (
      (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
      isOriginAllowed(trimmed, {
        allowedEntries,
        allowDevTunnels: env.security.corsAllowTunnels,
      })
    ) {
      return trimmed;
    }
  }

  return getDefaultWebOrigin();
}

export function sanitizeRedirectPath(rawPath) {
  if (typeof rawPath !== 'string') return '/';
  const trimmed = rawPath.trim();
  if (
    !trimmed ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /[\r\n]/.test(trimmed) ||
    trimmed.length > 300
  ) {
    return '/';
  }
  return trimmed;
}

function resolveCallbackUrl(req) {
  if (env.google.callbackUrl) {
    return env.google.callbackUrl;
  }
  const forwardedProto = req?.headers?.['x-forwarded-proto']?.split(',')[0]?.trim();
  const proto = forwardedProto || req?.protocol || 'https';
  const host = req?.get?.('host') || 'localhost:5000';
  return `${proto}://${host}/api/v1/auth/google/callback`;
}

function buildTargetUrl({ platform, origin, params }) {
  const base =
    platform === 'native' ? env.google.nativeCallbackUri : `${origin}/auth/google/callback`;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildGoogleAuthorizationUrl({ req, platform, origin, redirectPath }) {
  if (!isGoogleOAuthConfigured()) {
    throw new AppError('Fitur login Google belum dikonfigurasi pada server.', 503);
  }

  pruneMap(oauthStates);
  const state = crypto.randomBytes(24).toString('hex');
  const resolvedPlatform = platform === 'native' ? 'native' : 'web';
  const safeOrigin = resolveSafeWebOrigin(origin);
  const safeRedirect = sanitizeRedirectPath(redirectPath);
  const callbackUrl = resolveCallbackUrl(req);

  oauthStates.set(state, {
    platform: resolvedPlatform,
    origin: safeOrigin,
    redirectPath: safeRedirect,
    callbackUrl,
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  const authParams = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
}

export function decodeGoogleIdTokenPayload(idToken, expectedClientId) {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(decoded);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.aud !== expectedClientId) return null;
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      return null;
    }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now() - 60_000) {
      return null;
    }
    if (!payload.sub || !payload.email) return null;

    return {
      sub: String(payload.sub),
      email: String(payload.email),
      email_verified: payload.email_verified,
      name: typeof payload.name === 'string' ? payload.name : '',
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    };
  } catch {
    return null;
  }
}

async function exchangeAuthCodeWithGoogle({ code, redirectUri }) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    throw new AppError(`Gagal menukar kode otorisasi Google (${tokenRes.status}). ${errText}`, 401);
  }

  const tokenData = await tokenRes.json();
  if (!tokenData?.access_token && !tokenData?.id_token) {
    throw new AppError('Token akses Google tidak valid.', 401);
  }

  // id_token diterima langsung via TLS dari token endpoint resmi Google (OIDC Core §3.1.3.7)
  const idTokenProfile = decodeGoogleIdTokenPayload(tokenData.id_token, env.google.clientId);
  let userInfoProfile = null;

  if (tokenData?.access_token) {
    try {
      const userInfoRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
        },
      });

      if (userInfoRes.ok) {
        userInfoProfile = await userInfoRes.json();
      } else {
        const errSnippet = (await userInfoRes.text().catch(() => '')).slice(0, 300);
        console.error('[GoogleAuth] Userinfo endpoint gagal:', userInfoRes.status, errSnippet);
      }
    } catch (fetchErr) {
      console.error('[GoogleAuth] Gagal menghubungi userinfo endpoint:', fetchErr?.message || fetchErr);
    }
  }

  if (
    userInfoProfile?.sub &&
    idTokenProfile?.sub &&
    String(userInfoProfile.sub) !== String(idTokenProfile.sub)
  ) {
    throw new AppError('Identitas akun Google tidak konsisten.', 401);
  }

  const sub = userInfoProfile?.sub || idTokenProfile?.sub;
  const email = userInfoProfile?.email || idTokenProfile?.email;
  const emailVerified = userInfoProfile?.email_verified ?? idTokenProfile?.email_verified;
  const name = String(userInfoProfile?.name || idTokenProfile?.name || '').trim().slice(0, 120);
  const rawPicture = userInfoProfile?.picture || idTokenProfile?.picture || '';
  const picture =
    typeof rawPicture === 'string' && rawPicture.startsWith('https://')
      ? rawPicture.slice(0, 500)
      : null;

  if (!sub || !email) {
    throw new AppError('Gagal mengambil profil akun Google Anda.', 401);
  }
  if (emailVerified !== true && emailVerified !== 'true') {
    throw new AppError('Akun Google harus memiliki alamat email yang terverifikasi.', 400);
  }

  return {
    googleId: String(sub),
    email: String(email).trim().toLowerCase(),
    name,
    picture,
  };
}

export async function handleGoogleCallbackService({ code, state, error }) {
  pruneMap(oauthStates);
  const stateRecord = typeof state === 'string' ? oauthStates.get(state) : null;
  if (typeof state === 'string') {
    oauthStates.delete(state);
  }

  const fallbackOrigin = getDefaultWebOrigin();
  if (!stateRecord || stateRecord.expiresAt <= Date.now()) {
    return {
      platform: 'web',
      targetUrl: buildTargetUrl({
        platform: 'web',
        origin: fallbackOrigin,
        params: {
          status: 'error',
          message: 'Sesi otorisasi Google sudah kedaluwarsa atau tidak valid. Silakan coba lagi.',
        },
      }),
    };
  }

  const { platform, origin, redirectPath, callbackUrl } = stateRecord;

  if (error) {
    return {
      platform,
      targetUrl: buildTargetUrl({
        platform,
        origin,
        params: {
          status: 'error',
          message:
            error === 'access_denied'
              ? 'Login dengan Google dibatalkan.'
              : 'Autentikasi Google gagal diproses.',
        },
      }),
    };
  }

  if (!code || typeof code !== 'string') {
    return {
      platform,
      targetUrl: buildTargetUrl({
        platform,
        origin,
        params: {
          status: 'error',
          message: 'Kode otorisasi Google tidak ditemukan.',
        },
      }),
    };
  }

  try {
    const profile = await exchangeAuthCodeWithGoogle({ code, redirectUri: callbackUrl });
    const existingUser = await findUserByGoogleIdOrEmail(profile.googleId, profile.email);

    if (existingUser) {
      await linkUserGoogleAccount(existingUser.id, {
        googleId: profile.googleId,
        avatarUrl: profile.picture,
      });

      if (existingUser.status === 'pending') {
        return {
          platform,
          targetUrl: buildTargetUrl({
            platform,
            origin,
            params: {
              status: 'pending',
              message: 'Akun Anda sedang menunggu verifikasi NIM oleh Admin Kampus UNAS PASIM.',
            },
          }),
        };
      }

      if (existingUser.status !== 'active') {
        return {
          platform,
          targetUrl: buildTargetUrl({
            platform,
            origin,
            params: {
              status: 'error',
              message: `Akun Anda tidak dapat diakses (Status: ${existingUser.status}). Hubungi bagian kemahasiswaan.`,
            },
          }),
        };
      }

      pruneMap(exchangeCodes);
      const exchangeCode = crypto.randomBytes(24).toString('hex');
      exchangeCodes.set(exchangeCode, {
        userId: existingUser.id,
        redirectPath,
        expiresAt: Date.now() + EXCHANGE_TTL_MS,
      });

      return {
        platform,
        targetUrl: buildTargetUrl({
          platform,
          origin,
          params: {
            exchange: exchangeCode,
            redirect: redirectPath,
          },
        }),
      };
    }

    pruneMap(pendingRegistrations);
    const regToken = crypto.randomBytes(24).toString('hex');
    pendingRegistrations.set(regToken, {
      googleId: profile.googleId,
      email: profile.email,
      full_name: profile.name || profile.email.split('@')[0],
      avatar_url: profile.picture,
      expiresAt: Date.now() + REG_TTL_MS,
    });

    return {
      platform,
      targetUrl: buildTargetUrl({
        platform,
        origin,
        params: {
          status: 'needs_registration',
          reg_token: regToken,
          redirect: redirectPath,
        },
      }),
    };
  } catch (err) {
    console.error('[GoogleAuth] Callback gagal:', err?.message || err);
    return {
      platform,
      targetUrl: buildTargetUrl({
        platform,
        origin,
        params: {
          status: 'error',
          message: err?.message || 'Gagal memproses login Google.',
        },
      }),
    };
  }
}

export async function redeemGoogleExchangeCodeService({ code, userAgent, ipAddress }) {
  pruneMap(exchangeCodes);
  const record = typeof code === 'string' ? exchangeCodes.get(code) : null;
  if (typeof code === 'string') {
    exchangeCodes.delete(code);
  }

  if (!record || record.expiresAt <= Date.now()) {
    throw new AppError('Kode login Google sudah kedaluwarsa atau telah digunakan.', 400);
  }

  const user = await findUserById(record.userId);
  if (!user || user.status !== 'active') {
    throw new AppError('Akun pengguna tidak aktif atau belum terverifikasi.', 403);
  }

  const tokenPayload = { id: user.id, role: user.role, nim: user.nim };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  const expiresAt = new Date(Date.now() + env.jwt.refreshCookieMaxAge);

  await saveRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    userAgent,
    ipAddress,
    expiresAt,
  });

  return {
    user,
    accessToken,
    refreshToken,
    redirectPath: record.redirectPath || '/',
  };
}

export function getPendingGoogleRegistrationService(token) {
  pruneMap(pendingRegistrations);
  const record = typeof token === 'string' ? pendingRegistrations.get(token.trim()) : null;
  if (!record || record.expiresAt <= Date.now()) {
    throw new AppError('Sesi pendaftaran Google tidak ditemukan atau sudah kedaluwarsa.', 400);
  }
  return {
    email: record.email,
    full_name: record.full_name,
    avatar_url: record.avatar_url,
  };
}

export async function completeGoogleRegistrationService({
  token,
  nim,
  full_name,
  prodi,
  angkatan_year,
  role,
}) {
  pruneMap(pendingRegistrations);
  const trimmedToken = typeof token === 'string' ? token.trim() : '';
  const record = pendingRegistrations.get(trimmedToken);
  if (!record || record.expiresAt <= Date.now()) {
    throw new AppError(
      'Sesi pendaftaran Google sudah kedaluwarsa. Silakan ulangi masuk dengan Google.',
      400
    );
  }

  const existingByGoogleOrEmail = await findUserByGoogleIdOrEmail(record.googleId, record.email);
  if (existingByGoogleOrEmail) {
    pendingRegistrations.delete(trimmedToken);
    throw new AppError('Email atau akun Google ini sudah terdaftar. Silakan langsung masuk.', 409);
  }

  const existingByNim = await findUserByEmailOrNim(nim);
  if (existingByNim) {
    throw new AppError('NIM sudah terdaftar. Hubungi BAAK/Admin jika terjadi kesalahan.', 409);
  }

  const randomSecret = crypto.randomBytes(32).toString('hex');
  const password_hash = await bcrypt.hash(randomSecret, 10);

  const userId = await createGoogleUserRecord({
    nim,
    full_name: full_name || record.full_name,
    email: record.email,
    password_hash,
    role: role || 'mahasiswa',
    prodi,
    angkatan_year,
    google_id: record.googleId,
    avatar_url: record.avatar_url,
  });

  pendingRegistrations.delete(trimmedToken);
  return findUserById(userId);
}

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderNativeDeepLinkHtml(deepLinkUrl, nonce) {
  const escapedUrl = escapeHtmlAttr(deepLinkUrl);
  const serializedUrl = JSON.stringify(deepLinkUrl);
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="0;url=${escapedUrl}" />
    <title>Kembali ke Portal Pasim</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, sans-serif;
        background: #0f172a;
        color: #f8fafc;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 380px;
        background: #1e293b;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 20px;
        padding: 28px 24px;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 20px;
        font-weight: 800;
      }
      p {
        margin: 0 0 22px;
        font-size: 14px;
        line-height: 1.5;
        color: #cbd5e1;
      }
      a.btn {
        display: inline-block;
        padding: 12px 22px;
        border-radius: 12px;
        background: #8B1E24;
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Autentikasi Google Selesai</h1>
      <p>Mengalihkan kembali ke aplikasi Portal Pasim. Jika belum berpindah otomatis, tekan tombol di bawah ini.</p>
      <a class="btn" href="${escapedUrl}">Kembali ke Portal Pasim</a>
    </div>
    <script nonce="${escapeHtmlAttr(nonce)}">
      window.location.replace(${serializedUrl});
    </script>
  </body>
</html>`;
}

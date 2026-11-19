// FILE: server/src/utils/corsConfig.js

const DEV_TUNNEL_SUFFIXES = [
  '.trycloudflare.com',
  '.ngrok-free.app',
  '.ngrok-free.dev',
  '.ngrok.io',
  '.ngrok.app',
  '.loca.lt',
  '.devtunnels.ms',
  '.lhr.life',
  '.serveo.net',
];

const PRIVATE_IPV4_REGEX =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

const VALID_HOSTNAME_REGEX = /^[a-z0-9.-]+$/i;

const stripTrailingSlash = (value = '') => String(value).trim().replace(/\/+$/, '');

const parseUrlSafe = (value) => {
  try {
    const parsed = new URL(stripTrailingSlash(value));
    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'capacitor:'
    ) {
      return null;
    }
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
};

const matchesWildcardRule = (originUrl, pattern) => {
  const normalized = stripTrailingSlash(pattern);
  if (normalized === '*') return true;

  const wildcardMatch = normalized.match(/^(https?):\/\/\*\.([a-z0-9.-]+)(?::(\d+))?$/i);
  if (!wildcardMatch) return false;

  const [, ruleProto, baseDomain, rulePort = ''] = wildcardMatch;
  if (originUrl.protocol !== `${ruleProto.toLowerCase()}:`) return false;
  if (rulePort && originUrl.port !== rulePort) return false;
  if (!rulePort && originUrl.port !== '') return false;

  const host = originUrl.hostname.toLowerCase();
  const suffix = `.${baseDomain.toLowerCase()}`;
  return host.endsWith(suffix) && host.length > suffix.length && VALID_HOSTNAME_REGEX.test(host);
};

const isDevTunnelOrLocalOrigin = (originUrl) => {
  const host = originUrl.hostname.toLowerCase();

  // Localhost & loopback pada berbagai port dev/preview
  if ((host === 'localhost' || host === '127.0.0.1') && originUrl.protocol === 'http:') {
    return true;
  }

  // IP LAN lokal (akses uji coba dari HP di jaringan Wi-Fi yang sama)
  if (PRIVATE_IPV4_REGEX.test(host)) {
    return true;
  }

  // Layanan quick tunnel sementara (Cloudflare Tunnel, ngrok, devtunnels, localtunnel)
  if (originUrl.protocol === 'https:' && VALID_HOSTNAME_REGEX.test(host)) {
    return DEV_TUNNEL_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
  }

  return false;
};

export const buildAllowedOriginEntries = (clientUrl = '', defaultOrigins = []) =>
  Array.from(
    new Set([
      ...String(clientUrl || '')
        .split(',')
        .map(stripTrailingSlash)
        .filter(Boolean),
      ...defaultOrigins.map(stripTrailingSlash).filter(Boolean),
    ])
  );

const NATIVE_CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost'];

export const isOriginAllowed = (
  origin,
  { allowedEntries = [], allowDevTunnels = false } = {}
) => {
  if (!origin) return true;

  const originUrl = parseUrlSafe(origin);
  if (!originUrl) return false;

  const normalizedOrigin = originUrl.origin;

  // Origin klien native Capacitor Android & iOS diizinkan secara eksplisit
  if (NATIVE_CAPACITOR_ORIGINS.includes(normalizedOrigin)) {
    return true;
  }

  for (const entry of allowedEntries) {
    if (entry === normalizedOrigin) return true;
    if (entry.includes('*') && matchesWildcardRule(originUrl, entry)) return true;
  }

  if (allowDevTunnels && isDevTunnelOrLocalOrigin(originUrl)) {
    return true;
  }

  return false;
};

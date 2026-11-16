// FILE: server/src/utils/webPushClient.js
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { env } from '../config/env.js';

const toBase64Url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const fromBase64Url = (str) => {
  const padded = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
};

/**
 * Membuat pasangan VAPID keys P-256 (uncompressed 65-byte public key, 32-byte private key).
 */
export const generateVapidKeys = () => {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: toBase64Url(ecdh.getPublicKey()),
    privateKey: toBase64Url(ecdh.getPrivateKey()),
  };
};

let runtimeVapidKeys = null;
let loggedMissingVapidWarning = false;

export const getVapidConfig = () => {
  if (env.vapid.publicKey && env.vapid.privateKey) {
    return {
      publicKey: env.vapid.publicKey,
      privateKey: env.vapid.privateKey,
      subject: env.vapid.subject || 'mailto:admin@pasim.ac.id',
      isEphemeral: false,
    };
  }

  if (!runtimeVapidKeys) {
    runtimeVapidKeys = generateVapidKeys();
    if (!loggedMissingVapidWarning && env.nodeEnv !== 'test') {
      loggedMissingVapidWarning = true;
      console.warn(
        '[WEB PUSH] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY belum diatur di .env. Memakai kunci sementara di memori (akan berubah setelah restart).'
      );
    }
  }

  return {
    publicKey: runtimeVapidKeys.publicKey,
    privateKey: runtimeVapidKeys.privateKey,
    subject: env.vapid.subject || 'mailto:admin@pasim.ac.id',
    isEphemeral: true,
  };
};

/**
 * Membuat JWT VAPID (RFC 8292, ES256 / P-256) dari pasangan publicKey & privateKey base64url.
 */
export const createVapidAuthHeader = ({ endpoint, publicKey, privateKey, subject, ttlSeconds = 12 * 3600 }) => {
  const parsedUrl = new URL(endpoint);
  const audience = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;

  const headerB64 = toBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payloadB64 = toBase64Url(JSON.stringify({ aud: audience, exp, sub: subject }));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pubBytes = fromBase64Url(publicKey);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('Format VAPID public key tidak valid (harus uncompressed 65-byte P-256).');
  }

  const keyObject = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: toBase64Url(pubBytes.subarray(1, 33)),
      y: toBase64Url(pubBytes.subarray(33, 65)),
      d: privateKey,
    },
    format: 'jwk',
  });

  const signature = crypto.sign('sha256', Buffer.from(unsignedToken), {
    key: keyObject,
    dsaEncoding: 'ieee-p1363',
  });

  const jwt = `${unsignedToken}.${toBase64Url(signature)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
};

/**
 * Mengenkripsi payload Web Push sesuai RFC 8291 (Content-Encoding: aes128gcm).
 */
export const encryptWebPushPayload = ({ p256dh, auth, payload }) => {
  const userPublic = fromBase64Url(p256dh);
  const authSecret = fromBase64Url(auth);

  if (userPublic.length !== 65 || userPublic[0] !== 0x04) {
    throw new Error('Kunci publik subscription p256dh tidak valid.');
  }
  if (authSecret.length < 16) {
    throw new Error('Kunci auth subscription tidak valid.');
  }

  const serverEcdh = crypto.createECDH('prime256v1');
  serverEcdh.generateKeys();
  const serverPublic = serverEcdh.getPublicKey();
  const sharedSecret = serverEcdh.computeSecret(userPublic);

  const infoPrk = Buffer.concat([Buffer.from('WebPush: info\0'), userPublic, serverPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, infoPrk, 32));

  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  );
  const nonce = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12)
  );

  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const paddedPlaintext = Buffer.concat([payloadBuf, Buffer.from([0x02])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(paddedPlaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const header = Buffer.alloc(16 + 4 + 1 + 65);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(serverPublic.length, 20);
  serverPublic.copy(header, 21);

  return Buffer.concat([header, ciphertext, tag]);
};

const postEncryptedPush = (endpoint, headers, body, timeoutMs = 10000) =>
  new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const transport = url.protocol === 'http:' ? http : https;
    const req = transport.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': body.length,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Web Push request timeout'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

/**
 * Mengirim notifikasi Web Push ke satu subscription.
 * Menandai `expired: true` bila endpoint mengembalikan HTTP 404 atau 410 (Gone).
 */
export const sendWebPushNotification = async (subscription, payloadObj, options = {}) => {
  const vapid = getVapidConfig();
  const payloadString = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);

  const encryptedBody = encryptWebPushPayload({
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    payload: payloadString,
  });

  const authorization = createVapidAuthHeader({
    endpoint: subscription.endpoint,
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
    subject: vapid.subject,
  });

  const requester = options.requester || postEncryptedPush;
  const response = await requester(
    subscription.endpoint,
    {
      Authorization: authorization,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: String(options.ttl || 86400),
      Urgency: options.urgency || 'normal',
    },
    encryptedBody
  );

  const statusCode = response.statusCode || 500;
  if (statusCode >= 200 && statusCode < 300) {
    return { delivered: true, expired: false, statusCode };
  }

  return {
    delivered: false,
    expired: statusCode === 404 || statusCode === 410,
    statusCode,
    responseBody: response.body,
  };
};

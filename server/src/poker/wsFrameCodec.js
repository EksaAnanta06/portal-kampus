// FILE: server/src/poker/wsFrameCodec.js
import crypto from 'node:crypto';
import http from 'node:http';
import { EventEmitter } from 'node:events';

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const WS_OPCODE = Object.freeze({
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
});

export const computeWebSocketAcceptKey = (secWebSocketKey) =>
  crypto
    .createHash('sha1')
    .update(String(secWebSocketKey).trim() + WS_MAGIC_GUID)
    .digest('base64');

export const encodeWsFrame = (opcode, payload = Buffer.alloc(0), { mask = false } = {}) => {
  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const len = payloadBuf.length;

  let headerLen = 2;
  if (len >= 126 && len <= 65535) headerLen += 2;
  else if (len > 65535) headerLen += 8;
  if (mask) headerLen += 4;

  const out = Buffer.allocUnsafe(headerLen + len);
  out[0] = 0x80 | (opcode & 0x0f);

  const maskBit = mask ? 0x80 : 0x00;
  let offset = 2;
  if (len < 126) {
    out[1] = maskBit | len;
  } else if (len <= 65535) {
    out[1] = maskBit | 126;
    out.writeUInt16BE(len, 2);
    offset = 4;
  } else {
    out[1] = maskBit | 127;
    out.writeBigUInt64BE(BigInt(len), 2);
    offset = 10;
  }

  if (mask) {
    const maskKey = crypto.randomBytes(4);
    maskKey.copy(out, offset);
    offset += 4;
    for (let i = 0; i < len; i += 1) {
      out[offset + i] = payloadBuf[i] ^ maskKey[i % 4];
    }
  } else {
    payloadBuf.copy(out, offset);
  }

  return out;
};

export const encodeCloseFrame = (code = 1000, reason = '') => {
  const reasonBuf = Buffer.from(String(reason).slice(0, 120), 'utf8');
  const buf = Buffer.allocUnsafe(2 + reasonBuf.length);
  buf.writeUInt16BE(code, 0);
  reasonBuf.copy(buf, 2);
  return encodeWsFrame(WS_OPCODE.CLOSE, buf);
};

/**
 * Pembaca frame WebSocket RFC 6455 inkremental dengan batas ukuran payload & deteksi masking.
 */
export class WsFrameDecoder {
  constructor({ maxPayloadBytes = 16384, requireMask = true } = {}) {
    this.buffer = Buffer.alloc(0);
    this.maxPayloadBytes = maxPayloadBytes;
    this.requireMask = requireMask;
    this.fragmentChunks = [];
    this.fragmentOpcode = null;
    this.fragmentBytes = 0;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames = [];

    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (this.requireMask && !masked) {
        return { frames, error: 'UNMASKED_CLIENT_FRAME' };
      }

      if (payloadLen === 126) {
        if (this.buffer.length < offset + 2) break;
        payloadLen = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < offset + 8) break;
        const bigLen = this.buffer.readBigUInt64BE(offset);
        if (bigLen > BigInt(this.maxPayloadBytes)) {
          return { frames, error: 'PAYLOAD_TOO_LARGE' };
        }
        payloadLen = Number(bigLen);
        offset += 8;
      }

      if (payloadLen > this.maxPayloadBytes) {
        return { frames, error: 'PAYLOAD_TOO_LARGE' };
      }

      const maskLen = masked ? 4 : 0;
      if (this.buffer.length < offset + maskLen + payloadLen) break;

      let maskKey = null;
      if (masked) {
        maskKey = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      const rawPayload = this.buffer.subarray(offset, offset + payloadLen);
      const payload = Buffer.allocUnsafe(payloadLen);
      if (masked) {
        for (let i = 0; i < payloadLen; i += 1) {
          payload[i] = rawPayload[i] ^ maskKey[i % 4];
        }
      } else {
        rawPayload.copy(payload);
      }

      this.buffer = this.buffer.subarray(offset + payloadLen);

      // Control frames (Close/Ping/Pong) tidak pernah terfragmentasi menurut RFC 6455
      if (opcode >= 0x8) {
        frames.push({ opcode, payload });
        continue;
      }

      if (opcode !== WS_OPCODE.CONTINUATION) {
        if (fin) {
          frames.push({ opcode, payload });
        } else {
          this.fragmentOpcode = opcode;
          this.fragmentChunks = [payload];
          this.fragmentBytes = payload.length;
        }
      } else if (this.fragmentOpcode !== null) {
        this.fragmentBytes += payload.length;
        if (this.fragmentBytes > this.maxPayloadBytes) {
          return { frames, error: 'PAYLOAD_TOO_LARGE' };
        }
        this.fragmentChunks.push(payload);
        if (fin) {
          frames.push({
            opcode: this.fragmentOpcode,
            payload: Buffer.concat(this.fragmentChunks),
          });
          this.fragmentOpcode = null;
          this.fragmentChunks = [];
          this.fragmentBytes = 0;
        }
      }
    }

    return { frames, error: null };
  }
}

/**
 * Klien WebSocket Node.js ringan berbasis HTTP Upgrade + RFC 6455 untuk automated multi-client test.
 */
export const createNodeWsClient = (urlStr) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const key = crypto.randomBytes(16).toString('base64');
    const emitter = new EventEmitter();
    const decoder = new WsFrameDecoder({ maxPayloadBytes: 262144, requireMask: false });
    const pendingAcks = new Map();
    let nextAckId = 1;
    let rawSocket = null;
    let closed = false;

    const req = http.request({
      hostname: parsed.hostname,
      port: Number(parsed.port) || 80,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
      },
    });

    req.on('upgrade', (res, socket, head) => {
      const expected = computeWebSocketAcceptKey(key);
      if (res.headers['sec-websocket-accept'] !== expected) {
        socket.destroy();
        reject(new Error('Invalid Sec-WebSocket-Accept header'));
        return;
      }

      rawSocket = socket;
      const client = {
        on: (ev, fn) => emitter.on(ev, fn),
        off: (ev, fn) => emitter.off(ev, fn),
        once: (ev, fn) => emitter.once(ev, fn),
        emit: (event, data = {}) =>
          new Promise((resAck, rejAck) => {
            if (closed || !rawSocket || rawSocket.destroyed) {
              rejAck(new Error('WebSocket tertutup'));
              return;
            }
            const ackId = nextAckId++;
            const timer = setTimeout(() => {
              pendingAcks.delete(ackId);
              rejAck(new Error(`ACK timeout untuk event ${event}`));
            }, 5000);
            pendingAcks.set(ackId, { resolve: resAck, reject: rejAck, timer });
            const frame = encodeWsFrame(
              WS_OPCODE.TEXT,
              JSON.stringify({ event, data, ackId }),
              { mask: true }
            );
            rawSocket.write(frame);
          }),
        close: () => {
          if (closed) return;
          closed = true;
          try {
            rawSocket?.write(encodeCloseFrame(1000, 'client_close'));
          } catch {
            // Abaikan
          }
          rawSocket?.end();
        },
        waitForEvent: (eventName, predicate = () => true, timeoutMs = 4000) =>
          new Promise((resEv, rejEv) => {
            const t = setTimeout(() => {
              emitter.off(eventName, handler);
              rejEv(new Error(`Timeout menunggu event ${eventName}`));
            }, timeoutMs);
            const handler = (payload) => {
              if (predicate(payload)) {
                clearTimeout(t);
                emitter.off(eventName, handler);
                resEv(payload);
              }
            };
            emitter.on(eventName, handler);
          }),
      };

      const processChunk = (chunk) => {
        if (!chunk || chunk.length === 0) return;
        const { frames, error } = decoder.push(chunk);
        if (error) {
          socket.destroy();
          return;
        }
        for (const f of frames) {
          if (f.opcode === WS_OPCODE.PING) {
            socket.write(encodeWsFrame(WS_OPCODE.PONG, f.payload, { mask: true }));
          } else if (f.opcode === WS_OPCODE.CLOSE) {
            closed = true;
            const closeCode = f.payload.length >= 2 ? f.payload.readUInt16BE(0) : 1000;
            const closeReason = f.payload.length > 2 ? f.payload.subarray(2).toString('utf8') : '';
            emitter.emit('__close', { code: closeCode, reason: closeReason });
            socket.end();
          } else if (f.opcode === WS_OPCODE.TEXT) {
            try {
              const msg = JSON.parse(f.payload.toString('utf8'));
              if (msg.type === 'ack' && msg.ackId && pendingAcks.has(msg.ackId)) {
                const pending = pendingAcks.get(msg.ackId);
                clearTimeout(pending.timer);
                pendingAcks.delete(msg.ackId);
                pending.resolve(msg.payload);
              } else if (msg.event) {
                emitter.emit(msg.event, msg.data);
              }
            } catch {
              // Abaikan JSON rusak
            }
          }
        }
      };

      socket.on('data', processChunk);
      socket.on('close', () => {
        closed = true;
        for (const p of pendingAcks.values()) {
          clearTimeout(p.timer);
          p.reject(new Error('Koneksi WebSocket terputus'));
        }
        pendingAcks.clear();
        emitter.emit('__disconnected');
      });

      if (head && head.length > 0) processChunk(head);
      resolve(client);
    });

    req.on('response', (res) => {
      let body = '';
      res.on('data', (d) => {
        body += d.toString('utf8');
      });
      res.on('end', () => {
        const err = new Error(`Handshake ditolak (${res.statusCode}): ${body || res.statusMessage}`);
        err.statusCode = res.statusCode;
        reject(err);
      });
    });

    req.on('error', reject);
    req.end();
  });

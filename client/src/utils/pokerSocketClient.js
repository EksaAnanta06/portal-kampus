// FILE: client/src/utils/pokerSocketClient.js
import { API_BASE_URL, requestNewAccessToken } from '../api/axiosInstance';
import { getAccessToken } from '../api/authBridge';

export const resolvePokerWsUrl = (token) => {
  const apiUrl = API_BASE_URL;
  let originUrl;
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    originUrl = new URL(apiUrl).origin;
  } else if (typeof window !== 'undefined') {
    originUrl = window.location.origin;
  } else {
    originUrl = 'http://localhost:5000';
  }
  const wsOrigin = originUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  return `${wsOrigin}/socket.io?token=${encodeURIComponent(token || '')}`;
};

class PokerSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.pendingAcks = new Map();
    this.nextAckId = 1;
    this.manualDisconnect = false;
    this.replacedByOtherTab = false;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.status = 'disconnected'; // disconnected | connecting | reconnecting | connected | replaced
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  }

  _emitLocal(event, data) {
    const fns = this.listeners.get(event);
    if (!fns) return;
    for (const fn of fns) {
      try {
        fn(data);
      } catch {
        // Abaikan error listener
      }
    }
  }

  _setStatus(next) {
    this.status = next;
    this._emitLocal('__status', next);
  }

  async connect({ isReconnect = false } = {}) {
    const WsImpl = typeof window !== 'undefined' ? window.WebSocket : null;
    if (!WsImpl) return;

    if (this.ws && (this.ws.readyState === WsImpl.OPEN || this.ws.readyState === WsImpl.CONNECTING)) {
      return;
    }

    this.manualDisconnect = false;
    this.replacedByOtherTab = false;
    clearTimeout(this.reconnectTimer);
    this._setStatus(isReconnect ? 'reconnecting' : 'connecting');

    let token = getAccessToken();
    if (!token) {
      try {
        token = await requestNewAccessToken();
      } catch {
        token = null;
      }
    }
    if (!token) {
      this._setStatus('disconnected');
      return;
    }

    const url = resolvePokerWsUrl(token);
    const ws = new WsImpl(url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempt = 0;
      this._setStatus('connected');
    };

    ws.onmessage = (msgEv) => {
      if (this.ws !== ws) return;
      let parsed;
      try {
        parsed = JSON.parse(msgEv.data);
      } catch {
        return;
      }
      if (parsed.type === 'ack' && parsed.ackId && this.pendingAcks.has(parsed.ackId)) {
        const pending = this.pendingAcks.get(parsed.ackId);
        clearTimeout(pending.timer);
        this.pendingAcks.delete(parsed.ackId);
        pending.resolve(parsed.payload);
        return;
      }
      if (parsed.event === 'session:replaced') {
        this.replacedByOtherTab = true;
        this._setStatus('replaced');
      }
      if (parsed.event) {
        this._emitLocal(parsed.event, parsed.data);
      }
    };

    ws.onclose = async (closeEv) => {
      if (this.ws !== ws) return;
      this.ws = null;
      for (const p of this.pendingAcks.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('Koneksi terputus saat menunggu konfirmasi server.'));
      }
      this.pendingAcks.clear();

      if (closeEv.code === 4001 || this.replacedByOtherTab) {
        this._setStatus('replaced');
        return;
      }

      if (this.manualDisconnect) {
        this._setStatus('disconnected');
        return;
      }

      // Refresh access token diam-diam jika koneksi panjang terputus karena token kedaluwarsa
      try {
        await requestNewAccessToken();
      } catch {
        // Lanjut coba reconnect dengan backoff
      }

      const delay = Math.min(8000, 1000 * Math.pow(1.6, this.reconnectAttempt));
      this.reconnectAttempt += 1;
      this._setStatus('reconnecting');
      this.reconnectTimer = setTimeout(() => {
        this.connect({ isReconnect: true });
      }, delay);
    };

    ws.onerror = () => {
      // onclose akan menangani reconnect
    };
  }

  disconnect() {
    this.manualDisconnect = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close(1000, 'manual_disconnect');
      } catch {
        // Abaikan
      }
      this.ws = null;
    }
    this._setStatus('disconnected');
  }

  emit(event, data = {}) {
    return new Promise((resolve, reject) => {
      const WsImpl = typeof window !== 'undefined' ? window.WebSocket : null;
      if (!this.ws || !WsImpl || this.ws.readyState !== WsImpl.OPEN) {
        reject(new Error('Belum terhubung ke server permainan. Mencoba menyambung ulang...'));
        return;
      }
      const ackId = this.nextAckId++;
      const timer = setTimeout(() => {
        this.pendingAcks.delete(ackId);
        reject(new Error('Server tidak merespons tepat waktu.'));
      }, 6000);
      this.pendingAcks.set(ackId, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ event, data, ackId }));
    });
  }
}

export const pokerSocket = new PokerSocketClient();

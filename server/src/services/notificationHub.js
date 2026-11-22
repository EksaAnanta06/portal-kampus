// FILE: server/src/services/notificationHub.js

const HEARTBEAT_INTERVAL_MS = 25000;

export function formatSseEvent({ id, event, data }) {
  const lines = [];
  if (id !== undefined && id !== null) {
    lines.push(`id: ${id}`);
  }
  if (event) {
    lines.push(`event: ${event}`);
  }
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  lines.push(`data: ${serialized}`);
  return `${lines.join('\n')}\n\n`;
}

class NotificationHub {
  constructor() {
    this.clientsByUser = new Map();
  }

  subscribe(userId, res) {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0 || !res) {
      return () => {};
    }

    let userClients = this.clientsByUser.get(uid);
    if (!userClients) {
      userClients = new Set();
      this.clientsByUser.set(uid, userClients);
    }

    const entry = { res, heartbeat: null };
    userClients.add(entry);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (entry.heartbeat) {
        clearInterval(entry.heartbeat);
        entry.heartbeat = null;
      }
      res.off?.('close', cleanup);
      res.off?.('error', cleanup);
      const set = this.clientsByUser.get(uid);
      if (set) {
        set.delete(entry);
        if (set.size === 0) {
          this.clientsByUser.delete(uid);
        }
      }
    };

    entry.heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) {
        cleanup();
        return;
      }
      try {
        res.write(': keepalive\n\n');
      } catch {
        cleanup();
      }
    }, HEARTBEAT_INTERVAL_MS);
    entry.heartbeat.unref?.();

    res.on('close', cleanup);
    res.on('error', cleanup);

    return cleanup;
  }

  publish(userId, notification) {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0 || !notification) return;

    const userClients = this.clientsByUser.get(uid);
    if (!userClients || userClients.size === 0) return;

    const frame = formatSseEvent({
      id: notification.id,
      event: 'notification',
      data: notification,
    });

    for (const entry of [...userClients]) {
      const { res } = entry;
      if (res.writableEnded || res.destroyed) {
        userClients.delete(entry);
        if (entry.heartbeat) clearInterval(entry.heartbeat);
        continue;
      }
      try {
        res.write(frame);
      } catch {
        userClients.delete(entry);
        if (entry.heartbeat) clearInterval(entry.heartbeat);
      }
    }

    if (userClients.size === 0) {
      this.clientsByUser.delete(uid);
    }
  }

  disconnectUser(userId) {
    const uid = Number(userId);
    const userClients = this.clientsByUser.get(uid);
    if (!userClients) return;

    for (const entry of [...userClients]) {
      if (entry.heartbeat) clearInterval(entry.heartbeat);
      try {
        entry.res.end();
      } catch {
        // Abaikan stream yang sudah tertutup
      }
    }
    this.clientsByUser.delete(uid);
  }

  shutdown() {
    for (const userClients of this.clientsByUser.values()) {
      for (const entry of userClients) {
        if (entry.heartbeat) clearInterval(entry.heartbeat);
        try {
          entry.res.end();
        } catch {
          // Abaikan
        }
      }
    }
    this.clientsByUser.clear();
  }
}

export const notificationHub = new NotificationHub();
export default notificationHub;

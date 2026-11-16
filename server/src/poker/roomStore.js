// FILE: server/src/poker/roomStore.js

/**
 * Antarmuka penyimpanan state room Poker di memori.
 *
 * CATATAN ARSITEKTUR (Skalabilitas Multi-Instance):
 * - Versi ini menggunakan SATU instance Node.js sehingga seluruh state room dan timer giliran
 *   disimpan di memori (`InMemoryRoomStore`) agar latensi rendah dan konsisten.
 * - Untuk deployment multi-instance / horizontal scaling nantinya:
 *   1. Ganti `InMemoryRoomStore` dengan implementasi `RedisRoomStore` yang menyimpan state
 *      terserialisasi (beserta distributed lock/Lua script untuk aksi atomik per roomId).
 *   2. Tambahkan Socket.IO Redis Adapter (`@socket.io/redis-adapter`) atau pub/sub Redis
 *      agar broadcast room lintas instance tetap sinkron.
 *   3. Aktifkan sticky sessions pada load balancer / reverse proxy.
 */
export class InMemoryRoomStore {
  constructor() {
    this.rooms = new Map();
    this.userRoomMap = new Map();
    this.userCreateTimestamps = new Map();
  }

  get(roomId) {
    return this.rooms.get(String(roomId).toUpperCase()) || null;
  }

  set(roomId, roomEntry) {
    this.rooms.set(String(roomId).toUpperCase(), roomEntry);
  }

  delete(roomId) {
    return this.rooms.delete(String(roomId).toUpperCase());
  }

  has(roomId) {
    return this.rooms.has(String(roomId).toUpperCase());
  }

  values() {
    return [...this.rooms.values()];
  }

  size() {
    return this.rooms.size;
  }

  getUserRoom(userId) {
    return this.userRoomMap.get(Number(userId)) || null;
  }

  setUserRoom(userId, roomId) {
    this.userRoomMap.set(Number(userId), String(roomId).toUpperCase());
  }

  deleteUserRoom(userId) {
    return this.userRoomMap.delete(Number(userId));
  }

  countUserRecentCreations(userId, windowMs = 3600_000, nowMs = Date.now()) {
    const uid = Number(userId);
    const list = (this.userCreateTimestamps.get(uid) || []).filter(
      (ts) => nowMs - ts < windowMs
    );
    this.userCreateTimestamps.set(uid, list);
    return list.length;
  }

  recordUserCreation(userId, nowMs = Date.now()) {
    const uid = Number(userId);
    const list = this.userCreateTimestamps.get(uid) || [];
    list.push(nowMs);
    this.userCreateTimestamps.set(uid, list);
  }
}

// FILE: client/src/store/usePokerStore.js
import { create } from 'zustand';
import { FEATURE_POKER_ENV_ENABLED, pokerApi } from '../api/poker.api';
import { pokerSocket } from '../utils/pokerSocketClient';
import { toast } from './useThemeStore';

const SUIT_LABEL = { S: 'Sekop', H: 'Hati', D: 'Wajik', C: 'Keriting' };

const formatEventSummary = (ev) => {
  const p = ev?.payload || {};
  switch (ev?.type) {
    case 'player_joined':
      return `${p.fullName} bergabung ke meja.`;
    case 'player_left_fold':
      return `${p.fullName} keluar (otomatis fold).`;
    case 'player_left_bot_takeover':
      return `${p.formerName} meninggalkan meja (digantikan Bot sementara).`;
    case 'player_kicked':
      return `${p.fullName} dikeluarkan dari room oleh host.`;
    case 'player_disconnected':
      return `${p.fullName} terputus (masa tenggang ${p.graceSeconds || 60}d).`;
    case 'player_reconnected':
      return `${p.fullName} terhubung kembali.`;
    case 'host_migrated':
      return `Host berpindah ke ${p.fullName}.`;
    case 'hand_started':
      return `Ronde #${p.handNumber} dimulai${p.mustIncludeThreeDiamond ? ' (pembukaan wajib 3♦)' : ''}.`;
    case 'cards_played': {
      const codes = (p.cards || []).map((c) => c.code).join(' ');
      const auto = p.auto ? ' [otomatis]' : '';
      return `${p.fullName} banting ${p.label}: ${codes} (sisa ${p.remainingCount})${auto}`;
    }
    case 'player_pass':
      return `${p.fullName} lewat (Pass)${p.auto ? ' [otomatis]' : ''}.`;
    case 'trick_cleared':
      return 'Semua lawan lewat — meja dibersihkan untuk pemimpin putaran.';
    case 'round_won':
      return `${p.winnerName} menghabiskan kartu & memenangkan ${p.totalWon} chip!`;
    case 'game_finished':
      return p.winnerName
        ? `Permainan selesai! Juara meja: ${p.winnerName}.`
        : 'Permainan di meja telah berakhir.';
    case 'room_closed':
      return p.reason || 'Room ditutup.';
    default:
      return `${ev?.type || 'event'} ${Object.keys(SUIT_LABEL).length ? '' : ''}`.trim();
  }
};

const playTurnBeepIfAllowed = (soundEnabled) => {
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Abaikan jika audio diblokir browser
  }
};

let listenersRegistered = false;

const usePokerStore = create((set, get) => ({
  socketStatus: 'disconnected',
  featureEnabled: FEATURE_POKER_ENV_ENABLED,
  statusLoading: false,
  lobbyData: null,
  roomState: null,
  serverClockOffsetMs: 0,
  actionLog: [],
  seatReactions: {}, // { [seatIndex]: { emote, timestamp } }
  fourColorDeck: false,
  soundEnabled: false, // Default mati sesuai aturan UX
  replacedMessage: null,
  kickedMessage: null,

  initSocketListeners: () => {
    if (listenersRegistered) return;
    listenersRegistered = true;

    pokerSocket.on('__status', (status) => {
      set({ socketStatus: status });
    });

    pokerSocket.on('socket:ready', (info) => {
      if (info?.serverNow) {
        set({ serverClockOffsetMs: info.serverNow - Date.now() });
      }
      set({ replacedMessage: null });
    });

    pokerSocket.on('session:replaced', (payload) => {
      set({
        replacedMessage:
          payload?.message || 'Koneksi dibuka di tab lain. Tab ini dinonaktifkan.',
      });
    });

    pokerSocket.on('room:kicked', (payload) => {
      set({
        roomState: null,
        kickedMessage: payload?.message || 'Anda dikeluarkan dari room oleh host.',
      });
      toast.warning(payload?.message || 'Anda dikeluarkan dari room.');
    });

    pokerSocket.on('game:state', (incoming) => {
      if (!incoming) return;
      const current = get().roomState;

      // Buang update versi basi bila room sama & minta sinkronisasi bila ada celah state
      if (
        current &&
        current.roomId === incoming.roomId &&
        incoming.stateVersion < current.stateVersion
      ) {
        pokerSocket.emit('game:sync', { roomId: incoming.roomId }).catch(() => {});
        return;
      }

      const prevTurnSeat = current?.table?.currentTurnSeat;
      const nextTurnSeat = incoming.table?.currentTurnSeat;
      const isMyTurnNow =
        incoming.viewerSeat !== null &&
        nextTurnSeat === incoming.viewerSeat &&
        prevTurnSeat !== nextTurnSeat;

      if (isMyTurnNow) {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(90);
          } catch {
            // Abaikan
          }
        }
        playTurnBeepIfAllowed(get().soundEnabled);
      }

      set({
        roomState: incoming,
        kickedMessage: null,
        serverClockOffsetMs: incoming.serverNow ? incoming.serverNow - Date.now() : 0,
      });
    });

    pokerSocket.on('game:event', (ev) => {
      const text = formatEventSummary(ev);
      if (ev.type === 'room_closed') {
        toast.info(text);
      }
      set((s) => ({
        actionLog: [
          { id: `${ev.timestamp}-${ev.stateVersion}-${Math.random()}`, text, timestamp: ev.timestamp, type: ev.type },
          ...s.actionLog,
        ].slice(0, 45),
      }));
    });

    pokerSocket.on('reaction:broadcast', (r) => {
      if (r?.seatIndex === undefined) return;
      const key = r.seatIndex;
      set((s) => ({
        seatReactions: {
          ...s.seatReactions,
          [key]: { emote: r.emote, timestamp: r.timestamp || Date.now() },
        },
      }));
      setTimeout(() => {
        const curr = get().seatReactions[key];
        if (curr && curr.timestamp === r.timestamp) {
          set((s) => {
            const copy = { ...s.seatReactions };
            delete copy[key];
            return { seatReactions: copy };
          });
        }
      }, 2800);
    });

    pokerSocket.on('error', (err) => {
      if (err?.message) toast.error(err.message);
    });
  },

  ensureConnected: async () => {
    get().initSocketListeners();
    await pokerSocket.connect();
  },

  fetchLobbyStatus: async () => {
    set({ statusLoading: true });
    try {
      const res = await pokerApi.getStatus();
      set({
        featureEnabled: Boolean(res.data?.enabled),
        lobbyData: res.data || null,
      });
      return res.data;
    } catch (err) {
      if (err?.response?.status === 503) {
        set({ featureEnabled: false, lobbyData: err.response?.data?.data || null });
      }
      throw err;
    } finally {
      set({ statusLoading: false });
    }
  },

  createRoom: async (config) => {
    await get().ensureConnected();
    const ack = await pokerSocket.emit('room:create', config);
    if (!ack?.success) throw new Error(ack?.message || 'Gagal membuat room.');
    set({ roomState: ack.data, actionLog: [], kickedMessage: null });
    return ack.data;
  },

  joinRoom: async (roomId) => {
    await get().ensureConnected();
    const ack = await pokerSocket.emit('room:join', { roomId });
    if (!ack?.success) throw new Error(ack?.message || 'Gagal bergabung ke room.');
    set({ roomState: ack.data, kickedMessage: null });
    return ack.data;
  },

  leaveRoom: async (roomId) => {
    try {
      await pokerSocket.emit('room:leave', { roomId });
    } catch {
      // Tetap bersihkan state lokal
    }
    set({ roomState: null, actionLog: [] });
  },

  setReady: async (roomId, ready) => {
    const ack = await pokerSocket.emit('room:ready', { roomId, ready });
    if (!ack?.success) throw new Error(ack?.message || 'Gagal mengubah status siap.');
    set({ roomState: ack.data });
  },

  startGame: async (roomId) => {
    const ack = await pokerSocket.emit('room:start', { roomId });
    if (!ack?.success) throw new Error(ack?.message || 'Gagal memulai permainan.');
    set({ roomState: ack.data });
  },

  kickPlayer: async (roomId, targetUserId) => {
    const ack = await pokerSocket.emit('room:kick', { roomId, targetUserId });
    if (!ack?.success) throw new Error(ack?.message || 'Gagal mengeluarkan pemain.');
    set({ roomState: ack.data });
  },

  endRoom: async (roomId) => {
    const ack = await pokerSocket.emit('room:end', { roomId });
    if (!ack?.success) throw new Error(ack?.message || 'Gagal mengakhiri room.');
  },

  sendGameAction: async ({ roomId, handNumber, turnToken, action, cards }) => {
    const ack = await pokerSocket.emit('game:action', {
      roomId,
      handNumber,
      turnToken,
      action,
      cards,
    });
    if (!ack?.success) throw new Error(ack?.message || 'Aksi ditolak oleh server.');
    if (ack.data) set({ roomState: ack.data });
    return ack.data;
  },

  sendReaction: async (roomId, emote) => {
    const ack = await pokerSocket.emit('reaction:send', { roomId, emote });
    if (!ack?.success) throw new Error(ack?.message || 'Gagal mengirim reaksi.');
  },

  syncState: async (roomId) => {
    const ack = await pokerSocket.emit('game:sync', { roomId });
    if (ack?.success && ack.data) {
      set({ roomState: ack.data });
    }
    return ack?.data;
  },

  toggleFourColorDeck: () => set((s) => ({ fourColorDeck: !s.fourColorDeck })),
  toggleSoundEnabled: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  clearRoomState: () => set({ roomState: null, actionLog: [], kickedMessage: null }),
}));

export default usePokerStore;

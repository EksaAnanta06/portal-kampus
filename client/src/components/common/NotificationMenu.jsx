// FILE: client/src/components/common/NotificationMenu.jsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import { API_BASE_URL } from '../../api/axiosInstance';
import { campusApi } from '../../api/campus.api';
import { formatRelative } from '../../utils/formatDate';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { ensureNativeBackgroundPush } from '../../services/nativePushSync';
import {
  isNativePlatform,
  getNativeNotificationStatus,
  enableNativeNotifications,
  sendTestNativeNotification,
  showNativeNotification,
  onNativeAppResume,
  isNativePushServiceAvailable,
  onNativePushNotificationReceived,
  syncNativePushLastId,
  CHANNEL_GENERAL,
  CHANNEL_FOCUS,
} from '../../platform';

const TYPE_ICON = {
  photo_approved: <CheckCircleRoundedIcon fontSize="small" className="text-emerald-500" />,
  photo_rejected: <CancelRoundedIcon fontSize="small" className="text-red-500" />,
  new_comment: <ChatBubbleRoundedIcon fontSize="small" className="text-sky-500" />,
  new_like: <FavoriteRoundedIcon fontSize="small" className="text-pink-500" />,
  account_verified: <VerifiedUserRoundedIcon fontSize="small" className="text-emerald-500" />,
  material_approved: <CheckCircleRoundedIcon fontSize="small" className="text-emerald-500" />,
  material_rejected: <CancelRoundedIcon fontSize="small" className="text-red-500" />,
  material_takedown: <CancelRoundedIcon fontSize="small" className="text-red-500" />,
  course_approved: <CheckCircleRoundedIcon fontSize="small" className="text-emerald-500" />,
  course_rejected: <CancelRoundedIcon fontSize="small" className="text-red-500" />,
  request_fulfilled: <CheckCircleRoundedIcon fontSize="small" className="text-sky-500" />,
  focus_reminder: <TimerRoundedIcon fontSize="small" className="text-pasim" />,
  task_deadline: <EventNoteRoundedIcon fontSize="small" className="text-amber-500" />,
  system: <InfoRoundedIcon fontSize="small" className="text-amber-500" />,
};

const FALLBACK_POLL_INTERVAL = 120 * 1000;

// State tingkat modul agar perpindahan rute (mis. /poker) tidak mereset riwayat notifikasi terbaca
const sessionSeenIds = new Set();
let sessionSeenUserId = null;
let sessionLastNotifId = 0;

function resetSessionTrackingIfUserChanged(userId) {
  if (sessionSeenUserId === userId) return;
  sessionSeenUserId = userId;
  sessionSeenIds.clear();
  sessionLastNotifId = 0;
}

async function consumeNotificationSseStream({ url, headers, signal, onConnected, onNotification }) {
  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal,
  });
  if (!response.ok || !response.body) {
    const err = new Error(`SSE HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = 'message';
  let dataLines = [];

  const dispatchEvent = () => {
    if (dataLines.length === 0) {
      currentEvent = 'message';
      return;
    }
    const rawData = dataLines.join('\n');
    const eventName = currentEvent;
    currentEvent = 'message';
    dataLines = [];

    try {
      const parsed = JSON.parse(rawData);
      if (eventName === 'connected') {
        onConnected?.(parsed);
      } else if (eventName === 'notification') {
        onNotification?.(parsed);
      }
    } catch {
      // Abaikan payload non-JSON
    }
  };

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const rawLine = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

      if (line === '') {
        dispatchEvent();
      } else if (line.startsWith(':')) {
        // SSE keepalive comment
      } else if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
  }
}

export default function NotificationMenu() {
  const navigate = useNavigate();
  const isNative = isNativePlatform();
  const hasNativeBgService = isNativePushServiceAvailable();
  const userId = useAuthStore((s) => s.user?.id || null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nativeNotif, setNativeNotif] = useState({ enabled: false, loading: false });

  useEffect(() => {
    resetSessionTrackingIfUserChanged(userId);
  }, [userId]);

  useEffect(() => {
    if (!isNative) return;
    getNativeNotificationStatus()
      .then((status) => setNativeNotif((prev) => ({ ...prev, enabled: Boolean(status.enabled) })))
      .catch(() => {});
  }, [isNative]);

  const triggerFallbackBanner = useCallback(
    (notif) => {
      if (!isNative || hasNativeBgService || !notif || notif.is_read) return;
      const channelId =
        notif.type === 'focus_reminder' || notif.type === 'task_deadline'
          ? CHANNEL_FOCUS
          : CHANNEL_GENERAL;
      showNativeNotification({
        id: 500000 + Number(notif.id),
        title: notif.title,
        body: notif.message,
        channelId,
        link: notif.reference_link,
      }).catch(() => {});
    },
    [isNative, hasNativeBgService]
  );

  const pushIncomingNotification = useCallback(
    (notif, { allowFallbackBanner = true } = {}) => {
      const numericId = Number(notif?.id);
      if (!Number.isFinite(numericId) || numericId <= 0) return;

      resetSessionTrackingIfUserChanged(userId);
      const wasSeen = sessionSeenIds.has(numericId);
      sessionSeenIds.add(numericId);
      if (numericId > sessionLastNotifId) {
        sessionLastNotifId = numericId;
      }

      if (allowFallbackBanner && !wasSeen) {
        triggerFallbackBanner(notif);
      }

      setItems((prev) => {
        if (prev.some((i) => Number(i.id) === numericId)) return prev;
        return [notif, ...prev].slice(0, 30);
      });

      if (!wasSeen && !notif.is_read) {
        setUnread((u) => u + 1);
      }
    },
    [userId, triggerFallbackBanner]
  );

  const fetchNotifications = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        resetSessionTrackingIfUserChanged(userId);
        const isInitialSessionLoad = sessionSeenIds.size === 0 && sessionLastNotifId === 0;
        const res = await campusApi.getNotifications();
        const nextItems = res.data || [];

        let maxId = sessionLastNotifId;
        for (const n of nextItems) {
          const nid = Number(n.id) || 0;
          if (nid > maxId) maxId = nid;
          if (!isInitialSessionLoad && !n.is_read && !sessionSeenIds.has(nid)) {
            triggerFallbackBanner(n);
          }
          if (nid > 0) sessionSeenIds.add(nid);
        }
        sessionLastNotifId = maxId;

        if (hasNativeBgService && maxId > 0) {
          syncNativePushLastId(maxId);
        }

        setItems(nextItems);
        setUnread(res.meta?.unread_count || 0);
      } catch {
        // diamkan — notifikasi bukan fitur kritikal
      } finally {
        setLoading(false);
      }
    },
    [userId, hasNativeBgService, triggerFallbackBanner]
  );

  const handleEnableNativeNotifications = async () => {
    setNativeNotif((prev) => ({ ...prev, loading: true }));
    try {
      await enableNativeNotifications({ sendConfirmation: true });
      await ensureNativeBackgroundPush({ forceNew: true, userId }).catch(() => {});
      setNativeNotif({ enabled: true, loading: false });
      toast.success('Notifikasi perangkat Android aktif!');
    } catch (err) {
      setNativeNotif((prev) => ({ ...prev, loading: false }));
      toast.error(err?.message || 'Gagal mengaktifkan notifikasi Android.');
    }
  };

  const handleTestNativeNotification = async () => {
    setNativeNotif((prev) => ({ ...prev, loading: true }));
    try {
      await sendTestNativeNotification();
      toast.info('Notifikasi uji dikirim ke panel HP.');
    } catch (err) {
      toast.error(err?.message || 'Gagal mengirim notifikasi uji Android.');
    } finally {
      setNativeNotif((prev) => ({ ...prev, loading: false }));
    }
  };

  // Sinkronisasi awal, fallback polling 120 detik, serta refresh saat aplikasi kembali aktif
  useEffect(() => {
    fetchNotifications();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const unsubResume = onNativeAppResume(() => {
      fetchNotifications();
    });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications();
    }, FALLBACK_POLL_INTERVAL);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubResume();
      clearInterval(timer);
    };
  }, [fetchNotifications]);

  // Real-time dari Native Foreground Service (Android APK baru)
  useEffect(() => {
    if (!hasNativeBgService) return undefined;
    return onNativePushNotificationReceived((notif) => {
      pushIncomingNotification(notif, { allowFallbackBanner: false });
    });
  }, [hasNativeBgService, pushIncomingNotification]);

  // Real-time SSE stream untuk Browser Web / Android WebView saat plugin latar belakang belum terpasang
  useEffect(() => {
    if (hasNativeBgService || !accessToken || !userId) return undefined;

    let cancelled = false;
    let loopRunning = false;
    let backoffMs = 3000;
    let controller = null;
    let retryTimer = null;

    const connectLoop = async () => {
      if (loopRunning || cancelled) return;
      loopRunning = true;
      try {
        while (!cancelled) {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            break;
          }
          controller = new AbortController();
          try {
            const streamUrl = `${API_BASE_URL}/campus/notifications/stream?after_id=${sessionLastNotifId}`;
            await consumeNotificationSseStream({
              url: streamUrl,
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'text/event-stream',
                'Bypass-Tunnel-Reminder': 'true',
                'ngrok-skip-browser-warning': 'true',
                ...(isNative ? { 'X-Client': 'native' } : {}),
              },
              signal: controller.signal,
              onConnected: (info) => {
                backoffMs = 3000;
                if (Number(info?.latestId) > sessionLastNotifId && sessionLastNotifId === 0) {
                  sessionLastNotifId = Number(info.latestId);
                }
              },
              onNotification: (notif) => {
                pushIncomingNotification(notif, { allowFallbackBanner: true });
              },
            });
          } catch (err) {
            if (cancelled || err?.name === 'AbortError') break;
            if (err?.status === 401) {
              await fetchNotifications();
            }
          }

          if (cancelled) break;
          await new Promise((resolve) => {
            retryTimer = setTimeout(resolve, backoffMs);
          });
          backoffMs = Math.min(15000, backoffMs === 3000 ? 5000 : backoffMs + 5000);
        }
      } finally {
        loopRunning = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        connectLoop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    connectLoop();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
    };
  }, [hasNativeBgService, accessToken, userId, isNative, pushIncomingNotification, fetchNotifications]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications(items.length === 0);
  };

  const handleClickItem = async (n) => {
    setAnchorEl(null);
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: 1 } : i)));
      setUnread((u) => Math.max(0, u - 1));
      campusApi.readNotification(n.id).catch(() => {});
    }
    if (n.reference_link) navigate(n.reference_link);
  };

  const handleReadAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: 1 })));
    setUnread(0);
    campusApi.readAllNotifications().catch(() => {});
  };

  return (
    <>
      <Tooltip title="Notifikasi">
        <IconButton onClick={handleOpen} color="inherit" aria-label="Notifikasi">
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsNoneRoundedIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ className: 'w-[360px] max-w-[92vw] !rounded-2xl mt-2' }}
        MenuListProps={{ className: '!py-0' }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <span className="font-bold">Notifikasi</span>
          {unread > 0 && (
            <Button size="small" onClick={handleReadAll}>
              Tandai semua dibaca
            </Button>
          )}
        </div>

        {isNative && (
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
            {nativeNotif.enabled ? (
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <NotificationsActiveRoundedIcon fontSize="small" />
                  <span>Notifikasi HP Android aktif</span>
                </div>
                <Button
                  size="small"
                  variant="text"
                  disabled={nativeNotif.loading}
                  onClick={handleTestNativeNotification}
                  className="!min-w-0 !px-2 !py-0.5 !text-xs"
                >
                  Uji
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Aktifkan notifikasi agar pengingat masuk ke HP
                </span>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={nativeNotif.loading}
                  onClick={handleEnableNativeNotifications}
                  className="shrink-0"
                >
                  {nativeNotif.loading ? 'Memproses...' : 'Aktifkan'}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <CircularProgress size={24} />
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-muted m-0 px-4 py-10 text-center text-sm">Belum ada notifikasi.</p>
          )}

          {!loading &&
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClickItem(n)}
                className={`flex w-full cursor-pointer gap-3 border-0 border-b border-solid border-slate-100 px-4 py-3 text-left text-inherit transition last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                  n.is_read ? 'bg-transparent' : 'bg-pasim-50/60 dark:bg-pasim-900/20'
                }`}
              >
                <span className="mt-0.5">{TYPE_ICON[n.type] || TYPE_ICON.system}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{n.title}</span>
                  <span className="text-muted line-clamp-2 block text-xs">{n.message}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">{formatRelative(n.created_at)}</span>
                </span>
                {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-pasim" />}
              </button>
            ))}
        </div>
      </Menu>
    </>
  );
}

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
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import { campusApi } from '../../api/campus.api';
import { formatRelative } from '../../utils/formatDate';

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

const POLL_INTERVAL = 60 * 1000;

export default function NotificationMenu() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await campusApi.getNotifications();
      setItems(res.data || []);
      setUnread(res.meta?.unread_count || 0);
    } catch {
      // diamkan — notifikasi bukan fitur kritikal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

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

// FILE: client/src/components/poker/PokerWaitingRoom.jsx
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { getInitials } from '../../utils/constants';
import PokerViewportShell from './PokerViewportShell';
import { formatPlayerShortName, loadPokerPreferences } from '../../utils/pokerUiHelpers';
import { useFullscreen } from '../../utils/useFullscreen';

export default function PokerWaitingRoom({
  roomState,
  currentUserId,
  socketStatus = 'connected',
  onToggleReady,
  onStartGame,
  onKickPlayer,
  onLeaveRoom,
  actionBusy = false,
}) {
  const preferences = loadPokerPreferences();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const { roomId, room, table } = roomState;
  const seats = table?.seats || [];
  const isHost = room?.hostUserId === currentUserId;
  const mySeat = seats.find((s) => s.userId === currentUserId);
  const allNonHostHumansReady = seats
    .filter((s) => !s.isBot && s.userId !== room?.hostUserId)
    .every((s) => s.ready);
  const canStart = isHost && allNonHostHumansReady;

  const inviteUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/poker/${roomId}` : `/poker/${roomId}`;

  const handleCopyId = async () => {
    try {
      if (typeof window !== 'undefined' && window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(roomId);
        toast.success(`Kode ${roomId} disalin.`);
        return;
      }
      toast.info(`Kode Room: ${roomId}`);
    } catch (_err) {
      toast.info(`Kode Room: ${roomId}`);
    }
  };

  const handleShareLink = async () => {
    try {
      if (typeof window !== 'undefined' && window.navigator?.share) {
        await window.navigator.share({
          title: `Room Poker ${roomId}`,
          text: `Gabung ke Room Poker ${roomId}`,
          url: inviteUrl,
        });
        return;
      }
      if (typeof window !== 'undefined' && window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(inviteUrl);
        toast.success('Tautan room disalin.');
      }
    } catch (_err) {
      // Pengguna membatalkan dialog bagikan
    }
  };

  const statusDotColor =
    socketStatus === 'connected'
      ? 'bg-emerald-400'
      : socketStatus === 'reconnecting'
      ? 'bg-amber-400'
      : 'bg-rose-500';

  return (
    <PokerViewportShell theme={preferences.tableTheme}>
      {/* Bar Atas Tipis: Keluar (Kiri), Kode Room Besar + Salin/Bagikan (Tengah), Titik Koneksi (Kanan) */}
      <header className="flex items-center justify-between gap-2 px-1">
        <IconButton
          onClick={onLeaveRoom}
          disabled={actionBusy}
          aria-label="Keluar dari ruang tunggu"
          className="!min-h-[44px] !min-w-[44px] !text-slate-200"
        >
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>

        <div className="flex items-center gap-1.5">
          <span className="font-mono poker-text-lg font-extrabold tracking-widest text-white">
            {roomId}
          </span>
          <IconButton
            onClick={handleCopyId}
            aria-label="Salin kode room"
            className="!min-h-[44px] !min-w-[44px] !text-slate-200"
          >
            <ContentCopyRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={handleShareLink}
            aria-label="Bagikan tautan room"
            className="!min-h-[44px] !min-w-[44px] !text-emerald-400"
          >
            <ShareRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
            className="!min-h-[44px] !min-w-[44px] !text-amber-300"
          >
            {isFullscreen ? (
              <FullscreenExitRoundedIcon fontSize="small" />
            ) : (
              <FullscreenRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </div>

        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 mr-2 ${statusDotColor}`}
          role="status"
          aria-label={socketStatus === 'connected' ? 'Terhubung' : 'Menyambung ulang'}
        />
      </header>

      {/* Daftar 4 Slot Pemain (Pasti Muat 1 Layar di Portrait 320x568 maupun Landscape 640x360) */}
      <div className="my-auto mx-auto w-full max-w-md px-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((slot) => {
          const seat = seats.find((s) => s.seatIndex === slot);
          if (!seat) {
            return (
              <div
                key={slot}
                className="poker-flat-panel min-h-[48px] px-3 py-1.5 flex items-center justify-between text-slate-400"
              >
                <span className="poker-text-sm font-medium">Kursi #{slot + 1}</span>
                <span className="poker-text-sm">Kosong</span>
              </div>
            );
          }

          const seatIsHost = seat.userId === room?.hostUserId;
          const statusLabel = seatIsHost ? 'Host' : seat.ready ? 'Siap' : 'Menunggu';

          return (
            <div
              key={seat.userId}
              className="poker-flat-elevated min-h-[48px] px-3 py-1.5 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  src={getOptimizedImageUrl(seat.avatarUrl, { width: 64, height: 64 })}
                  sx={{ width: 28, height: 28, fontSize: 12 }}
                >
                  {getInitials(seat.fullName)}
                </Avatar>
                <span className="poker-text-md font-bold text-slate-100 truncate">
                  {formatPlayerShortName(seat.fullName, { maxChars: 14 })}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`poker-text-sm font-bold ${
                    seatIsHost
                      ? 'text-amber-400'
                      : seat.ready
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {statusLabel}
                </span>

                {isHost && seat.userId !== currentUserId && (
                  <IconButton
                    size="small"
                    color="error"
                    disabled={actionBusy}
                    onClick={() => onKickPlayer(seat.userId)}
                    aria-label={`Keluarkan ${seat.fullName}`}
                    className="!min-h-[44px] !min-w-[44px] !text-rose-400"
                  >
                    <PersonRemoveRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Satu Tombol Aksi Utama ("Mulai" untuk Host, "Siap" untuk Pemain) */}
      <footer className="mx-auto w-full max-w-md px-2 pt-1">
        {isHost ? (
          <Button
            variant="contained"
            color="success"
            fullWidth
            disabled={!canStart || actionBusy}
            onClick={onStartGame}
            className="!min-h-[50px] !rounded-2xl !bg-emerald-600 hover:!bg-emerald-500 disabled:!bg-slate-800 disabled:!text-slate-500 !text-white !font-extrabold poker-text-md !normal-case !shadow-none"
          >
            {canStart ? 'Mulai' : 'Menunggu Pemain Siap…'}
          </Button>
        ) : (
          <Button
            variant={mySeat?.ready ? 'outlined' : 'contained'}
            color="success"
            fullWidth
            disabled={actionBusy || !mySeat}
            onClick={() => onToggleReady(!mySeat?.ready)}
            className={`!min-h-[50px] !rounded-2xl !font-extrabold poker-text-md !normal-case !shadow-none ${
              mySeat?.ready
                ? '!border-emerald-400 !text-emerald-300'
                : '!bg-emerald-600 !text-white'
            }`}
          >
            {mySeat?.ready ? 'Siap ✓' : 'Siap'}
          </Button>
        )}
      </footer>
    </PokerViewportShell>
  );
}

// FILE: client/src/components/poker/PokerWaitingRoom.jsx
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { getInitials } from '../../utils/constants';

export default function PokerWaitingRoom({
  roomState,
  currentUserId,
  socketStatus,
  onToggleReady,
  onStartGame,
  onKickPlayer,
  onLeaveRoom,
  actionBusy,
}) {
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
      await navigator.clipboard.writeText(roomId);
      toast.success(`ID Room ${roomId} disalin.`);
    } catch {
      toast.info(`ID Room: ${roomId}`);
    }
  };

  const handleShareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Gabung Meja Capsa Banting PASIM (${roomId})`,
          text: `Ayo main Capsa Banting (Big 2) chip virtual hiburan di Room ${roomId}`,
          url: inviteUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Link ajakan room disalin ke clipboard.');
    } catch {
      // Pengguna membatalkan share
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Alert severity="info" className="!rounded-2xl !text-xs sm:!text-sm">
        <strong>Game hiburan dengan chip virtual. Tidak ada uang asli.</strong> Kursi yang kosong saat permainan dimulai akan otomatis diisi oleh Bot AI (4 kursi × 13 kartu).
      </Alert>

      <div className="card-surface p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CasinoRoundedIcon className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ruang Tunggu Capsa Banting
              </span>
              <Chip
                size="small"
                color={socketStatus === 'connected' ? 'success' : 'warning'}
                label={socketStatus === 'connected' ? 'Terhubung' : 'Menyambung...'}
                className="!h-5 !text-[10px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-2xl sm:text-3xl font-black tracking-widest text-slate-900 dark:text-white font-mono">
                {roomId}
              </h1>
              <Tooltip title="Salin ID Room">
                <IconButton
                  onClick={handleCopyId}
                  aria-label="Salin ID Room"
                  className="!min-h-[40px] !min-w-[40px] border border-slate-200 dark:border-slate-700"
                >
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                color="success"
                size="small"
                startIcon={<ShareRoundedIcon />}
                onClick={handleShareLink}
                className="!min-h-[40px]"
              >
                Bagikan Link
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip size="small" label={`Chip Awal: ${room?.config?.startingChips}`} variant="outlined" />
            <Chip size="small" label={`Tarif: ${room?.config?.baseStake || 10}/kartu`} variant="outlined" />
            <Chip size="small" label={`Timer: ${room?.config?.turnTimeoutSec}d`} variant="outlined" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((slot) => {
            const seat = seats.find((s) => s.seatIndex === slot);
            if (!seat) {
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 p-3.5 text-xs text-slate-400 dark:border-slate-700"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <SmartToyRoundedIcon fontSize="small" />
                    Kursi #{slot + 1} · Kosong
                  </span>
                  <span className="text-[11px]">Diisi Bot saat mulai</span>
                </div>
              );
            }

            const seatIsHost = seat.userId === room?.hostUserId;
            return (
              <div
                key={seat.userId}
                className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-navy"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={getOptimizedImageUrl(seat.avatarUrl, { width: 80, height: 80 })}
                    sx={{ width: 42, height: 42 }}
                  >
                    {getInitials(seat.fullName)}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {seat.fullName}
                      </span>
                      {seatIsHost && (
                        <Chip size="small" label="Host" color="warning" className="!h-4 !text-[10px]" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Chip
                        size="small"
                        color={seat.ready ? 'success' : 'default'}
                        variant={seat.ready ? 'filled' : 'outlined'}
                        label={seat.ready ? 'Siap' : 'Belum Siap'}
                        className="!h-5 !text-[10px]"
                      />
                      {!seat.connected && (
                        <Chip size="small" color="error" label="Terputus" className="!h-5 !text-[10px]" />
                      )}
                    </div>
                  </div>
                </div>

                {isHost && seat.userId !== currentUserId && (
                  <Tooltip title="Keluarkan dari room">
                    <IconButton
                      size="small"
                      color="error"
                      disabled={actionBusy}
                      onClick={() => onKickPlayer(seat.userId)}
                      aria-label={`Keluarkan ${seat.fullName}`}
                      className="!min-h-[44px] !min-w-[44px]"
                    >
                      <PersonRemoveRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
          <Button
            variant="outlined"
            color="error"
            startIcon={<ExitToAppRoundedIcon />}
            onClick={onLeaveRoom}
            disabled={actionBusy}
            className="!min-h-[44px]"
          >
            Keluar Room
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {mySeat && (
              <Button
                variant={mySeat.ready ? 'outlined' : 'contained'}
                color="success"
                startIcon={<CheckCircleRoundedIcon />}
                onClick={() => onToggleReady(!mySeat.ready)}
                disabled={actionBusy}
                className="!min-h-[44px]"
              >
                {mySeat.ready ? 'Batalkan Siap' : 'Saya Siap'}
              </Button>
            )}

            {isHost && (
              <Button
                variant="contained"
                color="success"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={onStartGame}
                disabled={!canStart || actionBusy}
                className="!min-h-[44px]"
              >
                Mulai Main ({seats.length}/4 Pemain · Sisa Bot)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

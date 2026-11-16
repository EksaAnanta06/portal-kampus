// FILE: client/src/components/poker/PokerResultView.jsx
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { getInitials } from '../../utils/constants';

export default function PokerResultView({ roomState, onBackToLobby }) {
  const { roomId, room, table } = roomState;
  const seats = [...(table?.seats || [])].sort((a, b) => b.chips - a.chips);
  const champion =
    seats.find((s) => s.userId === room?.winnerUserId) || seats[0] || null;

  return (
    <div className="mx-auto max-w-xl space-y-4 py-4">
      <div className="card-surface p-6 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
          <EmojiEventsRoundedIcon sx={{ fontSize: 36 }} />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Hasil Akhir Room #{roomId}
          </span>
          <h1 className="m-0 mt-1 text-2xl font-black text-slate-900 dark:text-white">
            {champion ? `${champion.fullName} Memenangkan Meja!` : 'Permainan Selesai'}
          </h1>
          <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Total {room?.handNumber || 0} tangan dimainkan.
          </p>
        </div>

        <Alert severity="info" className="!rounded-xl !text-xs text-left">
          Game hiburan dengan chip virtual. Tidak ada uang asli, dan seluruh chip room otomatis di-reset saat permainan selesai.
        </Alert>

        <div className="space-y-2 text-left">
          {seats.map((s, idx) => (
            <div
              key={s.userId}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 text-xs font-black text-slate-400">#{idx + 1}</span>
                <Avatar
                  src={getOptimizedImageUrl(s.avatarUrl, { width: 64, height: 64 })}
                  sx={{ width: 34, height: 34 }}
                >
                  {getInitials(s.fullName)}
                </Avatar>
                <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {s.fullName}
                </span>
              </div>
              <Chip
                size="small"
                color={idx === 0 && s.chips > 0 ? 'success' : 'default'}
                label={s.chips > 0 ? `${s.chips} chip` : 'Tereliminasi'}
              />
            </div>
          ))}
        </div>

        <Button
          variant="contained"
          color="success"
          fullWidth
          startIcon={<ArrowBackRoundedIcon />}
          onClick={onBackToLobby}
          className="!min-h-[46px]"
        >
          Kembali ke Lobby Poker
        </Button>
      </div>
    </div>
  );
}

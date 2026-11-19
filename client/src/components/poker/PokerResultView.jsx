// FILE: client/src/components/poker/PokerResultView.jsx
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { getInitials } from '../../utils/constants';
import PokerViewportShell from './PokerViewportShell';
import {
  formatCompactChips,
  formatPlayerShortName,
  loadPokerPreferences,
} from '../../utils/pokerUiHelpers';

/**
 * Minimalist Zero-Scroll Game Result Screen:
 * - Compact header, 4-row leaderboard (2x2 on landscape >= 640px)
 * - Two side-by-side thumb buttons ("Main Lagi" and "Keluar") + 1-line disclaimer
 */
export default function PokerResultView({
  roomState,
  onPlayAgain = null,
  onBackToLobby,
  actionBusy = false,
}) {
  const preferences = loadPokerPreferences();
  const { roomId, room, table } = roomState;
  const seats = [...(table?.seats || [])].sort((a, b) => b.chips - a.chips);
  const displaySeats = seats.slice(0, 4);
  const champion =
    seats.find((s) => s.userId === room?.winnerUserId) || seats[0] || null;

  return (
    <PokerViewportShell theme={preferences.tableTheme}>
      {/* Header Ringkas */}
      <header className="pt-1 text-center space-y-0.5 px-2">
        <div className="poker-text-sm font-bold text-slate-400 poker-tabular">
          Hasil Room #{roomId}
        </div>
        <h1 className="m-0 poker-text-lg font-extrabold text-amber-400 truncate">
          {champion
            ? `${formatPlayerShortName(champion.fullName, { maxChars: 16 })} Menang`
            : 'Permainan Selesai'}
        </h1>
      </header>

      {/* Papan Peringkat Sederhana (Maks 4 Baris; 2x2 di Landscape >= 640px) */}
      <div className="my-auto mx-auto w-full max-w-md px-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {displaySeats.map((s, idx) => {
          const isTop = idx === 0 && s.chips > 0;
          return (
            <div
              key={s.userId ?? idx}
              className={`poker-flat-elevated min-h-[46px] px-3 py-1.5 flex items-center justify-between gap-2 ${
                isTop ? 'border-amber-400/60' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`poker-text-sm font-extrabold poker-tabular shrink-0 ${
                    isTop ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  #{idx + 1}
                </span>
                <Avatar
                  src={getOptimizedImageUrl(s.avatarUrl, { width: 64, height: 64 })}
                  sx={{ width: 28, height: 28, fontSize: 12 }}
                >
                  {getInitials(s.fullName)}
                </Avatar>
                <span className="poker-text-md font-bold text-slate-100 truncate">
                  {formatPlayerShortName(s.fullName, { maxChars: 14 })}
                </span>
              </div>

              <span
                className={`poker-text-sm font-extrabold poker-tabular shrink-0 ${
                  s.chips > 0 ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {s.chips > 0 ? formatCompactChips(s.chips) : 'Habis'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer: Dua Tombol ("Main Lagi" & "Keluar") + Disclaimer 1 Baris */}
      <footer className="mx-auto w-full max-w-md px-2 space-y-1.5 pb-1">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="contained"
            color="success"
            disabled={actionBusy}
            onClick={onPlayAgain || onBackToLobby}
            className="!min-h-[48px] !rounded-xl !bg-emerald-600 hover:!bg-emerald-500 !text-white !font-extrabold poker-text-md !normal-case !shadow-none"
          >
            Main Lagi
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            disabled={actionBusy}
            onClick={onBackToLobby}
            className="!min-h-[48px] !rounded-xl !border-slate-600 !text-slate-200 !font-bold poker-text-md !normal-case"
          >
            Keluar
          </Button>
        </div>
        <p className="m-0 poker-text-sm text-slate-400 text-center truncate">
          Chip virtual, tanpa uang asli
        </p>
      </footer>
    </PokerViewportShell>
  );
}

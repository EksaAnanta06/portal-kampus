// FILE: client/src/components/poker/PokerActionPanel.jsx
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';

const QUICK_EMOTES = ['👍', '😂', '😮', '👏', 'GG', '🔥'];

export default function PokerActionPanel({
  validActions,
  isMyTurn = false,
  phase = 'lobby',
  activeTurnName = '',
  selectedCodes = [],
  selectionSummary = null,
  sortMode = 'rank',
  actionBusy = false,
  onPlaySelected,
  onPass,
  onHint,
  onClearSelection,
  onToggleSortMode,
  onSendReaction,
}) {
  const canPass = Boolean(isMyTurn && validActions?.canPass);
  const canPlay = Boolean(isMyTurn && selectedCodes.length > 0 && validActions?.canPlay);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-2.5 sm:p-3 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-navy-800/95 pb-[calc(0.65rem+env(safe-area-inset-bottom))] space-y-2">
      {/* Status giliran & emote cepat */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
            {isMyTurn
              ? validActions?.mustIncludeThreeDiamond
                ? 'Giliran Anda! Wajib sertakan 3♦'
                : 'Giliran Anda memilih kartu untuk dibanting'
              : phase === 'antar_tangan'
              ? 'Menghitung poin & bersiap ke ronde berikutnya...'
              : activeTurnName
              ? `Giliran ${activeTurnName}...`
              : 'Menunggu...'}
          </span>
          {selectionSummary && (
            <Chip
              size="small"
              color="success"
              label={selectionSummary}
              className="!h-5 !text-[10px] !font-bold"
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Reaksi Emote Cepat">
          {QUICK_EMOTES.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onSendReaction(em)}
              className="min-h-[34px] min-w-[34px] rounded-xl border border-slate-200 bg-slate-50 px-1.5 text-sm font-bold hover:bg-emerald-50 active:scale-95 transition dark:border-slate-700 dark:bg-navy dark:hover:bg-emerald-950/40"
              aria-label={`Kirim reaksi ${em}`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* Tombol Permainan Big 2 Offline (Jempol-friendly) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Button
          variant="contained"
          color="success"
          disabled={!canPlay || actionBusy}
          onClick={onPlaySelected}
          startIcon={<SendRoundedIcon />}
          className="!min-h-[44px] !font-extrabold col-span-2 sm:col-span-2"
        >
          Banting {selectedCodes.length > 0 ? `(${selectedCodes.length})` : ''}
        </Button>

        <Button
          variant="outlined"
          color="warning"
          disabled={!canPass || actionBusy}
          onClick={onPass}
          startIcon={<SkipNextRoundedIcon />}
          className="!min-h-[44px] !font-bold"
        >
          Lewat (Pass)
        </Button>

        <Button
          variant="outlined"
          color="primary"
          disabled={!isMyTurn || !validActions?.suggestedMoves?.length || actionBusy}
          onClick={onHint}
          startIcon={<LightbulbOutlinedIcon />}
          className="!min-h-[44px] !font-bold"
        >
          Saran
        </Button>

        <div className="flex gap-1.5 col-span-2 sm:col-span-1">
          <Button
            variant="outlined"
            color="inherit"
            onClick={onToggleSortMode}
            startIcon={<SortRoundedIcon />}
            className="!min-h-[44px] flex-1 !text-xs !font-bold"
          >
            {sortMode === 'rank' ? 'Angka' : 'Kembang'}
          </Button>
          {selectedCodes.length > 0 && (
            <Button
              variant="text"
              color="error"
              onClick={onClearSelection}
              aria-label="Reset pilihan kartu"
              className="!min-h-[44px] !min-w-[44px] !px-2"
            >
              <ClearRoundedIcon fontSize="small" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

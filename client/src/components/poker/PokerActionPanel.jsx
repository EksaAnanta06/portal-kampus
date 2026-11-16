// FILE: client/src/components/poker/PokerActionPanel.jsx
import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const QUICK_EMOTES = ['👍', '😂', '😮', '👏', 'GG', '🔥'];

export default function PokerActionPanel({
  validActions,
  totalPot = 0,
  isMyTurn = false,
  mySeat = null,
  phase = 'lobby',
  activeTurnName = '',
  actionBusy = false,
  onAction,
  onSendReaction,
}) {
  const minBet = validActions?.minBetOrRaiseTo || 0;
  const maxBet = validActions?.maxBetOrRaiseTo || 0;
  const canBetOrRaise = Boolean(validActions?.canBet || validActions?.canRaise);

  const [betAmount, setBetAmount] = useState(minBet);
  const [confirmAllInOpen, setConfirmAllInOpen] = useState(false);

  useEffect(() => {
    if (minBet > 0) {
      setBetAmount(minBet);
    }
  }, [minBet, validActions?.allInToTotal]);

  const clampBet = (val) => Math.max(minBet, Math.min(maxBet, Math.round(val)));

  const handleQuickFraction = (ratio) => {
    if (!canBetOrRaise) return;
    const suggested = clampBet(Math.max(minBet, totalPot * ratio + (validActions?.callAmount || 0)));
    setBetAmount(suggested);
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-navy-800/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2.5">
      {/* Bar Emote Cepat (Tanpa Chat Teks Bebas) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
          {isMyTurn
            ? 'Giliran Anda bertindak'
            : phase === 'antar_tangan'
            ? 'Menyiapkan tangan berikutnya...'
            : mySeat?.folded
            ? 'Anda sudah Fold di tangan ini'
            : mySeat?.allIn
            ? 'Anda sudah All-In'
            : activeTurnName
            ? `Menunggu giliran: ${activeTurnName}`
            : 'Menunggu...'}
        </span>

        <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Reaksi Emote Cepat">
          {QUICK_EMOTES.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onSendReaction(em)}
              className="min-h-[36px] min-w-[36px] rounded-xl border border-slate-200 bg-slate-50 px-1.5 text-sm font-bold hover:bg-emerald-50 active:scale-95 transition dark:border-slate-700 dark:bg-navy dark:hover:bg-emerald-950/40"
              aria-label={`Kirim reaksi ${em}`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* Kontrol Taruhan saat Giliran Aktif */}
      {isMyTurn && validActions && (
        <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-700/70">
          {canBetOrRaise && maxBet > minBet && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBetAmount(minBet)}
                    className="min-h-[32px] rounded-lg border border-slate-200 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                  >
                    Min ({minBet})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFraction(0.5)}
                    className="min-h-[32px] rounded-lg border border-slate-200 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                  >
                    ½ Pot
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFraction(1)}
                    className="min-h-[32px] rounded-lg border border-slate-200 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                  >
                    Pot
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetAmount(maxBet)}
                    className="min-h-[32px] rounded-lg border border-amber-300 bg-amber-50 px-2 text-[11px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    Max ({maxBet})
                  </button>
                </div>
                <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                  {betAmount} chip
                </span>
              </div>

              <div className="px-2">
                <Slider
                  size="small"
                  color="success"
                  min={minBet}
                  max={maxBet}
                  step={5}
                  value={betAmount}
                  onChange={(_e, val) => setBetAmount(Number(val))}
                  aria-label="Nominal Bet atau Raise"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              variant="outlined"
              color="error"
              disabled={!validActions.canFold || actionBusy}
              onClick={() => onAction('fold')}
              className="!min-h-[44px] !font-bold"
            >
              Fold
            </Button>

            {validActions.canCheck ? (
              <Button
                variant="contained"
                color="success"
                disabled={actionBusy}
                onClick={() => onAction('check')}
                className="!min-h-[44px] !font-bold"
              >
                Check
              </Button>
            ) : validActions.canCall ? (
              <Button
                variant="contained"
                color="success"
                disabled={actionBusy}
                onClick={() => onAction('call')}
                className="!min-h-[44px] !font-bold"
              >
                Call ({validActions.callAmount})
              </Button>
            ) : null}

            {canBetOrRaise && (
              <Button
                variant="contained"
                color="primary"
                disabled={actionBusy}
                onClick={() =>
                  onAction(validActions.canBet ? 'bet' : 'raise', betAmount)
                }
                className="!min-h-[44px] !font-bold"
              >
                {validActions.canBet ? `Bet ${betAmount}` : `Raise ke ${betAmount}`}
              </Button>
            )}

            {validActions.canAllIn && (
              <Button
                variant="contained"
                color="warning"
                disabled={actionBusy}
                onClick={() => setConfirmAllInOpen(true)}
                className="!min-h-[44px] !font-bold"
              >
                All-In ({validActions.allInChips})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Konfirmasi wajib sebelum All-In di mobile agar tidak salah tekan */}
      <Dialog open={confirmAllInOpen} onClose={() => setConfirmAllInOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="!font-extrabold">Konfirmasi All-In</DialogTitle>
        <DialogContent>
          <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
            Anda akan mempertaruhkan seluruh sisa <strong>{validActions?.allInChips || 0} chip virtual</strong> pada tangan ini. Lanjutkan?
          </p>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmAllInOpen(false)} className="!min-h-[44px]">
            Batal
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setConfirmAllInOpen(false);
              onAction('all_in');
            }}
            className="!min-h-[44px]"
          >
            Ya, All-In
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

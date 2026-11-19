// FILE: client/src/components/poker/ShowdownOverlay.jsx
import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import PlayingCard from './PlayingCard';
import { formatCompactChips, formatPlayerShortName } from '../../utils/pokerUiHelpers';

/**
 * Compact Flat Showdown Overlay:
 * - Shows winner name, hand name, and tabular payout on a single header line
 * - Highlights up to 5 winning cards while dimming non-winning cards
 * - Displays a single "Lanjut" button when onDismiss is provided
 * - Zero decorative particles or chip sweep animations
 */
export default function ShowdownOverlay({
  open = false,
  winnerName = 'Pemain',
  handName = 'Pemenang',
  potAwarded = 0,
  cards = [],
  winningCardCodes = [],
  fourColorDeck = false,
  cardBackDesign = 'pasim_crest',
  reducedMotion = false,
  compact = false,
  onDismiss = null,
}) {
  const displayCards = useMemo(() => (cards || []).slice(0, 5), [cards]);
  const [revealedCount, setRevealedCount] = useState(0);
  const winningSet = useMemo(() => new Set(winningCardCodes), [winningCardCodes]);

  useEffect(() => {
    if (!open) {
      setRevealedCount(0);
      return undefined;
    }
    if (reducedMotion || displayCards.length === 0) {
      setRevealedCount(displayCards.length);
      return undefined;
    }

    setRevealedCount(0);
    const timer = window.setTimeout(() => {
      setRevealedCount(displayCards.length);
    }, 32);

    return () => window.clearTimeout(timer);
  }, [open, displayCards.length, reducedMotion]);

  if (!open) return null;

  const shortWinner = formatPlayerShortName(winnerName, { maxChars: 14 });
  const payoutText = potAwarded > 0 ? `+${formatCompactChips(potAwarded)}` : null;

  return (
    <div
      className="poker-flat-elevated relative z-30 mx-auto w-full max-w-sm px-2.5 py-2 flex flex-col items-center justify-center gap-1.5 text-center"
      role="status"
      aria-live="polite"
    >
      {/* Baris Header Tunggal: Nama Pemenang · Nama Tangan · +Chip */}
      <div className="flex items-center justify-center gap-1.5 min-w-0 max-w-full flex-wrap">
        <span className="poker-text-sm font-extrabold text-amber-400 truncate max-w-[120px]">
          {shortWinner}
        </span>
        <span className="poker-text-sm text-slate-400" aria-hidden="true">
          ·
        </span>
        <span className="poker-text-sm font-bold text-slate-100 truncate max-w-[140px]">
          {handName}
        </span>
        {payoutText && (
          <span className="poker-text-sm font-extrabold poker-tabular text-emerald-400 shrink-0">
            {payoutText}
          </span>
        )}
      </div>

      {/* Maks 5 Kartu Tengah: 5 Kartu Terbaik Disorot, Sisanya Meredup */}
      {displayCards.length > 0 && (
        <div className="flex flex-nowrap items-center justify-center gap-1 pt-2 pb-0.5 max-w-full overflow-hidden">
          {displayCards.map((c, idx) => {
            const isWinCard = winningSet.size === 0 || winningSet.has(c.code);
            const isFaceDown = idx >= revealedCount;
            return (
              <PlayingCard
                key={c.code || idx}
                card={c}
                faceDown={isFaceDown}
                size={compact ? 'xs' : 'sm'}
                fourColor={fourColorDeck}
                cardBackDesign={cardBackDesign}
                highlight={isWinCard && !isFaceDown}
                dimmed={!isWinCard && !isFaceDown}
              />
            );
          })}
        </div>
      )}

      {/* Satu Tombol "Lanjut" */}
      {onDismiss && (
        <Button
          variant="contained"
          color="success"
          onClick={onDismiss}
          className="!min-h-[44px] !min-w-[120px] !rounded-xl !bg-emerald-600 hover:!bg-emerald-500 !text-white !font-extrabold poker-text-sm !normal-case !shadow-none"
        >
          Lanjut
        </Button>
      )}
    </div>
  );
}

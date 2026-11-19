// FILE: client/src/components/poker/Seat.jsx
import Avatar from '@mui/material/Avatar';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import TurnTimerRing from './TurnTimerRing';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { getInitials } from '../../utils/constants';
import { formatCompactChips, formatPlayerShortName } from '../../utils/pokerUiHelpers';

/**
 * Minimalist Opponent Unit for Zona 2:
 * - Portrait mode: vertical compact stack (Avatar+Timer, Name+Chips/Status, 2 tiny face-down cards)
 * - Landscape mode (`compactHorizontal`): horizontal unit with opponent cards at ~62% of hole card size,
 *   side-by-side without messy overlap and with clear spacing to name & chips.
 * - Ultra-compact mode (`ultraCompact`, 320px width): shortens opponent names to 2-letter initials.
 */
export default function Seat({
  seat = null,
  isTurn = false,
  isDealer = false,
  isSb = false,
  isBb = false,
  isFolded = false,
  isAllIn = false,
  isWinner = false,
  betAmount = 0,
  turnDeadlineAt = null,
  turnTimeoutSec = 30,
  serverClockOffsetMs = 0,
  timerPreviewProgress = null,
  ultraCompact = false,
  compactHorizontal = false,
}) {
  if (!seat) {
    return (
      <div
        className={`flex items-center justify-center px-1.5 py-0.5 opacity-35 ${
          compactHorizontal ? 'flex-row gap-1.5' : 'flex-col'
        }`}
      >
        <div className="h-6 w-6 rounded-full border border-dashed border-slate-600 shrink-0" />
        <span className="poker-text-sm text-slate-400">Kosong</span>
      </div>
    );
  }

  const dimmed = Boolean(
    isFolded || seat.folded || seat.isAway || (!seat.connected && !seat.isBot)
  );
  const posTag = isDealer ? 'D' : isSb ? 'SB' : isBb ? 'BB' : null;

  const statusText = (() => {
    if (isWinner) return 'MENANG';
    if (isFolded || seat.folded) return 'FOLD';
    if (isAllIn || seat.allIn) return 'ALL-IN';
    if (seat.hasPassed) return 'LEWAT';
    if (seat.isAway || (!seat.connected && !seat.isBot)) return 'AWAY';
    return `${formatCompactChips(seat.chips)}${
      betAmount > 0 ? ` · +${formatCompactChips(betAmount)}` : ''
    }`;
  })();

  const avatarSize = compactHorizontal ? 26 : ultraCompact ? 26 : 30;
  const ringSize = avatarSize + 8;
  const cardCount = Number(seat.cardCount ?? 2);
  const shortName = formatPlayerShortName(seat.fullName, {
    ultraCompact,
    maxChars: compactHorizontal ? 8 : 9,
  });

  const avatarNode = (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: ringSize, height: ringSize }}
    >
      <TurnTimerRing
        active={Boolean(isTurn)}
        turnDeadlineAt={turnDeadlineAt}
        turnTimeoutSec={turnTimeoutSec}
        serverClockOffsetMs={serverClockOffsetMs}
        previewProgress={timerPreviewProgress}
        size={ringSize}
        strokeWidth={2.5}
      />
      <Avatar
        src={getOptimizedImageUrl(seat.avatarUrl, { width: 64, height: 64 })}
        sx={{
          width: avatarSize,
          height: avatarSize,
          fontSize: 12,
          bgcolor: seat.isBot ? '#0f172a' : '#065f46',
        }}
      >
        {seat.isBot ? <SmartToyRoundedIcon sx={{ fontSize: 13 }} /> : getInitials(seat.fullName)}
      </Avatar>
    </div>
  );

  const infoNode = (
    <div
      className={`${
        compactHorizontal ? 'text-left max-w-[78px]' : 'mt-0.5 text-center max-w-[92px]'
      } min-w-0 leading-tight`}
    >
      <div className="poker-text-sm font-bold text-slate-100 truncate">
        {posTag ? `${posTag}·` : ''}
        {shortName}
      </div>
      <div
        className={`poker-text-sm font-extrabold poker-tabular truncate ${
          isWinner || isAllIn || seat.allIn ? 'text-amber-400' : 'text-emerald-400'
        }`}
      >
        {statusText}
      </div>
    </div>
  );

  const cardsNode =
    cardCount > 0 && !isFolded && !seat.folded ? (
      <div
        className={`${
          compactHorizontal ? 'ml-1.5 gap-1' : 'mt-0.5 gap-0.5'
        } inline-flex items-center shrink-0`}
        aria-label={`${cardCount} kartu tertutup`}
      >
        <span
          className={`${
            compactHorizontal
              ? 'poker-ls-opp-card rounded-[4px] border border-amber-400/35 bg-slate-800 shadow-sm'
              : 'h-3.5 w-2.5 rounded-[2px] border border-slate-500 bg-slate-800'
          } inline-block`}
        />
        <span
          className={`${
            compactHorizontal
              ? 'poker-ls-opp-card rounded-[4px] border border-amber-400/35 bg-slate-800 shadow-sm'
              : 'h-3.5 w-2.5 rounded-[2px] border border-slate-500 bg-slate-800'
          } inline-block`}
        />
        {cardCount > 2 && (
          <span className="poker-text-sm font-bold poker-tabular text-slate-300 ml-0.5">
            {cardCount}
          </span>
        )}
      </div>
    ) : null;

  return (
    <div
      className={`flex items-center justify-center min-w-0 rounded-xl transition-opacity ${
        compactHorizontal ? 'flex-row gap-2 px-1.5 py-0.5' : 'flex-col px-1.5 py-0.5'
      } ${dimmed ? 'opacity-45' : 'opacity-100'} ${
        isWinner ? 'ring-1 ring-amber-400 bg-amber-500/10' : ''
      }`}
    >
      {avatarNode}
      {infoNode}
      {cardsNode}
    </div>
  );
}

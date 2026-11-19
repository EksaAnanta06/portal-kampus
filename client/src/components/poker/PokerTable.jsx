// FILE: client/src/components/poker/PokerTable.jsx
import { useMemo } from 'react';
import Seat from './Seat';
import PotDisplay from './PotDisplay';
import PlayingCard from './PlayingCard';
import DraggableHand from './DraggableHand';
import ShowdownOverlay from './ShowdownOverlay';
import {
  mapSeatsRelativeToViewer,
  formatCompactChips,
} from '../../utils/pokerUiHelpers';

/**
 * Minimalist Flat Poker Table (Zonas 2, 3, and 4):
 * - Portrait mode remains untouched.
 * - Landscape mode (`isLandscape`):
 *   - Hole cards: ~22-26% of viewport height (5:7 ratio), gap 10-14px, gentle fan (±3.5°),
 *     with reserved top headroom so lifted/selected cards are never clipped.
 *   - Community cards: ~19-23% of viewport height (5:7 ratio), 5 slots in 1 row with gap 8-12px.
 *   - Opponent cards: ~62% of hole card size, clearly separated from name & chips.
 */
export default function PokerTable({
  theme = 'emerald_royal',
  cardBackDesign = 'pasim_crest',
  fourColorDeck = false,
  layoutMode = 'mobile_portrait',
  ultraCompact = false,
  seats = [],
  viewerSeat = 0,
  currentTurnSeat = null,
  dealerSeat = null,
  sbSeat = null,
  bbSeat = null,
  starterSeat = null,
  winnerSeats = [],
  turnDeadlineAt = null,
  turnTimeoutSec = 30,
  serverClockOffsetMs = 0,
  timerPreviewProgress = null,
  totalPot = 0,
  sidePots = [],
  communityCards = [],
  currentPlay = null,
  mustIncludeThreeDiamond = false,
  myHoleCards = [],
  selectedCodes = [],
  winningCardCodes = [],
  onToggleCard = null,
  centerSlot = null,
  activeAnimationStep = null,
  reducedMotion = false,
  showdownState = null,
  onDismissShowdown = null,
  sfx = null,
  orderedCards = null,
  dimmedCodes = null,
  comboLabel = '',
  onReorder = null,
  onAutoOrder = null,
  onResetOrder = null,
}) {
  const rel = useMemo(
    () => mapSeatsRelativeToViewer(seats, viewerSeat, 4),
    [seats, viewerSeat]
  );

  const winnerSet = useMemo(() => new Set(winnerSeats), [winnerSeats]);
  const winningCodeSet = useMemo(() => new Set(winningCardCodes), [winningCardCodes]);
  const isLandscape = layoutMode === 'mobile_landscape';
  const isCompact = ultraCompact || layoutMode === 'mobile_portrait' || isLandscape;

  const opponents = [rel.left, rel.top, rel.right];
  const boardCards = currentPlay?.cards?.length ? currentPlay.cards : communityCards;

  const handCount = Array.isArray(myHoleCards) ? myHoleCards.length : 0;
  const handOverlapClass = (() => {
    if (isLandscape) {
      if (handCount <= 2) return '';
      if (handCount <= 5) return 'gap-2.5 sm:gap-3';
      if (handCount <= 8) return '-space-x-4 sm:-space-x-3';
      return '-space-x-6 sm:-space-x-5';
    }
    if (handCount <= 2) return 'gap-2.5';
    if (handCount <= 5) return 'gap-1';
    if (ultraCompact) return '-space-x-6';
    if (isCompact) return '-space-x-5';
    return '-space-x-3.5';
  })();

  const myPosBadge = (() => {
    const sIdx = rel.bottom?.seatIndex;
    if (sIdx === undefined || sIdx === null) return null;
    if (sIdx === dealerSeat) return 'D';
    if (sIdx === sbSeat) return 'SB';
    if (sIdx === bbSeat) return 'BB';
    if (sIdx === starterSeat) return '3♦';
    return null;
  })();

  const renderOpponentUnit = (seat, key) => (
    <div key={key} className="flex-1 min-w-0 flex justify-center">
      <Seat
        seat={seat}
        isTurn={Boolean(seat && seat.seatIndex === currentTurnSeat)}
        isDealer={Boolean(seat && seat.seatIndex === dealerSeat)}
        isSb={Boolean(seat && seat.seatIndex === sbSeat)}
        isBb={Boolean(seat && seat.seatIndex === bbSeat)}
        isFolded={Boolean(seat?.folded)}
        isAllIn={Boolean(seat?.allIn)}
        isWinner={Boolean(seat && winnerSet.has(seat.seatIndex))}
        betAmount={seat?.streetBet || 0}
        turnDeadlineAt={turnDeadlineAt}
        turnTimeoutSec={turnTimeoutSec}
        serverClockOffsetMs={serverClockOffsetMs}
        timerPreviewProgress={
          seat && seat.seatIndex === currentTurnSeat ? timerPreviewProgress : null
        }
        ultraCompact={ultraCompact}
        compactHorizontal={isLandscape}
      />
    </div>
  );

  const boardCardSize = ultraCompact && !isLandscape ? 'xs' : isCompact ? 'sm' : 'md';
  const emptySlotSizeCls = isLandscape
    ? 'poker-ls-comm-card'
    : boardCardSize === 'xs'
    ? 'w-8 h-11'
    : boardCardSize === 'sm'
    ? 'w-10 h-14'
    : 'w-[50px] h-[70px]';

  // Hitung rotasi fan ringan (±3.5°) khusus di Landscape
  const computeLandscapeFanRotation = (idx, count) => {
    if (!isLandscape || reducedMotion || count <= 1) return undefined;
    if (count === 2) {
      const deg = idx === 0 ? -3.5 : 3.5;
      return {
        transform: `rotate(${deg}deg)`,
        transformOrigin: 'bottom center',
      };
    }
    if (count <= 5) {
      const mid = (count - 1) / 2;
      const deg = (idx - mid) * 2.2;
      return {
        transform: `rotate(${deg}deg)`,
        transformOrigin: 'bottom center',
      };
    }
    return undefined;
  };

  return (
    <div data-poker-theme={theme} className="contents">
      {/* ZONA 2 (≈ 22%): Baris Lawan Horizontal (1 s.d. 3 Lawan Sejajar) */}
      <section
        className={`poker-flat-panel flex items-center justify-around min-h-0 overflow-hidden ${
          ultraCompact || isLandscape ? 'px-1.5 py-0.5 gap-1' : 'px-2 py-1 gap-1'
        }`}
        aria-label="Zona pemain lawan"
      >
        {opponents.map((opp, idx) => renderOpponentUnit(opp, opp?.seatIndex ?? `empty-${idx}`))}
      </section>

      {/* ZONA 3 (≈ 28%): Lima Slot Community Card + Pot Satu Angka Besar */}
      <section
        className={`poker-flat-panel flex items-center justify-center min-h-0 overflow-hidden relative ${
          isLandscape
            ? 'flex-row flex-nowrap px-2 py-0.5 gap-3'
            : ultraCompact
            ? 'flex-col px-1.5 py-1 gap-1'
            : 'flex-col px-2 py-1.5 gap-1.5'
        }`}
        aria-label="Zona kartu tengah dan pot"
      >
        {showdownState?.open ? (
          <ShowdownOverlay
            open
            winnerName={showdownState.winnerName}
            handName={showdownState.handName}
            potAwarded={showdownState.potAwarded ?? totalPot}
            cards={showdownState.cards || boardCards}
            winningCardCodes={showdownState.winningCardCodes || winningCardCodes}
            fourColorDeck={fourColorDeck}
            cardBackDesign={cardBackDesign}
            reducedMotion={reducedMotion}
            compact={isCompact}
            onDismiss={onDismissShowdown}
          />
        ) : centerSlot ? (
          centerSlot
        ) : (
          <>
            {/* 5 Slot Community Card (Satu baris, jarak >= 8-12px di landscape) */}
            <div
              className={`flex flex-nowrap items-center justify-center ${
                isLandscape ? '' : 'gap-1 sm:gap-1.5'
              }`}
              style={isLandscape ? { gap: 'var(--ls-comm-gap, 14px)' } : undefined}
              role="group"
              aria-label="Kartu komunitas meja"
            >
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const card = boardCards[slotIdx] || null;
                if (!card) {
                  return (
                    <div
                      key={`slot-${slotIdx}`}
                      className={`${emptySlotSizeCls} rounded-[var(--poker-radius-sm)] border border-dashed border-slate-700 bg-slate-900/35 shrink-0`}
                      aria-hidden="true"
                    />
                  );
                }
                return (
                  <div
                    key={card.code || slotIdx}
                    className={!reducedMotion ? 'poker-anim-community' : ''}
                    style={{ '--comm-delay-ms': `${slotIdx * 40}ms` }}
                  >
                    <PlayingCard
                      card={card}
                      size={boardCardSize}
                      landscapeRole={isLandscape ? 'community' : null}
                      fourColor={fourColorDeck}
                      cardBackDesign={cardBackDesign}
                      highlight={Boolean(currentPlay?.isBomb || winningCodeSet.has(card.code))}
                      dimmed={winningCodeSet.size > 0 && !winningCodeSet.has(card.code)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Pot Sebagai Satu Angka Besar (Di Samping Kanan Kartu Tengah saat Landscape agar Tinggi Kartu Maksimal) */}
            {totalPot > 0 ? (
              <PotDisplay totalPot={totalPot} sidePots={sidePots} />
            ) : (
              <div className="poker-text-sm font-semibold text-slate-400 truncate max-w-[140px]">
                {currentPlay?.label
                  ? `${currentPlay.label} · ${currentPlay.fullName}`
                  : mustIncludeThreeDiamond
                  ? 'Wajib 3♦'
                  : 'Meja siap'}
              </div>
            )}
          </>
        )}
      </section>

      {/* ZONA 4 (≈ 22%): Kartu Sendiri Besar & Jelas + Ruang Cadangan Atas untuk Kartu Terangkat */}
      <section
        className={`poker-flat-panel flex items-center justify-center min-h-0 overflow-hidden relative ${
          isLandscape
            ? handCount > 5
              ? 'flex-row px-1.5 pt-2 pb-0.5'
              : 'flex-row px-2 pt-2.5 pb-0.5 gap-3'
            : ultraCompact
            ? 'flex-col px-1.5 pt-2 pb-0.5 gap-0.5'
            : 'flex-col px-2 pt-2 pb-1 gap-1'
        }`}
        aria-label="Zona kartu dan chip Anda"
      >
        {handCount > 0 && (
          <DraggableHand
            cards={myHoleCards}
            selectedCodes={selectedCodes}
            winningCodeSet={winningCodeSet}
            cardSize={
              ultraCompact && !isLandscape
                ? handCount > 2
                  ? 'xs'
                  : 'md'
                : handCount > 5
                ? 'sm'
                : 'lg'
            }
            isLandscape={isLandscape}
            ultraCompact={ultraCompact}
            fourColorDeck={fourColorDeck}
            cardBackDesign={cardBackDesign}
            onToggleCard={onToggleCard}
            reducedMotion={reducedMotion}
            handOverlapClass={handOverlapClass}
            activeAnimationStep={activeAnimationStep}
            sfx={sfx}
            orderedCards={orderedCards}
            dimmedCodes={dimmedCodes}
            comboLabel={comboLabel}
            onReorder={onReorder}
            onAutoOrder={onAutoOrder}
            onResetOrder={onResetOrder}
          />
        )}

        {/* Badge Posisi Seragam (D/SB/BB) + Chip Sendiri */}
        <div
          className={`inline-flex items-center shrink-0 ${
            isLandscape && handCount > 5
              ? 'absolute top-1 right-2 bg-slate-900/85 border border-slate-700/60 px-2 py-0.5 rounded-lg z-10'
              : isLandscape
              ? 'flex-col items-start gap-0.5'
              : 'gap-2'
          }`}
        >
          <div className="inline-flex items-center gap-1.5">
            {myPosBadge && (
              <span className="px-1.5 py-0.5 rounded border border-amber-400/60 bg-amber-500/15 poker-text-sm font-extrabold text-amber-300 poker-tabular">
                {myPosBadge}
              </span>
            )}
            <span className="poker-text-md font-extrabold poker-tabular text-emerald-400">
              {formatCompactChips(rel.bottom?.chips ?? 1000)} chip
            </span>
          </div>
          {rel.bottom?.streetBet > 0 && (
            <span className="poker-text-sm font-bold poker-tabular text-slate-400">
              Taruhan {formatCompactChips(rel.bottom.streetBet)}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

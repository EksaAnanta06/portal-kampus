// FILE: client/src/components/poker/FlyingTableOverlay.jsx
import { useMemo, useState, useEffect } from 'react';
import CardBack from './CardBack';
import PlayingCard from './PlayingCard';
import {
  computeArcThrowParams,
  formatCompactChips,
} from '../../utils/pokerUiHelpers';

/**
 * Lapisan Animasi Terpisah (Overlay Portal) di Atas Meja:
 * - position: absolute, inset: 0, pointer-events: none (dengan area tangkap tap untuk skip)
 * - overflow: visible, tidak pernah terpotong container mana pun
 * - Hanya menganimasikan transform & opacity dengan GPU acceleration (will-change)
 * - Mensimulasikan lemparan kartu realistis: lintasan busur parabola, rotasi acak ber-seed,
 *   ilusi kedalaman (scale 1.0 -> 1.12 -> 1.0), 3D flip kartu sendiri saat mendarat
 * - Animasi lemparan chip taruhan ke pot & pot sweep ke pemenang
 * - Responsif terhadap animationSpeed: 'full' | 'fast' | 'off' dan prefers-reduced-motion
 */
export default function FlyingTableOverlay({
  activeStep = null,
  animationSpeed = 'full',
  reducedMotion = false,
  cardBackDesign = 'pasim_crest',
  fourColorDeck = false,
  onFastForward = null,
}) {
  const isOff = animationSpeed === 'off' || reducedMotion;

  // Jika animasi dimatikan atau tidak ada step aktif yang butuh terbang, jangan render apapun
  if (isOff || !activeStep) {
    return null;
  }

  const { type, payload = {}, id: stepId } = activeStep;
  const isFlightStep =
    type === 'deal' ||
    type === 'bet_chips' ||
    type === 'collect_pot' ||
    type === 'pot_to_winner';

  if (!isFlightStep) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40 overflow-visible select-none"
      aria-hidden="true"
    >
      {/* Area sentuh transparan untuk tap-to-skip / mempercepat */}
      {onFastForward && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onFastForward}
          className="absolute inset-0 w-full h-full pointer-events-auto bg-transparent border-0 cursor-default focus:outline-none"
          title="Ketuk untuk mempercepat animasi"
          aria-label="Percepat animasi"
        />
      )}

      {/* 1. Animasi Lemparan Kartu (Bagi Kartu / Deal) */}
      {type === 'deal' && (
        <FlyingDealCards
          stepId={stepId}
          payload={payload}
          animationSpeed={animationSpeed}
          cardBackDesign={cardBackDesign}
          fourColorDeck={fourColorDeck}
        />
      )}

      {/* 2. Animasi Lemparan Chip Taruhan */}
      {type === 'bet_chips' && (
        <FlyingBetChips
          stepId={stepId}
          payload={payload}
          animationSpeed={animationSpeed}
        />
      )}

      {/* 3. Animasi Sapuan Pot ke Pemenang */}
      {type === 'pot_to_winner' && (
        <FlyingPotWinner
          stepId={stepId}
          payload={payload}
          animationSpeed={animationSpeed}
        />
      )}
    </div>
  );
}

/**
 * Render kartu terbang dari dek tengah ke kursi pemain dengan busur parabola
 */
function FlyingDealCards({
  stepId,
  payload = {},
  animationSpeed = 'full',
  cardBackDesign = 'pasim_crest',
  fourColorDeck = false,
}) {
  const {
    targetSlot = 'bottom',
    cardCount = 2,
    cards = [],
    handId = 1,
  } = payload;

  const cardsToFly = useMemo(() => {
    const list = [];
    const count = Math.min(13, Math.max(1, cardCount || cards.length || 2));
    for (let i = 0; i < count; i += 1) {
      const cardObj = cards[i] || null;
      const params = computeArcThrowParams({
        handId,
        cardIndex: i,
        slotPosition: targetSlot,
        animationSpeed,
      });
      list.push({ index: i, card: cardObj, params });
    }
    return list;
  }, [handId, targetSlot, cardCount, cards, animationSpeed]);

  // Koordinat target relative terhadap meja (persentase)
  const targetCoordinates = {
    bottom: { x: '50%', y: '82%' },
    left: { x: '18%', y: '40%' },
    top: { x: '50%', y: '16%' },
    right: { x: '82%', y: '40%' },
    community: { x: '50%', y: '50%' },
  };

  const targetPos = targetCoordinates[targetSlot] || targetCoordinates.bottom;

  return (
    <>
      {cardsToFly.map(({ index, card, params }) => {
        const isBottom = targetSlot === 'bottom';
        const flipDelayMs = params.durationMs + 40;

        return (
          <div
            key={`${stepId}-card-${index}`}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform"
            style={{
              '--target-x': targetPos.x,
              '--target-y': targetPos.y,
              '--arc-y': `${params.arcApexY}px`,
              '--rot-init': `${params.initialRotationDeg}deg`,
              '--rot-settle': `${params.settleRotationDeg}deg`,
              '--dur-ms': `${params.durationMs}ms`,
              '--delay-ms': `${index * params.staggerMs}ms`,
              animation: `pokerArcThrow var(--dur-ms) cubic-bezier(0.2, 0.8, 0.25, 1) var(--delay-ms) forwards`,
            }}
          >
            {/* Kartu 3D Flip saat mendarat untuk pemain sendiri (bottom), atau tetap CardBack untuk lawan */}
            <div
              className="w-12 h-16 sm:w-14 sm:h-20"
              style={{
                perspective: '600px',
              }}
            >
              {isBottom && card ? (
                <div
                  className="w-full h-full relative"
                  style={{
                    transformStyle: 'preserve-3d',
                    animation: `pokerCard3DFlip 280ms cubic-bezier(0.2, 0.8, 0.25, 1) ${
                      index * params.staggerMs + flipDelayMs
                    }ms forwards`,
                  }}
                >
                  {/* Sisi Belakang */}
                  <div
                    className="absolute inset-0 backface-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <CardBack design={cardBackDesign} />
                  </div>
                  {/* Sisi Depan */}
                  <div
                    className="absolute inset-0 backface-hidden"
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <PlayingCard
                      card={card}
                      size="sm"
                      fourColor={fourColorDeck}
                      cardBackDesign={cardBackDesign}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full shadow-lg rounded-lg overflow-hidden">
                  <CardBack design={cardBackDesign} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Render chip taruhan terbang dari kursi pemain ke area pot tengah
 */
function FlyingBetChips({
  stepId,
  payload = {},
  animationSpeed = 'full',
}) {
  const {
    fromSlot = 'bottom',
    amount = 50,
  } = payload;

  const durationMs = animationSpeed === 'fast' ? 180 : 320;

  const startPositions = {
    bottom: { x: '50%', y: '84%' },
    left: { x: '20%', y: '42%' },
    top: { x: '50%', y: '18%' },
    right: { x: '80%', y: '42%' },
  };

  const startPos = startPositions[fromSlot] || startPositions.bottom;

  return (
    <div
      key={stepId}
      className="absolute -translate-x-1/2 -translate-y-1/2 will-change-transform flex items-center gap-1 bg-slate-900/90 border border-amber-400/80 px-2 py-0.5 rounded-full shadow-xl"
      style={{
        left: startPos.x,
        top: startPos.y,
        '--dest-x': '50%',
        '--dest-y': '50%',
        animation: `pokerChipThrow ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
      }}
    >
      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-200 inline-block shrink-0 shadow-inner" />
      <span className="text-[12px] font-extrabold text-amber-300 font-mono tracking-tight">
        {formatCompactChips(amount)}
      </span>
    </div>
  );
}

/**
 * Render pot bergerak ke arah kursi pemenang saat ronde berakhir
 */
function FlyingPotWinner({
  stepId,
  payload = {},
  animationSpeed = 'full',
}) {
  const {
    winnerSlot = 'bottom',
    totalWon = 200,
  } = payload;

  const durationMs = animationSpeed === 'fast' ? 240 : 420;

  const destPositions = {
    bottom: { x: '50%', y: '84%' },
    left: { x: '20%', y: '42%' },
    top: { x: '50%', y: '18%' },
    right: { x: '80%', y: '42%' },
  };

  const destPos = destPositions[winnerSlot] || destPositions.bottom;

  return (
    <div
      key={stepId}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform flex items-center gap-1.5 bg-emerald-950/90 border-2 border-emerald-400 px-3 py-1 rounded-full shadow-2xl"
      style={{
        '--dest-x': destPos.x,
        '--dest-y': destPos.y,
        animation: `pokerPotSweep ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
      }}
    >
      <span className="w-4 h-4 rounded-full bg-amber-400 border border-amber-100 inline-block shrink-0 shadow-md" />
      <span className="text-[13px] font-black text-emerald-200 font-mono">
        +{formatCompactChips(totalWon)}
      </span>
    </div>
  );
}

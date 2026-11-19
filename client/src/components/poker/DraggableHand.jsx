// FILE: client/src/components/poker/DraggableHand.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PlayingCard from './PlayingCard';
import {
  reorderArray,
  autoOrderHandCards,
  computeDealCardTransform,
  computeLandscapeFanRotation,
} from '../../utils/pokerUiHelpers';

/**
 * Komponen Susun Kartu dengan Drag and Drop ke Samping (Horizontal Only)
 * - Murni visual dan lokal (tidak mengubah backend/state server)
 * - Kunci sumbu horizontal (X) dengan toleransi vertikal kecil
 * - Ambang aktivasi ±6px agar ketukan biasa (tap-to-select) tidak tertukar dengan drag
 * - Live reorder preview saat diseret (scale ~1.08, shadow lebih besar)
 * - Snap dengan animasi pegas singkat, haptic feedback 15ms, dan snap SFX
 * - Aksesibilitas penuh: keyboard ArrowLeft / ArrowRight dengan aria-live
 * - Tombol Auto-Urut (evaluator kombinasi terbaik di kiri, kicker di kanan, non-combo redup) & Reset
 */
export default function DraggableHand({
  cards = [],
  selectedCodes = [],
  winningCodeSet = new Set(),
  cardSize = 'md',
  isLandscape = false,
  ultraCompact = false,
  fourColorDeck = false,
  cardBackDesign = 'pasim_crest',
  onToggleCard = null,
  reducedMotion = false,
  handOverlapClass = '',
  activeAnimationStep = null,
  sfx = null,
  orderedCards: controlledCards = null,
  dimmedCodes: controlledDimmed = null,
  comboLabel: controlledComboLabel = '',
  onReorder = null,
  onAutoOrder = null,
  onResetOrder = null,
}) {
  // Urutan kartu lokal (jika tidak dikendalikan dari parent)
  const [localOrderedCards, setLocalOrderedCards] = useState(() => cards || []);
  const [localDimmedCodes, setLocalDimmedCodes] = useState(() => new Set());
  const [localComboLabel, setLocalComboLabel] = useState('');
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');

  const isControlled = Array.isArray(controlledCards);
  const orderedCards = isControlled ? controlledCards : localOrderedCards;
  const dimmedCodes = isControlled ? (controlledDimmed || new Set()) : localDimmedCodes;
  const comboLabel = isControlled ? controlledComboLabel : localComboLabel;

  // Status dragging pointer
  const [dragState, setDragState] = useState(null);

  const containerRef = useRef(null);
  const cardRefs = useRef(new Map());
  const prevCardsRef = useRef(cards);

  // Pertahankan susunan manual saat cards dari server berubah (uncontrolled mode)
  useEffect(() => {
    if (isControlled) return;
    const prev = prevCardsRef.current || [];
    prevCardsRef.current = cards;

    if (!Array.isArray(cards) || cards.length === 0) {
      setLocalOrderedCards([]);
      setLocalDimmedCodes(new Set());
      setLocalComboLabel('');
      return;
    }

    const currentCodes = new Set(cards.map((c) => c.code));
    const cardByCode = new Map(cards.map((c) => [c.code, c]));

    const retained = localOrderedCards
      .filter((c) => currentCodes.has(c.code))
      .map((c) => cardByCode.get(c.code) || c);

    const retainedCodes = new Set(retained.map((c) => c.code));
    const newlyAdded = cards.filter((c) => !retainedCodes.has(c.code));

    setLocalOrderedCards([...retained, ...newlyAdded]);
  }, [cards, isControlled, localOrderedCards]);

  const handCount = orderedCards.length;

  // Handler Auto-Urut
  const handleAutoOrder = useCallback(() => {
    if (onAutoOrder) {
      onAutoOrder();
      return;
    }
    if (!orderedCards.length) return;
    const res = autoOrderHandCards(orderedCards);
    if (!res || !res.orderedCards) return;

    setLocalOrderedCards(res.orderedCards);
    if (res.orderedCards.length > 5 && res.bestComboCardCodes && res.bestComboCardCodes.size > 0) {
      const nonBestCodes = new Set(
        res.orderedCards
          .filter((c) => !res.bestComboCardCodes.has(c.code))
          .map((c) => c.code)
      );
      setLocalDimmedCodes(nonBestCodes);
    } else {
      setLocalDimmedCodes(new Set());
    }

    setLocalComboLabel(res.label || '');
    setAriaAnnouncement(
      `Kartu diurutkan otomatis: ${res.label || 'Kombinasi terbaik'}.`
    );

    sfx?.playCardSnap?.();
    sfx?.triggerCardSnapHaptic?.(15);
  }, [onAutoOrder, orderedCards, sfx]);

  // Handler Reset ke Urutan Awal Server
  const handleResetOrder = useCallback(() => {
    if (onResetOrder) {
      onResetOrder();
      return;
    }
    if (!cards.length) return;
    setLocalOrderedCards([...cards]);
    setLocalDimmedCodes(new Set());
    setLocalComboLabel('');
    setAriaAnnouncement('Susunan kartu dikembalikan ke posisi awal.');

    sfx?.playCardSnap?.();
    sfx?.triggerCardSnapHaptic?.(15);
  }, [cards, onResetOrder, sfx]);

  // Pointer Down (Mouse & Touch)
  const handlePointerDown = (e, card, index) => {
    // Hanya tangani tombol utama mouse (kiri) atau sentuhan
    if (e.button !== undefined && e.button !== 0) return;

    const el = cardRefs.current.get(card.code);
    const rect = el ? el.getBoundingClientRect() : null;
    const cardWidth = rect ? rect.width : 56;

    // Perkirakan jarak antar-slot kartu
    let slotStep = cardWidth;
    if (containerRef.current && orderedCards.length > 1) {
      const containerRect = containerRef.current.getBoundingClientRect();
      slotStep = Math.max(16, (containerRect.width - cardWidth) / (orderedCards.length - 1));
    }

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch (_err) {
      // Abaikan jika browser tidak mendukung capture
    }

    setDragState({
      pointerId: e.pointerId,
      cardCode: card.code,
      fromIndex: index,
      hoverIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      deltaX: 0,
      isDragging: false,
      cardWidth,
      slotStep,
    });
  };

  // Pointer Move
  const handlePointerMove = (e) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    // Kunci sumbu X: jika gerakan vertikal terlalu dominan sebelum drag aktif, batalkan drag
    if (!dragState.isDragging) {
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) {
        // Gerakan vertikal pengguna, batalkan drag kartu
        setDragState(null);
        return;
      }
      // Ambang batas aktivasi ±6px horizontal
      if (Math.abs(dx) >= 6) {
        setDragState((prev) => (prev ? { ...prev, isDragging: true, deltaX: dx } : null));
      }
      return;
    }

    // Drag sedang aktif: hitung hoverIndex berdasarkan pergeseran X
    const step = Math.max(16, dragState.slotStep);
    const slotsShift = Math.round(dx / step);
    const candidateIdx = Math.max(
      0,
      Math.min(orderedCards.length - 1, dragState.fromIndex + slotsShift)
    );

    setDragState((prev) =>
      prev
        ? {
            ...prev,
            deltaX: dx,
            hoverIndex: candidateIdx,
          }
        : null
    );
  };

  // Pointer Up / Snap
  const handlePointerUp = (e) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch (_err) {
      // Abaikan
    }

    if (dragState.isDragging) {
      const from = dragState.fromIndex;
      const to = dragState.hoverIndex;

      if (from !== to) {
        if (onReorder) {
          onReorder(from, to);
        } else {
          const nextCards = reorderArray(orderedCards, from, to);
          setLocalOrderedCards(nextCards);
          sfx?.playCardSnap?.();
          sfx?.triggerCardSnapHaptic?.(15);
        }

        const movedCard = orderedCards[from];
        setAriaAnnouncement(
          `Kartu ${movedCard?.code || ''} dipindahkan ke posisi ${to + 1} dari ${orderedCards.length}`
        );
      }
    } else {
      // Bukan drag (klik / tap murni < 6px) -> panggil onToggleCard
      if (onToggleCard) {
        onToggleCard(dragState.cardCode);
      }
    }

    setDragState(null);
  };

  const handlePointerCancel = (e) => {
    if (dragState && dragState.pointerId === e.pointerId) {
      setDragState(null);
    }
  };

  // Navigasi Keyboard (Aksesibilitas)
  const handleKeyDown = (e, card, index) => {
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      if (onReorder) {
        onReorder(index, index - 1);
      } else {
        const nextCards = reorderArray(orderedCards, index, index - 1);
        setLocalOrderedCards(nextCards);
        sfx?.playCardSnap?.();
        sfx?.triggerCardSnapHaptic?.(15);
      }
      setAriaAnnouncement(
        `Kartu ${card.code} dipindahkan ke posisi ${index} dari ${orderedCards.length}`
      );
      // Pindahkan fokus ke kartu yang berpindah
      setTimeout(() => {
        cardRefs.current.get(card.code)?.focus();
      }, 20);
    } else if (e.key === 'ArrowRight' && index < orderedCards.length - 1) {
      e.preventDefault();
      if (onReorder) {
        onReorder(index, index + 1);
      } else {
        const nextCards = reorderArray(orderedCards, index, index + 1);
        setLocalOrderedCards(nextCards);
        sfx?.playCardSnap?.();
        sfx?.triggerCardSnapHaptic?.(15);
      }
      setAriaAnnouncement(
        `Kartu ${card.code} dipindahkan ke posisi ${index + 2} dari ${orderedCards.length}`
      );
      setTimeout(() => {
        cardRefs.current.get(card.code)?.focus();
      }, 20);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onToggleCard) onToggleCard(card.code);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center max-w-full">
      {/* Pengumuman Aksesibilitas aria-live */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaAnnouncement}
      </span>

      {/* Kontrol Cepat: Auto-Urut [Urut] & [Reset] (Hanya tampil di portrait, di landscape dipindahkan ke ActionPanel) */}
      {handCount > 1 && !isLandscape && (
        <div className="flex items-center gap-1.5 z-20 mb-0.5">
          <button
            type="button"
            onClick={handleAutoOrder}
            className="px-2 py-0.5 rounded-md border border-emerald-500/50 bg-slate-900/85 text-emerald-300 hover:bg-emerald-500/20 active:scale-95 text-xs font-bold tracking-tight shadow-sm transition min-h-[28px]"
            aria-label="Urutkan kartu otomatis sesuai kombinasi terbaik"
          >
            Urut{comboLabel ? `: ${comboLabel}` : ''}
          </button>
          <button
            type="button"
            onClick={handleResetOrder}
            className="px-1.5 py-0.5 rounded-md border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95 text-xs font-medium shadow-sm transition min-h-[28px]"
            aria-label="Kembalikan susunan kartu ke urutan semula"
          >
            Reset
          </button>
        </div>
      )}

      {/* Baris Kartu yang Dapat Diseret (Horizontal Drag) */}
      <div
        ref={containerRef}
        className={`flex flex-nowrap items-center justify-center max-w-full overflow-visible select-none ${
          isLandscape ? 'pt-1 pb-0.5' : 'py-0.5'
        } ${handOverlapClass}`}
        style={
          isLandscape && handCount === 2
            ? { gap: 'var(--ls-hole-gap, 18px)' }
            : undefined
        }
        role="group"
        aria-label="Kartu di tangan Anda"
      >
        {orderedCards.map((c, idx) => {
          const dealStyle = computeDealCardTransform('bottom', idx);
          const fanStyle = computeLandscapeFanRotation(idx, handCount);
          const isDealing = activeAnimationStep?.type === 'deal';

          // Menghitung pergeseran kartu lain saat ada yang sedang di-drag (live reorder preview)
          const isDraggedCard = dragState?.isDragging && dragState?.cardCode === c.code;
          let liveShiftX = 0;
          if (dragState?.isDragging && !isDraggedCard) {
            const from = dragState.fromIndex;
            const hover = dragState.hoverIndex;
            const step = dragState.slotStep || 30;

            if (from < hover && idx > from && idx <= hover) {
              liveShiftX = -step; // Geser ke kiri
            } else if (from > hover && idx >= hover && idx < from) {
              liveShiftX = step; // Geser ke kanan
            }
          }

          // Gaya dinamis kartu yang di-drag vs kartu yang bergeser
          const cardTransformStyle = isDraggedCard
            ? {
                transform: `translateX(${dragState.deltaX}px) scale(1.08)`,
                zIndex: 50,
                boxShadow: '0 12px 24px -4px rgba(0,0,0,0.7)',
                transition: 'none',
              }
            : {
                transform: liveShiftX !== 0 ? `translateX(${liveShiftX}px)` : undefined,
                transition: reducedMotion ? 'none' : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)',
              };

          const isDimmed =
            (dimmedCodes.has(c.code) && !winningCodeSet.has(c.code)) ||
            (winningCodeSet.size > 0 && !winningCodeSet.has(c.code));

          return (
            <div
              key={c.code}
              ref={(el) => {
                if (el) cardRefs.current.set(c.code, el);
                else cardRefs.current.delete(c.code);
              }}
              tabIndex={0}
              role="button"
              aria-label={`Kartu ${c.code}, posisi ${idx + 1} dari ${handCount}. Tekan panah kiri atau kanan untuk memindahkan.`}
              onPointerDown={(e) => handlePointerDown(e, c, idx)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onKeyDown={(e) => handleKeyDown(e, c, idx)}
              className={`touch-none relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 rounded-lg ${
                !reducedMotion && isDealing ? 'poker-anim-deal' : ''
              }`}
              style={{
                ...dealStyle,
                ...(fanStyle || {}),
                ...cardTransformStyle,
              }}
            >
              <PlayingCard
                card={c}
                size={cardSize}
                landscapeRole={isLandscape ? 'hole' : null}
                className={isLandscape && handCount > 5 ? 'is-multi-hand' : ''}
                fourColor={fourColorDeck}
                cardBackDesign={cardBackDesign}
                selected={selectedCodes.includes(c.code)}
                highlight={winningCodeSet.has(c.code)}
                dimmed={isDimmed}
                // Klik ditangani oleh onPointerUp untuk membedakan tap vs drag
                onClick={null}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

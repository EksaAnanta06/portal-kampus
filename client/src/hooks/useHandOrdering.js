// FILE: client/src/hooks/useHandOrdering.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { reorderArray, autoOrderHandCards } from '../utils/pokerUiHelpers';

/**
 * Hook untuk mengelola susunan kartu pemain secara lokal (drag & drop, auto-urut, reset):
 * - Mempertahankan susunan manual saat cards dari server berubah (append kartu baru di kanan)
 * - Auto-urut deterministik (kombinasi terbaik di kiri, kicker di kanan, non-combo redup)
 * - Reset kembali ke susunan awal server
 * - Haptic feedback & sound snap
 */
export default function useHandOrdering(serverCards = [], sfx = null) {
  const [orderedCards, setOrderedCards] = useState(() => serverCards || []);
  const [dimmedCodes, setDimmedCodes] = useState(() => new Set());
  const [comboLabel, setComboLabel] = useState('');
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const prevCardsRef = useRef(serverCards);

  // Pertahankan susunan manual saat kartu dari server berubah
  useEffect(() => {
    const prev = prevCardsRef.current || [];
    prevCardsRef.current = serverCards;

    if (!Array.isArray(serverCards) || serverCards.length === 0) {
      setOrderedCards([]);
      setDimmedCodes(new Set());
      setComboLabel('');
      return;
    }

    const currentCodes = new Set(serverCards.map((c) => c.code));
    const cardByCode = new Map(serverCards.map((c) => [c.code, c]));

    const retained = orderedCards
      .filter((c) => currentCodes.has(c.code))
      .map((c) => cardByCode.get(c.code) || c);

    const retainedCodes = new Set(retained.map((c) => c.code));
    const newlyAdded = serverCards.filter((c) => !retainedCodes.has(c.code));

    setOrderedCards([...retained, ...newlyAdded]);
  }, [serverCards]);

  const handleAutoOrder = useCallback(() => {
    if (!orderedCards.length) return;
    const res = autoOrderHandCards(orderedCards);
    if (!res || !res.orderedCards) return;

    setOrderedCards(res.orderedCards);
    if (res.orderedCards.length > 5 && res.bestComboCardCodes && res.bestComboCardCodes.size > 0) {
      const nonBestCodes = new Set(
        res.orderedCards
          .filter((c) => !res.bestComboCardCodes.has(c.code))
          .map((c) => c.code)
      );
      setDimmedCodes(nonBestCodes);
    } else {
      setDimmedCodes(new Set());
    }

    setComboLabel(res.label || '');
    setAriaAnnouncement(`Kartu diurutkan otomatis: ${res.label || 'Kombinasi terbaik'}.`);
    sfx?.playCardSnap?.();
    sfx?.triggerCardSnapHaptic?.(15);
  }, [orderedCards, sfx]);

  const handleResetOrder = useCallback(() => {
    if (!serverCards.length) return;
    setOrderedCards([...serverCards]);
    setDimmedCodes(new Set());
    setComboLabel('');
    setAriaAnnouncement('Susunan kartu dikembalikan ke posisi awal.');
    sfx?.playCardSnap?.();
    sfx?.triggerCardSnapHaptic?.(15);
  }, [serverCards, sfx]);

  const handleReorder = useCallback((fromIndex, toIndex) => {
    setOrderedCards((prev) => {
      const next = reorderArray(prev, fromIndex, toIndex);
      const movedCard = prev[fromIndex];
      setAriaAnnouncement(
        `Kartu ${movedCard?.code || ''} dipindahkan ke posisi ${toIndex + 1} dari ${prev.length}`
      );
      return next;
    });
    sfx?.playCardSnap?.();
    sfx?.triggerCardSnapHaptic?.(15);
  }, [sfx]);

  return {
    orderedCards,
    dimmedCodes,
    comboLabel,
    ariaAnnouncement,
    setOrderedCards,
    handleAutoOrder,
    handleResetOrder,
    handleReorder,
  };
}

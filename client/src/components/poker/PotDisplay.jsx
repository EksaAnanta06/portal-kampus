// FILE: client/src/components/poker/PotDisplay.jsx
import { useEffect, useRef, useState } from 'react';
import { formatCompactChips } from '../../utils/pokerUiHelpers';

/**
 * Minimalist single-element Pot Display:
 * - One large tabular number underneath community cards, zero decorative 3D chip stacks.
 * - Short count-up transition (<= 220ms), instant on prefers-reduced-motion.
 */
export default function PotDisplay({ totalPot = 0, sidePots = [] }) {
  const target = Math.max(0, Math.round(Number(totalPot) || 0));
  const [displayPot, setDisplayPot] = useState(target);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    const startVal = prevTargetRef.current;
    prevTargetRef.current = target;
    if (startVal === target) {
      setDisplayPot(target);
      return undefined;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || typeof window === 'undefined' || !window.performance) {
      setDisplayPot(target);
      return undefined;
    }

    const duration = 200;
    const startTime = window.performance.now();
    let rafId = null;

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPot(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [target]);

  const formattedPot =
    displayPot >= 100000
      ? formatCompactChips(displayPot)
      : Number(displayPot).toLocaleString('id-ID');

  const sidePotCount = Array.isArray(sidePots) ? sidePots.filter((p) => p.amount > 0).length : 0;

  return (
    <div
      className="inline-flex items-baseline gap-1.5 px-2 py-0.5"
      aria-label={`Total pot ${displayPot} chip`}
    >
      <span className="poker-text-sm font-bold uppercase tracking-wider text-slate-400">
        Pot
      </span>
      <span className="poker-text-lg font-extrabold poker-tabular text-amber-400">
        {formattedPot}
      </span>
      {sidePotCount > 1 && (
        <span className="poker-text-sm font-semibold text-slate-400 poker-tabular">
          ({sidePotCount} pot)
        </span>
      )}
    </div>
  );
}

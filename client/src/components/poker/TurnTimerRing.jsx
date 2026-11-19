// FILE: client/src/components/poker/TurnTimerRing.jsx
import { useEffect, useState } from 'react';

export default function TurnTimerRing({
  active = false,
  turnDeadlineAt = null,
  turnTimeoutSec = 30,
  serverClockOffsetMs = 0,
  progress = null, // Opsional 0..1 untuk pratinjau komponen (/poker/_preview)
  size = 50,
  children,
}) {
  const [ratio, setRatio] = useState(() => (progress !== null ? progress : 1));

  useEffect(() => {
    if (progress !== null) {
      setRatio(Math.max(0, Math.min(1, progress)));
      return undefined;
    }

    if (!active || !turnDeadlineAt) {
      setRatio(1);
      return undefined;
    }

    const totalMs = Math.max(1000, Number(turnTimeoutSec) * 1000);
    let rafId = 0;

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const approxServerNow = Date.now() + (serverClockOffsetMs || 0);
      const remMs = Math.max(0, turnDeadlineAt - approxServerNow);
      setRatio(Math.min(1, remMs / totalMs));
      if (remMs > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active, turnDeadlineAt, turnTimeoutSec, serverClockOffsetMs, progress]);

  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const ringColor =
    ratio > 0.5 ? '#10b981' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
  const isUrgent = active && ratio <= 0.25;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {active && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={`absolute inset-0 -rotate-90 pointer-events-none ${
            isUrgent ? 'poker-timer-urgent' : ''
          }`}
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
      )}
      {children}
    </div>
  );
}

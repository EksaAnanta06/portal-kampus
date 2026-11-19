// FILE: client/src/hooks/useSfx.js
import { useCallback, useEffect, useRef } from 'react';

/**
 * Lightweight Web Audio API sound effects & haptic feedback hook.
 * - Default OFF (sfxEnabled = false, hapticsEnabled = false).
 * - Lazily initializes AudioContext ONLY after user interaction when enabled.
 */
export default function useSfx({
  sfxEnabled = false,
  sfxVolume = 0.65,
  hapticsEnabled = false,
} = {}) {
  const audioCtxRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!sfxEnabled || typeof window === 'undefined') return null;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch (_err) {
      return null;
    }
  }, [sfxEnabled]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  const playToneSequence = useCallback(
    (notes = []) => {
      if (!sfxEnabled) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;
      const masterGain = Math.min(1, Math.max(0, Number(sfxVolume) || 0.65)) * 0.18;
      if (masterGain <= 0.001) return false;

      try {
        const now = ctx.currentTime;
        notes.forEach(({ freq = 440, type = 'sine', start = 0, duration = 0.08, gain = 1 }) => {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, now + start);

          const peak = Math.max(0.0001, masterGain * gain);
          env.gain.setValueAtTime(0.0001, now + start);
          env.gain.exponentialRampToValueAtTime(peak, now + start + 0.012);
          env.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

          osc.connect(env);
          env.connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + duration + 0.015);
        });
        return true;
      } catch (_err) {
        return false;
      }
    },
    [sfxEnabled, sfxVolume, getAudioContext]
  );

  const playDeal = useCallback(
    () =>
      playToneSequence([
        { freq: 310, type: 'triangle', start: 0, duration: 0.045, gain: 0.7 },
        { freq: 520, type: 'sine', start: 0.02, duration: 0.055, gain: 0.55 },
      ]),
    [playToneSequence]
  );

  const playFlip = useCallback(
    () =>
      playToneSequence([
        { freq: 440, type: 'triangle', start: 0, duration: 0.05, gain: 0.75 },
        { freq: 660, type: 'sine', start: 0.035, duration: 0.065, gain: 0.65 },
      ]),
    [playToneSequence]
  );

  const playChip = useCallback(
    () =>
      playToneSequence([
        { freq: 1480, type: 'sine', start: 0, duration: 0.05, gain: 0.65 },
        { freq: 2240, type: 'triangle', start: 0.025, duration: 0.065, gain: 0.5 },
      ]),
    [playToneSequence]
  );

  const playTurn = useCallback(
    () =>
      playToneSequence([
        { freq: 523.25, type: 'sine', start: 0, duration: 0.09, gain: 0.85 },
        { freq: 659.25, type: 'sine', start: 0.085, duration: 0.13, gain: 0.9 },
      ]),
    [playToneSequence]
  );

  const playWin = useCallback(
    () =>
      playToneSequence([
        { freq: 523.25, type: 'triangle', start: 0, duration: 0.1, gain: 0.85 },
        { freq: 659.25, type: 'triangle', start: 0.08, duration: 0.1, gain: 0.85 },
        { freq: 783.99, type: 'triangle', start: 0.16, duration: 0.12, gain: 0.9 },
        { freq: 1046.5, type: 'sine', start: 0.25, duration: 0.22, gain: 1 },
      ]),
    [playToneSequence]
  );

  const triggerTurnHaptic = useCallback(
    (pattern = 28) => {
      if (!hapticsEnabled) return false;
      try {
        if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
          return Boolean(window.navigator.vibrate(pattern));
        }
      } catch (_err) {
        // Fallback silently on unsupported browsers/devices
      }
      return false;
    },
    [hapticsEnabled]
  );

  const playCardSnap = useCallback(
    () =>
      playToneSequence([
        { freq: 620, type: 'triangle', start: 0, duration: 0.035, gain: 0.7 },
        { freq: 440, type: 'sine', start: 0.015, duration: 0.04, gain: 0.5 },
      ]),
    [playToneSequence]
  );

  const triggerCardSnapHaptic = useCallback(
    () => triggerTurnHaptic(15),
    [triggerTurnHaptic]
  );

  return {
    playDeal,
    playFlip,
    playChip,
    playTurn,
    playWin,
    playCardSnap,
    triggerTurnHaptic,
    triggerCardSnapHaptic,
  };
}

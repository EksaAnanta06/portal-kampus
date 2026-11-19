// FILE: client/src/hooks/useAnimationQueue.js
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  createInitialAnimationQueueState,
  reduceAnimationQueue,
} from '../utils/pokerUiHelpers';

const detectReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};

const detectTabHidden = () => {
  if (typeof document === 'undefined') return false;
  return Boolean(document.hidden || document.visibilityState === 'hidden');
};

/**
 * Resilient animation queue hook for the poker table.
 * - Never blocks or leaves cards/chips stuck when rapid server updates arrive.
 * - Automatically skips/completes animations when prefers-reduced-motion or hidden tab is detected.
 */
export default function useAnimationQueue() {
  const [state, dispatch] = useReducer(reduceAnimationQueue, undefined, () =>
    createInitialAnimationQueueState({
      reducedMotion: detectReducedMotion(),
      tabHidden: detectTabHidden(),
    })
  );

  const versionRef = useRef(state.lastStateVersion);
  versionRef.current = state.lastStateVersion;

  // Listen to prefers-reduced-motion and tab visibility changes
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const handleMotionChange = (e) => {
      dispatch({
        type: 'SET_ENVIRONMENT',
        reducedMotion: Boolean(e.matches),
      });
    };

    const handleVisibilityChange = () => {
      dispatch({
        type: 'SET_ENVIRONMENT',
        tabHidden: detectTabHidden(),
      });
    };

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleMotionChange);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMotionChange);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  // Advance active animation step on timer completion
  useEffect(() => {
    if (!state.activeStep) return undefined;
    const stepId = state.activeStep.id;
    const duration = Math.max(40, Number(state.activeStep.durationMs) || 300);

    const timer = window.setTimeout(() => {
      dispatch({ type: 'STEP_COMPLETE', stepId });
    }, duration);

    return () => window.clearTimeout(timer);
  }, [state.activeStep]);

  const enqueueSteps = useCallback((steps = [], options = {}) => {
    const nextVersion =
      options.stateVersion !== undefined ? options.stateVersion : versionRef.current + 1;
    dispatch({
      type: 'ENQUEUE_STEPS',
      steps,
      stateVersion: nextVersion,
      replaceStale: options.replaceStale !== false,
      flushExisting: Boolean(options.flushExisting),
    });
  }, []);

  const fastForwardAll = useCallback(() => {
    dispatch({ type: 'FAST_FORWARD_ALL' });
  }, []);

  return {
    activeStep: state.activeStep,
    pendingSteps: state.pendingSteps,
    completedCount: state.completedCount,
    lastStateVersion: state.lastStateVersion,
    reducedMotion: state.reducedMotion,
    tabHidden: state.tabHidden,
    isAnimating: Boolean(state.activeStep),
    enqueueSteps,
    fastForwardAll,
  };
}

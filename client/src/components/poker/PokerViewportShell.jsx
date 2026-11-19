// FILE: client/src/components/poker/PokerViewportShell.jsx
import { useEffect, useState } from 'react';

/**
 * Zero-scroll 100dvh shell for all /poker* screens:
 * - Locks html/body overflow & overscroll-behavior ONLY while inside a poker route,
 *   cleaning up automatically on unmount.
 * - Tracks window.visualViewport so virtual keyboards never cause layout jumps.
 */
export default function PokerViewportShell({
  theme = 'emerald_royal',
  className = '',
  style = undefined,
  children,
}) {
  const [vvStyle, setVvStyle] = useState({});

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    htmlEl.classList.add('poker-route-lock');
    bodyEl.classList.add('poker-route-lock');

    // Sesuaikan warna status bar & address bar Chrome Android ke warna felt meja poker (#04181d)
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const prevThemeColor = metaTheme ? metaTheme.getAttribute('content') : '#8B1E24';
    if (metaTheme) {
      metaTheme.setAttribute('content', '#04181d');
    }

    return () => {
      htmlEl.classList.remove('poker-route-lock');
      bodyEl.classList.remove('poker-route-lock');
      if (metaTheme && prevThemeColor) {
        metaTheme.setAttribute('content', prevThemeColor);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return undefined;
    const vv = window.visualViewport;

    const syncViewport = () => {
      const keyboardInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setVvStyle({
        '--poker-vv-height': `${Math.round(vv.height)}px`,
        '--poker-keyboard-inset': `${keyboardInset}px`,
      });
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    };
  }, []);

  return (
    <div
      data-poker-theme={theme}
      className={`poker-stage poker-viewport-shell ${className}`.trim()}
      style={{ ...vvStyle, ...(style || {}) }}
    >
      {children}
    </div>
  );
}

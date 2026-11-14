// FILE: client/src/hooks/useDebounce.js
import { useEffect, useState } from 'react';

/**
 * Menunda perubahan nilai hingga user berhenti mengetik selama `delay` ms.
 */
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

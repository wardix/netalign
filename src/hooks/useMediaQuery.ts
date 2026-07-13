import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query (e.g. `(max-width: 768px)`).
 * Defaults to `false` on the server / first paint before match.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Narrow layout breakpoint aligned with issue #69 (~768px). */
export const NARROW_LAYOUT_QUERY = '(max-width: 768px)';

export function useIsNarrowLayout(): boolean {
  return useMediaQuery(NARROW_LAYOUT_QUERY);
}

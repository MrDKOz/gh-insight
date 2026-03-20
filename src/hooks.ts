import { useEffect, useCallback, type RefObject } from 'react';

/**
 * Attaches a mousedown listener to document that calls `onClose` whenever
 * the click lands outside `ref`. The listener is only active while `active`
 * is true, and is removed on cleanup.
 *
 * Pass a stable `onClose` (e.g. via useCallback) to avoid unnecessary
 * listener churn.
 */
export function useOutsideClick(
  ref: RefObject<Element | null>,
  active: boolean,
  onClose: () => void,
): void {
  // Keep a stable reference to onClose so we never need it in the dep array.
  const onCloseRef = useCallback(onClose, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCloseRef();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, ref, onCloseRef]);
}

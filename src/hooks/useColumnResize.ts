import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages resizable column widths for a table.
 *
 * `startResize(idx, e, currentWidth)` must be called from a column header's
 * `onMouseDown`. Pass the column's current pixel width as `currentWidth` — it
 * is captured at drag-start so the callback itself has no stale-closure risk
 * and can be memoised with an empty dep array.
 *
 * @param defaultWidths - Initial pixel width for each column, in column order.
 */
const useColumnResize = (defaultWidths: number[]) => {
  const [widths, setWidths] = useState<number[]>(defaultWidths);

  // Holds a cleanup fn for any in-progress drag so unmount can remove listeners.
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const startResize = useCallback(
    (idx: number, e: React.MouseEvent, currentWidth: number) => {
      e.preventDefault();
      const startX = e.clientX;
      const onMove = (ev: MouseEvent) => {
        const newW = Math.max(40, currentWidth + (ev.clientX - startX));
        setWidths((prev) => prev.map((w, i) => (i === idx ? newW : w)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        cleanupRef.current = null;
      };
      cleanupRef.current = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [],
  );

  return { widths, startResize };
}

export { useColumnResize };

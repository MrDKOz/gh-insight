/** Milliseconds in one day. */
export const MS = 86_400_000;

/** Format an ISO date string as "D Mon" (e.g. "3 Jan"). Returns 'N/A' for falsy input. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

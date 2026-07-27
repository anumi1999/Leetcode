const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

/**
 * Normalizes heterogeneous date strings to ISO 8601 (YYYY-MM-DD).
 *
 * Handles:
 *   "10-11-2002"          → DD-MM-YYYY  → "2002-11-10"
 *   "15-July-2001"        → DD-Month-YYYY → "2001-07-15"
 *   "01-October-2005"     → DD-Month-YYYY → "2005-10-01"
 *   "2021-11-12"          → already ISO  → unchanged
 */
export function parseDate(raw: string): string {
  if (!raw || raw.trim() === '') return '';

  const s = raw.trim();

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const parts = s.split('-');
  if (parts.length !== 3) return s; // unknown format — pass through

  const [p1, p2, p3] = parts.map((p) => p.trim());

  // DD-Month-YYYY  e.g. "15-July-2001"
  const monthKey = p2.toLowerCase();
  if (MONTHS[monthKey]) {
    const dd   = p1.padStart(2, '0');
    const yyyy = p3.padStart(4, '0');
    return `${yyyy}-${MONTHS[monthKey]}-${dd}`;
  }

  // DD-MM-YYYY  e.g. "10-11-2002"
  if (/^\d{1,2}$/.test(p1) && /^\d{1,2}$/.test(p2) && /^\d{4}$/.test(p3)) {
    const dd   = p1.padStart(2, '0');
    const mm   = p2.padStart(2, '0');
    return `${p3}-${mm}-${dd}`;
  }

  return s; // fallback: return as-is
}

/** Returns the number of months between two ISO date strings. */
export function monthsBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end   = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

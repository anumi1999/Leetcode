import type { CandidateName } from '../../models/candidate';

/**
 * Accepts either:
 *  - first + last separately (Format 1)
 *  - "Last, First" combined string where lastName is set and firstName is empty (Format 2)
 */
export function parseName(firstName: string, lastName: string): CandidateName {
  const first = firstName.trim();
  const last  = lastName.trim();
  const full  = [first, last].filter(Boolean).join(' ');
  return { first, last, full };
}

import type { ParsedSkillGroup } from '../types';
import type { SkillGroup } from '../../models/candidate';

/**
 * Converts ParsedSkillGroup[] to the output SkillGroup[].
 * Flat "uncategorized" groups from Format 1 stay as-is.
 * Duplicate categories are merged.
 */
export function normalizeSkills(parsed: ParsedSkillGroup[]): SkillGroup[] {
  const map = new Map<string, Set<string>>();

  for (const group of parsed) {
    const cat = group.category.trim().toLowerCase() || 'uncategorized';
    if (!map.has(cat)) map.set(cat, new Set());
    for (const v of group.values) {
      map.get(cat)!.add(v.trim());
    }
  }

  return Array.from(map.entries()).map(([category, values]) => ({
    category,
    values: Array.from(values),
  }));
}

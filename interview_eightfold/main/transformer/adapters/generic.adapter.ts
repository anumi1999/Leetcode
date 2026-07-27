import type { FolderMappingConfig, FieldPath } from '../../config/folderConfig';
import type { ParsedInput, ParsedEducation, ParsedExperience, ParsedSkillGroup } from '../types';

// ─── Path utilities ───────────────────────────────────────────────────────────

/** Traverse a dot-notation path on any value (e.g. "school.name") */
function get(obj: unknown, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

/** Try each path in order; return the first non-null/undefined value */
function resolve(obj: unknown, field: FieldPath): unknown {
  const paths = Array.isArray(field) ? field : [field];
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function str(v: unknown): string { return v != null ? String(v) : ''; }
function arr(v: unknown): string[] { return Array.isArray(v) ? v.map(String) : []; }

function topLevelKey(field: FieldPath): string {
  const p = Array.isArray(field) ? field[0] : field;
  return p.split('.')[0];
}

// ─── Single generic adapter ───────────────────────────────────────────────────
// Driven entirely by FolderMappingConfig — no code changes needed for new formats.

export const GenericAdapter = {
  parse(raw: unknown, config: FolderMappingConfig): ParsedInput {
    const r = raw as Record<string, unknown>;
    const m = config.mapping;

    // Collect all known top-level keys so everything else goes into extras
    const knownKeys = new Set<string>([
      m.education.sourcePath,
      m.experience.sourcePath,
      m.skills.sourcePath,
    ]);
    for (const field of [m.name.first, m.name.last, m.name.full]) {
      if (field) knownKeys.add(topLevelKey(field));
    }

    const extras: Record<string, unknown> = {};
    for (const key of Object.keys(r)) {
      if (!knownKeys.has(key)) extras[key] = r[key];
    }

    // ─── Name ───────────────────────────────────────────────────────────────
    let firstName = '';
    let lastName  = '';

    if (m.name.full) {
      const full = str(resolve(r, m.name.full));
      if (m.name.fullNameFormat === 'last, first' && full.includes(',')) {
        [lastName, firstName] = full.split(',').map((s) => s.trim());
      } else {
        firstName = full;
      }
    } else {
      firstName = m.name.first ? str(resolve(r, m.name.first)) : '';
      lastName  = m.name.last  ? str(resolve(r, m.name.last))  : '';
    }

    // ─── Education ──────────────────────────────────────────────────────────
    const edArr = (r[m.education.sourcePath] as unknown[]) ?? [];
    const education: ParsedEducation[] = edArr.map((e) => ({
      degree:          str(resolve(e, m.education.degree)),
      institutionName: str(resolve(e, m.education.institutionName)),
      country:         m.education.institutionCountry ? str(resolve(e, m.education.institutionCountry)) : '',
      state:           m.education.institutionState   ? str(resolve(e, m.education.institutionState))   : '',
      major:           str(resolve(e, m.education.major)),
      minors:          m.education.minors ? arr(resolve(e, m.education.minors)) : [],
    }));

    // ─── Experience ─────────────────────────────────────────────────────────
    const expArr = (r[m.experience.sourcePath] as unknown[]) ?? [];
    const experience: ParsedExperience[] = expArr.map((e) => {
      const endVal = m.experience.end ? resolve(e, m.experience.end) : null;
      return {
        title:    str(resolve(e, m.experience.title)),
        orgName:  str(resolve(e, m.experience.orgName)),
        country:  m.experience.orgCountry ? str(resolve(e, m.experience.orgCountry)) : '',
        state:    m.experience.orgState   ? str(resolve(e, m.experience.orgState))   : '',
        city:     m.experience.orgCity    ? str(resolve(e, m.experience.orgCity))    : '',
        startRaw: str(resolve(e, m.experience.start)),
        endRaw:   endVal != null ? str(endVal) : null,
      };
    });

    // ─── Skills ─────────────────────────────────────────────────────────────
    const skillsRaw = (r[m.skills.sourcePath] as unknown[]) ?? [];
    let skills: ParsedSkillGroup[];

    if (m.skills.type === 'flat') {
      skills = skillsRaw.length
        ? [{ category: 'uncategorized', values: skillsRaw.map(String) }]
        : [];
    } else {
      skills = skillsRaw.map((s) => ({
        category: m.skills.categoryField ? str(resolve(s, m.skills.categoryField)) : 'uncategorized',
        values:   m.skills.valuesField   ? arr(resolve(s, m.skills.valuesField))   : [],
      }));
    }

    return { firstName, lastName, education, experience, skills, extras };
  },
};

// ─── Per-folder mapping config ────────────────────────────────────────────────
// Each source folder has a _pipeline.config.json that uses these types.
// A FieldPath is a dot-notation string ("school.name") or an ordered array of
// fallback paths tried left-to-right ("ancillary_subjects" | "other_subjects").

export type FieldPath = string | string[];

export interface NameMapping {
  first?:          FieldPath;   // Format 1: separate fields
  last?:           FieldPath;
  full?:           FieldPath;   // Format 2: combined full name
  fullNameFormat?: 'first last' | 'last, first';
}

export interface EducationMapping {
  sourcePath:          string;      // top-level array key in the source JSON
  degree:              FieldPath;
  institutionName:     FieldPath;
  institutionCountry?: FieldPath;
  institutionState?:   FieldPath;
  major:               FieldPath;
  minors?:             FieldPath;
}

export interface ExperienceMapping {
  sourcePath: string;
  title:      FieldPath;
  orgName:    FieldPath;
  orgCountry?: FieldPath;
  orgState?:   FieldPath;
  orgCity?:    FieldPath;
  start:      FieldPath;
  end?:       FieldPath;
}

export interface SkillsMapping {
  sourcePath:     string;
  type:           'flat' | 'grouped';
  categoryField?: FieldPath;   // required when type = 'grouped'
  valuesField?:   FieldPath;   // required when type = 'grouped'
}

export interface FolderMappingConfig {
  pattern:   string;     // glob for file discovery relative to the folder
  outputDir: string;     // relative to the folder root
  mapping: {
    name:       NameMapping;
    education:  EducationMapping;
    experience: ExperienceMapping;
    skills:     SkillsMapping;
  };
}

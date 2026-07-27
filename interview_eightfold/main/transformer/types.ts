// ─── Intermediate representation ──────────────────────────────────────────────
// GenericAdapter normalizes any raw input (driven by FolderMappingConfig) into
// ParsedInput. The mapper then converts ParsedInput → Candidate (output schema).

export interface ParsedEducation {
  degree: string;
  institutionName: string;
  country: string;
  state: string;
  major: string;
  minors: string[];
}

export interface ParsedExperience {
  title: string;
  orgName: string;
  country: string;
  state: string;
  city: string;
  startRaw: string;       // raw date string from source — dateParser normalizes it
  endRaw: string | null;  // null = current role
}

export interface ParsedSkillGroup {
  category: string;
  values: string[];
}

export interface ParsedInput {
  firstName: string;
  lastName: string;
  education: ParsedEducation[];
  experience: ParsedExperience[];
  skills: ParsedSkillGroup[];
  extras: Record<string, unknown>;  // unmapped fields pass through
}



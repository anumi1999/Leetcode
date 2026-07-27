// ─── Output Schema ────────────────────────────────────────────────────────────

export interface CandidateName {
  first: string;
  last: string;
  full: string;
}

export interface Institution {
  name: string;
  country: string;
  state: string;
}

export interface Education {
  degree: string;                 // e.g. "Masters", "Bachelors of Engineering"
  institution: Institution;
  major: string;
  minors: string[];
}

export interface Organization {
  name: string;
  country: string;
  state: string;
  city: string;
}

export interface Experience {
  title: string;
  organization: Organization;
  start: string;                  // ISO 8601: YYYY-MM-DD
  end: string | null;             // null = current role
  duration_months: number;        // derived: (end ?? today) - start
}

export interface SkillGroup {
  category: string;               // "programming_language" | "databases" | "uncategorized" | ...
  values: string[];
}

export interface CandidateMetadata {
  source_folder: string;          // e.g. "Folder1/Customer1"
  source_file: string;            // e.g. "candidate1.json"
  format_version: string;         // "1" | "2" — which input format was parsed
  ingested_at: string;            // ISO 8601 timestamp
}

export type ExtrasDict = Record<string, unknown>;

export interface Candidate {
  id: string;                     // stable hash of (full_name + source_file)
  name: CandidateName;
  education: Education[];
  experience: Experience[];
  skills: SkillGroup[];
  extras: ExtrasDict;             // catch-all: unmapped fields from any input format
  metadata: CandidateMetadata;
}

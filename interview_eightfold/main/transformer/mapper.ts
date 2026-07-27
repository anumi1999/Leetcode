import * as crypto from 'crypto';
import * as path from 'path';
import type { ParsedInput } from './types';
import type { Candidate } from '../models/candidate';
import { parseName } from './parsers/nameParser';
import { parseDate, monthsBetween } from './parsers/dateParser';
import { normalizeSkills } from './parsers/skillsParser';

export function mapToCandidate(
  parsed: ParsedInput,
  sourceFilePath: string,
  sourceRoot: string,
): Candidate {
  const name    = parseName(parsed.firstName, parsed.lastName);
  const today   = new Date().toISOString().slice(0, 10);

  const id = crypto
    .createHash('sha256')
    .update(`${name.full}::${path.resolve(sourceFilePath)}`)
    .digest('hex')
    .slice(0, 16);

  const education = parsed.education.map((e) => ({
    degree: e.degree,
    institution: {
      name:    e.institutionName,
      country: e.country,
      state:   e.state,
    },
    major:  e.major,
    minors: e.minors,
  }));

  const experience = parsed.experience.map((e) => {
    const start           = parseDate(e.startRaw);
    const end             = e.endRaw ? parseDate(e.endRaw) : null;
    const duration_months = monthsBetween(start, end ?? today);
    return {
      title: e.title,
      organization: {
        name:    e.orgName,
        country: e.country,
        state:   e.state,
        city:    e.city,
      },
      start,
      end,
      duration_months,
    };
  });

  const skills = normalizeSkills(parsed.skills);

  const sourceFolder = path.relative(process.cwd(), sourceRoot);
  const sourceFile   = path.basename(sourceFilePath);

  return {
    id,
    name,
    education,
    experience,
    skills,
    extras: parsed.extras,
    metadata: {
      source_folder:  sourceFolder,
      source_file:    sourceFile,
      format_version: path.basename(sourceRoot),
      ingested_at:    new Date().toISOString(),
    },
  };
}

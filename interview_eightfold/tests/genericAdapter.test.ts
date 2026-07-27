import * as fs from 'fs';
import * as path from 'path';
import { GenericAdapter } from '../../main/transformer/adapters/generic.adapter';
import type { FolderMappingConfig } from '../../main/config/folderConfig';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadConfig(folder: string): FolderMappingConfig {
  const cfgPath = path.join(
    __dirname, '..', 'data', folder, '_pipeline.config.json',
  );
  return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
}

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf-8'));
}

// ─── Format 1 ─────────────────────────────────────────────────────────────────

describe('GenericAdapter — Format 1 (Folder1)', () => {
  const config = loadConfig('Folder1');
  const raw    = loadFixture('candidate_format1.json');
  const parsed = GenericAdapter.parse(raw, config);

  it('parses first and last name separately', () => {
    expect(parsed.firstName).toBe('John');
    expect(parsed.lastName).toBe('Michel');
  });

  it('parses education array', () => {
    expect(parsed.education).toHaveLength(2);
    expect(parsed.education[0].degree).toBe('Masters Degree');
    expect(parsed.education[0].institutionName).toBe('San Jose State University');
    expect(parsed.education[0].major).toBe('Computer science');
    expect(parsed.education[0].minors).toEqual(['Maths', 'Business Accounts']);
    expect(parsed.education[0].country).toBe('USA');
    expect(parsed.education[0].state).toBe('CA');
  });

  it('parses experience array with correct raw dates', () => {
    expect(parsed.experience).toHaveLength(2);
    expect(parsed.experience[0].title).toBe('Software Engineer');
    expect(parsed.experience[0].orgName).toBe('IBM');
    expect(parsed.experience[0].startRaw).toBe('10-11-2002');
    expect(parsed.experience[0].endRaw).toBe('12-06-2006');
  });

  it('wraps flat skills in uncategorized group', () => {
    expect(parsed.skills).toHaveLength(1);
    expect(parsed.skills[0].category).toBe('uncategorized');
    expect(parsed.skills[0].values).toEqual(['java', 'python', 'Databases', 'Distributed Systems']);
  });

  it('puts unknown fields in extras', () => {
    // fixture has no unknown fields — extras should be empty
    expect(Object.keys(parsed.extras)).toHaveLength(0);
  });
});

// ─── Format 2 ─────────────────────────────────────────────────────────────────

describe('GenericAdapter — Format 2 (Folder2)', () => {
  const config = loadConfig('Folder2');
  const raw    = loadFixture('candidate_format2.json');
  const parsed = GenericAdapter.parse(raw, config);

  it('splits "Last, First" full_name correctly', () => {
    expect(parsed.firstName).toBe('John');
    expect(parsed.lastName).toBe('Michel');
  });

  it('resolves nested institution via dot-notation', () => {
    expect(parsed.education[0].institutionName).toBe('California University of Pennsylvania');
    expect(parsed.education[0].country).toBe('USA');
    expect(parsed.education[0].state).toBe('CA');
  });

  it('picks specialization as major (first fallback)', () => {
    expect(parsed.education[0].major).toBe('Computer science');
  });

  it('picks primary_subject as major (second fallback)', () => {
    expect(parsed.education[1].major).toBe('Computer Science');
  });

  it('picks ancillary_subjects as minors (first fallback)', () => {
    expect(parsed.education[0].minors).toEqual(['Maths', 'Business Accounts']);
  });

  it('picks other_subjects as minors (second fallback)', () => {
    expect(parsed.education[1].minors).toEqual(['Maths', 'English']);
  });

  it('resolves org via typo-tolerant fallback (orgnanization → organization)', () => {
    expect(parsed.experience[0].orgName).toBe('google');
    expect(parsed.experience[0].city).toBe('SFO');
  });

  it('parses grouped skills with categories', () => {
    expect(parsed.skills).toHaveLength(3);
    expect(parsed.skills[0].category).toBe('programming_language');
    expect(parsed.skills[0].values).toEqual(['Go', 'python']);
    expect(parsed.skills[1].category).toBe('databases');
  });
});

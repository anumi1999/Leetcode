import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { transform } from '../../main/transformer/index';

// Integration test: exercises the full read → adapt → map pipeline
// using real fixture files and real _pipeline.config.json files.

const dataDir     = path.join(__dirname, '..', 'data');
const fixturesDir = path.join(__dirname, 'fixtures');

describe('transform() integration — Format 1', () => {
  let tmpFile: string;

  beforeEach(() => {
    // Copy fixture into a temp location inside the Folder1 source root so
    // the sourceRoot points to the right _pipeline.config.json
    const sourceRoot = path.join(dataDir, 'Folder1');
    tmpFile = path.join(sourceRoot, '_test_candidate.json');
    fs.copyFileSync(
      path.join(fixturesDir, 'candidate_format1.json'),
      tmpFile,
    );
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('produces a Candidate with correct name', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder1'));
    expect(candidate.name.first).toBe('John');
    expect(candidate.name.last).toBe('Michel');
    expect(candidate.name.full).toBe('John Michel');
  });

  it('normalises dates to ISO 8601', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder1'));
    expect(candidate.experience[0].start).toBe('2002-11-10');
    expect(candidate.experience[0].end).toBe('2006-06-12');
  });

  it('computes duration_months', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder1'));
    expect(candidate.experience[0].duration_months).toBeGreaterThan(0);
  });

  it('produces a stable id', () => {
    const c1 = transform(tmpFile, path.join(dataDir, 'Folder1'));
    const c2 = transform(tmpFile, path.join(dataDir, 'Folder1'));
    expect(c1.id).toBe(c2.id);
  });

  it('populates metadata with source info', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder1'));
    expect(candidate.metadata.source_file).toBe('_test_candidate.json');
    expect(candidate.metadata.ingested_at).toBeTruthy();
  });

  it('keeps skills as uncategorized group', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder1'));
    expect(candidate.skills[0].category).toBe('uncategorized');
    expect(candidate.skills[0].values).toContain('java');
  });
});

describe('transform() integration — Format 2', () => {
  let tmpFile: string;

  beforeEach(() => {
    const sourceRoot = path.join(dataDir, 'Folder2');
    tmpFile = path.join(sourceRoot, '_test_candidate.json');
    fs.copyFileSync(
      path.join(fixturesDir, 'candidate_format2.json'),
      tmpFile,
    );
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('splits "Last, First" full_name correctly', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder2'));
    expect(candidate.name.first).toBe('John');
    expect(candidate.name.last).toBe('Michel');
  });

  it('resolves nested institution name', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder2'));
    expect(candidate.education[0].institution.name).toBe('California University of Pennsylvania');
  });

  it('normalises DD-Month-YYYY dates', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder2'));
    expect(candidate.experience[0].start).toBe('2001-07-15');
    expect(candidate.experience[0].end).toBe('2005-09-12');
  });

  it('preserves grouped skill categories', () => {
    const candidate = transform(tmpFile, path.join(dataDir, 'Folder2'));
    const cats = candidate.skills.map((s) => s.category);
    expect(cats).toContain('programming_language');
    expect(cats).toContain('databases');
  });
});

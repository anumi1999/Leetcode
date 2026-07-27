import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CandidateWriter } from '../../main/writer/index';
import type { Candidate } from '../../main/models/candidate';

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'test-id-001',
    name: { first: 'John', last: 'Michel', full: 'John Michel' },
    education: [],
    experience: [],
    skills: [],
    extras: {},
    metadata: {
      source_folder:  'data/Folder1',
      source_file:    'candidate1.json',
      format_version: 'Folder1',
      ingested_at:    new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('CandidateWriter', () => {
  let tmpDir: string;
  let writer: CandidateWriter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'));
    writer = new CandidateWriter(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── upsert ───────────────────────────────────────────────────────────────

  it('upsert writes a JSON file named by id', () => {
    const candidate = makeCandidate();
    const outPath   = writer.upsert(candidate);

    expect(outPath).toBe(path.join(tmpDir, 'test-id-001.json'));
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('upsert overwrites an existing record (update)', () => {
    const original = makeCandidate();
    writer.upsert(original);

    const updated = makeCandidate({ name: { first: 'Jane', last: 'Michel', full: 'Jane Michel' } });
    writer.upsert(updated);

    const found = writer.findById('test-id-001')!;
    expect(found.name.first).toBe('Jane');
  });

  it('written file round-trips to valid Candidate', () => {
    const candidate = makeCandidate();
    writer.upsert(candidate);

    const found = writer.findById('test-id-001');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('test-id-001');
    expect(found!.name.full).toBe('John Michel');
  });

  // ─── deleteBySourceFile ───────────────────────────────────────────────────

  it('deleteBySourceFile removes the correct output file', () => {
    const candidate = makeCandidate();
    const outPath   = writer.upsert(candidate);
    expect(fs.existsSync(outPath)).toBe(true);

    const removed = writer.deleteBySourceFile('candidate1.json');
    expect(removed).toBe(outPath);
    expect(fs.existsSync(outPath)).toBe(false);
  });

  it('deleteBySourceFile returns null when source file not found in output', () => {
    writer.upsert(makeCandidate());
    const result = writer.deleteBySourceFile('nonexistent.json');
    expect(result).toBeNull();
  });

  it('deleteBySourceFile only removes the matching record, not others', () => {
    writer.upsert(makeCandidate({ id: 'id-A', metadata: { source_folder: '', source_file: 'a.json', format_version: '', ingested_at: '' } }));
    writer.upsert(makeCandidate({ id: 'id-B', metadata: { source_folder: '', source_file: 'b.json', format_version: '', ingested_at: '' } }));

    writer.deleteBySourceFile('a.json');

    expect(fs.existsSync(path.join(tmpDir, 'id-A.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'id-B.json'))).toBe(true);
  });

  // ─── listAll ──────────────────────────────────────────────────────────────

  it('listAll returns all written candidates', () => {
    writer.upsert(makeCandidate({ id: 'id-1' }));
    writer.upsert(makeCandidate({ id: 'id-2' }));

    const all = writer.listAll();
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.id).sort()).toEqual(['id-1', 'id-2']);
  });

  it('listAll returns empty array when output dir is empty', () => {
    expect(writer.listAll()).toEqual([]);
  });
});

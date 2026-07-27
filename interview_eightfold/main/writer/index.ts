import * as fs from 'fs';
import * as path from 'path';
import type { Candidate } from '../models/candidate';

// ─── CandidateWriter ──────────────────────────────────────────────────────────
// Handles all output-side operations: upsert (add/change) and delete.
// Output is one JSON file per candidate, named by the candidate's stable id.
//
// File layout:  <outputDir>/<id>.json
// Using the id (not the source filename) means renames in the source don't
// create orphaned output files.

export class CandidateWriter {
  constructor(private readonly outputDir: string) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ─── Upsert (add or update) ────────────────────────────────────────────────

  upsert(candidate: Candidate): string {
    const outPath = this.pathFor(candidate.id);
    fs.writeFileSync(outPath, JSON.stringify(candidate, null, 2), 'utf-8');
    return outPath;
  }

  // ─── Delete by source file ─────────────────────────────────────────────────
  // Scans the output directory to find the record whose metadata.source_file
  // matches the deleted source file, then removes it.
  // This is O(n) on output files but output sets are typically small.

  deleteBySourceFile(sourceFile: string): string | null {
    const files = this.listOutput();

    for (const f of files) {
      const fullPath = path.join(this.outputDir, f);
      try {
        const candidate: Candidate = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        if (candidate.metadata.source_file === path.basename(sourceFile)) {
          fs.unlinkSync(fullPath);
          return fullPath;
        }
      } catch {
        // corrupt or unrelated file — skip
      }
    }

    return null; // not found
  }

  // ─── Read back ────────────────────────────────────────────────────────────

  findById(id: string): Candidate | null {
    const outPath = this.pathFor(id);
    if (!fs.existsSync(outPath)) return null;
    return JSON.parse(fs.readFileSync(outPath, 'utf-8')) as Candidate;
  }

  listAll(): Candidate[] {
    return this.listOutput().map((f) => {
      return JSON.parse(
        fs.readFileSync(path.join(this.outputDir, f), 'utf-8'),
      ) as Candidate;
    });
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private pathFor(id: string): string {
    return path.join(this.outputDir, `${id}.json`);
  }

  private listOutput(): string[] {
    if (!fs.existsSync(this.outputDir)) return [];
    return fs.readdirSync(this.outputDir).filter((f) => f.endsWith('.json'));
  }
}

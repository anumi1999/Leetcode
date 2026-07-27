import * as fs from 'fs';
import type { IReader } from '../types';

/**
 * Minimal CSV reader — parses a header row + data rows into an array of objects.
 * The first row is treated as column names. Values are always strings; the
 * GenericAdapter / parsers downstream handle coercion.
 *
 * For a single-record file (candidate-per-file pattern), this returns the
 * first data row as a plain object rather than an array, so the GenericAdapter
 * receives the same shape as JSON input.
 */
export const CsvReader: IReader = {
  extensions: ['.csv'],

  read(filePath: string): unknown {
    const text  = fs.readFileSync(filePath, 'utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');

    if (lines.length < 2) {
      throw new Error(`[CsvReader] "${filePath}" has no data rows.`);
    }

    const headers = splitCsvLine(lines[0]);
    const rows    = lines.slice(1).map((line) => {
      const values = splitCsvLine(line);
      return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]));
    });

    // Single-record CSV → return the object directly (consistent with JSON shape)
    return rows.length === 1 ? rows[0] : rows;
  },
};

/** Splits a CSV line respecting double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

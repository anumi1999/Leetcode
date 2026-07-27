import * as path from 'path';
import type { IReader } from './types';
import { JsonReader } from './readers/json.reader';
import { CsvReader }  from './readers/csv.reader';

// ─── Registry ─────────────────────────────────────────────────────────────────
// Maps file extensions to their reader.
// To support a new file type: create a reader, add it here.

const registry = new Map<string, IReader>();

function register(reader: IReader): void {
  for (const ext of reader.extensions) {
    registry.set(ext.toLowerCase(), reader);
  }
}

register(JsonReader);
register(CsvReader);

export { register as registerReader };

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reads a source file and returns its parsed content as unknown.
 * Dispatches to the registered reader for the file's extension.
 * Throws if the extension has no registered reader.
 */
export function readFile(filePath: string): unknown {
  const ext    = path.extname(filePath).toLowerCase();
  const reader = registry.get(ext);

  if (!reader) {
    const supported = [...registry.keys()].join(', ');
    throw new Error(
      `No reader registered for extension "${ext}". Supported: [${supported}]`,
    );
  }

  return reader.read(filePath);
}

/** Returns true if a reader exists for this file's extension. */
export function canRead(filePath: string): boolean {
  return registry.has(path.extname(filePath).toLowerCase());
}

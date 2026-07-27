import * as fs from 'fs';
import * as path from 'path';
import type { FolderMappingConfig } from '../config/folderConfig';
import type { Candidate } from '../models/candidate';
import { GenericAdapter } from './adapters/generic.adapter';
import { mapToCandidate } from './mapper';
import { readFile } from '../reader/index';

// ─── Transform entry point ────────────────────────────────────────────────────
// 1. Reads _pipeline.config.json from sourceRoot (field mapping config)
// 2. Delegates file reading to the Reader registry (JSON, CSV, …)
// 3. GenericAdapter normalizes raw content → ParsedInput
// 4. Mapper converts ParsedInput → Candidate (output schema)

export function transform(filePath: string, sourceRoot: string): Candidate {
  const configPath = path.join(sourceRoot, '_pipeline.config.json');
  const config: FolderMappingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const raw    = readFile(filePath);          // reader registry dispatches by extension
  const parsed = GenericAdapter.parse(raw, config);
  return mapToCandidate(parsed, filePath, sourceRoot);
}

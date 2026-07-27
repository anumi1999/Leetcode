import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import type { SourcePath } from '../config/pipeline.config';
import type { FolderMappingConfig } from '../config/folderConfig';

// ─── Event types ──────────────────────────────────────────────────────────────

export type PipelineEventType = 'add' | 'change' | 'delete';

export interface PipelineEvent {
  type:       PipelineEventType;
  filePath:   string;
  sourceRoot: string;   // folder that owns _pipeline.config.json
  outputDir:  string;
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export class PipelineWatcher extends EventEmitter {
  private watchers: FSWatcher[] = [];

  /**
   * Starts watching all configured source folders.
   * Reads _pipeline.config.json from each folder to get pattern + outputDir.
   * Emits 'pipeline' events for add / change / delete.
   *
   * Usage:
   *   watcher.on('pipeline', (event: PipelineEvent) => { ... });
   */
  start(sources: SourcePath[]): void {
    for (const source of sources) {
      const watchPath  = path.resolve(source.path);
      const configPath = path.join(watchPath, '_pipeline.config.json');
      const folderConfig: FolderMappingConfig = JSON.parse(
        fs.readFileSync(configPath, 'utf-8'),
      );
      const outputDir      = path.resolve(watchPath, folderConfig.outputDir);
      const matchesPattern = makeGlobMatcher(folderConfig.pattern);

      const watcher = chokidar.watch(watchPath, {
        ignored: (p: string) => {
          const base = path.basename(p);
          return base.startsWith('.') || base === '_pipeline.config.json';
        },
        persistent:     true,
        ignoreInitial:  false,            // emit 'add' for existing files on startup
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval:       100,
        },
      });

      const emit = (type: PipelineEventType) => (filePath: string) => {
        if (!matchesPattern(filePath)) return;
        const event: PipelineEvent = { type, filePath, sourceRoot: watchPath, outputDir };
        this.emit('pipeline', event);
      };

      watcher
        .on('add',    emit('add'))
        .on('change', emit('change'))
        .on('unlink', emit('delete'))
        .on('error',  (err) => this.emit('error', err));

      this.watchers.push(watcher);
    }
  }

  async stop(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.close()));
    this.watchers = [];
  }
}

// ─── Simple glob matcher (supports ** and *) ──────────────────────────────────
// Converts glob to regex. Sufficient for common patterns like "**/*.json".

function makeGlobMatcher(pattern: string): (filePath: string) => boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')          // escape dots
    .replace(/\*\*/g, '§§')        // placeholder for **
    .replace(/\*/g, '[^/\\\\]*')   // * = any chars except separator
    .replace(/§§/g, '.*');         // ** = anything including separators
  const regex = new RegExp(`(${regexStr})$`, 'i');
  return (filePath: string) => regex.test(filePath.replace(/\\/g, '/'));
}

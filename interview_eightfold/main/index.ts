import { pipelineConfig } from './config/pipeline.config';
import { transform } from './transformer/index';
import { PipelineWatcher, PipelineEvent } from './watcher/index';
import { CandidateWriter } from './writer/index';

// ─── Writer pool ──────────────────────────────────────────────────────────────
// One CandidateWriter per outputDir (lazily created, reused across events).

const writers = new Map<string, CandidateWriter>();

function getWriter(outputDir: string): CandidateWriter {
  if (!writers.has(outputDir)) writers.set(outputDir, new CandidateWriter(outputDir));
  return writers.get(outputDir)!;
}

// ─── Event handler ────────────────────────────────────────────────────────────

function handleEvent(event: PipelineEvent): void {
  const writer = getWriter(event.outputDir);

  try {
    if (event.type === 'delete') {
      const removed = writer.deleteBySourceFile(event.filePath);
      if (removed) console.log(`[delete] → ${removed}`);
      else         console.warn(`[delete] no output found for ${event.filePath}`);
      return;
    }

    // add | change — read → transform → upsert
    const candidate = transform(event.filePath, event.sourceRoot);
    const outPath   = writer.upsert(candidate);
    console.log(`[${event.type.padEnd(6)}] ${event.filePath} → ${outPath}`);
  } catch (err) {
    console.error(`[error]  ${event.filePath}:`, (err as Error).message);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const watcher = new PipelineWatcher();

watcher.on('pipeline', handleEvent);
watcher.on('error', (err: Error) => console.error('[watcher error]', err.message));

watcher.start(pipelineConfig.sources);

console.log('Pipeline started. Watching sources:');
for (const s of pipelineConfig.sources) {
  console.log(`  ${s.path}`);
}

// Graceful shutdown
process.on('SIGINT',  async () => { await watcher.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await watcher.stop(); process.exit(0); });

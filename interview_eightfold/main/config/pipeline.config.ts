// ─── Pipeline source configuration ───────────────────────────────────────────
// Add a new entry per source folder. All other config (pattern, outputDir,
// field mappings) lives in that folder's own _pipeline.config.json.

export interface SourcePath {
  path: string;  // absolute or relative to project root
}

export const pipelineConfig: { sources: SourcePath[] } = {
  sources: [
    { path: './data/Folder1' },
    { path: './data/Folder2' },
  ],
};

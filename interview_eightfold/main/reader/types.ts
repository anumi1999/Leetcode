// ─── Reader contract ──────────────────────────────────────────────────────────
// Each reader handles one file extension. It receives the raw file buffer and
// returns parsed content as unknown (the GenericAdapter maps it to ParsedInput).

export interface IReader {
  readonly extensions: string[];          // e.g. ['.json'] or ['.csv']
  read(filePath: string): unknown;        // returns parsed raw content
}

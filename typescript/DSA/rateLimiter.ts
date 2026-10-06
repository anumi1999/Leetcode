// Mocks to help your code compile cleanly
interface LogEntry {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}
function parseLine(line: string): LogEntry {
  const isError = line.includes('ERROR');
  return { timestamp: Date.now(), level: isError ? 'ERROR' : 'INFO', message: line };
}
async function saveToDatabase(batch: LogEntry[]): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 50));
}

class RateLimitedLogPipeline {
  private maxRequest: number;
  private windowMs: number;
  
  // 💡 Fix 2: Keep Rate Limiting separate from Database Batching
  private rateLimitTimestamps: number[]; 
  private flushBuffer: LogEntry[];
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor(maxRequest: number = 100, windowMs: number = 1000) {
    this.maxRequest = maxRequest;
    this.windowMs = windowMs;
    this.rateLimitTimestamps = [];
    this.flushBuffer = [];
  }

  /**
   * Main ingest pipeline method
   */
  public ingest(rawLine: string): void {
    const logLine = parseLine(rawLine);

    // CRITICAL REQUIREMENT: ERROR logs completely bypass rate limiting
    if (logLine.level !== 'ERROR') {
      const isAllowed = this.allowRequest(logLine.timestamp);
      if (!isAllowed) {
        return; // Silently drop the log line
      }
    }

    // Push into the database buffer queue
    this.flushBuffer.push(logLine);

    // Batch constraint check: flush if we reach 50 entries
    if (this.flushBuffer.length >= 50) {
      this.flushBatch();
    } else {
      this.scheduleTimeBasedFlush();
    }
  }

  /**
   * Your Sliding Window Rate Limiter Pattern (Fixed and Optimized)
   */
  private allowRequest(timestamp: number): boolean {
    const expiryThreshold = timestamp - this.windowMs;

    // 💡 Fix 1: Check length > 0 to prevent "Cannot read property of undefined" crashes
    while (this.rateLimitTimestamps.length > 0 && this.rateLimitTimestamps[0] < expiryThreshold) {
      this.rateLimitTimestamps.shift();
    }

    if (this.rateLimitTimestamps.length < this.maxRequest) {
      this.rateLimitTimestamps.push(timestamp);
      return true;
    }

    return false;
  }

  private scheduleTimeBasedFlush(): void {
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flushBatch(), 2000);
      this.flushTimeout.unref?.(); 
    }
  }

  private flushBatch(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.flushBuffer.length === 0) return;

    // Snapshot and atomically swap to prevent race conditions during async database call
    const batchToSend = this.flushBuffer;
    this.flushBuffer = [];

    saveToDatabase(batchToSend).catch((err) => {
      console.error("[Pipeline Error] Failed to write logs to DB:", err);
    });
  }
}

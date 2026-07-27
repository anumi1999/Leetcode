/**
 * ============================================================
 *  03 — Logs: the "point-in-time facts" pillar
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  When you're paged at 3am, the trace tells you "tool X failed" and
 *  the metric tells you "5% of tool_calls are erroring." But you need
 *  the *exact* args, the exact provider error message, the exact
 *  intermediate reasoning — that's what a log line carries.
 *
 *  RULES (violate at your peril)
 *  -----------------------------
 *  1. STRUCTURED. JSON, not `console.log("tool failed: " + JSON.stringify(x))`.
 *     Structured logs are queryable. String logs require regex + prayer.
 *
 *  2. CORRELATED. Every line MUST carry `trace_id`, `span_id`, `run_id`
 *     (whichever apply). Otherwise you can't jump from a spiky trace
 *     to the log that explains it.
 *
 *  3. LEVELED. debug < info < warn < error. Filterable at query time,
 *     sample rate configurable per level (usually keep 100% of warn+).
 *
 *  4. REDACTED. Prompts and tool args often contain PII. Scrub at the
 *     log boundary via a redactor middleware — never rely on ad-hoc
 *     regex on strings.
 *
 *  5. SAMPLED. At 10k QPS × 20 log lines/request, you emit 200k
 *     lines/sec. Keep 100% of warn+ and error, sample info/debug.
 *
 *  6. NO SECRETS. API keys, JWTs, session cookies. Never. Redactor
 *     should have an allowlist for known-safe fields, not a denylist.
 *
 *  7. NO GIANT BLOBS. Truncate long strings. If you need the full
 *     prompt, store it separately keyed by trace_id (S3/blob store).
 *
 *  DESIGN
 *  ------
 *  A `Logger` that:
 *    - always emits JSON
 *    - carries a "context" (correlation IDs + any pinned fields)
 *    - applies a chain of `LogTransform`s (redact, sample, enrich)
 *    - writes to a `LogSink` (stderr by default; real prod: OTLP / stdout for k8s)
 */

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogFields {
    [key: string]: unknown;
}

export interface LogRecord {
    ts: number;                // ms since epoch
    level: LogLevel;
    msg: string;
    // Correlation
    trace_id?: string;
    span_id?: string;
    run_id?: string;
    // Free-form
    fields: LogFields;
}

export interface LogSink {
    write(record: LogRecord): void;
}

/** A transform can mutate, drop (return null), or enrich a record. */
export type LogTransform = (record: LogRecord) => LogRecord | null;

// ------------------------------------------------------------
// Sinks
// ------------------------------------------------------------

/** Writes one JSON per line to stderr — the k8s / Loki / CloudWatch friendly format. */
export class JsonSink implements LogSink {
    write(record: LogRecord): void {
        // process.stderr for prod; console.error for demo portability.
        console.error(JSON.stringify(record));
    }
}

/** Keeps records in memory for tests + demos. */
export class MemorySink implements LogSink {
    readonly records: LogRecord[] = [];
    write(record: LogRecord): void { this.records.push(record); }
}

// ------------------------------------------------------------
// Redaction — allowlist based, not regex.
// ------------------------------------------------------------

/**
 * Deep-scan a fields object and mask any keys not in `allow`.
 * We MASK rather than DROP so debug-ability is preserved:
 *   { email: "a@b.com" } → { email: "[REDACTED]" }
 * The presence of the field is still visible; the value isn't.
 */
export function redactor(allow: Set<string>, maxStrLen = 512): LogTransform {
    const walk = (v: unknown): unknown => {
        if (typeof v === "string") return v.length > maxStrLen ? v.slice(0, maxStrLen) + "…[truncated]" : v;
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === "object") {
            const out: Record<string, unknown> = {};
            for (const [k, val] of Object.entries(v)) {
                out[k] = allow.has(k) ? walk(val) : "[REDACTED]";
            }
            return out;
        }
        return v;
    };
    return (rec) => ({ ...rec, fields: walk(rec.fields) as LogFields });
}

// ------------------------------------------------------------
// Sampling — drop N% of records at a given level.
// ------------------------------------------------------------

/**
 * Keep 100% of warn/error. Sample debug/info at `sampleRate` (0..1).
 * Deterministic per-record via a hash of trace_id when present, so
 * either the ENTIRE trace is logged or none of it is.
 */
export function levelSampler(sampleRate: number): LogTransform {
    return (rec) => {
        if (rec.level === "warn" || rec.level === "error") return rec;
        const key = rec.trace_id ?? String(rec.ts);
        const h = hashStr(key);
        return h < sampleRate ? rec : null;
    };
}

function hashStr(s: string): number {
    // fnv-1a → [0,1)
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h * 16777619) >>> 0;
    }
    return (h % 10_000) / 10_000;
}

// ------------------------------------------------------------
// Logger
// ------------------------------------------------------------

export interface LoggerContext {
    trace_id?: string;
    span_id?: string;
    run_id?: string;
    /** Pinned fields that appear on every log line from this logger. */
    pinned?: LogFields;
}

export class Logger {
    constructor(
        private sink: LogSink,
        private transforms: LogTransform[] = [],
        private minLevel: LogLevel = "info",
        private ctx: LoggerContext = {},
    ) {}

    /** Return a child logger with additional context. Immutable. */
    child(add: LoggerContext): Logger {
        return new Logger(this.sink, this.transforms, this.minLevel, {
            ...this.ctx,
            ...add,
            pinned: { ...(this.ctx.pinned ?? {}), ...(add.pinned ?? {}) },
        });
    }

    debug(msg: string, fields: LogFields = {}) { this.emit("debug", msg, fields); }
    info (msg: string, fields: LogFields = {}) { this.emit("info",  msg, fields); }
    warn (msg: string, fields: LogFields = {}) { this.emit("warn",  msg, fields); }
    error(msg: string, fields: LogFields = {}) { this.emit("error", msg, fields); }

    private emit(level: LogLevel, msg: string, fields: LogFields): void {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
        let record: LogRecord | null = {
            ts: Date.now(),
            level,
            msg,
            trace_id: this.ctx.trace_id,
            span_id: this.ctx.span_id,
            run_id: this.ctx.run_id,
            fields: { ...(this.ctx.pinned ?? {}), ...fields },
        };
        for (const t of this.transforms) {
            record = t(record);
            if (record === null) return;
        }
        this.sink.write(record);
    }
}

// ------------------------------------------------------------
// Demo — a realistic pipeline: redact → sample → sink.
// ------------------------------------------------------------

if (require.main === module) {
    const sink = new MemorySink();
    const logger = new Logger(
        sink,
        [
            redactor(new Set([
                "trace_id", "span_id", "run_id",     // correlation always kept
                "tool", "provider", "model",         // dimensions
                "outcome", "latency_ms", "tokens",   // measurements
                "reason", "kind",                     // error taxonomy
                "city",                               // safe example field
            ])),
            levelSampler(0.5),                        // keep 50% of info/debug
        ],
        "debug",
    );

    const req = logger.child({
        trace_id: "0123456789abcdef0123456789abcdef",
        run_id: "run_1",
        pinned: { service: "agent-runtime" },
    });

    req.info("agent.start", { user_id: "u_abc", user_email: "a@b.com" }); // PII will be redacted
    req.info("tool.call", { tool: "get_weather", city: "Seattle" });
    req.warn("tool.retry", { tool: "search_web", reason: "429", latency_ms: 812 });
    req.error("tool.failed", {
        tool: "search_web",
        kind: "timeout",
        // Simulate a huge blob — should be truncated.
        raw: "x".repeat(10_000),
    });

    console.log(`\nWrote ${sink.records.length} records (after sampling):\n`);
    for (const r of sink.records) console.log(JSON.stringify(r));
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why redact with an allowlist, not a denylist?
 *     A: New fields get added every week. A denylist means every new
 *        PII-adjacent field leaks by default until someone remembers
 *        to add it. Allowlist means new fields are redacted by default
 *        → safe by default. Same principle as CORS, same principle as
 *        firewall rules.
 *
 *  Q: Why sample by trace_id, not per-line random?
 *     A: You want the WHOLE story or none of it. Random per-line
 *        gives you fragmented traces where you can see the middle
 *        but not the beginning — useless for debugging. Hashing the
 *        trace_id makes the decision consistent across every line.
 *
 *  Q: Prompt / completion — log or not?
 *     A: Depends. Full prompt = PII risk, cost, and giant lines. Two
 *        common patterns:
 *          (a) Never log raw. Log a hash + token count. Store raw in
 *              a separate store keyed by trace_id, with strict ACLs.
 *          (b) Log a truncated version at debug level, sampled at 1%.
 *        Both require product/legal signoff before shipping.
 *
 *  Q: Where should the log level filter run — in the app, or in the
 *     log pipeline (Fluent Bit, Vector)?
 *     A: Both. App-side filter avoids paying serialization cost.
 *        Pipeline-side filter lets you crank debug logs on at runtime
 *        without a redeploy (via config). Real prod does both.
 *
 *  Q: Structured logs vs printf logs — cost?
 *     A: Structured logs are ~2x the bytes on the wire (JSON keys)
 *        but 100x cheaper to query. At Elastic/Loki/Splunk prices,
 *        query cost DOMINATES ingest cost. Always structured.
 *
 *  Q: What one thing must be true for logs to be useful in prod?
 *     A: They contain trace_id. Without it you can't jump from
 *        dashboard → trace → the log line explaining it. Log lines
 *        without trace_id are basically anonymous.
 */

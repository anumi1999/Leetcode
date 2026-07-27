/**
 * ============================================================
 *  01 — Traces: the "one story" pillar
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  An agent turn touches many components: LLM, tool registry, N tools
 *  in parallel, another LLM turn. When something goes wrong you need
 *  ONE view that shows the causal chain, timings, inputs, outputs.
 *
 *  That view is a TRACE. A trace is a tree of SPANS.
 *
 *  TERMINOLOGY (OpenTelemetry, the de-facto standard)
 *  --------------------------------------------------
 *      trace_id    128-bit id, unique per request. Shared by every span.
 *      span_id     64-bit id, unique per span within a trace.
 *      parent_id   the span_id of the parent (undefined for the root).
 *      name        e.g. "agent.run", "llm.call", "tool.get_weather"
 *      start / end monotonic timestamps (µs or ns)
 *      status      "OK" | "ERROR" (+ optional message)
 *      attributes  key/value tags (low-cardinality preferred)
 *      events      timestamped notes ("first_token", "cache_hit")
 *
 *  WHY NOT `console.log`?
 *  ----------------------
 *  Logs are point-in-time; they don't encode causality or timing.
 *  You'd have to reconstruct "which log line belongs to which request"
 *  yourself. Traces give you the tree for free.
 *
 *  DESIGN
 *  ------
 *  - A minimal `Tracer` that produces OpenTelemetry-shaped spans.
 *  - Spans support parent linking, attributes, events, status.
 *  - An in-memory exporter for demos + tests. Real code plugs OTLP
 *    (Jaeger, Tempo, Honeycomb, Datadog, Grafana Cloud, ...) here.
 *  - `withSpan(name, fn)` wraps an async function so the span auto-ends
 *    on resolve/reject. This is the ergonomic 90% API.
 */

// ------------------------------------------------------------
// Types — mirror the OpenTelemetry data model
// ------------------------------------------------------------

export type SpanStatus =
    | { code: "OK" }
    | { code: "ERROR"; message: string };

export interface SpanAttributes {
    /**
     * Keep values low-cardinality — good: "openai", "get_weather".
     * Bad: user_id, full prompt (put those in log/event with sampling).
     */
    [key: string]: string | number | boolean | undefined;
}

export interface SpanEvent {
    name: string;
    at: number; // ms since epoch, or monotonic — pick one and stick with it
    attrs?: SpanAttributes;
}

export interface Span {
    traceId: string;
    spanId: string;
    parentId?: string;
    name: string;
    startedAt: number;
    endedAt?: number;
    status: SpanStatus;
    attrs: SpanAttributes;
    events: SpanEvent[];
}

/** Where completed spans go. Real code: OTLP exporter. */
export interface SpanExporter {
    export(span: Span): void;
}

// ------------------------------------------------------------
// In-memory exporter — enough for tests + demos.
// ------------------------------------------------------------

export class MemoryExporter implements SpanExporter {
    readonly spans: Span[] = [];
    export(span: Span): void {
        this.spans.push(span);
    }
    /** Pretty print as a tree for humans. */
    printTree(): void {
        const byId = new Map(this.spans.map((s) => [s.spanId, s]));
        const children = new Map<string | undefined, Span[]>();
        for (const s of this.spans) {
            const arr = children.get(s.parentId) ?? [];
            arr.push(s);
            children.set(s.parentId, arr);
        }
        // Sort children by start time for stable output.
        for (const arr of children.values()) arr.sort((a, b) => a.startedAt - b.startedAt);

        const roots = children.get(undefined) ?? [];
        const walk = (span: Span, depth: number) => {
            const dur = (span.endedAt ?? span.startedAt) - span.startedAt;
            const s = span.status.code === "OK" ? " " : "✗";
            console.log(
                `${"  ".repeat(depth)}${s} ${span.name.padEnd(28 - depth * 2)} ${dur}ms  ${JSON.stringify(span.attrs)}`,
            );
            for (const ev of span.events) {
                console.log(`${"  ".repeat(depth + 1)}· event: ${ev.name} ${JSON.stringify(ev.attrs ?? {})}`);
            }
            for (const c of children.get(span.spanId) ?? []) walk(c, depth + 1);
        };
        for (const r of roots) walk(r, 0);
        // Silence "unused" warning in the byId map; it's kept for future extensions.
        void byId;
    }
}

// ------------------------------------------------------------
// Tracer — the API you actually use
// ------------------------------------------------------------

export interface StartSpanOptions {
    /**
     * If provided, this span becomes a child of `parent`. If omitted, we
     * fall back to whatever is on the current async context (see 04).
     * You almost never pass this by hand — use withSpan/withActive.
     */
    parent?: Pick<Span, "traceId" | "spanId">;
    attrs?: SpanAttributes;
}

export class Tracer {
    constructor(private exporter: SpanExporter) {}

    /**
     * Start a span. YOU are responsible for calling `end()`.
     * Prefer `withSpan(...)` unless you need manual control.
     */
    startSpan(name: string, opts: StartSpanOptions = {}): ActiveSpan {
        const parent = opts.parent;
        const traceId = parent?.traceId ?? newTraceId();
        const spanId = newSpanId();
        const raw: Span = {
            traceId,
            spanId,
            parentId: parent?.spanId,
            name,
            startedAt: Date.now(),
            status: { code: "OK" },
            attrs: { ...(opts.attrs ?? {}) },
            events: [],
        };
        return new ActiveSpan(raw, this.exporter);
    }

    /**
     * Ergonomic wrapper: start a span, run fn, end on resolve/reject.
     * The span object is passed in so you can set attrs / events.
     */
    async withSpan<T>(
        name: string,
        fn: (span: ActiveSpan) => Promise<T>,
        opts: StartSpanOptions = {},
    ): Promise<T> {
        const span = this.startSpan(name, opts);
        try {
            const value = await fn(span);
            span.end();
            return value;
        } catch (e) {
            span.recordException(e);
            span.setStatus({ code: "ERROR", message: (e as Error).message });
            span.end();
            throw e;
        }
    }
}

/**
 * Wraps a Span with mutator methods. Handing this to callers instead of
 * the raw span makes the "you can't mutate an ended span" rule enforceable.
 */
export class ActiveSpan {
    #ended = false;
    constructor(private span: Span, private exporter: SpanExporter) {}

    get traceId() { return this.span.traceId; }
    get spanId()  { return this.span.spanId; }

    setAttr(key: string, value: string | number | boolean): this {
        if (this.#ended) return this; // silently drop late writes — never crash prod
        this.span.attrs[key] = value;
        return this;
    }

    addEvent(name: string, attrs?: SpanAttributes): this {
        if (this.#ended) return this;
        this.span.events.push({ name, at: Date.now(), attrs });
        return this;
    }

    setStatus(status: SpanStatus): this {
        if (this.#ended) return this;
        this.span.status = status;
        return this;
    }

    recordException(err: unknown): this {
        const e = err as Error;
        return this.addEvent("exception", {
            "exception.type": e?.name ?? "Error",
            "exception.message": e?.message ?? String(err),
        });
    }

    end(): void {
        if (this.#ended) return;
        this.#ended = true;
        this.span.endedAt = Date.now();
        this.exporter.export(this.span);
    }

    /** Snapshot for parent-linking; see 04_context_propagation.ts. */
    snapshot(): Pick<Span, "traceId" | "spanId"> {
        return { traceId: this.traceId, spanId: this.spanId };
    }
}

// ------------------------------------------------------------
// Id generation. Real code uses crypto-random 128/64-bit values.
// ------------------------------------------------------------

function newTraceId(): string {
    return randHex(16); // 128 bits
}
function newSpanId(): string {
    return randHex(8); // 64 bits
}
function randHex(bytes: number): string {
    // Node crypto is available in Bun and modern Node.
    const buf = new Uint8Array(bytes);
    (globalThis.crypto ?? require("node:crypto").webcrypto).getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------
// Demo — trace an agent turn with a nested LLM + two tool calls.
// ------------------------------------------------------------

if (require.main === module) {
    const exporter = new MemoryExporter();
    const tracer = new Tracer(exporter);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
        await tracer.withSpan("agent.run", async (root) => {
            root.setAttr("run_id", "run_1");
            root.setAttr("user_id_hash", "u_abc123"); // hashed, low-cardinality bucket

            // LLM call #1
            await tracer.withSpan("llm.call", async (llm) => {
                llm.setAttr("provider", "openai");
                llm.setAttr("model", "gpt-4o");
                llm.addEvent("first_token", { latency_ms: 42 });
                await sleep(30);
                llm.setAttr("tokens.input", 200);
                llm.setAttr("tokens.output", 40);
            }, { parent: root.snapshot() });

            // Two tools in parallel — each is a child of root, siblings of each other.
            await tracer.withSpan("tools.batch", async (batch) => {
                batch.setAttr("count", 2);
                await Promise.all([
                    tracer.withSpan("tool.get_weather", async (t) => {
                        t.setAttr("tool", "get_weather");
                        await sleep(20);
                        t.setAttr("cache", "miss");
                    }, { parent: batch.snapshot() }),
                    tracer.withSpan("tool.search_web", async (t) => {
                        t.setAttr("tool", "search_web");
                        await sleep(50);
                        t.setStatus({ code: "ERROR", message: "429 rate limited" });
                    }, { parent: batch.snapshot() }),
                ]);
            }, { parent: root.snapshot() });

            // Final LLM turn
            await tracer.withSpan("llm.call", async (llm) => {
                llm.setAttr("provider", "openai");
                await sleep(15);
                llm.setAttr("tokens.output", 80);
            }, { parent: root.snapshot() });
        });

        console.log("\nTRACE TREE:\n");
        exporter.printTree();
        console.log(`\n${exporter.spans.length} spans exported.`);
    })();
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: What's the difference between a log and a trace?
 *     A: A log is a point-in-time fact. A trace is a causally-linked
 *        tree of timed spans. Traces answer "what happened in this
 *        request?"; logs answer "what were the exact details at
 *        moment X?". You want both, with the same trace_id on each
 *        log line for correlation.
 *
 *  Q: What's the biggest anti-pattern in trace attributes?
 *     A: High-cardinality labels. `user_id` as an attribute is fine
 *        for a single trace (you only need one). Putting it on a
 *        metric label creates one time-series per user → your
 *        Prometheus dies. Rule: attributes = descriptive, unbounded
 *        values OK. Metrics labels = enumerable, bounded values ONLY.
 *
 *  Q: Sampling strategy?
 *     A: Head sampling: decide at trace start (e.g. 1% of requests).
 *        Cheap. Loses errors that are rare in the sampled 1%.
 *        Tail sampling: buffer the whole trace, decide after seeing
 *        it (e.g. "always keep if status=ERROR or duration>500ms").
 *        Expensive but preserves the interesting stuff. Production:
 *        head-sample by default + always-keep for error paths.
 *
 *  Q: Distributed traces — how does trace_id survive a network hop?
 *     A: W3C traceparent header:
 *          traceparent: 00-<trace_id>-<span_id>-<flags>
 *        Sender writes it, receiver reads it and starts a new span
 *        as a child. That's how a browser click, your gateway, your
 *        agent, and your DB all show up on one trace.
 *
 *  Q: Why do you need `AsyncLocalStorage` for context propagation?
 *     A: See 04. Short version: a global "current span" variable
 *        breaks the second you `await` a parallel operation, because
 *        two concurrent chains would clobber each other's context.
 *        AsyncLocalStorage gives each async chain its own view.
 */

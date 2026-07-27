/**
 * ============================================================
 *  04 — Context Propagation with AsyncLocalStorage
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  You want any code, no matter how deep in the call stack, to be able
 *  to ask "what trace am I in?" without passing `tracer` and `parentSpan`
 *  through every function signature.
 *
 *  THE WRONG WAYS (interviewers love these gotchas)
 *  ------------------------------------------------
 *  (a) Global mutable variable
 *
 *          let currentSpan: Span | undefined;
 *          async function handleRequest() {
 *              currentSpan = startSpan("http.get");
 *              await Promise.all([doA(), doB()]);   // both write to currentSpan!
 *          }
 *
 *      Two concurrent requests clobber each other. Random test failures.
 *
 *  (b) Thread-locals
 *
 *      Node has no thread-locals. Each event-loop iteration reuses the
 *      SAME "thread". `thread_local` semantics don't map onto async JS.
 *
 *  (c) Pass span through every function
 *
 *      Works. Painful. Every third-party library and every callback needs
 *      to be modified. Not a real option for a large codebase.
 *
 *  THE RIGHT WAY: `AsyncLocalStorage` (Node 12.17+)
 *  ------------------------------------------------
 *  Node's async_hooks tracks the "async execution chain". `AsyncLocalStorage`
 *  gives each chain its OWN view of a value.
 *
 *      const als = new AsyncLocalStorage<Ctx>();
 *      als.run({ traceId: "abc" }, async () => {
 *          // Every function called inside — sync OR async — sees {traceId:"abc"}
 *          // via als.getStore(), even across `await`, `setTimeout`, `Promise.all`.
 *      });
 *
 *  Two concurrent `als.run(...)` calls have separate stores. Solved.
 *
 *  ANALOGY
 *  -------
 *  Think of it as one filing cabinet per concurrent request, with the
 *  runtime handing you the right drawer based on which async chain
 *  you're currently in.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { ActiveSpan, Tracer } from "./01_traces";
import type { Logger } from "./03_logs";

// ------------------------------------------------------------
// The context we carry along an async chain.
// ------------------------------------------------------------

export interface RequestContext {
    tracer: Tracer;
    logger: Logger;
    /** The current active span. Children auto-parent to this. */
    span?: ActiveSpan;
    /** Application-level correlation. */
    runId?: string;
    userId?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

/** Read the current context. Undefined if not inside `runWithContext`. */
export function currentContext(): RequestContext | undefined {
    return als.getStore();
}

export function currentSpan(): ActiveSpan | undefined {
    return als.getStore()?.span;
}

/**
 * Establish a context for everything transitively called inside `fn`.
 * Nesting is fine: the inner context replaces the outer for its scope.
 */
export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
    return als.run(ctx, fn);
}

/**
 * The ergonomic span helper. It:
 *   1. Grabs the current context.
 *   2. Starts a span parented to the current span (if any).
 *   3. Rewrites the context with the new span for the duration of `fn`.
 *   4. Ends the span on resolve/reject.
 *
 * This is the ONE API most application code should use.
 */
export async function withSpan<T>(
    name: string,
    fn: (span: ActiveSpan) => Promise<T>,
    attrs?: Record<string, string | number | boolean>,
): Promise<T> {
    const ctx = als.getStore();
    if (!ctx) throw new Error("withSpan called outside a request context");

    const span = ctx.tracer.startSpan(name, {
        parent: ctx.span?.snapshot(),
        attrs,
    });

    // Give child code a context whose `.span` is our new span.
    const childCtx: RequestContext = { ...ctx, span };
    // Also make the child logger correlated to this span.
    const childLogger = ctx.logger.child({
        trace_id: span.traceId,
        span_id: span.spanId,
    });
    childCtx.logger = childLogger;

    try {
        const value = await als.run(childCtx, () => fn(span));
        span.end();
        return value;
    } catch (e) {
        span.recordException(e);
        span.setStatus({ code: "ERROR", message: (e as Error).message });
        span.end();
        throw e;
    }
}

// ------------------------------------------------------------
// Demo — proves that parallel chains do NOT clobber each other.
// ------------------------------------------------------------

if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Tracer, MemoryExporter } = require("./01_traces");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logger, MemorySink } = require("./03_logs");

    const exporter = new MemoryExporter();
    const tracer = new Tracer(exporter);
    const sink = new MemorySink();
    const logger = new Logger(sink);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function handleRequest(id: string) {
        return runWithContext({ tracer, logger, runId: id }, async () => {
            await withSpan("request", async () => {
                await withSpan("child.a", async () => {
                    await sleep(10 + Math.random() * 20);
                });
                await withSpan("child.b", async () => {
                    await sleep(10 + Math.random() * 20);
                });
                // The current-span check would fail without ALS —
                // both requests would see the same "current" span.
            }, { req_id: id });
        });
    }

    (async () => {
        // 3 concurrent requests. Each should produce its OWN trace tree
        // with 3 spans (request + 2 children).
        await Promise.all([handleRequest("A"), handleRequest("B"), handleRequest("C")]);

        // Group by trace_id to prove isolation.
        const byTrace = new Map<string, number>();
        for (const s of exporter.spans) {
            byTrace.set(s.traceId, (byTrace.get(s.traceId) ?? 0) + 1);
        }
        console.log("Traces observed:", byTrace.size);
        for (const [tid, n] of byTrace) console.log(`  ${tid.slice(0, 8)}… → ${n} spans`);

        console.log("\nTree:\n");
        exporter.printTree();
    })();
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: What's the runtime cost of AsyncLocalStorage?
 *     A: Real. AsyncLocalStorage relies on async_hooks, which adds
 *        per-async-op overhead (a few hundred ns per await). In hot
 *        loops with millions of tiny awaits, benchmark. In an agent
 *        loop (dozens of ops per request), it's negligible.
 *
 *  Q: Does ALS work across `setImmediate`, `setTimeout`, `Promise.all`?
 *     A: Yes to all three — those are tracked by async_hooks. It does
 *        NOT propagate across `worker_threads` or `child_process` —
 *        those are separate execution contexts. You have to serialize
 *        `traceparent` and rehydrate in the child.
 *
 *  Q: What if an EventEmitter fires callbacks outside the run scope?
 *     A: Trap. `emitter.emit("x")` runs listeners synchronously in
 *        whatever context called `emit`, not where the listener was
 *        registered. Fix: `als.bind(fn)` returns a function that
 *        restores the context that was active when `bind` was called.
 *
 *  Q: Can I use it in the browser?
 *     A: No; it's a Node built-in. Browsers get `AsyncContext` as a
 *        Stage 2 TC39 proposal (2024) — same idea, portable.
 *
 *  Q: Alternative: pass context explicitly?
 *     A: Works, and some codebases prefer it for auditability
 *        (Go-style `ctx context.Context` in every function). Trade-off:
 *        every function signature grows, every 3rd-party lib needs a
 *        shim. ALS is the pragmatic choice for JS/TS.
 *
 *  Q: How does trace context leave the process (distributed tracing)?
 *     A: Serialize to W3C traceparent header on outgoing HTTP:
 *          traceparent: 00-<traceId>-<spanId>-<flags>
 *        The remote service reads it, calls `tracer.startSpan` with
 *        that as parent. Now the browser click, the gateway, your
 *        agent, and the DB share one trace.
 */

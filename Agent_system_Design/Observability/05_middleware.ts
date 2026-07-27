/**
 * ============================================================
 *  05 — Wiring observability into the tool registry
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  01–04 built the primitives. Now we prove they slot cleanly into an
 *  agent runtime by writing MIDDLEWARE for the ToolCalling registry:
 *
 *    - traceMiddleware:  one span per tool invocation, attributes for
 *                         tool name, outcome, latency, tokens.
 *    - metricsMiddleware: bump counters/histograms per invocation.
 *    - logMiddleware:     structured log lines with trace_id correlation.
 *
 *  KEY IDEAS
 *  ---------
 *  - Cross-cutting concerns are pluggable. The registry is a pipeline
 *    (see ToolCalling/06_registry.ts). We don't touch tool handlers.
 *  - Each middleware reads context from AsyncLocalStorage (04). No
 *    manual wiring at call sites.
 *  - Order matters. Outer middleware sees INNER outcomes:
 *
 *        request →  trace  →  metrics  →  log  →  tool handler
 *                                                    │
 *        response ← trace  ← metrics  ← log  ←──────┘
 *
 *    Put `trace` outermost so the span exists BEFORE metrics/logs
 *    record their fields — they'll use the trace_id from ALS.
 */

import type { Middleware, InvocationContext, InvocationResult } from "../ToolCalling/06_registry";
import { currentContext, withSpan } from "./04_context_propagation";
import type { MetricsRegistry } from "./02_metrics";
import { makeAgentMetrics } from "./02_metrics";

// ------------------------------------------------------------
// Trace middleware — one span per tool invocation.
// ------------------------------------------------------------

export const traceMiddleware: Middleware = async (inv, next) => {
    return withSpan(
        `tool.${inv.name}`,
        async (span) => {
            span.setAttr("tool", inv.name);
            // NEVER put raw args on the span — put a shape hint.
            span.setAttr("args.keys", Object.keys(inv.args).join(","));
            const res = await next();
            span.setAttr("outcome", res.ok ? "ok" : res.error.kind);
            if (!res.ok) span.setStatus({ code: "ERROR", message: res.error.message });
            return res;
        },
    );
};

// ------------------------------------------------------------
// Metrics middleware — counters + latency histogram.
// ------------------------------------------------------------

export function metricsMiddleware(reg: MetricsRegistry): Middleware {
    const m = makeAgentMetrics(reg);
    return async (inv, next) => {
        m.toolInFlight.add(1, { tool: inv.name });
        const started = Date.now();
        try {
            const res = await next();
            const outcome = res.ok ? "ok" : (res.error.kind === "timeout" ? "timeout" : "error");
            m.toolCalls.inc({ tool: inv.name, outcome });
            m.toolLatency.observe(Date.now() - started, { tool: inv.name });
            return res;
        } finally {
            m.toolInFlight.add(-1, { tool: inv.name });
        }
    };
}

// ------------------------------------------------------------
// Log middleware — pre-call info, post-call info/warn/error.
// ------------------------------------------------------------

export const logMiddleware: Middleware = async (inv, next) => {
    const ctx = currentContext();
    // If no ALS context, fall through to the caller-provided ctx.log.
    const log = ctx?.logger;
    const start = Date.now();

    if (log) log.info("tool.request", { tool: inv.name, args_keys: Object.keys(inv.args) });
    else     inv.ctx.log({ event: "tool.request", tool: inv.name, args_keys: Object.keys(inv.args) });

    const res = await next();
    const latency_ms = Date.now() - start;

    const fields = { tool: inv.name, latency_ms, ok: res.ok, ...(res.ok ? {} : { kind: res.error.kind, message: res.error.message }) };
    if (log) {
        if (res.ok) log.info("tool.response", fields);
        else        log.warn("tool.error", fields);
    } else {
        inv.ctx.log({ event: res.ok ? "tool.response" : "tool.error", ...fields });
    }
    return res;
};

// ------------------------------------------------------------
// Convenience: install the standard trio.
// ------------------------------------------------------------

import type { ToolRegistry } from "../ToolCalling/06_registry";

export function installObservability(
    registry: ToolRegistry,
    reg: MetricsRegistry,
): void {
    // Order: outermost first (registered first). trace → metrics → log → handler.
    registry.use(traceMiddleware);
    registry.use(metricsMiddleware(reg));
    registry.use(logMiddleware);
}

// ------------------------------------------------------------
// Demo — pretend we have a registry from ToolCalling and drive it.
// ------------------------------------------------------------

if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ToolRegistry } = require("../ToolCalling/06_registry");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Tracer, MemoryExporter } = require("./01_traces");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logger, MemorySink } = require("./03_logs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MetricsRegistry } = require("./02_metrics");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runWithContext } = require("./04_context_propagation");

    const exporter = new MemoryExporter();
    const tracer = new Tracer(exporter);
    const sink = new MemorySink();
    const logger = new Logger(sink);
    const metrics = new MetricsRegistry();

    const registry = new ToolRegistry();
    installObservability(registry, metrics);

    registry.register({
        definition: {
            type: "function",
            function: {
                name: "get_weather",
                description: "Get weather.",
                parameters: {
                    type: "object",
                    required: ["city"],
                    additionalProperties: false,
                    properties: { city: { type: "string", minLength: 1 } },
                },
            },
        },
        handler: async ({ city }: Record<string, unknown>) => {
            await new Promise((r) => setTimeout(r, 20 + Math.random() * 40));
            return { city, tempC: 19 };
        },
    });

    registry.register({
        definition: {
            type: "function",
            function: {
                name: "boom",
                description: "always errors",
                parameters: { type: "object", additionalProperties: false, properties: {} },
            },
        },
        handler: async () => { throw new Error("kaboom"); },
    });

    const ctx: InvocationContext = {
        requestId: "req_1",
        log: (f) => { /* replaced by logMiddleware when ALS is available */ void f; },
    };

    runWithContext({ tracer, logger, runId: "run_1" }, async () => {
        await Promise.all([
            registry.invoke("get_weather", { city: "SF" }, ctx),
            registry.invoke("get_weather", { city: "NY" }, ctx),
            registry.invoke("boom", {}, ctx),
        ]);

        console.log("\n--- TRACES ---");
        exporter.printTree();

        console.log("\n--- METRICS ---");
        console.log(metrics.dump());

        console.log("\n--- LOGS ---");
        for (const r of sink.records) console.log(JSON.stringify(r));
    });
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why put trace OUTERMOST?
 *     A: Metrics and logs need trace_id to correlate. If trace runs
 *        after them, they emit BEFORE the span exists, so trace_id
 *        is empty. Ordering: trace → metrics → log → handler.
 *
 *  Q: Middleware chain works for one hop. What about downstream
 *     services (LLM, DB)?
 *     A: Wrap the outgoing call the same way: `withSpan("llm.call",
 *        async span => { ... })`. On outbound HTTP, inject the
 *        traceparent header so the remote service continues the trace.
 *
 *  Q: Should the middleware log the args?
 *     A: NO. Args often contain user text (city name is fine; email,
 *        prompt, coordinates are not). Log the SHAPE (`args_keys`),
 *        rely on the trace attributes for the same, and rely on the
 *        REDACTOR in the log pipeline (03) to enforce it as a
 *        belt-and-suspenders defense.
 *
 *  Q: Every tool call now allocates a span, updates 3 counters, and
 *     emits a log line. What's the perf overhead?
 *     A: ~microseconds per call for in-process observability + a few
 *        hundred bytes of memory per span. Serialization/export to
 *        OTLP is asynchronous and batched — real overhead lives
 *        there, not on the request path. Rule: measure it, don't
 *        assume.
 *
 *  Q: If the tool crashes the process (unhandled reject), what
 *     happens to its in-flight span?
 *     A: Never exported. This is why you also need process-level
 *        signal handlers that flush the tracer on SIGTERM. In prod
 *        with OTLP, the SDK does this automatically.
 */

/**
 * ============================================================
 *  Orchestrator — end-to-end observability demo
 * ============================================================
 *
 *  Simulates one agent turn:
 *    1. HTTP-shaped entry → we open the root request context.
 *    2. Root span "agent.run".
 *    3. LLM call (span "llm.call").
 *    4. Two parallel tool calls (each its own span, wired via middleware).
 *    5. Final LLM call.
 *    6. Print the trace tree + metrics + logs.
 *
 *  No network. No real LLM. The point is that traces, metrics, and
 *  logs are ALL emitted from the SAME run, correlated by trace_id,
 *  from three different pillars.
 *
 *      bun orchestrator.ts
 */

import { Tracer, MemoryExporter } from "./01_traces";
import { MetricsRegistry, makeAgentMetrics } from "./02_metrics";
import { Logger, MemorySink, redactor, levelSampler } from "./03_logs";
import { runWithContext, withSpan } from "./04_context_propagation";
import { installObservability } from "./05_middleware";
import { ToolRegistry, InvocationContext } from "../ToolCalling/06_registry";

// ------------------------------------------------------------
// Bootstrapping: the observability platform
// ------------------------------------------------------------

const exporter = new MemoryExporter();
const tracer   = new Tracer(exporter);
const sink     = new MemorySink();
const logger   = new Logger(
    sink,
    [
        redactor(new Set([
            "trace_id", "span_id", "run_id",
            "tool", "provider", "model", "outcome", "latency_ms",
            "kind", "message", "city", "args_keys", "ok",
            "tokens", "reason", "service",
        ])),
        levelSampler(1.0),
    ],
    "debug",
);
const metrics = new MetricsRegistry();
const m       = makeAgentMetrics(metrics);

// ------------------------------------------------------------
// Application: the agent registry with two tools
// ------------------------------------------------------------

const registry = new ToolRegistry();
installObservability(registry, metrics);

registry.register({
    definition: {
        type: "function",
        function: {
            name: "get_weather",
            description: "Get weather for a city.",
            parameters: {
                type: "object", required: ["city"], additionalProperties: false,
                properties: { city: { type: "string", minLength: 1 } },
            },
        },
    },
    handler: async ({ city }) => {
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
        return { city, tempC: 19, sky: "cloudy" };
    },
});

registry.register({
    definition: {
        type: "function",
        function: {
            name: "search_web",
            description: "Web search.",
            parameters: {
                type: "object", required: ["query"], additionalProperties: false,
                properties: { query: { type: "string", minLength: 1 } },
            },
        },
    },
    handler: async ({ query }) => {
        await new Promise((r) => setTimeout(r, 60 + Math.random() * 80));
        return [{ title: `Result for ${query}`, url: "https://example.com" }];
    },
});

// ------------------------------------------------------------
// Fake LLM call — modeled as a span with token attrs.
// ------------------------------------------------------------

async function callLLM(kind: "plan" | "final"): Promise<void> {
    await withSpan("llm.call", async (span) => {
        span.setAttr("provider", "openai");
        span.setAttr("model", "gpt-4o");
        span.addEvent("first_token", { at_ms: 42 });
        const inTokens  = 150 + Math.floor(Math.random() * 50);
        const outTokens = 40  + Math.floor(Math.random() * 40);
        await new Promise((r) => setTimeout(r, 30 + Math.random() * 20));
        span.setAttr("tokens.input", inTokens);
        span.setAttr("tokens.output", outTokens);
        span.setAttr("kind", kind);
        m.llmRequests.inc({ provider: "openai", model: "gpt-4o", outcome: "ok" });
        m.llmTokens.inc({ provider: "openai", direction: "input"  }, inTokens);
        m.llmTokens.inc({ provider: "openai", direction: "output" }, outTokens);
        m.llmFirstToken.observe(42, { provider: "openai", model: "gpt-4o" });
    });
}

// ------------------------------------------------------------
// One end-to-end agent turn
// ------------------------------------------------------------

async function agentTurn(runId: string, userPrompt: string): Promise<void> {
    return runWithContext({ tracer, logger, runId }, async () => {
        m.activeRuns.add(1);
        try {
            await withSpan("agent.run", async (root) => {
                root.setAttr("run_id", runId);
                root.setAttr("prompt_tokens_estimate", userPrompt.length / 4);

                await callLLM("plan");

                const invCtx: InvocationContext = {
                    requestId: runId,
                    log: () => { /* logMiddleware uses ALS logger */ },
                };
                await Promise.all([
                    registry.invoke("get_weather", { city: "Seattle" }, invCtx),
                    registry.invoke("search_web",  { query: "seattle events" }, invCtx),
                ]);

                await callLLM("final");
                m.turns.inc({ status: "ok" });
            });
        } finally {
            m.activeRuns.add(-1);
        }
    });
}

// ------------------------------------------------------------
// Drive: three concurrent runs so we see ALS isolation.
// ------------------------------------------------------------

(async () => {
    await Promise.all([
        agentTurn("run_A", "What's the weather in Seattle and what's on?"),
        agentTurn("run_B", "Any news in Seattle this weekend?"),
        agentTurn("run_C", "Plan me a trip to Seattle."),
    ]);

    console.log("\n============ TRACE TREES ============\n");
    exporter.printTree();

    console.log(`\nTotal spans: ${exporter.spans.length}`);
    const traceIds = new Set(exporter.spans.map((s) => s.traceId));
    console.log(`Unique traces: ${traceIds.size} (should be 3 — one per run)\n`);

    console.log("============ METRICS ============\n");
    console.log(metrics.dump().split("\n").slice(0, 40).join("\n"));

    console.log("\n============ LOGS (excerpt) ============\n");
    for (const r of sink.records.slice(0, 12)) console.log(JSON.stringify(r));
    console.log(`\n(${sink.records.length} total log records)`);
})();

/**
 * WHAT TO OBSERVE
 * ---------------
 *  1. THREE trace trees — one per run. If you got only one, ALS
 *     propagation is broken.
 *
 *  2. Every log line carries `trace_id` and `span_id`. That's what
 *     lets you jump dashboards → traces → logs in prod.
 *
 *  3. Metrics don't carry trace_id — they're aggregated across all
 *     three runs. That's how metrics work: you lose per-request
 *     detail in exchange for cheap aggregation.
 *
 *  4. Tool errors would show up with status=ERROR on their span AND
 *     an incremented `tool_calls_total{outcome="error"}` counter AND
 *     a `warn`-level log line. Three views of the same event.
 */

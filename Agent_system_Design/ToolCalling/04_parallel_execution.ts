/**
 * ============================================================
 *  04 — Parallel Tool Execution with Promise.allSettled
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  Modern LLMs emit multiple tool calls in a single turn (e.g. "check
 *  weather in SF AND search web for news"). We should execute them
 *  concurrently to minimize latency.
 *
 *  Why NOT Promise.all?
 *  --------------------
 *  Promise.all rejects on the FIRST failure and discards all other
 *  results — even ones that already resolved. In an agent, we want
 *  to feed *every* result (success or failure) back to the model
 *  so it can decide how to recover.
 *
 *  Promise.allSettled always resolves. Each entry is either:
 *     { status: "fulfilled", value: T }
 *     { status: "rejected",  reason: unknown }
 *
 *  Additional concerns:
 *    1. Concurrency cap: don't hammer downstreams if the model asks
 *       for 30 tools in one turn.
 *    2. Fail isolation: a thrown handler mustn't take down the loop.
 *    3. Consistent shape returned to the caller.
 *    4. Preserve order — model expects results in call order.
 */

export interface ToolResult {
    toolCallId: string;
    name: string;
    ok: boolean;
    /** Serialized result (LLMs consume strings). */
    output: string;
    /** Wall-clock ms; useful for tracing. */
    latencyMs: number;
    /** Populated when ok = false. */
    error?: { kind: string; message: string };
}

export interface ToolInvocation {
    toolCallId: string;
    name: string;
    /**
     * The actual work. It is passed an AbortSignal so the runner can
     * cancel it — see 05_timeout.ts.
     */
    execute: (signal: AbortSignal) => Promise<unknown>;
}

// ------------------------------------------------------------
// Concurrency limiter — small, dependency-free.
// ------------------------------------------------------------

async function withConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    limit: number,
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    let cursor = 0;

    async function worker() {
        while (true) {
            const i = cursor++;
            if (i >= tasks.length) return;
            try {
                const value = await tasks[i]();
                results[i] = { status: "fulfilled", value };
            } catch (reason) {
                results[i] = { status: "rejected", reason };
            }
        }
    }

    // Spawn min(limit, tasks.length) workers; they pull from the queue.
    const workers = Array.from(
        { length: Math.min(limit, tasks.length) },
        () => worker(),
    );
    await Promise.all(workers);
    return results;
}

// ------------------------------------------------------------
// Public API — execute a batch of tool calls
// ------------------------------------------------------------

export interface RunBatchOptions {
    /** Max in-flight tools. Default: 8. */
    concurrency?: number;
    /** Parent signal for the whole batch (e.g. HTTP request cancelled). */
    signal?: AbortSignal;
}

import { withTimeout } from "./05_timeout";

export async function runToolBatch(
    invocations: ToolInvocation[],
    perToolTimeoutMs: number,
    opts: RunBatchOptions = {},
): Promise<ToolResult[]> {
    const { concurrency = 8, signal: parentSignal } = opts;

    // Fast-fail if the whole batch was already cancelled.
    if (parentSignal?.aborted) {
        return invocations.map<ToolResult>((inv) => ({
            toolCallId: inv.toolCallId,
            name: inv.name,
            ok: false,
            output: "",
            latencyMs: 0,
            error: { kind: "aborted", message: "batch aborted before start" },
        }));
    }

    const tasks = invocations.map((inv) => async (): Promise<ToolResult> => {
        const started = Date.now();
        try {
            // Each tool gets its own AbortController linked to the parent
            // AND armed with an independent timeout — see 05_timeout.ts.
            const raw = await withTimeout(
                (childSignal) => inv.execute(childSignal),
                perToolTimeoutMs,
                parentSignal,
            );
            return {
                toolCallId: inv.toolCallId,
                name: inv.name,
                ok: true,
                output: serializeForModel(raw),
                latencyMs: Date.now() - started,
            };
        } catch (e) {
            const err = e as Error & { name?: string };
            return {
                toolCallId: inv.toolCallId,
                name: inv.name,
                ok: false,
                output: "",
                latencyMs: Date.now() - started,
                error: {
                    kind: err.name === "AbortError" ? "timeout" : "exception",
                    message: err.message ?? String(err),
                },
            };
        }
    });

    // Even though each task catches its own errors, run under allSettled
    // as a safety net. `results[i].status` is always "fulfilled" here
    // because our tasks never throw — but this defends against a future
    // refactor accidentally letting an exception escape.
    const settled = await withConcurrency(tasks, concurrency);

    return settled.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        const inv = invocations[i];
        return {
            toolCallId: inv.toolCallId,
            name: inv.name,
            ok: false,
            output: "",
            latencyMs: 0,
            error: { kind: "internal", message: String(r.reason) },
        };
    });
}

/**
 * The LLM only reads strings. Objects/arrays get JSON.stringified.
 * We also cap output size to avoid blowing up the context window.
 */
function serializeForModel(value: unknown, maxChars = 8_000): string {
    let s: string;
    if (typeof value === "string") s = value;
    else {
        try {
            s = JSON.stringify(value);
        } catch {
            s = String(value);
        }
    }
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars) + `\n…[truncated ${s.length - maxChars} chars]`;
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const sleep = (ms: number, signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
            const t = setTimeout(resolve, ms);
            signal?.addEventListener("abort", () => {
                clearTimeout(t);
                reject(new DOMException("aborted", "AbortError"));
            });
        });

    const invocations: ToolInvocation[] = [
        {
            toolCallId: "c1",
            name: "fast_ok",
            execute: async () => ({ v: 1 }),
        },
        {
            toolCallId: "c2",
            name: "slow_ok",
            execute: async (signal) => {
                await sleep(50, signal);
                return "done";
            },
        },
        {
            toolCallId: "c3",
            name: "boom",
            execute: async () => {
                throw new Error("kaboom");
            },
        },
        {
            toolCallId: "c4",
            name: "will_timeout",
            execute: async (signal) => {
                await sleep(5_000, signal);
                return "never";
            },
        },
    ];

    runToolBatch(invocations, /* per-tool timeout */ 200).then((results) => {
        console.log(results);
    });
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why cap concurrency inside the agent instead of at the tool?
 *     A: The AGENT sees the whole batch. A tool doesn't know it's
 *        one of 20 concurrent calls. Also, some tools share resources
 *        (a rate-limited API key). Enforcing at the batch level is
 *        the simplest correct place. Per-tool caps can still exist
 *        inside the tool via a semaphore.
 *
 *  Q: What if two tools *depend* on each other (search → summarize)?
 *     A: That's a DAG, not a batch. The model should chain them in
 *        two turns: it calls search, gets results, then calls
 *        summarize. Tool graphs *inside* one call are a rabbit hole
 *        (see LangGraph). Interview-safe answer: multi-turn.
 *
 *  Q: How would you add retries for transient errors?
 *     A: Wrap `inv.execute` with an exponential-backoff retry, but
 *        ONLY for classifiable transient errors (5xx, ECONNRESET).
 *        Retries + AbortController = link signals correctly so a
 *        cancelled parent kills mid-backoff sleep.
 *
 *  Q: Ordering guarantees?
 *     A: `results[i]` corresponds to `invocations[i]`. We rely on
 *        `withConcurrency` writing into an index-keyed array.
 *        Never rely on Promise resolution order — it's non-deterministic.
 */

/**
 * ============================================================
 *  Orchestrator — end-to-end agent loop
 * ============================================================
 *
 *  This file ties every concept together into a runnable "mini
 *  agent" that:
 *      1. builds a registry (06)
 *      2. simulates an LLM emitting tool_calls (02)
 *      3. parses + repairs args (02, 03)
 *      4. executes them in parallel with per-tool timeout (04, 05)
 *      5. feeds results back to a fake LLM until "stop"
 *
 *  No network dependency — the LLM is stubbed. Focus is on the
 *  control flow you'd write around any real provider.
 *
 *      npx tsx Agent_system_Design/ToolCalling/orchestrator.ts
 */

import { getWeatherTool, searchWebTool } from "./01_schema";
import {
    parseOpenAI,
    OpenAIRawResponse,
    ParsedAssistantMessage,
    ParsedToolCall,
} from "./02_parsing";
import { runToolBatch, ToolInvocation, ToolResult } from "./04_parallel_execution";
import {
    ToolRegistry,
    InvocationContext,
    traceMiddleware,
} from "./06_registry";

// ------------------------------------------------------------
// 1. Assemble the registry
// ------------------------------------------------------------

const registry = new ToolRegistry();
registry.use(traceMiddleware);

registry.register({
    definition: getWeatherTool,
    handler: async ({ city, unit }) => {
        // Simulate a slow network call
        await new Promise((r) => setTimeout(r, 30));
        return { city, unit: unit ?? "celsius", tempC: 19, sky: "cloudy" };
    },
});

registry.register({
    definition: searchWebTool,
    handler: async ({ query, top_k }) => {
        const k = (top_k as number) ?? 3;
        return Array.from({ length: k }, (_, i) => ({
            title: `Result ${i + 1} for "${query}"`,
            url: `https://example.com/${i + 1}`,
        }));
    },
});

// ------------------------------------------------------------
// 2. Fake LLM. Deterministic, easy to reason about in an interview.
//    Turn 1: emits two parallel tool calls.
//    Turn 2: emits final answer (stop).
// ------------------------------------------------------------

let turn = 0;
async function fakeLLMChat(_history: unknown[]): Promise<OpenAIRawResponse> {
    turn++;
    if (turn === 1) {
        return {
            choices: [
                {
                    finish_reason: "tool_calls",
                    message: {
                        role: "assistant",
                        content: null,
                        tool_calls: [
                            {
                                id: "call_weather",
                                type: "function",
                                function: {
                                    name: "get_weather",
                                    arguments: '{"city":"Seattle","unit":"celsius"}',
                                },
                            },
                            {
                                id: "call_search",
                                type: "function",
                                function: {
                                    // NOTE the trailing comma — demonstrates 03_malformed_json repair
                                    name: "search_web",
                                    arguments: '{"query":"seattle events this weekend","top_k":2,}',
                                },
                            },
                        ],
                    },
                },
            ],
        };
    }
    // Turn 2: final answer
    return {
        choices: [
            {
                finish_reason: "stop",
                message: {
                    role: "assistant",
                    content:
                        "It's 19°C and cloudy in Seattle. Top events this weekend are listed above.",
                    tool_calls: [],
                },
            },
        ],
    };
}

// ------------------------------------------------------------
// 3. The loop
// ------------------------------------------------------------

interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string; // required when role === "tool"
    name?: string;
}

async function agentLoop(userPrompt: string, opts: { maxTurns?: number } = {}) {
    const { maxTurns = 6 } = opts;
    const history: ChatMessage[] = [
        { role: "system", content: "You are a helpful assistant with tools." },
        { role: "user", content: userPrompt },
    ];

    // Parent AbortController for the whole request.
    const requestAbort = new AbortController();
    // Global watchdog: no single request may exceed 30s.
    const watchdog = setTimeout(() => requestAbort.abort("request budget exceeded"), 30_000);

    const ctx: InvocationContext = {
        requestId: `req_${Date.now()}`,
        signal: requestAbort.signal,
        log: (f) => console.log("[log]", JSON.stringify(f)),
    };

    try {
        for (let i = 0; i < maxTurns; i++) {
            const raw = await fakeLLMChat(history);
            const msg: ParsedAssistantMessage = parseOpenAI(raw);

            // Append the assistant turn to history so the next
            // LLM call sees the tool_calls context.
            history.push({
                role: "assistant",
                content: msg.text,
                // In real code we'd also carry the raw tool_calls array.
            });

            if (msg.finishReason === "stop" || msg.toolCalls.length === 0) {
                console.log("\nFINAL ANSWER:\n", msg.text);
                return msg.text;
            }

            if (msg.finishReason === "length") {
                console.warn("Model hit max_tokens; consider retrying with more budget.");
                return msg.text;
            }

            // Convert parsed tool calls into invocations for the batch runner.
            const invocations = msg.toolCalls.map<ToolInvocation>(
                (tc: ParsedToolCall) => ({
                    toolCallId: tc.id,
                    name: tc.name,
                    execute: async (signal) => {
                        const child: InvocationContext = { ...ctx, signal };
                        const res = await registry.invoke(tc.name, tc.args, child);
                        if (!res.ok) {
                            // Throwing puts this into the "rejected" bucket at
                            // the batch runner, but we can also return a
                            // structured error object as the value. Convention
                            // here: throw for rate/auth/schema errors, return
                            // for domain errors. Interviewers appreciate that
                            // you have an explicit policy.
                            throw new Error(`${res.error.kind}: ${res.error.message}`);
                        }
                        return res.value;
                    },
                }),
            );

            const results: ToolResult[] = await runToolBatch(
                invocations,
                /* per-tool timeout */ 5_000,
                { concurrency: 8, signal: requestAbort.signal },
            );

            // Feed each result back to the model with the matching tool_call_id.
            for (const r of results) {
                history.push({
                    role: "tool",
                    tool_call_id: r.toolCallId,
                    name: r.name,
                    content: r.ok
                        ? r.output
                        : JSON.stringify({ error: r.error }),
                });
            }
            console.log("\n[turn", i + 1, "tool results]", results);
        }
        throw new Error(`agent exceeded ${maxTurns} turns without stopping`);
    } finally {
        clearTimeout(watchdog);
    }
}

if (require.main === module) {
    agentLoop("What's the weather in Seattle and what's happening this weekend?")
        .catch((e) => {
            console.error("agent failed:", e);
            process.exitCode = 1;
        });
}

/**
 * READING GUIDE
 * -------------
 *  Read the files in this order:
 *    01_schema.ts             — how a tool describes itself
 *    02_parsing.ts            — how we understand the LLM reply
 *    03_malformed_json.ts     — how we survive broken JSON
 *    05_timeout.ts            — how one tool call bounds itself
 *    04_parallel_execution.ts — how many tool calls run together
 *    06_registry.ts           — how tools are looked up + governed
 *    orchestrator.ts (this)   — how the pieces compose
 *
 *  Each file's bottom section has interview-style follow-up
 *  questions. Rehearse them out loud.
 */
